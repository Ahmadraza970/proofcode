"use client";

import type {
  ApiProject,
  ApiIssue,
  ApiSnapshot,
  ApiTest,
} from "./types";
import { getSessionAccessToken } from "../supabase-browser";

const USER_KEY_STORAGE = "proofcode_user_llm_key";

/**
 * Base URL for the analysis API. When the UI is hosted separately from the
 * engine (e.g. frontend on Vercel, engine on Fly.io), set
 * `NEXT_PUBLIC_API_URL` to the engine's origin. Defaults to same-origin.
 */
const API_BASE = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")
  : ""
).toString();

function withBase(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  // The visitor's own AI key, when they saved one in Settings, rides along so
  // heavy AI work can run on their quota. It lives only in this browser.
  const userKey = getStoredUserKey();
  if (userKey) headers["x-user-llm-key"] = userKey;
  if (options.body !== undefined && !options.formData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(withBase(path), {
    method: options.method ?? "GET",
    headers,
    body: options.formData
      ? options.formData
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    if (data && typeof data === "object" && "error" in data) {
      const err = (data as { error?: unknown }).error;
      if (typeof err === "string" && err.length > 0) message = err;
    }
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export function getStoredUserKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(USER_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function storeUserKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY_STORAGE, key);
}

export function clearUserKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY_STORAGE);
}

/**
 * Resolves the credential API calls should carry: the current Google
 * sign-in session's access token, or null when signed out. ProofCode has
 * no API token any more (removed 2026-11-04) — sign-in is the only way
 * in, and signed-out calls go out without a credential, fail with 401,
 * and the UI shows the sign-in state instead of looping.
 */
export async function ensureToken(): Promise<string | null> {
  return getSessionAccessToken();
}

export type ProjectListItem = {
  id: string;
  name: string;
  source: "url" | "upload";
  language: string;
  status: string;
  health: number | null;
  healthAfter: number | null;
  fileCount: number;
  createdAt: string;
  lastAnalyzed: string | null;
  issueCount: number;
};

export async function ensureAndWrap<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const token = await ensureToken();
      if (token) return request();
    }
    throw error;
  }
}

export async function listProjects(): Promise<{ projects: ProjectListItem[] }> {
  const token = await ensureToken();
  return request<{ projects: ProjectListItem[] }>("/api/v1/projects", { token });
}

export async function getProjectLive(id: string): Promise<ApiProject> {
  const token = await ensureToken();
  return request<ApiProject>(`/api/v1/projects/${id}`, { token });
}

/** Lists project summaries, then fetches each full project record. */
export async function listFullProjects(): Promise<ApiProject[]> {
  const { projects } = await listProjects();
  return Promise.all(projects.map((p) => getProjectLive(p.id)));
}

export async function createProjectFromUrl(url: string): Promise<{ ok: true; project: ApiProject }> {
  const token = await ensureToken();
  return request<{ ok: true; project: ApiProject }>("/api/v1/projects", {
    method: "POST",
    token,
    body: { url },
  });
}

export async function createProjectFromZip(file: File): Promise<{ ok: true; project: ApiProject }> {
  const token = await ensureToken();
  const formData = new FormData();
  formData.append("file", file, file.name);
  return request<{ ok: true; project: ApiProject }>("/api/v1/projects", {
    method: "POST",
    token,
    formData,
  });
}

export function analyzeProject(token: string | null, projectId: string): Promise<{ ok: true; project: ApiProject }> {
  return request<{ ok: true; project: ApiProject }>("/api/v1/analyze", {
    method: "POST",
    token,
    body: { projectId },
  });
}

export interface FixOutcome {
  ok: boolean;
  issueId: string;
  appliedToFile?: string;
  beforeLine?: string;
  afterLine?: string;
  verified: boolean;
  message: string;
  usedLLM: boolean;
}

export function fixIssue(token: string | null, projectId: string, issueId: string): Promise<{ ok: boolean; outcome: FixOutcome; health?: number }> {
  return request<{ ok: boolean; outcome: FixOutcome; health?: number }>(`/api/v1/issues/${issueId}/fix`, {
    method: "POST",
    token,
    body: { projectId },
  });
}

export function fixAll(token: string | null, projectId: string): Promise<{ ok: true; fixed: number; failed: number }> {
  return request<{ ok: true; fixed: number; failed: number }>("/api/v1/fix-all", {
    method: "POST",
    token,
    body: { projectId },
  });
}

export interface VerifyOutcome {
  ok: true;
  result: "verified" | "failed" | "skipped";
  snapshot: ApiSnapshot;
  tests: ApiTest[];
}

export function verifyProjectLive(token: string | null, projectId: string): Promise<VerifyOutcome> {
  return request<VerifyOutcome>("/api/v1/verify", {
    method: "POST",
    token,
    body: { projectId },
  });
}

/**
 * Downloads the project's current files (with every applied fix) as one
 * ZIP. The API authenticates via the `Authorization` header, which a plain
 * anchor cannot send — so this fetches the archive as a blob and saves it
 * through a temporary object URL. Throws ApiError on any failure so the
 * caller can show the reason instead of failing silently.
 */
export async function downloadProjectZip(projectId: string): Promise<void> {
  const token = await ensureToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(withBase(`/api/v1/projects/${projectId}/download`), {
    headers,
  });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const data = (await res.json()) as { error?: unknown; message?: unknown };
      if (typeof data.error === "string" && data.error.length > 0) message = data.error;
      else if (typeof data.message === "string" && data.message.length > 0) message = data.message;
    } catch {
      /* keep the status-based message */
    }
    throw new ApiError(message, res.status);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `proofcode-${projectId}-fixed.zip`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function deleteProjectLive(token: string | null, projectId: string): Promise<{ ok: true; deleted: string }> {
  return request<{ ok: true; deleted: string }>(`/api/v1/projects/${projectId}`, {
    method: "DELETE",
    token,
  });
}

export type { ApiProject, ApiIssue };
