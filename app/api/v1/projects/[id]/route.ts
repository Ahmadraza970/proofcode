import { NextResponse } from "next/server";
import { findProject, deleteProject, workspaceDir } from "@/lib/api/db";
import { jsonError, requireAuth } from "@/lib/api/auth";
import { promises as fs } from "node:fs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const project = await findProject(id);
    if (!project) return NextResponse.json({ error: "Unknown project", id }, { status: 404 });
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
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await context.params;
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
