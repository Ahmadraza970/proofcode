"use client";

import { useMemo, useState } from "react";
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
  XCircle,
  MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { ErrorState } from "@/components/shared/ErrorState";
import { HealthRing } from "@/components/shared/HealthRing";
import { IssueCard } from "@/components/report/IssueCard";
import { SnapshotRow } from "@/components/report/SnapshotRow";
import { useProof } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "issues", label: "Issues", icon: FileCode2 },
  { value: "changes", label: "Code Changes", icon: GitCompareArrows },
  { value: "tests", label: "Tests", icon: FlaskConical },
  { value: "history", label: "Verification History", icon: History },
] as const;

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { getProject, countOpenIssues } = useProof();
  const initialTab = searchParams.get("tab") ?? "overview";
  const [tab, setTab] = useState<string>(
    TABS.some((item) => item.value === initialTab) ? initialTab : "overview",
  );

  const project = getProject(params.id);

  const summary = useMemo(() => {
    if (!project) return null;
    const counts = countOpenIssues(project);
    const passed = project.tests.filter((t) => t.status === "passed").length;
    const failed = project.tests.filter((t) => t.status === "failed").length;
    const skipped = project.tests.filter((t) => t.status === "skipped").length;
    return { ...counts, passed, failed, skipped };
  }, [project, countOpenIssues]);

  if (!project || !summary) {
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

  const fixed = project.issues.some((issue) => issue.status === "fixed");

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
            Last analyzed {project.lastAnalyzed}
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
          <Card>
            <CardContent className="flex flex-col items-center gap-8 p-6 sm:p-8 lg:flex-row lg:gap-12">
              <HealthRing
                score={fixed && project.healthAfter ? project.healthAfter : project.health}
                size={160}
                label="Health score"
                sub={fixed && project.healthAfter ? "improved by fix" : undefined}
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
              <StatusLine />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="mt-5 space-y-3">
          {project.issues.filter((i) => i.status === "dismissed").length ===
            project.issues.length && project.issues.length > 0 ? (
            <EmptyIssues />
          ) : (
            project.issues
              .filter((issue) => issue.status !== "dismissed")
              .map((issue) => (
                <IssueCard key={issue.id} issue={issue} projectId={project.id} />
              ))
          )}
        </TabsContent>

        <TabsContent value="changes" className="mt-5 space-y-4">
          {project.changes.length === 0 ? (
            <NoChanges />
          ) : (
            project.changes.map((change) => (
              <Card key={change.fileName}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 font-mono text-sm font-medium">
                        <FileCode2 className="size-4 text-brand" aria-hidden="true" />
                        {change.fileName}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{change.summary}</p>
                    </div>
                    <span className="font-mono text-xs">
                      <span className="text-verify">+{change.linesAdded}</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-critical">-{change.linesRemoved}</span>
                    </span>
                  </div>
                  {change.before && (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <CodeBlock code={change.before} header="Before" />
                      <CodeBlock code={change.after} header="After" />
                    </div>
                  )}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                {project.history.map((entry) => (
                  <SnapshotRow
                    key={`${entry.date}-${entry.label}`}
                    date={entry.date}
                    label={entry.label}
                    health={entry.health}
                    critical={entry.critical}
                    high={entry.high}
                    medium={entry.medium}
                    result={entry.result}
                  />
                ))}
              </div>
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

function StatusLine() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span className="flex items-center gap-2 text-verify">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Latest scan complete
      </span>
      <span className="flex items-center gap-2 text-muted-foreground">
        <History className="size-4" aria-hidden="true" />
        Safety checks gated
      </span>
    </div>
  );
}

function EmptyIssues() {
  return (
    <Card className="flex flex-col items-center p-10 text-center">
      <p className="text-sm text-muted-foreground">
        Your project passed the current checks. All findings are dismissed or resolved.
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