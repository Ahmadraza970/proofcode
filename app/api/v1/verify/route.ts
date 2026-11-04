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

    // A project whose analysis found nothing scannable carries no health
    // score. Verifying it would mint a fake perfect score from an empty
    // issue list, so the verification is honestly skipped instead.
    if (project.health === null && project.status === "analyzed") {
      return NextResponse.json({
        ok: true,
        result: "skipped",
        reason: "This project was not scanned (no supported code files), so there is nothing to verify yet.",
        snapshot: {
          date: new Date().toISOString(),
          label: "Not scanned — verification skipped",
          health: 0,
          critical: 0,
          high: 0,
          medium: 0,
          result: "skipped",
        },
        tests: [],
      });
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
