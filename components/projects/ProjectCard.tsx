"use client";

import Link from "next/link";
import { ArrowUpRight, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useProof } from "@/lib/store";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  const { countOpenIssues } = useProof();
  const counts = countOpenIssues(project);

  return (
    <Card className="group flex flex-col">
      <CardContent className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold tracking-tight">
                {project.name}
              </h3>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono">
                {project.language}
              </span>
              <span className="font-mono">{project.framework}</span>
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "font-mono text-2xl font-semibold tabular-nums",
                project.health >= 90
                  ? "text-verify"
                  : project.health >= 75
                    ? "text-medium"
                    : project.health >= 60
                      ? "text-high"
                      : "text-critical",
              )}
            >
              {project.health}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              health
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <FileSearch className="size-3.5" aria-hidden="true" />
          Last analyzed · <span className="font-medium text-foreground">{project.lastAnalyzed}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Open issues by severity">
          {[
            { label: counts.critical, title: "Critical", className: "text-critical border-critical/30 bg-critical/15" },
            { label: counts.high, title: "High", className: "text-high border-high/30 bg-high/15" },
            { label: counts.medium, title: "Medium", className: "text-medium border-medium/30 bg-medium/15" },
          ]
            .filter((chip) => chip.label > 0)
            .map((chip) => (
              <span
                key={chip.title}
                className={cn("rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums", chip.className)}
                title={`${chip.title} issues`}
              >
                {chip.label} {chip.title.toLowerCase()}
              </span>
            ))}
        </div>
      </CardContent>
      <CardFooter className="border-t border-border/70 p-4">
        <Button asChild variant="outline" className="w-full">
          <Link href={`/report/${project.id}`}>
            Open Report
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}