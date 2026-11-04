"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bug,
  Loader2,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  HealthRing,
  healthLabel,
} from "@/components/shared/HealthRing";
import { ScoreCard } from "@/components/shared/ScoreCard";
import { severityOrder } from "@/components/shared/SeverityBadge";
import { LiveIssueRow } from "@/components/live/LiveIssueRow";
import {
  getProjectLive,
  ensureToken,
  ensureAndWrap,
  fixAll,
  verifyProjectLive,
  type ApiProject,
  type ApiIssue,
} from "@/lib/api/client";
import type { Severity } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type FilterKey = "all" | Severity;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export function LiveReport({ id }: { id: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [fixingAll, setFixingAll] = useState(false);
  const [runningScan, setRunningScan] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await ensureAndWrap(async () => getProjectLive(id));
        void token;
        const p = await getProjectLive(id);
        if (!cancelled) setProject(p);
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the project");
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const retry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await ensureAndWrap(async () => getProjectLive(id));
      void token;
      const p = await getProjectLive(id);
      setProject(p);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the project");
      setLoading(false);
    }
  }, [id]);

  const handleFixAll = useCallback(async () => {
    setFixingAll(true);
    try {
      const token = await ensureToken();
      await fixAll(token, id);
      toast.success("Fix-all complete. Re-scanning…");
      setProject(await getProjectLive(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fix-all failed");
    } finally {
      setFixingAll(false);
    }
  }, [id]);

  const handleVerify = useCallback(async () => {
    setRunningScan(true);
    try {
      const token = await ensureToken();
      const result = await verifyProjectLive(token, id);
      toast.success(
        result.result === "verified"
          ? "Verification passed."
          : "Verification recorded.",
      );
      setProject(await getProjectLive(id));
      router.push(`/verify?live=${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setRunningScan(false);
    }
  }, [id, router]);

  const handleIssueChanged = useCallback((updated: ApiIssue, health?: number) => {
    setProject((prev) =>
      prev
        ? {
            ...prev,
            issues: prev.issues.map((i) =>
              i.id === updated.id ? updated : i,
            ),
            // A successful fix carries the server's recomputed health in
            // its response — apply it to the header score now (mirroring
            // the stored record, which sets health = healthAfter) instead
            // of leaving the pre-fix score up until a reload.
            ...(typeof health === "number"
              ? { health, healthAfter: health }
              : {}),
          }
        : prev,
    );
  }, []);

  const openIssues = useMemo(
    () => (project?.issues ?? []).filter((i) => i.status === "open"),
    [project],
  );

  const fixedIssues = useMemo(
    () =>
      (project?.issues ?? [])
        .filter((i) => i.status === "fixed")
        .sort(
          (a, b) =>
            severityOrder(a.severity) - severityOrder(b.severity) ||
            a.line - b.line,
        ),
    [project],
  );

  const issues = useMemo(
    () =>
      openIssues
        .sort(
          (a, b) =>
            severityOrder(a.severity) - severityOrder(b.severity) ||
            a.line - b.line,
        )
        .filter((issue) => filter === "all" || issue.severity === filter),
    [openIssues, filter],
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-9 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-56 animate-pulse rounded-2xl bg-muted/60" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <ErrorState
        title="Could not open this project"
        description={error}
      >
        <Button onClick={retry} variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
        <Button asChild>
          <Link href="/upload">Analyze a project</Link>
        </Button>
      </ErrorState>
    );
  }

  if (!project) return null;

  const counts = {
    critical: openIssues.filter((i) => i.severity === "critical").length,
    high: openIssues.filter((i) => i.severity === "high").length,
    medium: openIssues.filter((i) => i.severity === "medium").length,
    low: openIssues.filter((i) => i.severity === "low").length,
  };
  const score = project.health ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Health hero */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 h-56 w-96 rounded-full bg-brand/10 blur-3xl"
        />
        <CardContent className="flex flex-col items-center gap-8 p-6 sm:p-8 lg:flex-row lg:gap-12">
          <HealthRing
            score={score}
            label="Project Health"
            sub={healthLabel(score)}
            size={168}
          />
          <div className="flex-1 self-stretch">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Findings summary</h2>
              <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                Live analysis
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { key: "critical" as const, value: counts.critical, color: "border-critical/30 bg-critical/15 text-critical" },
                  { key: "high" as const, value: counts.high, color: "border-high/30 bg-high/15 text-high" },
                  { key: "medium" as const, value: counts.medium, color: "border-medium/30 bg-medium/15 text-medium" },
                ] as const
              ).map((chip) => (
                <span
                  key={chip.key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium",
                    chip.color,
                  )}
                >
                  <span className="font-mono tabular-nums">{chip.value}</span> {chip.key}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                <span className="font-mono tabular-nums">{counts.low}</span> Low
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={handleVerify} disabled={runningScan} variant="secondary">
                {runningScan ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="size-4" aria-hidden="true" />
                )}
                {runningScan ? "Verifying…" : "Run Verification"}
              </Button>
              <Button onClick={handleFixAll} disabled={fixingAll || openIssues.length === 0}>
                {fixingAll ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Bug className="size-4" aria-hidden="true" />
                )}
                {fixingAll ? "Fixing all bugs…" : `Fix All Bugs (${openIssues.length})`}
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="size-4" aria-hidden="true" />
              {project.language} · {project.fileCount} files scanned ·{" "}
              {project.issues.length} total findings
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Score cards */}
      {project.scores && project.scores.length > 0 && (
        <section aria-labelledby="live-scores-heading">
          <h2 id="live-scores-heading" className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Score breakdown
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {project.scores.map((scoreItem) => (
              <ScoreCard
                key={scoreItem.label}
                label={scoreItem.label}
                value={scoreItem.after ?? scoreItem.before}
                hint={scoreItem.hint}
                improved={scoreItem.after > scoreItem.before}
              />
            ))}
          </div>
        </section>
      )}

      {/* Issues */}
      <section aria-labelledby="live-issues-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="live-issues-heading" className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Open issues
          </h2>
          <div
            className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1"
            role="group"
            aria-label="Filter issues by severity"
          >
            {FILTERS.map((item) => (
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
          {openIssues.length === 0 ? (
            <EmptyState
              icon={<SearchCheck className="size-6" aria-hidden="true" />}
              title="No open findings"
              description="Your project passed the current checks. Run a verification to record a snapshot."
            />
          ) : issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No {filter} issues.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {issues.map((issue) => (
                <LiveIssueRow
                  key={issue.id}
                  issue={issue}
                  projectId={id}
                  onChanged={handleIssueChanged}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Fixed issues stay on the page with their patches, instead of
          vanishing from the open-only list the moment a fix succeeds. */}
      {fixedIssues.length > 0 && (
        <section aria-labelledby="live-fixed-heading">
          <h2 id="live-fixed-heading" className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Fixed ({fixedIssues.length})
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            {fixedIssues.map((issue) => (
              <LiveIssueRow
                key={issue.id}
                issue={issue}
                projectId={id}
                onChanged={handleIssueChanged}
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-end border-t border-border pt-6">
        <Button asChild variant="outline" size="sm">
          <Link href={`/verify?live=${id}`}>
            <TerminalSquare className="size-4" aria-hidden="true" />
            Open verification page
          </Link>
        </Button>
      </div>
    </div>
  );
}
