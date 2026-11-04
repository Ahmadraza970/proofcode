"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FileSearch,
  FolderPlus,
  Loader2,
  PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { useProof } from "@/lib/store";
import {
  listProjects,
  type ProjectListItem,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";

function LiveProjectCard({ project }: { project: ProjectListItem }) {
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
                (project.health ?? 0) >= 90
                  ? "text-verify"
                  : (project.health ?? 0) >= 75
                    ? "text-medium"
                    : (project.health ?? 0) >= 60
                      ? "text-high"
                      : "text-critical",
              )}
            >
              {project.health ?? "—"}
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
        </div>
      </CardContent>
      <div className="border-t border-border/70 p-4">
        <Button asChild variant="outline" className="w-full">
          <Link href={`/report/${project.id}`}>
            Open Report
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

export default function ProjectsPage() {
  const { state } = useProof();
  const mockProjects = state.projects;

  const [live, setLive] = useState<ProjectListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listProjects();
        if (!cancelled) setLive(res.projects);
      } catch {
        if (!cancelled) setLive([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showLive = live !== null && live.length > 0;
  const showMock = mockProjects.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Projects"
        description="Every codebase ProofCode has analyzed, with live health scores."
      >
        <Button asChild size="lg">
          <Link href="/upload">
            <FolderPlus className="size-4" aria-hidden="true" />
            Analyze Project
          </Link>
        </Button>
      </PageHeader>

      {loading && (
        <div
          className="flex items-center justify-center gap-3 py-10 text-muted-foreground"
          aria-busy="true"
        >
          <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm">Loading your analyzed projects…</p>
        </div>
      )}

      {!loading && showLive && (
        <section aria-labelledby="live-projects-heading">
          <h2
            id="live-projects-heading"
            className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground"
          >
            Your projects
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {live.map((project) => (
              <LiveProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {showMock && (
        <section aria-labelledby="demo-projects-heading">
          <h2
            id="demo-projects-heading"
            className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground"
          >
            Demo projects
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mockProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {!loading && !showLive && !showMock && (
        <EmptyState
          icon={<PackageOpen className="size-6" aria-hidden="true" />}
          title="No projects yet"
          description="Upload a ZIP or paste a GitHub URL to get your first verification report."
        >
          <Button asChild>
            <Link href="/upload">
              <FolderPlus className="size-4" aria-hidden="true" />
              Analyze your first project
            </Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
