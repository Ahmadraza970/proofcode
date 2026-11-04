"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  FileCode2,
  Flame,
  Lightbulb,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FixPanel } from "@/components/fix/FixPanel";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { ErrorState } from "@/components/shared/ErrorState";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import { useProof } from "@/lib/store";

/** Finds the offending line in a BEFORE snippet for a light highlight. */
function dangerLine(code: string): number[] {
  const markers = /unsafe|dangerous|may throw|swallowed|no timeout|unvalidated|appears unused/g;
  const lines = code.split("\n");
  const index = lines.findIndex((line) => markers.test(line));
  return index >= 0 ? [index + 1] : [];
}

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "snapcart-api";
  const { state, getProject, getIssue, startFix, completeFix, dismissIssue } =
    useProof();
  const router = useRouter();

  const issue = useMemo(
    () => getIssue(projectId, params.id),
    [getIssue, projectId, params.id],
  );
  const project = getProject(projectId);

  const fixing = state.fixJob?.status === "running" && issue?.status === "fixing";

  const handleGenerateFix = useCallback(() => {
    if (!project || !issue) return;
    startFix(project.id, issue.id);
  }, [project, issue, startFix]);

  const handleCompleteFix = useCallback(() => {
    if (!project || !issue) return;
    completeFix(project.id, issue.id);
    router.push("/verify");
  }, [project, issue, completeFix, router]);

  const handleDismiss = useCallback(() => {
    if (!project || !issue) return;
    dismissIssue(project.id, issue.id);
    toast("Issue dismissed.", {
      description: "It is removed from the report but kept in project history.",
    });
    router.push(`/report/${project.id}`);
  }, [project, issue, dismissIssue, router]);

  if (!project || !issue) {
    return (
      <ErrorState
        title="Issue not found"
        description="The issue you opened does not exist or belongs to a different report."
      >
        <Button asChild>
          <Link href="/projects">All projects</Link>
        </Button>
      </ErrorState>
    );
  }

  const isFixed = issue.status === "fixed";

  return (
    <div className="flex flex-col gap-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 mb-2 w-fit text-muted-foreground"
      >
        <Link href={`/report/${project.id}`}>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to {project.name} report
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {issue.category}
        </span>
        <SeverityBadge severity={issue.severity} className="uppercase" />
        {isFixed && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-verify/30 bg-verify-dim px-2.5 py-1 text-xs font-medium text-verify">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Fixed
          </span>
        )}
      </div>

      <PageHeading issue={issue} />

      {isFixed ? (
        <Card className="border-verify/30 bg-verify-dim/30">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-verify">
                <ShieldCheck className="size-5" aria-hidden="true" />
                Fix applied & verified
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This issue was resolved and its regression test passed.
              </p>
            </div>
            <Button asChild>
              <Link href="/verify">View Verification</Link>
            </Button>
          </CardContent>
        </Card>
      ) : fixing ? (
        <>
          <FixPanel onComplete={handleCompleteFix} />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="size-4 text-brand" aria-hidden="true" />
            Keep this window open — the fix is applied and verified automatically.
          </p>
        </>
      ) : (
        <>
          {/* Explanation */}
          <Card>
            <CardContent className="grid gap-6 p-6 md:grid-cols-2">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Lightbulb className="size-4 text-brand" aria-hidden="true" />
                  What&apos;s going on
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {issue.explanation}
                </p>

                <h2 className="mt-6 flex items-center gap-2 font-semibold">
                  <Flame className="size-4 text-high" aria-hidden="true" />
                  Why it matters
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {issue.whyItMatters}
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="font-mono text-xs text-muted-foreground">
                    {issue.fileName}
                    <span className="mx-1 text-border">:</span>
                    <span className="text-foreground">{issue.line}</span>
                  </p>
                </div>
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium">Recommended Fix</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Replace the inline query with a parameterized statement and
                      validate the id before it ever reaches the database. A
                      regression test is generated alongside the patch.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Diff */}
          <section aria-label="Proposed diff">
            <div className="grid gap-4 lg:grid-cols-2">
              <CodeBlock
                code={issue.before}
                header="Before"
                highlightLines={dangerLine(issue.before)}
              />
              <CodeBlock code={issue.after} header="After" />
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-11 flex-1 px-6" onClick={handleGenerateFix}>
              <Wrench className="size-4" aria-hidden="true" />
              Generate Fix
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-6" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        </>
      )}

      <div className="border-t border-border pt-6">
        <WorkflowStrip current={isFixed ? 6 : 3} />
      </div>
    </div>
  );
}

function PageHeading({ issue }: { issue: { title: string; fileName: string; line: number } }) {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        <FileCode2 className="hidden size-6 text-brand sm:block" aria-hidden="true" />
        {issue.title}
      </h1>
      <p className="mt-1 font-mono text-sm text-muted-foreground">
        {issue.fileName}:{issue.line}
      </p>
    </div>
  );
}