"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Dot,
  RadarChart,
  PolarGrid,
  Radar,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Target,
  GitBranch,
  Bug,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScoreCard as SharedScoreCard } from "@/components/shared/ScoreCard";
import { HealthRing } from "@/components/shared/HealthRing";
import { useProof } from "@/lib/store";
import { countBySeverity } from "@/lib/mock-data";
import type { Project, Severity, ScoreCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "hsl(var(--destructive))",
  high: "hsl(var(--warning))",
  medium: "hsl(var(--info))",
  low: "hsl(var(--success))",
};

const SEVERITY_ICONS: Record<Severity, React.ComponentType<{ className?: string }>> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: Bug,
  low: FileCode,
};

const STATUS_COLORS: Record<Project["status"], string> = {
  excellent: "text-success bg-success/10 border-success/20",
  good: "text-info bg-info/10 border-info/20",
  "needs-attention": "text-warning bg-warning/10 border-warning/20",
  "at-risk": "text-destructive bg-destructive/10 border-destructive/20",
};

const STATUS_LABELS: Record<Project["status"], string> = {
  excellent: "Excellent",
  good: "Good",
  "needs-attention": "Needs Attention",
  "at-risk": "At Risk",
};

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: TrendingUp,
} as const;

function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor,
  trend,
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  trend?: "up" | "down" | "neutral";
}) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const TrendIcon = TREND_ICONS[trend ?? "neutral"];

  return (
    <Card className="reveal">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
            {change !== undefined && changeLabel && (
              <p className="mt-2 flex items-center gap-1.5 text-sm">
                <TrendIcon
                  className={cn(
                    "size-3.5",
                    isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "font-medium",
                    isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {isPositive ? "+" : ""}{change}{changeLabel}
                </span>
              </p>
            )}
          </div>
          <div className={cn("size-12 rounded-xl flex items-center justify-center", iconColor)}>
            <Icon className="size-6 text-white" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityBreakdown({ projects }: { projects: Project[] }) {
  const totals = useMemo(() => {
    const acc = { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>;
    projects.forEach((p) => {
      const counts = countBySeverity(p.issues);
      (Object.keys(counts) as Severity[]).forEach((s) => {
        acc[s] += counts[s];
      });
    });
    return acc;
  }, [projects]);

  const data = (Object.keys(totals) as Severity[]).map((severity) => ({
    severity,
    count: totals[severity],
    color: SEVERITY_COLORS[severity],
  }));

  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <Card className="reveal">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          Issues by Severity
          <Badge variant="outline" className="text-xs">
            {total} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="severity"
                tickLine={false}
                axisLine={false}
                width={80}
                tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
              />
              <Tooltip
                formatter={(value: number | string | readonly (number | string)[] | undefined) => [Number(value ?? 0), "issues"]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              />
              <Legend />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={data[index].color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {data.map((d) => {
            const Icon = SEVERITY_ICONS[d.severity];
            return (
<Badge
              key={d.severity}
              variant="outline"
              className={cn("gap-1.5 border-l-4", `border-l-[${d.color}]`)}
            >
              <Icon className={cn("size-3", `text-[${d.color}]`)} />
              <span className="capitalize">{d.severity}</span>
              <span className={cn("font-mono font-bold", `text-[${d.color}]`)}>
                {d.count}
              </span>
            </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function HealthTrend({ projects }: { projects: Project[] }) {
  const historyData = useMemo(() => {
    const allEntries = projects.flatMap((p) =>
      p.history.map((h) => ({
        ...h,
        project: p.name,
        projectId: p.id,
      })),
    );
    return allEntries
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-20);
  }, [projects]);

  return (
    <Card className="reveal">
      <CardHeader className="pb-3">
        <CardTitle>Health Score Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis
                type="number"
                domain={[60, 100]}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(value: number | string | readonly (number | string)[] | undefined, name?: string | number) => {
                  if (name === "health") return [Number(value ?? 0), "Health Score"];
                  return [Number(value ?? 0), String(name ?? "")];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="health"
                stroke="hsl(var(--brand))"
                strokeWidth={2}
                dot={<Dot r={4} strokeWidth={2} />}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {projects.map((p) => (
            <Badge
              key={p.id}
              variant="outline"
              className={cn("gap-1.5", STATUS_COLORS[p.status])}
            >
              <HealthRing score={p.health} size={28} stroke={3} />
              <span>{p.name}</span>
              <span className="font-mono font-bold">{p.health}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QualityRadar({ projects }: { projects: Project[] }) {
  const avgScores = useMemo(() => {
    const scoreIds: ScoreCard["id"][] = ["security", "reliability", "testing", "codeQuality", "dependencies"];
    return scoreIds.map((id) => {
      const avg = projects.reduce((sum, p) => {
        const card = p.scores.find((s) => s.id === id);
        return sum + (card?.after ?? card?.before ?? 0);
      }, 0) / projects.length;
      return { subject: id, score: Math.round(avg) };
    });
  }, [projects]);

  return (
    <Card className="reveal">
      <CardHeader className="pb-3">
        <CardTitle>Avg Code Quality Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" innerRadius={60} outerRadius={100} data={avgScores}>
              <PolarGrid gridType="polygon" />
              <PolarAngleAxis dataKey="subject" tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)} />
              <PolarRadiusAxis angle={90} domain={[70, 100]} tickCount={3} tickFormatter={(v: number) => `${v}`} />
              <Radar
                name="Average Score"
                dataKey="score"
                stroke="hsl(var(--brand))"
                fill="hsl(var(--brand))"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(value: number | string | readonly (number | string)[] | undefined) => [Number(value ?? 0), "Score"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <Card className="reveal">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          Project Comparison
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">
              View All <GitBranch className="size-3.5 ml-1" />
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Health</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Critical</th>
                <th className="text-center p-3 font-medium text-muted-foreground">High</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Medium</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Low</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Tests</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Last Scan</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const counts = countBySeverity(project.issues);
                const passedTests = project.tests.filter((t) => t.status === "passed").length;
                const totalTests = project.tests.length;
                return (
                  <tr key={project.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                        {project.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{project.language} · {project.framework}</p>
                    </td>
                    <td className="p-3 text-center">
                      <HealthRing score={project.health} size={36} stroke={4} label={`${project.health}/100`} />
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={STATUS_COLORS[project.status]}>
                        {STATUS_LABELS[project.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-destructive">{counts.critical}</td>
                    <td className="p-3 text-center font-mono font-bold text-warning">{counts.high}</td>
                    <td className="p-3 text-center font-mono font-bold text-info">{counts.medium}</td>
                    <td className="p-3 text-center font-mono font-bold text-success">{counts.low}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={totalTests === passedTests ? "text-success border-success/20" : "text-warning border-warning/20"}>
                        {passedTests}/{totalTests}
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-muted-foreground whitespace-nowrap">{project.lastAnalyzed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreGrid({ projects }: { projects: Project[] }) {
  return (
    <Card className="reveal">
      <CardHeader className="pb-3">
        <CardTitle>Quality Dimensions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {projects.flatMap((p) =>
            p.scores.map((score) => (
              <SharedScoreCard
                key={`${p.id}-${score.id}`}
                label={score.label}
                value={score.after}
                hint={score.hint}
                improved={score.after > score.before}
              />
            )),
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function KPIsPage() {
  const { state } = useProof();
  const projects = state.projects;

  const totals = useMemo(() => {
    const issues = projects.flatMap((p) => p.issues);
    const counts = countBySeverity(issues);
    const totalIssues = Object.values(counts).reduce((a, b) => a + b, 0);
    const avgHealth = projects.reduce((sum, p) => sum + p.health, 0) / projects.length;
    const fixedIssues = issues.filter((i) => i.status === "fixed").length;
    const fixRate = totalIssues > 0 ? Math.round((fixedIssues / totalIssues) * 100) : 0;
    return { counts, totalIssues, avgHealth: Math.round(avgHealth), fixRate };
  }, [projects]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Business KPIs"
        description="Track code health, issue trends, and quality metrics across all projects."
      >
        <Button asChild variant="outline">
          <Link href="/projects">
            Manage Projects
          </Link>
        </Button>
      </PageHeader>

      {/* Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Projects"
          value={projects.length}
          change={1}
          changeLabel="this month"
          icon={Layers}
          iconColor="bg-brand/10 text-brand"
          trend="up"
        />
        <MetricCard
          title="Total Issues"
          value={totals.totalIssues}
          change={-12}
          changeLabel="vs last week"
          icon={AlertTriangle}
          iconColor="bg-warning/10 text-warning"
          trend="down"
        />
        <MetricCard
          title="Avg Health Score"
          value={totals.avgHealth}
          change={8}
          changeLabel="pts improvement"
          icon={Target}
          iconColor="bg-success/10 text-success"
          trend="up"
        />
        <MetricCard
          title="Fix Rate"
          value={`${totals.fixRate}%`}
          change={15}
          changeLabel="pts this quarter"
          icon={CheckCircle2}
          iconColor="bg-info/10 text-info"
          trend="up"
        />
      </div>

      <Separator />

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SeverityBreakdown projects={projects} />
        <HealthTrend projects={projects} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <QualityRadar projects={projects} />
        <Card className="reveal">
          <CardHeader className="pb-3">
            <CardTitle>Key Metrics Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.map((p) => {
              const counts = countBySeverity(p.issues);
              const openTotal = counts.critical + counts.high + counts.medium + counts.low;
              const healthDelta = (p.healthAfter ?? p.health) - p.health;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileCode className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{p.language} · {p.framework}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <HealthRing score={p.health} size={32} stroke={3} />
                    <Badge variant="outline" className={STATUS_COLORS[p.status]}>
                      {STATUS_LABELS[p.status]}
                    </Badge>
                    <span className="font-mono text-muted-foreground">
                      {openTotal} open
                    </span>
                    {healthDelta > 0 && (
                      <span className="flex items-center gap-1 text-success font-medium">
                        <ArrowUpRight className="size-3.5" />
                        +{healthDelta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Project Comparison Table */}
      <ProjectTable projects={projects} />

      <Separator />

      {/* Score Cards Grid */}
      <ScoreGrid projects={projects} />
    </div>
  );
}