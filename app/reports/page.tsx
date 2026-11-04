"use client";

import Link from "next/link";
import { ArrowUpRight, FileBarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SnapshotRow } from "@/components/report/SnapshotRow";
import { useProof } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const { state } = useProof();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Reports"
        description="Health snapshots and findings for every analyzed codebase."
      />

      {state.projects.length === 0 ? (
        <EmptyState
          icon={<FileBarChart2 className="size-6" aria-hidden="true" />}
          title="No reports yet"
          description="Analyze a project and its verification report will show up here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {state.projects.map((project) => {
            const latest = project.history[0];
            return (
              <Card key={project.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold tracking-tight">
                        {project.name}
                      </h2>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {project.language} · {project.framework} · analyzed{" "}
                        {project.lastAnalyzed}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-mono text-2xl font-semibold tabular-nums",
                            project.health >= 90
                              ? "text-verify"
                              : project.health >= 75
                                ? "text-medium"
                                : "text-critical",
                          )}
                        >
                          {project.health}
                        </p>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          health
                        </p>
                      </div>
                      <Button asChild variant="outline">
                        <Link href={`/report/${project.id}`}>
                          Open Report
                          <ArrowUpRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  {latest && (
                    <div className="mt-4 border-t border-border/70 pt-2">
                      <SnapshotRow
                        date={latest.date}
                        label={latest.label}
                        health={latest.health}
                        critical={latest.critical}
                        high={latest.high}
                        medium={latest.medium}
                        result={latest.result}
                      />
                    </div>
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