"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  FileCode2,
  FlaskConical,
  GitCompareArrows,
  History,
  LayoutDashboard,
  Loader2,
  MinusCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { HealthRing } from "@/components/shared/HealthRing";
import { IssueCard } from "@/components/report/IssueCard";
import { SnapshotRow } from "@/components/report/SnapshotRow";
import {
  ApiError,
  getProjectLive,
  type ApiProject,
} from "@/lib/api/client";
import type { ApiIssue } from "@/lib/api/types";
import type { Issue } from "@/lib/types";
import { countBySeverity } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "issues", label: "Issues", icon: FileCode2 },
  { value: "changes", label: "Code Changes", icon: GitCompareArrows },
  { value: "tests", label: "Tests", icon: FlaskConical },
  { value: "history", label: "Verification History", icon: History },
] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "Not analyzed yet";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { dateStyle: "medium" });
}

/** Adapts an API issue to the shape IssueCard renders. */
function toUiIssue(issue: ApiIssue): Issue {
  return {
    id: issue.id,
    severity: issue.severity,
    title: issue.title,
    explanation: issue.explanation,
    whyItMatters: issue.whyItMatters,
    fileName: issue.fileName,
    line: issue.line,
    category: issue.category,
    before: issue.before ?? "",
    after: issue.after ?? "",
    status: issue.status,
  };
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "overview";
  const [tab, setTab] = useState<string>(
    TABS.some((item) => item.value === initialTab) ? initialTab : "overview",
  );
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setProject(await getProjectLive(params.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : "Could not load the project");
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    if (!project) return null;
    const counts = countBySeverity(project.issues, "open");
    const passed = project.tests.filter((t) => t.status === "passed").length;
    const failed = project.tests.filter((t) => t.status === "failed").length;
    const skipped = project.tests.filter((t) => t.status === "skipped").length;
    return { ...counts, passed, failed, skipped };
  }, [project]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-3 py-24 text-muted-foreground"
        aria-busy="true"
      >
        <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm">Loading project…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <ErrorState
        title="Project not found"
        description="The project you opened does not exist or was never analyzed."
      >
        <Button asChild>
          <Link href="/projects">All projects</Link>
        </Button>
      </ErrorState>
    );
  }

  if (error || !project || !summary) {
    return (
      <ErrorState
        title="Could not load this project"
        description={error ?? "Something went wrong while loading the project."}
      >
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
        <Button asChild>
          <Link href="/projects">All projects</Link>
        </Button>
      </ErrorState>
    );
  }

  if (project.status === "error") {
    return (
      <ErrorState
        title="Analysis failed for this project"
        description={project.error ?? "The analysis run recorded an error."}
      >
        <Button asChild>
          <Link href="/projects">All projects</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/upload">Analyze another project</Link>
        </Button>
      </ErrorState>
    );
  }

  const fixed = project.issues.some((issue) => issue.status === "fixed");
  const health = project.healthAfter ?? project.health;
  const changes = project.issues.filter(
    (issue) => issue.status === "fixed" && issue.before && issue.after,
  );
  const visibleIssues = project.issues.filter(
    (issue) => issue.status !== "dismissed",
  );

  return (
    <div className="flex flex-col gap-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 mb-2 w-fit text-muted-foreground"
      >
        <Link href="/projects">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All projects
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {project.name}
            {fixed && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-verify/30 bg-verify-dim px-2 py-0.5 text-xs font-medium text-verify">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                verified
              </span>
            )}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">
              {project.language}
            </span>
            <span className="font-mono">{project.framework}</span>
            <CalendarClock className="ml-1 size-3.5 text-muted-foreground" aria-hidden="true" />
            Last analyzed {formatDate(project.lastAnalyzed)}
          </p>
        </div>
        <Button asChild>
          <Link href={`/report/${project.id}`}>Open Report</Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger key={item.value} value={item.value} className="gap-1.5">
                <Icon className="size-3.5" aria-hidden="true" />
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-6">
          {health === null ? (
            <EmptyState
              icon={<FileCode2 className="size-6" aria-hidden="true" />}
              title="Not analyzed yet"
              description="This project has been created but no analysis has completed for it yet."
            >
              <Button asChild>
                <Link href="/upload">Analyze a project</Link>
              </Button>
            </EmptyState>
          ) : (
            <>
              <Card>
                <CardContent className="flex flex-col items-center gap-8 p-6 sm:p-8 lg:flex-row lg:gap-12">
                  <HealthRing
                    score={health}
                    size={160}
                    label="Health score"
                    sub={fixed ? "improved by fix" : undefined}
                  />
                  <div className="grid w-full flex-1 grid-cols-2 gap-4 sm:grid-cols-2">
                    <Stat label="Critical" value={summary.critical} tone="critical" />
                    <Stat label="High" value={summary.high} tone="high" />
                    <Stat label="Medium" value={summary.medium} tone="medium" />
                    <Stat label="Tests passed" value={`${summary.passed}/${project.tests.length}`} tone="verify" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-2 p-6">
                  <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Verification status
                  </h2>
                  <StatusLine verified={project.history.some((h) => h.result === "verified")} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="issues" className="mt-5 space-y-3">
          {visibleIssues.length === 0 ? (
            <EmptyIssues hasIssues={project.issues.length > 0} />
          ) : (
            visibleIssues.map((issue) => (
              <IssueCard key={issue.id} issue={toUiIssue(issue)} projectId={project.id} />
            ))
          )}
        </TabsContent>

        <TabsContent value="changes" className="mt-5 space-y-4">
          {changes.length === 0 ? (
            <NoChanges />
          ) : (
            changes.map((issue) => (
              <Card key={issue.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 font-mono text-sm font-medium">
                        <FileCode2 className="size-4 text-brand" aria-hidden="true" />
                        {issue.fileName}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{issue.title}</p>
                    </div>
                    <span className="font-mono text-xs">
                      <span className="text-verify">+1</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-critical">-1</span>
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <CodeBlock code={issue.before!} header="Before" />
                    <CodeBlock code={issue.after!} header="After" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="tests" className="mt-5">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-verify/30 bg-verify-dim px-3 py-1 font-medium text-verify">
                  {summary.passed} Passed
                </span>
                <span className="rounded-full border border-critical/30 bg-critical/15 px-3 py-1 font-medium text-critical">
                  {summary.failed} Failed
                </span>
                <span className="rounded-full border border-border bg-muted/50 px-3 py-1 font-medium text-muted-foreground">
                  {summary.skipped} Skipped
                </span>
              </div>
              {project.tests.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No test results recorded yet. Run a verification from the
                  project report to execute the test suite.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col divide-y divide-border">
                  {project.tests.map((test) => (
                    <li
                      key={test.name}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span className="flex items-center gap-3 text-sm">
                        {test.status === "passed" && (
                          <Check className="size-4 text-verify" aria-hidden="true" />
                        )}
                        {test.status === "failed" && (
                          <XCircle className="size-4 text-critical" aria-hidden="true" />
                        )}
                        {test.status === "skipped" && (
                          <MinusCircle className="size-4 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="font-mono text-[13px]">{test.name}</span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {test.duration}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <Card>
            <CardContent className="p-5">
              {project.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No verification snapshots yet. Snapshots are recorded when a
                  verification run completes.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...project.history]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((entry) => (
                      <SnapshotRow
                        key={`${entry.date}-${entry.label}`}
                        date={formatDay(entry.date)}
                        label={entry.label}
                        health={entry.health}
                        critical={entry.critical}
                        high={entry.high}
                        medium={entry.medium}
                        result={entry.result}
                      />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "critical" | "high" | "medium" | "verify";
}) {
  const toneClass = {
    critical: "text-critical",
    high: "text-high",
    medium: "text-medium",
    verify: "text-verify",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </p>
    </div>
  );
}

function StatusLine({ verified }: { verified: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span className="flex items-center gap-2 text-verify">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Latest scan complete
      </span>
      <span className="flex items-center gap-2 text-muted-foreground">
        <History className="size-4" aria-hidden="true" />
        {verified ? "A verification run has passed" : "No passing verification yet"}
      </span>
    </div>
  );
}

function EmptyIssues({ hasIssues }: { hasIssues: boolean }) {
  return (
    <Card className="flex flex-col items-center p-10 text-center">
      <p className="text-sm text-muted-foreground">
        {hasIssues
          ? "Your project passed the current checks. All findings are dismissed or resolved."
          : "No findings recorded for this project yet."}
      </p>
    </Card>
  );
}

function NoChanges() {
  return (
    <Card className="flex flex-col items-center p-10 text-center">
      <p className="text-sm text-muted-foreground">
        No code changes have been applied to this project yet.
      </p>
    </Card>
  );
}
