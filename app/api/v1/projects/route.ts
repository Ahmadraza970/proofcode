import { NextResponse } from "next/server";
import { listProjects } from "@/lib/api/db";
import { provisionProject, stageUpload } from "@/lib/api/analyze";
import { jsonError, requireCaller, scopeProjects } from "@/lib/api/auth";
import {
  clientIp,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;

  try {
    const projects = scopeProjects(caller, await listProjects()).map((p) => ({
      id: p.id,
      name: p.name,
      source: p.source,
      language: p.language,
      status: p.status,
      health: p.health,
      healthAfter: p.healthAfter,
      fileCount: p.fileCount,
      createdAt: p.createdAt,
      lastAnalyzed: p.lastAnalyzed,
      issueCount: p.issues.filter((i) => i.status === "open").length,
    }));
    return NextResponse.json({ projects });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not list projects",
      500,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  // Creation is the most expensive endpoint (clone/upload + extraction), so
  // the limiter runs before auth and before any body parsing.
  const limit = rateLimit(`projects:${clientIp(request)}`, 5);
  if (!limit.ok) return rateLimitedResponse(limit);

  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;

  const contentType = request.headers.get("content-type") ?? "";
  // Signed-in users stamp their projects; the owner token leaves them
  // unstamped (owner-only), exactly as before per-user scoping existed.
  const userId = caller.kind === "user" ? caller.userId : null;

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { url?: string };
      const url = body.url?.trim();
      if (!url) return jsonError("Provide a `url` (https git repo) to analyze.");
      if (!/^https:\/\//i.test(url)) return jsonError("Only public https git URLs are supported.");
      const project = await provisionProject({ kind: "url", url }, userId);
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return jsonError("Upload a .zip archive in the `file` field.");
      if (!file.name.toLowerCase().endsWith(".zip")) return jsonError("The uploaded file must be a .zip archive.");
      if (file.size > 40 * 1024 * 1024) return jsonError("Archive is larger than the 40 MB limit.");
      const project = await provisionProject({ kind: "upload", file: new ArrayBuffer(0) }, userId);
      const buffer = Buffer.from(await file.arrayBuffer());
      await stageUpload(project.id, buffer);
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    return jsonError("Send either `application/json` with a `url`, or `multipart/form-data` with a `file` (.zip).");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create the project", 500);
  }
}
