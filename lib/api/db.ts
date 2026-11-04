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
 * - `proofcode_config` table: single-row store for the app's bearer API token
 *   (this is what `POST /api/v1/keys` returns).
 *
 * When Supabase env vars are absent (e.g. `npm run dev` without config), the
 * module falls back to an in-memory store so the app still boots and runs
 * deterministic scans locally.
 */

export interface DbShape {
  version: 1;
  apiToken: string | null;
  projects: ApiProject[];
}

interface ProjectRow {
  pid: string;
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
const mem: DbShape = { version: 1, apiToken: null, projects: [] };

function rowToProject(row: ProjectRow): ApiProject {
  return {
    id: row.pid,
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
  return {
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
}

/** True when the owner pinned the API token via `PROOFCODE_OWNER_TOKEN`. */
export function isOwnerTokenConfigured(): boolean {
  return Boolean(process.env.PROOFCODE_OWNER_TOKEN?.trim());
}

export async function getApiToken(): Promise<string> {
  // A server-configured owner token wins outright: it is never generated,
  // stored, or rotated by the app.
  const ownerToken = process.env.PROOFCODE_OWNER_TOKEN?.trim();
  if (ownerToken) return ownerToken;
  if (!isSupabaseConfigured()) {
    if (!mem.apiToken) {
      mem.apiToken = `pk_${crypto.randomBytes(24).toString("hex")}`;
    }
    return mem.apiToken;
  }
  const { data, error } = await supabase
    .from("proofcode_config")
    .select("api_token")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    // Fall back to an ephemeral token rather than failing the request.
    return `pk_${crypto.randomBytes(24).toString("hex")}`;
  }
  if (data?.api_token) return data.api_token;
  const token = `pk_${crypto.randomBytes(24).toString("hex")}`;
  await supabase
    .from("proofcode_config")
    .upsert({ id: 1, api_token: token, updated_at: new Date().toISOString() });
  return token;
}

export async function verifyToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const expected = await getApiToken();
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
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

export async function deleteProject(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const next = mem.projects.filter((p) => p.id !== id);
    if (next.length === mem.projects.length) return false;
    mem.projects = next;
    return true;
  }
  const before = await findProject(id);
  if (!before) return false;
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
