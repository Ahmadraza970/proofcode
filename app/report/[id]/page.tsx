"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  FolderGit2,
  SearchCheck,
  ScanSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  HealthRing,
  healthLabel,
} from "@/components/shared/HealthRing";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScoreCard } from "@/components/shared/ScoreCard";
import { severityOrder } from "@/components/shared/SeverityBadge";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import { FixPanel } from "@/components/fix/FixPanel";
import { IssueCard } from "@/components/report/IssueCard";
import { LiveReport } from "@/components/live/LiveReport";
import { useProof } from "@/lib/store";
import type { Project, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: "all" | Severity; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const { getProject } = useProof();
  const project = getProject(params.id);

  // Live mode: an ID that isn't a mock project is rendered by the real API.
  if (!project) {
    return <LiveReport id={params.id} />;
  }

  return <MockReport project={project} />;
}

function MockReport({ project }: { project: Project }) {
  const router = useRouter();
  const { countOpenIssues, startFixAll, completeFixAll } = useProof();
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [fixingAll, setFixingAll] = useState(false);

  const handleFixAllComplete = useCallback(() => {
    completeFixAll(project.id);
    router.push("/verify");
  }, [completeFixAll, project.id, router]);

  const handleFixAllStart = useCallback(() => {
    startFixAll(project.id);
    setFixingAll(true);
  }, [project.id, startFixAll]);

  const issues = useMemo(() => {
    const open = project.issues.filter((issue) => issue.status !== "dismissed");
    return open
      .sort(
        (a, b) =>
          severityOrder(a.severity) - severityOrder(b.severity) ||
          a.line - b.line,
      )
      .filter((issue) => filter === "all" || issue.severity === filter);
  }, [project.issues, filter]);

  const counts = countOpenIssues(project);
  const openIssues = counts.critical + counts.high + counts.medium + counts.low;
  const fixed = project.issues.some((issue) => issue.status === "fixed");
  const displayScore =
    fixed && project.healthAfter ? project.healthAfter : project.health;
  const chipCounts = [
    { key: "critical" as const, label: "Critical", value: counts.critical },
    { key: "high" as const, label: "High", value: counts.high },
    { key: "medium" as const, label: "Medium", value: counts.medium },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
          <Link href="/">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Dashboard
          </Link>
        </Button>
        <PageHeader
          title={project.name}
          description={`${project.description} Last analyzed ${project.lastAnalyzed}.`}
        >
          <Button asChild variant="secondary" size="lg">
            <Link href={`/projects/${project.id}`}>
              <FolderGit2 className="size-4" aria-hidden="true" />
              Project detail
            </Link>
          </Button>
          {!fixed && openIssues > 0 && (
            <Button size="lg" onClick={handleFixAllStart} disabled={fixingAll}>
              <Bug className="size-4" aria-hidden="true" />
              {fixingAll ? "Fixing all bugs…" : "Fix All Bugs"}
            </Button>
          )}
          {fixed && (
            <Button asChild size="lg">
              <Link href="/verify">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Run Full Scan
              </Link>
            </Button>
          )}
        </PageHeader>
      </div>

      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 h-56 w-96 rounded-full bg-brand/10 blur-3xl"
        />
        <CardContent className="flex flex-col items-center gap-8 p-6 sm:p-8 lg:flex-row lg:gap-12">
          <HealthRing
            score={displayScore}
            delta={fixed && project.healthAfter ? project.healthAfter - project.health : undefined}
            label="Project Health"
            sub={healthLabel(displayScore)}
            size={168}
          />
          <div className="flex-1 self-stretch">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Findings summary</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {chipCounts.map((chip) => (
                <span
                  key={chip.key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium",
                    chip.key === "critical" && "border-critical/30 bg-critical/15 text-critical",
                    chip.key === "high" && "border-high/30 bg-high/15 text-high",
                    chip.key === "medium" && "border-medium/30 bg-medium/15 text-medium",
                  )}
                >
                  <span className="font-mono tabular-nums">{chip.value}</span> {chip.label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                <span className="font-mono tabular-nums">{counts.low}</span> Low
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <ScanSearch className="size-4" aria-hidden="true" />
                {fixed ? (
                  <>
                    <span className="text-verify">Fix verified.</span> Issues
                    that remain open are listed below.
                  </>
                ) : (
                  "Issues that need attention are listed below."
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="scores-heading">
        <h2 id="scores-heading" className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Score breakdown
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {project.scores.map((score) => (
            <ScoreCard
              key={score.id}
              label={score.label}
              value={fixed ? score.after : score.before}
              hint={score.hint}
              improved={fixed && score.after > score.before}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="issues-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="issues-heading" className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Issues
          </h2>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1" role="group" aria-label="Filter issues by severity">
            {!fixingAll &&
              FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  aria-pressed={filter === item.key}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    filter === item.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
          </div>
        </div>

        <div className="mt-4">
          {fixingAll ? (
            <FixPanel onComplete={handleFixAllComplete} />
          ) : issues.length === 0 ? (
            <EmptyState
              icon={<SearchCheck className="size-6" aria-hidden="true" />}
              title="Your project passed the current checks."
              description="0 critical issues detected. Run a new scan anytime to re-verify the codebase."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} projectId={project.id} />
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-border pt-6">
        <WorkflowStrip current={2} />
      </div>
    </div>
  );
}
