import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import type { ApiProject, ApiIssue, Severity } from "./types";
import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * ProofCode persists to Supabase Postgres.
 *
 * - `proofcode` table: one row per project; scalar columns hold metadata and
 *   the nested `issues` / `tests` / `scores` / `history` arrays are stored as
 *   JSONB (the engine always reads/writes them as whole arrays).
 * - `proofcode_config` table: legacy single-row config store (it held the
 *   old bearer API token; the token was removed on 2026-11-04 in favour of
 *   Google sign-in, and nothing reads it now).
 * - `proofcode_files` table: one row per source file (pid + relative path +
 *   text content) — the durable copy of a project's workspace. The on-disk
 *   workspace is only a cache: hosts restart and redeploy, and stages that
 *   re-read source files (fix / verify) rehydrate from these rows instead of
 *   dying with ENOENT. Arrives with files-migration.sql; every accessor
 *   below degrades silently when the table is absent, exactly like the
 *   `user_id` column did before auth-migration.sql was applied.
 *
 * When Supabase env vars are absent (e.g. `npm run dev` without config), the
 * module falls back to an in-memory store so the app still boots and runs
 * deterministic scans locally.
 */

export interface DbShape {
  version: 1;
  projects: ApiProject[];
  /** Durable file copies, keyed project id → relative path → content. */
  files: Record<string, Record<string, string>>;
}

interface ProjectRow {
  pid: string;
  /** Creator's Supabase Auth user id; null/absent on pre-auth rows. */
  user_id?: string | null;
  name: string;
  source: string;
  url: string | null;
  language: string;
  framework: string;
  created_at: string;
  last_analyzed: string | null;
  health: number | null;
  health_after: number | null;
  status: string;
  error: string | null;
  file_count: number;
  issues: ApiIssue[];
  tests: unknown[];
  scores: unknown[];
  history: unknown[];
}

/** In-memory fallback when Supabase is not configured. */
const mem: DbShape = { version: 1, projects: [], files: {} };

function rowToProject(row: ProjectRow): ApiProject {
  return {
    id: row.pid,
    userId: row.user_id ?? null,
    name: row.name,
    source: (row.source as ApiProject["source"]) ?? "url",
    url: row.url ?? undefined,
    language: row.language,
    framework: row.framework,
    createdAt: row.created_at,
    lastAnalyzed: row.last_analyzed,
    health: row.health,
    healthAfter: row.health_after,
    status: (row.status as ApiProject["status"]) ?? "pending",
    error: row.error ?? undefined,
    fileCount: row.file_count,
    issues: Array.isArray(row.issues) ? row.issues : [],
    tests: Array.isArray(row.tests) ? (row.tests as ApiProject["tests"]) : [],
    scores: Array.isArray(row.scores) ? (row.scores as ApiProject["scores"]) : [],
    history: Array.isArray(row.history)
      ? (row.history as ApiProject["history"])
      : [],
  };
}

function projectToRow(project: ApiProject): Record<string, unknown> {
  const row: Record<string, unknown> = {
    pid: project.id,
    name: project.name,
    source: project.source,
    url: project.url ?? null,
    language: project.language,
    framework: project.framework,
    created_at: project.createdAt,
    last_analyzed: project.lastAnalyzed,
    health: project.health,
    health_after: project.healthAfter,
    status: project.status,
    error: project.error ?? null,
    file_count: project.fileCount,
    issues: project.issues,
    tests: project.tests,
    scores: project.scores,
    history: project.history,
  };
  // The `user_id` column arrives with auth-migration.sql. It is only written
  // when a project actually carries a stamp, so legacy unstamped projects
  // (null) keep reading/writing exactly as before — even against a database
  // where the migration has not been applied yet.
  if (project.userId) row.user_id = project.userId;
  return row;
}

export async function listProjects(): Promise<ApiProject[]> {
  if (!isSupabaseConfigured()) return mem.projects;
  const { data, error } = await supabase
    .from("proofcode")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => rowToProject(r as unknown as ProjectRow));
}

export async function findProject(id: string): Promise<ApiProject | undefined> {
  if (!isSupabaseConfigured()) return mem.projects.find((p) => p.id === id);
  const { data, error } = await supabase
    .from("proofcode")
    .select("*")
    .eq("pid", id)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToProject(data as unknown as ProjectRow);
}

export async function createProject(
  project: ApiProject,
): Promise<ApiProject> {
  if (!isSupabaseConfigured()) {
    mem.projects.unshift(project);
    return project;
  }
  await supabase.from("proofcode").insert(projectToRow(project));
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<ApiProject>,
): Promise<ApiProject | undefined> {
  if (!isSupabaseConfigured()) {
    const idx = mem.projects.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    mem.projects[idx] = { ...mem.projects[idx], ...patch };
    return mem.projects[idx];
  }
  const existing = await findProject(id);
  if (!existing) return undefined;
  const row = projectToRow({ ...existing, ...patch });
  const { data, error } = await supabase
    .from("proofcode")
    .update(row)
    .eq("pid", id)
    .select("*")
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToProject(data as unknown as ProjectRow);
}

interface ProjectFileRow {
  pid: string;
  path: string;
  content: string;
}

/**
 * Replaces a project's whole durable file copy. Best-effort by design: when
 * the `proofcode_files` table has not been created yet (files-migration.sql
 * not applied), the write is skipped silently and the app behaves exactly as
 * it did when workspaces were disk-only.
 */
export async function saveProjectFiles(
  id: string,
  files: Record<string, string>,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    mem.files[id] = { ...files };
    return;
  }
  const rows: ProjectFileRow[] = Object.entries(files).map(
    ([relPath, content]) => ({ pid: id, path: relPath, content }),
  );
  const { error: clearError } = await supabase
    .from("proofcode_files")
    .delete()
    .eq("pid", id);
  if (clearError) return; // table absent (or store down) — disk-only mode
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from("proofcode_files")
      .insert(rows.slice(i, i + 200));
    if (error) return;
  }
}

/** The project's durable file copy, or null when none was ever stored. */
export async function getProjectFiles(
  id: string,
): Promise<Record<string, string> | null> {
  if (!isSupabaseConfigured()) {
    const files = mem.files[id];
    return files && Object.keys(files).length > 0 ? { ...files } : null;
  }
  const { data, error } = await supabase
    .from("proofcode_files")
    .select("path, content")
    .eq("pid", id);
  if (error || !data || data.length === 0) return null;
  const files: Record<string, string> = {};
  for (const row of data as Array<{ path: string; content: string }>) {
    files[row.path] = row.content;
  }
  return files;
}

/** Upserts one file's durable copy (a fix just patched it on disk). */
export async function updateProjectFile(
  id: string,
  relPath: string,
  content: string,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    mem.files[id] = { ...(mem.files[id] ?? {}), [relPath]: content };
    return;
  }
  await supabase.from("proofcode_files").upsert(
    { pid: id, path: relPath, content, updated_at: new Date().toISOString() },
    { onConflict: "pid,path" },
  );
}

/** Removes a project's durable file copy. Part of a real delete. */
export async function deleteProjectFiles(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    delete mem.files[id];
    return;
  }
  await supabase.from("proofcode_files").delete().eq("pid", id);
}

export async function deleteProject(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const next = mem.projects.filter((p) => p.id !== id);
    if (next.length === mem.projects.length) return false;
    mem.projects = next;
    delete mem.files[id];
    return true;
  }
  const before = await findProject(id);
  if (!before) return false;
  // The durable file copy goes with the record — delete means delete.
  await deleteProjectFiles(id);
  const { error } = await supabase.from("proofcode").delete().eq("pid", id);
  return !error;
}

/**
 * Where the checked-out code for a project lives on disk.
 *
 * Uses an env-driven scratch root so the engine runs on hosts with a
 * read-only app bundle (Vercel serverless) or an ephemeral VM (Fly.io).
 * Defaults to the OS temp dir under a `proofcode` namespace, which is
 * writable everywhere.
 */
export function workspaceDir(id: string): string {
  const root = process.env.SCRATCH_DIR ?? path.join(os.tmpdir(), "proofcode");
  return path.join(root, "workspaces", id);
}

export function newProjectId(): string {
  return crypto.randomBytes(6).toString("hex");
}

export interface IssueInput {
  detector: string;
  severity: Severity;
  title: string;
  explanation: string;
  whyItMatters: string;
  fileName: string;
  line: number;
  column: number;
  category: string;
  before?: string;
  after?: string;
  fixAvailable: "auto" | "llm" | "none";
  fixSuggested?: string;
  status?: ApiIssue["status"];
}

export function makeIssue(input: IssueInput): ApiIssue {
  return {
    id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    detector: input.detector,
    severity: input.severity,
    title: input.title,
    explanation: input.explanation,
    whyItMatters: input.whyItMatters,
    fileName: input.fileName,
    line: input.line,
    column: input.column,
    category: input.category,
    status: input.status ?? "open",
    before: input.before,
    after: input.after,
    fixAvailable: input.fixAvailable,
    fixSuggested: input.fixSuggested,
  };
}

export function severityWeight(severity: Severity): number {
  switch (severity) {
    case "critical":
      return 12;
    case "high":
      return 7;
    case "medium":
      return 4;
    case "low":
      return 1;
  }
}

/** Health starts at 100 and loses weight per open (incl. dismissed) issue. */
export function computeHealth(issues: ApiIssue[]): number {
  const penalty = issues.reduce(
    (sum, i) => sum + severityWeight(i.severity),
    0,
  );
  return Math.max(5, 100 - penalty);
}
