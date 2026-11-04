"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  FolderPlus,
  Loader2,
  PackageOpen,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectsLockedState } from "@/components/projects/ProjectsLockedState";
import { useProof } from "@/lib/store";

export default function ProjectsPage() {
  const { projects, loading, error, needsSignIn, refresh } = useProof();

  // If the visitor was signed out on first load, retry once they are back
  // on this page — they may have signed in meanwhile.
  useEffect(() => {
    if (needsSignIn) void refresh();
  }, [needsSignIn, refresh]);

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

      {!loading && error && (
        <ErrorState title="Could not load projects" description={error}>
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </ErrorState>
      )}

      {!loading && needsSignIn && <ProjectsLockedState />}

      {!loading && !error && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDeleted={() => void refresh()}
            />
          ))}
        </div>
      )}

      {!loading && !error && !needsSignIn && projects.length === 0 && (
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
