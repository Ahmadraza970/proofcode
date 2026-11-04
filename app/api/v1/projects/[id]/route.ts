import { NextResponse } from "next/server";
import { findProject, deleteProject, workspaceDir } from "@/lib/api/db";
import { callerCanAccess, jsonError, requireCaller } from "@/lib/api/auth";
import { promises as fs } from "node:fs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;

  try {
    const { id } = await context.params;
    const project = await findProject(id);
    // A project outside the caller's scope is reported as unknown rather
    // than forbidden, so its existence is not leaked to other users.
    if (!project || !callerCanAccess(caller, project)) {
      return NextResponse.json({ error: "Unknown project", id }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load the project",
      500,
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;

  try {
    const { id } = await context.params;
    const existing = await findProject(id);
    if (!existing || !callerCanAccess(caller, existing)) {
      return NextResponse.json({ error: "Unknown project", id }, { status: 404 });
    }
    const removed = await deleteProject(id);
    if (!removed) return NextResponse.json({ error: "Unknown project", id }, { status: 404 });
    await fs.rm(workspaceDir(id), { recursive: true, force: true });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not delete the project",
      500,
    );
  }
}
