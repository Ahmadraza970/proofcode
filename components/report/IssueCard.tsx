"use client";

import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import type { Issue } from "@/lib/types";

export function IssueCard({
  issue,
  projectId,
}: {
  issue: Issue;
  projectId: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <h3 className="font-medium tracking-tight">{issue.title}</h3>
          </div>
          <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
            {issue.category}
          </span>
        </div>

        <p className="mt-1.5 font-mono text-xs text-muted-foreground">
          {issue.fileName}
          <span className="mx-1 text-border">:</span>
          <span className="text-foreground">{issue.line}</span>
        </p>

        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {issue.explanation}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/issue/${issue.id}?project=${projectId}`}>
              View Details
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="default">
            <Link href={`/issue/${issue.id}?project=${projectId}`}>
              <Wrench className="size-3.5" aria-hidden="true" />
              Fix Issue
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}