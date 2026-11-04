"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Loader2,
  PackageOpen,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SnapshotRow } from "@/components/report/SnapshotRow";
import { listFullProjects, type ApiProject } from "@/lib/api/client";

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { dateStyle: "medium" });
}

function latestSnapshot(project: ApiProject) {
  if (project.history.length === 0) return null;
  return [...project.history].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export default function ReportsPage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listFullProjects());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Reports"
        description="Your verification history, recorded from real analysis runs."
      />

      {loading && (
        <div
          className="flex items-center justify-center gap-3 py-10 text-muted-foreground"
          aria-busy="true"
        >
          <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm">Loading reports…</p>
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Could not load reports" description={error}>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </ErrorState>
      )}

      {!loading && !error && projects.length === 0 && (
        <EmptyState
          icon={<PackageOpen className="size-6" aria-hidden="true" />}
          title="No reports yet"
          description="Analyze a project to create your first verification report."
        >
          <Button asChild>
            <Link href="/upload">Analyze a project</Link>
          </Button>
        </EmptyState>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="flex flex-col gap-4">
          {projects.map((project) => {
            const latest = latestSnapshot(project);
            return (
              <Card key={project.id}>
                <CardHeader className="pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>{project.name}</CardTitle>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/report/${project.id}`}>
                        Open Report
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Verification history
                  </p>
                </CardHeader>
                <CardContent className="p-6 pt-4">
                  {latest ? (
                    <SnapshotRow
                      date={formatDay(latest.date)}
                      label={latest.label}
                      health={latest.health}
                      critical={latest.critical}
                      high={latest.high}
                      medium={latest.medium}
                      result={latest.result}
                    />
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ScrollText className="size-4" aria-hidden="true" />
                      No verification snapshots yet for this project.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
