import { promises as fs } from "node:fs";
import path from "node:path";
import { workspaceDir } from "./db";
import { ensureWorkspaceFiles, persistProjectFile } from "./workspace";
import { scanJsTs, scanPython, scanSecrets } from "./scanner";
import type { ApiIssue } from "./types";

export interface FixOutcome {
  ok: boolean;
  issueId: string;
  appliedToFile?: string;
  beforeLine?: string;
  afterLine?: string;
  verified: boolean;
  message: string;
  usedLLM: boolean;
}

export interface FixResult {
  outcome: FixOutcome;
  updatedIssue?: ApiIssue;
}

function assertInsideWorkspace(id: string, abs: string): void {
  const root = path.resolve(workspaceDir(id)) + path.sep;
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(root)) {
    throw new Error("Refusing to touch a file outside the project workspace.");
  }
}

/** Deterministic patch for xss-innerhtml: switch to textContent + String(). */
function deterministicPatch(source: string, line: number): { target: number; after: string } | null {
  const lines = source.split("\n");
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) return null;
  const original = lines[idx];
  const m = original.match(/([^;]*?\.)innerHTML\s*=\s*(.+)$/);
  if (!m) return null;
  const lhs = m[1];
  const rhs = m[2].replace(/;+\s*$/, "").trim();
  const after = `${lhs}textContent = String(${rhs});`;
  return { target: idx, after };
}

/** Ask the configured LLM (OpenRouter-compatible) for a corrected line. */
function buildPrompt(args: {
  issue: ApiIssue;
  lineText: string;
  before: string;
  after: string;
  language: string;
}): string {
  const { issue, lineText, before, after, language } = args;
  return `You are a senior ${language} security engineer fixing exactly ONE line of code.

ISSUE: ${issue.title}
DETAILS: ${issue.explanation}
WHY: ${issue.whyItMatters}
TYPE: ${issue.detector}

FILE LINE (line ${issue.line}):
\`\`\`
${lineText}
\`\`\`

Context before:
\`\`\`
${before}
\`\`\`

Context after:
\`\`\`
${after}
\`\`\`

Respond with a valid JSON object only (no markdown fences) in this exact shape:
{"replacement": "<the corrected text of the single line, same indentation, no first/backticks>"}
The replacement must stay on one line, keep surrounding meaning, and remove the vulnerability.`;
}

function parseReplacement(content: string): string | null {
  const jsonText = content.replace(/```(?:json)?/g, "").trim();
  const match = jsonText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { replacement?: string };
    const replacement = parsed.replacement?.trim();
    return replacement && replacement.length > 0 && replacement.length <= 5000 ? replacement : null;
  } catch {
    return null;
  }
}

/** Error from a single Gemini attempt; `status` is set when an HTTP response came back. */
class GeminiCallError extends Error {
  status?: number;
  retryable: boolean;

  constructor(message: string, opts: { status?: number; retryable: boolean }) {
    super(message);
    this.name = "GeminiCallError";
    this.status = opts.status;
    this.retryable = opts.retryable;
  }
}

/** Pull the human-readable detail out of a Google error body (no raw JSON soup). */
function geminiErrorDetail(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown; status?: unknown } };
    if (typeof parsed.error?.message === "string") {
      const statusText = typeof parsed.error?.status === "string" ? ` ${parsed.error.status}` : "";
      return `Gemini request failed (${status}${statusText}): ${parsed.error.message}`;
    }
  } catch {
    /* fall through to the trimmed raw body */
  }
  const trimmed = body.replace(/\s+/g, " ").trim().slice(0, 200);
  return `Gemini request failed (${status})${trimmed ? `: ${trimmed}` : ""}`;
}

/**
 * Gemini models to try, in order: the configured/default flash model first,
 * then the lighter free flash-lite model as the overload fallback — and the
 * other way round when the lite model is the configured one.
 */
function geminiModelChain(): string[] {
  const primary = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const chain = [primary, "gemini-3.5-flash-lite", "gemini-flash-latest"].filter(
    (model, idx, all) => all.indexOf(model) === idx,
  );
  return chain.slice(0, 2);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One Gemini attempt against one model. Throws GeminiCallError on failure. */
async function geminiAttempt(
  model: string,
  prompt: string,
  apiKey: string,
  timeoutMs: number,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (error) {
    // Transport failure / timeout — no HTTP status came back. An overloaded
    // service often just hangs or drops, so treat this as transient.
    const detail = error instanceof Error ? error.message : "network error";
    throw new GeminiCallError(`Gemini request failed: ${detail}`, { retryable: true });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Only overload / rate-limit responses are worth retrying; a 400 or an
    // auth error will fail identically every time, so those fail fast.
    const retryable = res.status === 503 || res.status === 429;
    throw new GeminiCallError(geminiErrorDetail(res.status, body), {
      status: res.status,
      retryable,
    });
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return parseReplacement(content);
}

// The fix routes set maxDuration = 60s; keep the whole Gemini chain (retries
// + model fallback) comfortably inside that, leaving headroom for the file
// patch and rescan that follow a successful fix.
const GEMINI_BUDGET_MS = 50_000;
const GEMINI_ATTEMPT_TIMEOUT_MS = 20_000;
const GEMINI_RETRY_BACKOFF_MS = [1_500, 4_000]; // waits before retry 1 and 2, per model

/**
 * Calls Google Gemini to fix the risky line, resilient to free-tier overload:
 * each model gets up to 2 retries with short backoff on 503/429 (or a dropped
 * connection), then the chain falls back to the next model. When everything
 * is exhausted, the thrown message says plainly that the AI service is
 * overloaded and keeps the provider's own detail for the result panel.
 */
async function geminiCorrectLine(
  args: {
    issue: ApiIssue;
    lineText: string;
    before: string;
    after: string;
    language: string;
  },
  apiKey: string,
): Promise<string | null> {
  const prompt = buildPrompt(args);
  const models = geminiModelChain();
  const deadline = Date.now() + GEMINI_BUDGET_MS;
  let lastError: GeminiCallError | null = null;
  let stop = false;

  for (const model of models) {
    if (stop) break;
    for (let attempt = 0; attempt <= GEMINI_RETRY_BACKOFF_MS.length; attempt++) {
      if (attempt > 0) {
        const backoff = GEMINI_RETRY_BACKOFF_MS[attempt - 1];
        if (Date.now() + backoff >= deadline) {
          stop = true;
          break;
        }
        await sleep(backoff);
      }
      const remaining = deadline - Date.now();
      if (remaining <= 1_000) {
        stop = true;
        break;
      }
      try {
        return await geminiAttempt(
          model,
          prompt,
          apiKey,
          Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remaining),
        );
      } catch (error) {
        const callError =
          error instanceof GeminiCallError
            ? error
            : new GeminiCallError(
                `Gemini request failed: ${error instanceof Error ? error.message : "unknown error"}`,
                { retryable: true },
              );
        lastError = callError;
        if (!callError.retryable) throw callError; // 400/auth/etc — fail fast, as before
      }
    }
  }

  // Every model and retry is exhausted (or the time budget ran out).
  if (lastError?.retryable) {
    throw new Error(
      `The AI fix service is overloaded right now, so this fix could not run — please try again in a minute. (${lastError.message}; tried ${models.join(" and ")})`,
    );
  }
  throw lastError ?? new Error("Gemini request failed");
}

/** Calls any OpenAI-compatible endpoint (OpenRouter, etc.). */
async function openaiCorrectLine(args: {
  issue: ApiIssue;
  lineText: string;
  before: string;
  after: string;
  language: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const isOpenRouter = /openrouter/i.test(baseUrl);
  const model = process.env.PROOF_MODEL || (isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini");
  const prompt = buildPrompt(args);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(isOpenRouter ? { "HTTP-Referer": "http://localhost:3000", "X-Title": "ProofCode" } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  return parseReplacement(content);
}

async function llmCorrectLine(
  args: {
    issue: ApiIssue;
    lineText: string;
    before: string;
    after: string;
    language: string;
  },
  userKey?: string | null,
): Promise<string | null> {
  // A key the user supplied for this request wins — heavy AI work runs on
  // their own quota. It is used for this call only and never stored.
  if (userKey) {
    return geminiCorrectLine(args, userKey);
  }
  // Prefer Gemini when configured, otherwise fall back to an OpenAI-compatible provider.
  if (process.env.GEMINI_API_KEY) {
    return geminiCorrectLine(args, process.env.GEMINI_API_KEY);
  }
  return openaiCorrectLine(args);
}

async function rescanDetector(
  id: string,
  relPath: string,
  ext: string,
  detector: string,
  line: number,
): Promise<boolean> {
  try {
    const abs = path.join(workspaceDir(id), relPath);
    const source = await fs.readFile(abs, "utf8");
    const candidates = [...scanJsTs(source, relPath), ...(ext === ".py" ? scanPython(source, relPath) : []), ...scanSecrets(source, relPath)];
    return !candidates.some((c) => c.detector === detector && c.line === line);
  } catch {
    return false;
  }
}

/** Attempts a real fix for one issue: deterministic patch first, then LLM. */
export async function fixIssue(id: string, issue: ApiIssue, userKey?: string | null): Promise<FixResult> {
  try {
    const abs = path.join(workspaceDir(id), issue.fileName);
    assertInsideWorkspace(id, abs);
    // The workspace may have been wiped by a restart since analysis ran —
    // restore the durable copy instead of failing with ENOENT.
    await ensureWorkspaceFiles(id);
    const source = await fs.readFile(abs, "utf8");
    const sourceLines = source.split("\n");
    const idx = issue.line - 1;
    const lineText = sourceLines[idx] ?? "";

    let replacement: string | null = null;
    let usedLLM = false;

    if (issue.detector === "xss-innerhtml") {
      const patch = deterministicPatch(source, issue.line);
      if (patch) replacement = patch.after;
    }

    if (replacement === null) {
      const before = (sourceLines[idx - 2] ?? "") + "\n" + (sourceLines[idx - 1] ?? "");
      const after = (sourceLines[idx + 1] ?? "") + "\n" + (sourceLines[idx + 2] ?? "");
      try {
        replacement = await llmCorrectLine({
          issue,
          lineText,
          before,
          after,
          language: issue.fileName.endsWith(".py") ? "Python" : "JavaScript/TypeScript",
        }, userKey);
        usedLLM = true;
      } catch (error) {
        replacement = null;
        return {
          outcome: {
            ok: false,
            issueId: issue.id,
            verified: false,
            message: error instanceof Error ? error.message : "LLM fix failed",
            usedLLM: true,
          },
        };
      }
    }

    if (replacement === null || replacement.trim() === lineText.trim()) {
      return {
        outcome: {
          ok: false,
          issueId: issue.id,
          verified: false,
          message: issuedUnfixableMessage(issue),
          usedLLM,
        },
      };
    }

    sourceLines[idx] = replacement;
    const patched = sourceLines.join("\n");
    await fs.writeFile(abs, patched, "utf8");
    // Keep the durable copy in step with the disk, so a verify/rescan after
    // a restart sees the patched content, not the pre-fix original.
    await persistProjectFile(id, issue.fileName, patched);

    // rescanDetector resolves true when the detector NO LONGER fires on the
    // patched line — i.e. the fix is verified clean.
    const noLongerFlagged = await rescanDetector(
      id,
      issue.fileName,
      path.extname(issue.fileName),
      issue.detector,
      issue.line,
    );

    const updatedIssue: ApiIssue = {
      ...issue,
      status: "fixed",
      before: lineText,
      after: replacement,
    };

    return {
      outcome: {
        ok: true,
        issueId: issue.id,
        appliedToFile: issue.fileName,
        beforeLine: lineText,
        afterLine: replacement,
        verified: noLongerFlagged,
        message: noLongerFlagged
          ? "Patch applied and the line no longer trips its detector."
          : "Patch applied. Re-scan still flags this line — the fix may need a wider edit.",
        usedLLM,
      },
      updatedIssue,
    };
  } catch (error) {
    return {
      outcome: {
        ok: false,
        issueId: issue.id,
        verified: false,
        message: error instanceof Error ? error.message : "Could not apply a fix",
        usedLLM: false,
      },
    };
  }
}

function issuedUnfixableMessage(issue: ApiIssue): string {
  if (issue.fixAvailable === "auto") return "No safe automatic patch was found for this exact line.";
  if (issue.fixAvailable === "llm") {
    return "This finding needs an AI fix, but no AI key is available. Add your own free Gemini key in Settings, or fix it manually.";
  }
  return "This finding cannot be auto-fixed (rotate the secret manually, or adjust the code by hand).";
}

/** Resolve the absolute path helper used by callers that need to re-read files. */
export function resolveWorkspaceFile(id: string, relPath: string): string {
  const abs = path.join(workspaceDir(id), relPath);
  assertInsideWorkspace(id, abs);
  return abs;
}