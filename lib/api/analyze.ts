import { promises as fs } from "node:fs";
import path from "node:path";
import { workspaceDir, createProject, updateProject, computeHealth } from "./db";
import { scanWorkspace } from "./scanner";
import { cloneRepo, unzipUpload } from "./workspace";
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

/** Creates the project record (status: pending) before source is on disk. */
export async function provisionProject(source: SourceSpec): Promise<ApiProject> {
  const name = deriveName(source);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  const id = slug ? `${slug}-${Date.now().toString(36)}` : Date.now().toString(36);
  const project: ApiProject = {
    id,
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

  try {
    if (project.source === "url" && project.url) {
      await cloneRepo(id, project.url);
    } else if (project.source === "upload") {
      const dir = workspaceDir(id);
      const zipPath = path.join(dir, "payload.zip");
      const buffer = await fs.readFile(zipPath);
      await unzipUpload(id, buffer);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch source";
    return (await updateProject(id, { status: "error", error: msg }))!;
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
    history: [],
  };
  return (await updateProject(id, analyzed))!;
}