"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { CodeBlock } from "@/components/shared/CodeBlock";
import {
  ensureToken,
  fixIssue,
  type ApiIssue,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function LiveIssueRow({
  issue,
  projectId,
  onChanged,
}: {
  issue: ApiIssue;
  projectId: string;
  onChanged: (updated: ApiIssue) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    before?: string;
    after?: string;
    verified?: boolean;
  } | null>(null);

  const handleFix = useCallback(async () => {
    setFixing(true);
    setResult(null);
    try {
      const token = await ensureToken();
      const res = await fixIssue(token, projectId, issue.id);
      setResult({
        ok: res.outcome.ok,
        message: res.outcome.message,
        before: res.outcome.beforeLine ?? issue.before,
        after: res.outcome.afterLine ?? issue.after,
        verified: res.outcome.verified,
      });
      if (res.outcome.ok) {
        toast.success(res.outcome.verified ? "Fix applied and verified." : "Fix applied, but the line still flags.");
        onChanged({ ...issue, status: "fixed", before: res.outcome.beforeLine ?? issue.before, after: res.outcome.afterLine ?? issue.after });
      } else {
        toast.error(res.outcome.message);
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Fix failed" });
      toast.error(err instanceof Error ? err.message : "Fix failed");
    } finally {
      setFixing(false);
    }
  }, [issue, projectId, onChanged]);

  // The result panel is rendered in two places (exactly one at a time):
  // a FAILED fix renders it outside the collapsible details, so the failure
  // can never be missed behind a collapsed row plus a transient toast; a
  // successful fix renders it inside the details — and once the row lands
  // in LiveReport's Fixed group, the stored-lines `fixedPanel` below takes
  // over the same job outside the details.
  const resultPanel = result ? (
    <div
      className={cn(
        "rounded-lg border p-4",
        result.ok ? "border-verify/30 bg-verify-dim/20" : "border-critical/30 bg-critical/10",
      )}
    >
      <p className={cn("text-sm font-medium", result.ok ? "text-verify" : "text-critical")}>
        {result.ok ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Fix {result.verified ? "applied and verified" : "applied"}
          </span>
        ) : (
          "Could not auto-fix"
        )}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
      {result.before && (
        <div className="mt-3">
          <CodeBlock code={result.before} header={`Before ·${issue.fileName}:${issue.line}`} />
        </div>
      )}
      {result.after && (
        <div className="mt-3">
          <CodeBlock code={result.after} header={`Fixed ·${issue.fileName}:${issue.line}`} highlightLines={[1]} />
        </div>
      )}
    </div>
  ) : null;

  // A fixed issue keeps its patch visible. Rows rendered from the store
  // (page reload, fix-all refresh, or the remount into LiveReport's Fixed
  // group right after a successful fix) have no `result` state, so this
  // panel is driven by the before/after lines stored on the issue record
  // itself — and, like the failure panel, it renders OUTSIDE the
  // collapsible details so the patch is seen without expanding anything.
  // Older records may not carry the lines; then no panel is shown (the
  // row's disabled "Fixed" button remains the badge) — nothing is invented.
  const fixedPanel =
    issue.status === "fixed" && !result && (issue.before || issue.after) ? (
      <div className="rounded-lg border border-verify/30 bg-verify-dim/20 p-4">
        <p className="text-sm font-medium text-verify">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Fix applied
          </span>
        </p>
        {issue.before && (
          <div className="mt-3">
            <CodeBlock code={issue.before} header={`Before ·${issue.fileName}:${issue.line}`} />
          </div>
        )}
        {issue.after && (
          <div className="mt-3">
            <CodeBlock code={issue.after} header={`Fixed ·${issue.fileName}:${issue.line}`} highlightLines={[1]} />
          </div>
        )}
      </div>
    ) : null;

  return (
    <Card className="transition-shadow hover:shadow-md hover:shadow-black/5">
      <CardContent className="p-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          aria-expanded={expanded}
          className="flex cursor-pointer flex-wrap items-start justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <h3 className="font-medium tracking-tight">{issue.title}</h3>
          </div>
          <span className="flex items-center gap-2">
            <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              {issue.category}
            </span>
            {expanded ? (
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
        </div>

        <p className="mt-1.5 font-mono text-xs text-muted-foreground">
          {issue.fileName}
          <span className="mx-1 text-border">:</span>
          <span className="text-foreground">{issue.line}</span>
        </p>

        <p className="mt-3 text-sm text-muted-foreground">{issue.explanation}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded((v) => !v)}>
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            Why it matters
          </Button>
          <Button size="sm" onClick={handleFix} disabled={fixing || issue.status === "fixed"}>
            {fixing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Wrench className="size-3.5" aria-hidden="true" />
            )}
            {fixing ? "Fixing…" : issue.status === "fixed" ? "Fixed" : "Fix Issue"}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Why it matters
              </p>
              <p className="mt-1.5 text-sm text-foreground">{issue.whyItMatters}</p>
              {issue.fixSuggested && (
                <p className="mt-3 rounded-md border border-brand/20 bg-brand-dim/40 p-3 text-sm text-foreground">
                  <span className="font-semibold text-brand">Suggested fix: </span>
                  {issue.fixSuggested}
                </p>
              )}
            </div>

            {issue.before && (
              <CodeBlock code={issue.before} header={`before ·${issue.fileName}:${issue.line}`} highlightLines={[1]} />
            )}

            {result && result.ok && resultPanel}
          </div>
        )}

        {result && !result.ok && <div className="mt-4">{resultPanel}</div>}

        {fixedPanel && <div className="mt-4">{fixedPanel}</div>}
      </CardContent>
    </Card>
  );
}
