import { NextResponse } from "next/server";
import { findProject, updateProject } from "@/lib/api/db";
import { requireAuth, jsonError } from "@/lib/api/auth";
import { verifyProject } from "@/lib/api/verify";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const body = (await request.json().catch(() => ({}))) as { projectId?: string };
  if (!body.projectId) return jsonError("Provide a `projectId`.");

  const project = await findProject(body.projectId);
  if (!project) return jsonError("Unknown projectId", 404);

  const outcome = await verifyProject(project);
  const history = [...(project.history ?? []), outcome.snapshot];

  await updateProject(project.id, {
    tests: outcome.tests,
    history,
    health: outcome.healthAfter,
    healthAfter: outcome.healthAfter,
  });

  return NextResponse.json({ ok: true, result: outcome.result, snapshot: outcome.snapshot, tests: outcome.tests });
}