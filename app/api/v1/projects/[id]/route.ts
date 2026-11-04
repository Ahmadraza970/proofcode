import { NextResponse } from "next/server";
import { findProject, deleteProject, workspaceDir } from "@/lib/api/db";
import { promises as fs } from "node:fs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const project = await findProject(id);
  if (!project) return NextResponse.json({ error: "Unknown project", id }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const removed = await deleteProject(id);
  if (!removed) return NextResponse.json({ error: "Unknown project", id }, { status: 404 });
  await fs.rm(workspaceDir(id), { recursive: true, force: true });
  return NextResponse.json({ ok: true, deleted: id });
}