"use client";

import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FolderPlus,
  Loader2,
  PackageOpen,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectsLockedState } from "@/components/projects/ProjectsLockedState";
import { useProof } from "@/lib/store";

const VALUE_CARDS: {
  icon: LucideIcon;
  title: string;
  body: string;
  accent: string;
}[] = [
  {
    icon: SearchCheck,
    title: "Detect",
    body: "Find bugs, security risks, and reliability issues across your codebase.",
    accent: "text-brand bg-brand-dim border-brand/25",
  },
  {
    icon: Wrench,
    title: "Fix",
    body: "Generate and apply targeted fixes with explanations you can review.",
    accent: "text-brand bg-brand-dim border-brand/25",
  },
  {
    icon: CheckCircle2,
    title: "Prove",
    body: "Run tests and verify that the fix actually works before you ship.",
    accent: "text-verify bg-verify-dim border-verify/25",
  },
];

export default function DashboardPage() {
  const { projects, loading, error, needsToken, refresh } = useProof();
  const recent = projects.slice(0, 6);

  // Same locked-workspace retry as the Projects page: if the token was
  // saved in Settings after the first load, pick the projects up on return.
  useEffect(() => {
    if (needsToken) void refresh();
  }, [needsToken, refresh]);

  return (
    <div className="flex flex-col gap-12">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-12 sm:px-10 sm:py-16"
        aria-labelledby="hero-title"
      >
        <div
          aria-hidden="true"
          className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-dim px-3 py-1 text-xs font-medium text-brand">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            AI-powered code verification
          </span>
          <h1
            id="hero-title"
            className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
          >
            Verify your code{" "}
            <span className="text-brand">before you ship.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Analyze, fix, test, and verify your software with an AI-powered code
            verification workflow.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 px-5">
              <Link href="/upload">
                <FolderPlus className="size-4" aria-hidden="true" />
                Analyze Project
              </Link>
            </Button>
          </div>
          <div className="mt-10">
            <WorkflowStrip aria-hidden />
          </div>
        </div>
      </section>

      {/* Value cards */}
      <section aria-label="What ProofCode does">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          How it works
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {VALUE_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="reveal"
                style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
              >
                <CardContent className="p-5">
                  <div
                    className={`grid size-10 place-items-center rounded-lg border ${card.accent}`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold">{card.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{card.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Recent projects */}
      <section aria-labelledby="recent-projects">
        <PageHeader
          title="Recent projects"
          description="Open a report to review findings, or analyze something new."
        >
          <Button asChild variant="outline">
            <Link href="/projects">All projects</Link>
          </Button>
        </PageHeader>
        <div className="mt-4">
          {loading ? (
            <div
              className="flex items-center justify-center gap-3 py-10 text-muted-foreground"
              aria-busy="true"
            >
              <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
              <p className="text-sm">Loading your projects…</p>
            </div>
          ) : needsToken ? (
            <ProjectsLockedState />
          ) : error ? (
            <ErrorState
              title="Could not load projects"
              description={error}
            >
              <Button variant="outline" onClick={() => void refresh()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </ErrorState>
          ) : recent.length === 0 ? (
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
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recent.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDeleted={() => void refresh()}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
