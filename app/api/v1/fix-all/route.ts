import { NextResponse } from "next/server";
import { findProject, updateProject, computeHealth } from "@/lib/api/db";
import { requireAuth, jsonError } from "@/lib/api/auth";
import { fixIssue } from "@/lib/api/fixer";
import { computeScores } from "@/lib/api/verify";
import {
  clientIp,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const limit = rateLimit(`fix-all:${clientIp(request)}`, 10);
  if (!limit.ok) return rateLimitedResponse(limit);

  try {
    const body = (await request.json().catch(() => ({}))) as { projectId?: string };
    if (!body.projectId) return jsonError("Provide a `projectId`.");

    const project = await findProject(body.projectId);
    if (!project) return jsonError("Unknown projectId", 404);

    const open = project.issues.filter((i) => i.status === "open");
    if (open.length === 0) return jsonError("There are no open issues to fix on this project.");

    const userKey = request.headers.get("x-user-llm-key")?.trim() || null;
    const outcomes = [];
    let issues = [...project.issues];

    for (const issue of open) {
      const result = await fixIssue(project.id, issue, userKey);
      if (result.outcome.ok && result.updatedIssue) {
        issues = issues.map((i) => (i.id === issue.id ? result.updatedIssue! : i));
      }
      outcomes.push({ id: issue.id, ok: result.outcome.ok, verified: result.outcome.verified, usedLLM: result.outcome.usedLLM, message: result.outcome.message });
    }

    const healthAfter = computeHealth(issues.filter((i) => i.status === "open"));
    await updateProject(project.id, {
      issues,
      health: healthAfter,
      healthAfter,
      scores: computeScores({ ...project, issues }),
    });

    return NextResponse.json({ ok: true, fixed: outcomes.filter((o) => o.ok).length, failed: outcomes.filter((o) => !o.ok).length, outcomes });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Fix-all failed", 500);
  }
}
