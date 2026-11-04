import { promises as fs } from "node:fs";
import path from "node:path";
import { workspaceDir } from "./db";
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

/** Calls Google Gemini (flash) to fix the risky line. */
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
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const prompt = buildPrompt(args);

  const res = await fetch(
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
      signal: AbortSignal.timeout(45_000),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return parseReplacement(content);
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
    await fs.writeFile(abs, sourceLines.join("\n"), "utf8");

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

export interface GuestCodeFix {
  fixedCode: string;
  summary: string;
}

/**
 * Whole-file AI repair for guest mode ("Fix my code"): corrects the pasted
 * error and the scanner findings in one pass. Runs only on the caller's own
 * API key — guest mode never spends the server's key.
 */
export async function llmFixCode(args: {
  code: string;
  fileName: string;
  errorMessage?: string;
  issues: ApiIssue[];
  apiKey: string;
}): Promise<GuestCodeFix> {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const findings = args.issues
    .slice(0, 20)
    .map((i) => `- [${i.severity}] line ${i.line}: ${i.title} — ${i.explanation}`)
    .join("\n");
  const prompt = [
    "You are ProofCode's repair engine. Fix the user's code file.",
    "Rules: correct the pasted error (if any) and every listed security finding; keep all other behaviour identical; do not add features; return the COMPLETE corrected file, not a diff.",
    'Respond with JSON only: {"fixedCode": "<the complete corrected file>", "summary": "<one or two plain sentences on what you changed>"}',
    "",
    `File: ${args.fileName}`,
    args.errorMessage
      ? `Error the user is seeing:\n${args.errorMessage}`
      : "Error the user is seeing: (none pasted)",
    `Security findings from ProofCode's scanner:\n${findings || "- none"}`,
    "",
    "Code:",
    args.code,
  ].join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": args.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The AI provider returned an unreadable response. Try again.");
  let parsed: { fixedCode?: string; summary?: string };
  try {
    parsed = JSON.parse(match[0]) as { fixedCode?: string; summary?: string };
  } catch {
    throw new Error("The AI provider returned an unreadable response. Try again.");
  }
  const fixedCode = parsed.fixedCode?.trim();
  if (!fixedCode || fixedCode.length > 120_000) {
    throw new Error("The AI provider returned an unusable fix. Try again.");
  }
  return { fixedCode, summary: parsed.summary?.trim() || "AI repair applied." };
}

/** Resolve the absolute path helper used by callers that need to re-read files. */
export function resolveWorkspaceFile(id: string, relPath: string): string {
  const abs = path.join(workspaceDir(id), relPath);
  assertInsideWorkspace(id, abs);
  return abs;
}