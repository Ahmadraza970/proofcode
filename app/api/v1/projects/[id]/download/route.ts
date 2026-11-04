import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { promises as fs } from "node:fs";
import path from "node:path";
import { findProject, workspaceDir } from "@/lib/api/db";
import { callerCanAccess, jsonError, requireCaller } from "@/lib/api/auth";
import {
  clientIp,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";
import {
  ensureWorkspaceFiles,
  IGNORED_DIRS,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_TOTAL_BYTES,
} from "@/lib/api/workspace";

export const dynamic = "force-dynamic";

interface DownloadFile {
  relPath: string; // POSIX, relative to workspace root
  absPath: string;
  size: number;
}

/** Walks the workspace collecting every real file outside the junk dirs. */
async function collectFiles(root: string): Promise<DownloadFile[]> {
  const files: DownloadFile[] = [];

  async function walk(dir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const relPosix = (rel ? `${rel}/` : "") + entry.name;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(abs, relPosix);
      } else if (entry.isFile()) {
        const stat = await fs.stat(abs).catch(() => null);
        if (!stat) continue;
        files.push({ relPath: relPosix, absPath: abs, size: stat.size });
      }
    }
  }

  await walk(root, "");
  return files;
}

/** `<project name>-fixed.zip`, reduced to header-safe ASCII. */
function downloadFilename(project: { id: string; name: string }): string {
  const base = project.name
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || project.id}-fixed.zip`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;

  // A read, but it assembles an archive — same limiter as the fix routes.
  const limit = rateLimit(`download:${clientIp(request)}`, 10);
  if (!limit.ok) return rateLimitedResponse(limit);

  try {
    const { id } = await context.params;
    const project = await findProject(id);
    // Same scoping as the sibling project route: another user's project is
    // reported as unknown rather than forbidden, so nothing leaks.
    if (!project || !callerCanAccess(caller, project)) {
      return NextResponse.json({ error: "Unknown project", id }, { status: 404 });
    }

    // The on-disk workspace is only a cache and a restart can wipe it —
    // restore the durable copy first, exactly like the fix path does, so
    // the archive holds the project's current (post-fix) files.
    await ensureWorkspaceFiles(id);

    const files = await collectFiles(workspaceDir(id));
    if (files.length === 0) {
      return jsonError("This project has no files available to download.", 404);
    }
    if (files.length > MAX_ZIP_ENTRIES) {
      return jsonError(
        `Project has ${files.length} files; the download limit is ${MAX_ZIP_ENTRIES}.`,
        413,
      );
    }
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_ZIP_TOTAL_BYTES) {
      return jsonError(
        `Project files expand past the ${MAX_ZIP_TOTAL_BYTES / (1024 * 1024)} MB download limit.`,
        413,
      );
    }

    const zip = new AdmZip();
    for (const file of files) {
      zip.addFile(file.relPath, await fs.readFile(file.absPath));
    }
    const buffer = zip.toBuffer();

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${downloadFilename(project)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not build the download",
      500,
    );
  }
}
