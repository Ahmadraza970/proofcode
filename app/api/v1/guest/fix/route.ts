import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/auth";
import { computeHealth, makeIssue, type IssueInput } from "@/lib/api/db";
import { llmFixCode } from "@/lib/api/fixer";
import { scanJsTs, scanPython, scanSecrets } from "@/lib/api/scanner";
import {
  clientIp,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";
import type { ApiIssue, Severity } from "@/lib/api/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Guest mode ("Fix my code") — deliberately stateless and unauthenticated:
 * one pasted file is scanned in memory and, when the visitor supplied their
 * own AI key, repaired by the AI in the same request. Nothing is written to
 * the database or the workspace, no code is executed, and the server's own
 * AI key is never spent on guest requests.
 */

const MAX_CODE_CHARS = 60_000;
const MAX_ERROR_CHARS = 4_000;
const MAX_USER_KEY_CHARS = 300;
const ALLOWED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
]);

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function POST(request: Request): Promise<Response> {
  const limit = rateLimit(`guest-fix:${clientIp(request)}`, 5);
  if (!limit.ok) return rateLimitedResponse(limit);

  try {
    const body = (await request.json().catch(() => null)) as {
      code?: unknown;
      fileName?: unknown;
      errorMessage?: unknown;
    } | null;

    if (!body || typeof body.code !== "string" || body.code.trim().length === 0) {
      return jsonError("Paste the code you want checked.");
    }
    if (body.code.length > MAX_CODE_CHARS) {
      return jsonError(
        `That file is too large for guest mode (max ${MAX_CODE_CHARS.toLocaleString()} characters). Sign in with a workspace for full projects.`,
      );
    }
    const errorMessage =
      typeof body.errorMessage === "string"
        ? body.errorMessage.slice(0, MAX_ERROR_CHARS)
        : "";

    let fileName =
      typeof body.fileName === "string"
        ? (body.fileName.split(/[\\/]/).pop() ?? "").trim()
        : "";
    let ext = fileName.includes(".")
      ? `.${fileName.split(".").pop()!.toLowerCase()}`
      : "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      fileName = "code.js";
      ext = ".js";
    }

    const candidates: IssueInput[] =
      ext === ".py"
        ? [
            ...scanPython(body.code, fileName),
            ...scanSecrets(body.code, fileName),
          ]
        : [
            ...scanJsTs(body.code, fileName),
            ...scanSecrets(body.code, fileName),
          ];

    const seen = new Set<string>();
    const issues: ApiIssue[] = [];
    for (const candidate of candidates) {
      const key = `${candidate.detector}@${candidate.line}@${candidate.fileName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push(makeIssue(candidate));
    }
    issues.sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.line - b.line,
    );
    const health = computeHealth(issues);

    const userKey = (request.headers.get("x-user-llm-key") ?? "")
      .trim()
      .slice(0, MAX_USER_KEY_CHARS);

    let aiFix: "done" | "needs-key" | "failed" = "needs-key";
    let fixedCode: string | null = null;
    let summary: string | null = null;
    let aiError: string | null = null;

    if (userKey) {
      try {
        const result = await llmFixCode({
          code: body.code,
          fileName,
          errorMessage,
          issues,
          apiKey: userKey,
        });
        fixedCode = result.fixedCode;
        summary = result.summary;
        aiFix = "done";
      } catch (error) {
        aiFix = "failed";
        aiError =
          error instanceof Error ? error.message : "The AI fix failed.";
      }
    }

    return NextResponse.json({
      ok: true,
      health,
      issues: issues.map((issue) => ({
        detector: issue.detector,
        severity: issue.severity,
        title: issue.title,
        explanation: issue.explanation,
        line: issue.line,
        fileName: issue.fileName,
        fixAvailable: issue.fixAvailable,
      })),
      fixedCode,
      summary,
      aiFix,
      aiError,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Guest fix failed",
      500,
    );
  }
}
