"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  getStoredUserKey,
  guestFix,
  type GuestFixResult,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { label: "JavaScript", fileName: "code.js" },
  { label: "TypeScript", fileName: "code.ts" },
  { label: "Python", fileName: "code.py" },
] as const;

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-critical/30 bg-critical/15 text-critical",
  high: "border-high/30 bg-high/15 text-high",
  medium: "border-medium/30 bg-medium/15 text-medium",
  low: "border-border bg-muted/50 text-muted-foreground",
};

const TEXTAREA_CLASSES =
  "w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function FixMyCodePage() {
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>(LANGUAGES[0]);
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuestFixResult | null>(null);

  useEffect(() => {
    setHasKey(Boolean(getStoredUserKey()));
  }, []);

  const run = async () => {
    if (!code.trim()) {
      toast.error("Paste your code first");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await guestFix({
        code,
        fileName: language.fileName,
        errorMessage: errorMessage.trim() || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const copyFixed = async () => {
    if (!result?.fixedCode) return;
    try {
      await navigator.clipboard.writeText(result.fixedCode);
      toast.success("Fixed code copied");
    } catch {
      toast.error("Copy failed — select the code and copy it manually");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Fix my code"
        description="Paste broken or risky code. ProofCode scans it for real security problems instantly — and with your own free Gemini key, repairs it for you."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Language</span>
            {LANGUAGES.map((item) => (
              <Button
                key={item.fileName}
                type="button"
                size="sm"
                variant={language.fileName === item.fileName ? "default" : "outline"}
                onClick={() => setLanguage(item)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div>
            <label htmlFor="fix-code" className="text-sm font-medium">
              Your code
            </label>
            <textarea
              id="fix-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={14}
              spellCheck={false}
              placeholder="// Paste the file that is broken or needs a security check…"
              className={cn(TEXTAREA_CLASSES, "mt-2")}
            />
          </div>

          <div>
            <label htmlFor="fix-error" className="text-sm font-medium">
              The error you are seeing <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="fix-error"
              value={errorMessage}
              onChange={(event) => setErrorMessage(event.target.value)}
              rows={3}
              spellCheck={false}
              placeholder="TypeError: Cannot read properties of undefined…"
              className={cn(TEXTAREA_CLASSES, "mt-2")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void run()} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ScanSearch className="size-4" aria-hidden="true" />
              )}
              {busy ? "Working…" : "Scan & fix"}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <KeyRound className="size-3.5" aria-hidden="true" />
              {hasKey
                ? "Your Gemini key is saved in this browser — AI repair is on."
                : "No key saved — you get the scan free; AI repair needs your free key."}
            </p>
          </div>

          {error && (
            <p className="text-sm text-critical" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            Guest mode stores nothing: your code is scanned in memory and
            forgotten, and nothing is saved on the server. Your key never
            leaves this browser except to call Google for your repair.
          </p>
        </CardContent>
      </Card>

      {result && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5">
              <p className="font-mono text-2xl font-semibold tabular-nums">
                <span
                  className={cn(
                    result.health >= 90
                      ? "text-verify"
                      : result.health >= 75
                        ? "text-medium"
                        : "text-critical",
                  )}
                >
                  {result.health}
                </span>
                <span className="text-muted-foreground">/100</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {result.issues.length === 0
                  ? "No security problems found in this file."
                  : `${result.issues.length} problem${result.issues.length === 1 ? "" : "s"} found`}
              </p>
            </CardContent>
          </Card>

          {result.issues.length > 0 && (
            <Card>
              <CardContent className="flex flex-col p-5">
                {result.issues.map((issue, index) => (
                  <div
                    key={`${issue.detector}-${issue.line}-${index}`}
                    className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-border/60 py-3 last:border-b-0"
                  >
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                        SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.low,
                      )}
                    >
                      {issue.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {issue.title}{" "}
                        <span className="font-normal text-muted-foreground">
                          · line {issue.line}
                        </span>
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {issue.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result.aiFix === "needs-key" && (
            <Card>
              <CardContent className="flex flex-col gap-3 p-5">
                <h2 className="text-sm font-semibold">
                  Want the repaired version?
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The scan above is free. For an AI-repaired version of your
                  file, add your own free Gemini key — it stays in your
                  browser, is sent only with your fix requests, and is never
                  stored on our server.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/settings">Add your key in Settings</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <a
                      href="https://aistudio.google.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get a free key — Google AI Studio
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {result.aiFix === "failed" && (
            <Card>
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold">AI repair failed</h2>
                <p className="mt-2 text-sm leading-relaxed text-critical" role="alert">
                  {result.aiError ?? "The AI provider could not complete the fix."}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Check that the key saved in{" "}
                  <Link href="/settings" className="font-medium text-foreground underline-offset-2 hover:underline">
                    Settings
                  </Link>{" "}
                  is a valid Gemini key, then try again. Your scan results
                  above are unaffected.
                </p>
              </CardContent>
            </Card>
          )}

          {result.aiFix === "done" && result.fixedCode && (
            <Card>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Repaired code</h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyFixed()}>
                    <Copy className="size-4" aria-hidden="true" />
                    Copy fixed code
                  </Button>
                </div>
                {result.summary && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {result.summary}
                  </p>
                )}
                <pre className="max-h-[480px] overflow-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                  {result.fixedCode}
                </pre>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Always review AI changes before shipping them — run your own
                  tests on the repaired file.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
