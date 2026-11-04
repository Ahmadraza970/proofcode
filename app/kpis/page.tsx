"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Gauge,
  Loader2,
  PackageOpen,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScoreCard } from "@/components/shared/ScoreCard";
import { listFullProjects, type ApiProject } from "@/lib/api/client";
import { countBySeverity } from "@/lib/store";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--severity-critical)",
  high: "var(--severity-high)",
  medium: "var(--severity-medium)",
  low: "var(--severity-low)",
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  fontSize: "0.875rem",
} as const;

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Gauge;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function KPIsPage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listFullProjects());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const openCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    let openTotal = 0;
    let fixedTotal = 0;
    let healthSum = 0;
    let healthCount = 0;

    for (const project of projects) {
      const counts = countBySeverity(project.issues, "open");
      openCounts.critical += counts.critical;
      openCounts.high += counts.high;
      openCounts.medium += counts.medium;
      openCounts.low += counts.low;
      openTotal += counts.critical + counts.high + counts.medium + counts.low;
      fixedTotal += project.issues.filter((i) => i.status === "fixed").length;
      const health = project.healthAfter ?? project.health;
      if (health !== null) {
        healthSum += health;
        healthCount += 1;
      }
    }

    const resolvedTotal = fixedTotal + openTotal;
    return {
      openCounts,
      openTotal,
      avgHealth: healthCount > 0 ? Math.round(healthSum / healthCount) : null,
      fixRate:
        resolvedTotal > 0
          ? Math.round((fixedTotal / resolvedTotal) * 100)
          : null,
    };
  }, [projects]);

  const severityData = useMemo(
    () =>
      (["critical", "high", "medium", "low"] as const).map((severity) => ({
        name: severity,
        count: stats.openCounts[severity],
        fill: SEVERITY_COLORS[severity],
      })),
    [stats],
  );

  const healthTrend = useMemo(() => {
    const points = projects
      .flatMap((project) =>
        project.history.map((snapshot) => ({
          date: snapshot.date,
          health: snapshot.health,
        })),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    return points.map((point) => ({
      label: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      health: point.health,
    }));
  }, [projects]);

  const scoreAverages = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const project of projects) {
      for (const score of project.scores) {
        const entry = totals.get(score.label) ?? { sum: 0, count: 0 };
        entry.sum += score.after;
        entry.count += 1;
        totals.set(score.label, entry);
      }
    }
    return [...totals.entries()].map(([label, { sum, count }]) => ({
      label,
      value: Math.round(sum / count),
    }));
  }, [projects]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="KPIs"
        description="Aggregated metrics computed from your real analyzed projects."
      />

      {loading && (
        <div
          className="flex items-center justify-center gap-3 py-10 text-muted-foreground"
          aria-busy="true"
        >
          <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm">Loading metrics…</p>
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Could not load metrics" description={error}>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </ErrorState>
      )}

      {!loading && !error && projects.length === 0 && (
        <EmptyState
          icon={<PackageOpen className="size-6" aria-hidden="true" />}
          title="No projects yet"
          description="Metrics appear here once you have analyzed a project."
        >
          <Button asChild>
            <Link href="/upload">Analyze a project</Link>
          </Button>
        </EmptyState>
      )}

      {!loading && !error && projects.length > 0 && (
        <>
          {/* Summary stat cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Projects"
              value={String(projects.length)}
              description="Projects analyzed by ProofCode"
              icon={FileCode2}
            />
            <StatCard
              title="Open Issues"
              value={String(stats.openTotal)}
              description="Findings still open across all projects"
              icon={AlertTriangle}
            />
            <StatCard
              title="Avg Health Score"
              value={stats.avgHealth !== null ? String(stats.avgHealth) : "—"}
              description="Mean of latest project health scores"
              icon={Gauge}
            />
            <StatCard
              title="Fix Rate"
              value={stats.fixRate !== null ? `${stats.fixRate}%` : "—"}
              description="Share of recorded findings marked fixed"
              icon={CheckCircle2}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Open issues by severity */}
            <Card>
              <CardHeader>
                <CardTitle>Open Issues by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                      <YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {severityData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Health trend */}
            <Card>
              <CardHeader>
                <CardTitle>Health Score Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {healthTrend.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No verification snapshots yet. Run a verification from a
                    project report to start the trend.
                  </p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={healthTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                        <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        <Line
                          type="monotone"
                          dataKey="health"
                          stroke="var(--brand)"
                          strokeWidth={2}
                          dot={{ fill: "var(--brand)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quality scores */}
          {scoreAverages.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {scoreAverages.map((score) => (
                  <ScoreCard
                    key={score.label}
                    label={score.label}
                    value={score.value}
                    hint="Average across analyzed projects"
                  />
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Quality Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={scoreAverages}>
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis
                          dataKey="label"
                          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                        />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          dataKey="value"
                          stroke="var(--brand)"
                          fill="var(--brand)"
                          fillOpacity={0.25}
                        />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Project comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Project Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Open Issues</TableHead>
                    <TableHead>Last Analyzed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const open = countBySeverity(project.issues, "open");
                    const openTotal =
                      open.critical + open.high + open.medium + open.low;
                    const health = project.healthAfter ?? project.health;
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/projects/${project.id}`}
                            className="hover:underline"
                          >
                            {project.name}
                          </Link>
                        </TableCell>
                        <TableCell>{project.status}</TableCell>
                        <TableCell>{health ?? "—"}</TableCell>
                        <TableCell>{openTotal}</TableCell>
                        <TableCell>
                          {project.lastAnalyzed
                            ? new Date(project.lastAnalyzed).toLocaleDateString(
                                "en-US",
                                { dateStyle: "medium" },
                              )
                            : "Not analyzed yet"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
