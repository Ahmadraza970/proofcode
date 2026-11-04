import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/api/analyze";
import { findProject } from "@/lib/api/db";
import { callerCanAccess, requireCaller, jsonError } from "@/lib/api/auth";
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

  const limit = rateLimit(`analyze:${clientIp(request)}`, 5);
  if (!limit.ok) return rateLimitedResponse(limit);

  try {
    const body = (await request.json().catch(() => ({}))) as { projectId?: string };
    if (!body.projectId) return jsonError("Provide a `projectId`.");
    const exists = await findProject(body.projectId);
    if (!exists || !callerCanAccess(caller, exists)) {
      return jsonError("Unknown projectId", 404);
    }

    const project = await runAnalysis(body.projectId);
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Analysis failed", 500);
  }
}
