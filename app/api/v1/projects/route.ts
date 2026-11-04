import { NextResponse } from "next/server";
import { listProjects } from "@/lib/api/db";
import { provisionProject, stageUpload } from "@/lib/api/analyze";
import { jsonError } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const projects = (await listProjects()).map((p) => ({
    id: p.id,
    name: p.name,
    source: p.source,
    language: p.language,
    status: p.status,
    health: p.health,
    healthAfter: p.healthAfter,
    fileCount: p.fileCount,
    createdAt: p.createdAt,
    lastAnalyzed: p.lastAnalyzed,
    issueCount: p.issues.filter((i) => i.status === "open").length,
  }));
  return NextResponse.json({ projects });
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { url?: string };
      const url = body.url?.trim();
      if (!url) return jsonError("Provide a `url` (https git repo) to analyze.");
      if (!/^https:\/\//i.test(url)) return jsonError("Only public https git URLs are supported.");
      const project = await provisionProject({ kind: "url", url });
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return jsonError("Upload a .zip archive in the `file` field.");
      if (!file.name.toLowerCase().endsWith(".zip")) return jsonError("The uploaded file must be a .zip archive.");
      if (file.size > 40 * 1024 * 1024) return jsonError("Archive is larger than the 40 MB limit.");
      const project = await provisionProject({ kind: "upload", file: new ArrayBuffer(0) });
      const buffer = Buffer.from(await file.arrayBuffer());
      await stageUpload(project.id, buffer);
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    return jsonError("Send either `application/json` with a `url`, or `multipart/form-data` with a `file` (.zip).");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create the project", 500);
  }
}