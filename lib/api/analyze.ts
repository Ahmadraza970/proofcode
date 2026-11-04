import { promises as fs } from "node:fs";
import path from "node:path";
import { workspaceDir, createProject, updateProject, computeHealth } from "./db";
import { scanWorkspace } from "./scanner";
import {
  cloneRepo,
  unzipUpload,
  captureProjectFiles,
  ensureWorkspaceFiles,
} from "./workspace";
import { computeScores } from "./verify";
import type { ApiProject } from "./types";

export type SourceSpec = { kind: "url"; url: string } | { kind: "upload"; file: ArrayBuffer };

function deriveName(source: SourceSpec): string {
  if (source.kind === "url") {
    const trimmed = source.url.replace(/\.git$/, "").split("?")[0];
    return trimmed.split("/").filter(Boolean).pop() ?? "project";
  }
  return "uploaded-project";
}

/**
 * Creates the project record (status: pending) before source is on disk.
 * `userId` stamps the creating Supabase Auth user (per-user scoping); the
 * owner-token path passes null, as before.
 */
export async function provisionProject(
  source: SourceSpec,
  userId: string | null = null,
): Promise<ApiProject> {
  const name = deriveName(source);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  const id = slug ? `${slug}-${Date.now().toString(36)}` : Date.now().toString(36);
  const project: ApiProject = {
    id,
    userId,
    name,
    source: source.kind,
    url: source.kind === "url" ? source.url : undefined,
    language: "Analyzing…",
    framework: source.kind === "url" ? "Git" : "Upload",
    createdAt: new Date().toISOString(),
    lastAnalyzed: null,
    health: null,
    healthAfter: null,
    status: "pending",
    fileCount: 0,
    issues: [],
    tests: [],
    scores: [],
    history: [],
  };
  await createProject(project);
  return project;
}

/** Hoists the uploaded ZIP onto disk where the scanner can read it. */
export async function stageUpload(id: string, buffer: Buffer): Promise<void> {
  const dir = workspaceDir(id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "payload.zip"), buffer);
}

/**
 * Pulls the source (git clone for URLs, unzip for uploads) and runs every
 * detector over the workspace. Returns the refreshed project record.
 */
export async function runAnalysis(id: string): Promise<ApiProject> {
  const project = await updateProject(id, { status: "analyzing" });
  if (!project) throw new Error(`Unknown project ${id}`);

  let haveSource = false;
  try {
    if (project.source === "url" && project.url) {
      await cloneRepo(id, project.url);
      haveSource = true;
    } else if (project.source === "upload") {
      const dir = workspaceDir(id);
      const zipPath = path.join(dir, "payload.zip");
      const buffer = await fs.readFile(zipPath);
      await unzipUpload(id, buffer);
      haveSource = true;
    }
  } catch (error) {
    // The workspace is ephemeral: a restart wipes it (payload.zip included),
    // and re-analysis of an upload can no longer re-read the archive. Fall
    // back to the durable file copy before declaring the project broken.
    haveSource = await ensureWorkspaceFiles(id);
    if (!haveSource) {
      const msg = error instanceof Error ? error.message : "Failed to fetch source";
      return (await updateProject(id, { status: "error", error: msg }))!;
    }
  }

  if (haveSource) {
    // Refresh the durable copy from the files now on disk, so a later
    // restart can rehydrate fix / verify from exactly what was scanned.
    await captureProjectFiles(id);
  }

  let summary;
  try {
    summary = await scanWorkspace(id);
  } catch {
    return (await updateProject(id, { status: "error", error: "The scanner could not read the workspace." }))!;
  }

  const health = computeHealth(summary.issues);
  const analyzed: ApiProject = {
    ...project,
    status: "analyzed",
    language: summary.language,
    fileCount: summary.fileCount,
    issues: summary.issues,
    lastAnalyzed: new Date().toISOString(),
    health,
    healthAfter: health,
    scores: computeScores({ ...project, issues: summary.issues }),
    // Preserve snapshots from earlier runs — re-analysis appends to the
    // project's history instead of wiping it.
    history: project.history ?? [],
  };
  return (await updateProject(id, analyzed))!;
}