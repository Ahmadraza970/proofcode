import { NextResponse } from "next/server";
import { findProject, updateProject } from "@/lib/api/db";
import { callerCanAccess, requireCaller, jsonError } from "@/lib/api/auth";
import { verifyProject } from "@/lib/api/verify";
import {
  clientIp,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;

  const limit = rateLimit(`verify:${clientIp(request)}`, 10);
  if (!limit.ok) return rateLimitedResponse(limit);

  try {
    const body = (await request.json().catch(() => ({}))) as { projectId?: string };
    if (!body.projectId) return jsonError("Provide a `projectId`.");

    const project = await findProject(body.projectId);
    if (!project || !callerCanAccess(caller, project)) {
      return jsonError("Unknown projectId", 404);
    }

    const outcome = await verifyProject(project);
    const history = [...(project.history ?? []), outcome.snapshot];

    await updateProject(project.id, {
      tests: outcome.tests,
      history,
      health: outcome.healthAfter,
      healthAfter: outcome.healthAfter,
    });

    return NextResponse.json({ ok: true, result: outcome.result, snapshot: outcome.snapshot, tests: outcome.tests });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Verification failed", 500);
  }
}
