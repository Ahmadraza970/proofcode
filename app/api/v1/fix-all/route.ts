import { NextResponse } from "next/server";
import { findProject, updateProject, computeHealth } from "@/lib/api/db";
import { requireAuth, jsonError } from "@/lib/api/auth";
import { fixIssue } from "@/lib/api/fixer";
import { computeScores } from "@/lib/api/verify";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const body = (await request.json().catch(() => ({}))) as { projectId?: string };
  if (!body.projectId) return jsonError("Provide a `projectId`.");

  const project = await findProject(body.projectId);
  if (!project) return jsonError("Unknown projectId", 404);

  const open = project.issues.filter((i) => i.status === "open");
  if (open.length === 0) return jsonError("There are no open issues to fix on this project.");

  const outcomes = [];
  let issues = [...project.issues];

  for (const issue of open) {
    const result = await fixIssue(project.id, issue);
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
}