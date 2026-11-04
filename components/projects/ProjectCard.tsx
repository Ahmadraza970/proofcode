"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileSearch, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  deleteProjectLive,
  ensureToken,
  type ProjectListItem,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Card for a real API project summary (GET /api/v1/projects). */
export function ProjectCard({
  project,
  onDeleted,
}: {
  project: ProjectListItem;
  onDeleted?: () => void;
}) {
  const health = project.healthAfter ?? project.health;
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (deleting) return;
    const confirmed = window.confirm(
      `Delete "${project.name}" permanently? Its files, findings and reports will be removed. This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = await ensureToken();
      await deleteProjectLive(token, project.id);
      onDeleted?.();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete this project.",
      );
      setDeleting(false);
    }
  }

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
              <span className="font-mono">{project.source}</span>
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "font-mono text-2xl font-semibold tabular-nums",
                health === null
                  ? "text-muted-foreground"
                  : health >= 90
                    ? "text-verify"
                    : health >= 75
                      ? "text-medium"
                      : health >= 60
                        ? "text-high"
                        : "text-critical",
              )}
            >
              {health ?? "—"}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              health
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <FileSearch className="size-3.5" aria-hidden="true" />
          {project.fileCount} files ·{" "}
          <span className="font-medium text-foreground">{project.status}</span>
          {project.issueCount > 0 && (
            <>
              {" "}·{" "}
              <span className="font-medium text-foreground">
                {project.issueCount} open{" "}
                {project.issueCount === 1 ? "issue" : "issues"}
              </span>
            </>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 border-t border-border/70 p-4">
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/report/${project.id}`}>
              Open Report
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void handleDelete()}
            disabled={deleting}
            title={`Delete ${project.name}`}
            aria-label={`Delete ${project.name}`}
            className="shrink-0 text-muted-foreground hover:text-critical"
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        {deleteError && (
          <p className="text-xs text-critical" role="alert">
            Delete failed: {deleteError}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
