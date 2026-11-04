"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileCode2,
  Flame,
  Lightbulb,
  Loader2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { ErrorState } from "@/components/shared/ErrorState";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import {
  getProjectLive,
  listFullProjects,
  type ApiProject,
} from "@/lib/api/client";
import type { ApiIssue } from "@/lib/api/types";

interface Located {
  project: ApiProject;
  issue: ApiIssue;
}

function IssueDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectHint = searchParams.get("project");

  const [located, setLocated] = useState<Located | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fast path: the linking page usually knows the owning project.
        if (projectHint) {
          try {
            const project = await getProjectLive(projectHint);
            const issue = project.issues.find((i) => i.id === params.id);
            if (issue) {
              if (!cancelled) setLocated({ project, issue });
              return;
            }
          } catch {
            // Fall through to the full scan of projects.
          }
        }
        const projects = await listFullProjects();
        for (const project of projects) {
          const issue = project.issues.find((i) => i.id === params.id);
          if (issue) {
            if (!cancelled) setLocated({ project, issue });
            return;
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the issue");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, projectHint]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-3 py-24 text-muted-foreground"
        aria-busy="true"
      >
        <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm">Loading issue…</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState title="Could not load this issue" description={error}>
        <Button asChild>
          <Link href="/projects">All projects</Link>
        </Button>
      </ErrorState>
    );
  }

  if (!located) {
    return (
      <ErrorState
        title="Issue not found"
        description="The issue you opened does not exist in any analyzed project."
      >
        <Button asChild>
          <Link href="/projects">All projects</Link>
        </Button>
      </ErrorState>
    );
  }

  const { project, issue } = located;
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

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <FileCode2 className="hidden size-6 text-brand sm:block" aria-hidden="true" />
          {issue.title}
        </h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {issue.fileName}:{issue.line}
        </p>
      </div>

      {isFixed ? (
        <Card className="border-verify/30 bg-verify-dim/30">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-verify">
                <ShieldCheck className="size-5" aria-hidden="true" />
                Fix applied
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This issue was resolved in the project workspace. Run a
                verification from the report to record the result.
              </p>
            </div>
            <Button asChild>
              <Link href={`/verify?live=${project.id}`}>View Verification</Link>
            </Button>
          </CardContent>
        </Card>
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
                      {issue.fixSuggested ??
                        (issue.fixAvailable === "auto"
                          ? "A deterministic patch is available for this finding — apply it from the project report and ProofCode will re-scan the line to confirm."
                          : issue.fixAvailable === "llm"
                            ? "An AI-assisted fix is available for this finding — apply it from the project report and ProofCode will re-scan the line to confirm."
                            : "This finding has no automatic fix. Adjust the code by hand, then re-run the analysis from the project report.")}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Code, when recorded */}
          {issue.before && (
            <section aria-label="Flagged code">
              <div className="grid gap-4 lg:grid-cols-2">
                <CodeBlock code={issue.before} header="Flagged line" highlightLines={[1]} />
                {issue.after && <CodeBlock code={issue.after} header="After fix" />}
              </div>
            </section>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 flex-1 px-6">
              <Link href={`/report/${project.id}`}>
                <Wrench className="size-4" aria-hidden="true" />
                Fix this in the project report
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6">
              <Link href={`/projects/${project.id}`}>Project detail</Link>
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

export default function IssueDetailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center gap-3 py-24 text-muted-foreground"
          aria-busy="true"
        >
          <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm">Loading issue…</p>
        </div>
      }
    >
      <IssueDetailContent />
    </Suspense>
  );
}
