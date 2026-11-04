import { isSupabaseConfigured, supabase } from "./supabase";
import type { ApiProject } from "./types";
import type { NextRequest } from "next/server";

function extractToken(request: NextRequest | Request): string | null {
  const header = request.headers.get("authorization");
  if (header && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, "").trim();
  return request.headers.get("x-api-key");
}

/** The workspace owner's Google account (server-side env, set once). */
function ownerEmail(): string | null {
  const value = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return value ? value : null;
}

/**
 * Who is calling the API. Sign-in is Google-only; there is no API token:
 * - `owner` — signed in with the Google account named by `OWNER_EMAIL`.
 *   Sees and can do everything, including projects created before sign-in
 *   existed (they carry no user stamp).
 * - `user` — any other Google-signed-in user. Sees only the projects
 *   stamped with their own user id.
 */
export type Caller =
  | { kind: "owner"; userId: string; email: string | null }
  | { kind: "user"; userId: string; email: string | null };

/**
 * Resolves the caller from the request's Supabase Auth access token, or
 * null when it does not validate. The token is always checked against the
 * Auth server — never trusted on shape alone.
 */
export async function resolveCaller(
  request: NextRequest | Request,
): Promise<Caller | null> {
  const token = extractToken(request);
  if (!token) return null;
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const email = data.user.email ?? null;
  const owner = ownerEmail();
  if (owner && email && email.toLowerCase() === owner) {
    return { kind: "owner", userId: data.user.id, email };
  }
  return { kind: "user", userId: data.user.id, email };
}

function unauthorized(): Response {
  const message =
    "Missing or invalid credentials. Sign in with Google and send the session token as `Authorization: Bearer <token>` on this request.";
  return new Response(JSON.stringify({ error: "unauthorized", message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Rejects requests that resolve to no caller. Applies to reads and writes.
 * Returns the resolved {@link Caller} on success so routes can scope data.
 */
export async function requireCaller(
  request: NextRequest | Request,
): Promise<Caller | Response> {
  const caller = await resolveCaller(request);
  if (!caller) return unauthorized();
  return caller;
}

/**
 * Per-user scoping: the owner reaches every project; a signed-in user only
 * the ones stamped with their id. Unstamped (legacy) projects are
 * owner-only.
 */
export function callerCanAccess(
  caller: Caller,
  project: Pick<ApiProject, "userId">,
): boolean {
  if (caller.kind === "owner") return true;
  return project.userId !== null && project.userId === caller.userId;
}

/** Filters a project list down to what the caller may see. */
export function scopeProjects<T extends Pick<ApiProject, "userId">>(
  caller: Caller,
  projects: T[],
): T[] {
  if (caller.kind === "owner") return projects;
  return projects.filter((p) => callerCanAccess(caller, p));
}

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
