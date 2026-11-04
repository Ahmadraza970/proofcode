import { NextResponse } from "next/server";
import { findProject, updateProject, computeHealth } from "@/lib/api/db";
import { requireAuth, jsonError } from "@/lib/api/auth";
import { fixIssue } from "@/lib/api/fixer";
import { computeScores } from "@/lib/api/verify";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ issueId: string }> },
): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const { issueId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { projectId?: string };
  if (!body.projectId) return jsonError("Provide a `projectId`.");

  const project = await findProject(body.projectId);
  if (!project) return jsonError("Unknown projectId", 404);
  const issue = project.issues.find((i) => i.id === issueId);
  if (!issue) return jsonError("Unknown issueId", 404);
  if (issue.status !== "open") return jsonError(`Issue is already ${issue.status}.`);

  const result = await fixIssue(project.id, issue);

  if (result.outcome.ok && result.updatedIssue) {
    const issues = project.issues.map((i) => (i.id === issueId ? result.updatedIssue! : i));
    const healthAfter = computeHealth(issues.filter((i) => i.status === "open"));
    await updateProject(project.id, {
      issues,
      healthAfter,
      health: healthAfter,
      scores: computeScores({ ...project, issues }),
    });
  }

  return NextResponse.json({ ok: result.outcome.ok, outcome: result.outcome });
}