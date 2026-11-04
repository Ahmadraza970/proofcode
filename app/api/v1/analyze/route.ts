import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/api/analyze";
import { findProject } from "@/lib/api/db";
import { requireAuth, jsonError } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const body = (await request.json().catch(() => ({}))) as { projectId?: string };
  if (!body.projectId) return jsonError("Provide a `projectId`.");
  const exists = await findProject(body.projectId);
  if (!exists) return jsonError("Unknown projectId", 404);

  try {
    const project = await runAnalysis(body.projectId);
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Analysis failed", 500);
  }
}