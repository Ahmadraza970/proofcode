"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/ErrorState";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import { ANALYSIS_EVENTS, ANALYSIS_STEPS } from "@/lib/mock-data";
import { useProof } from "@/lib/store";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const DEFAULT_PROJECT = "snapcart-api";
const EVENT_GAP = 340;

export default function AnalysisPage() {
  const { state, getProject, completeAnalysis } = useProof();
  const router = useRouter();
  const project = getProject(DEFAULT_PROJECT);
  const job = state.analysisJob;
  const running = job?.status === "running";
  const reduced = usePrefersReducedMotion();

  const [stepIndex, setStepIndex] = useState(() => (running ? 0 : -1));
  const [events, setEvents] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;

    const unit = reduced ? 120 : EVENT_GAP;

    // Final step finished -> wrap up the run.
    if (stepIndex >= ANALYSIS_STEPS.length) {
      const timer = setTimeout(() => {
        completeAnalysis(DEFAULT_PROJECT);
        router.push(`/report/${DEFAULT_PROJECT}`);
      }, reduced ? 150 : 800);
      return () => clearTimeout(timer);
    }

    if (stepIndex < 0) return;

    const step = ANALYSIS_STEPS[stepIndex];
    const stepEvents = ANALYSIS_EVENTS[step.id] ?? [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    stepEvents.forEach((event, index) => {
      timers.push(
        setTimeout(() => setEvents((prev) => [...prev, event]), (index + 1) * unit),
      );
    });

    timers.push(
      setTimeout(
        () => setStepIndex((index) => index + 1),
        stepEvents.length * unit + (reduced ? 150 : 420),
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [running, stepIndex, reduced, completeAnalysis, router]);

  useEffect(() => {
    terminalRef.current?.scrollTo({
      top: terminalRef.current.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [events, reduced]);

  if (!running || stepIndex < 0) {
    return (
      <ErrorState
        title="No analysis is running"
        description="Start an analysis from the upload page and the live progress will appear here."
      >
        <Button asChild>
          <Link href="/upload">Analyze a project</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </ErrorState>
    );
  }

  const progress = Math.min(
    100,
    Math.round((stepIndex / ANALYSIS_STEPS.length) * 100),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon-sm" aria-label="Back to dashboard">
          <Link href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            Analyzing your project...
          </h1>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {project?.name} · {project?.framework}
          </p>
        </div>
      </div>

      <WorkflowStrip current={1} />

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {Math.min(stepIndex + 1, ANALYSIS_STEPS.length)} of{" "}
            {ANALYSIS_STEPS.length}
          </span>
          <span className="font-mono tabular-nums">{progress}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Live progress: the remainder of the run is announced in a live region */}
      <span className="sr-only" aria-live="polite">
        {stepIndex < ANALYSIS_STEPS.length
          ? `Now: ${ANALYSIS_STEPS[stepIndex].label}`
          : "Preparing report"}
      </span>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Agent steps */}
        <ol className="flex flex-col gap-3" aria-label="Analysis steps">
          {ANALYSIS_STEPS.map((step, index) => {
            const isDone = index < stepIndex;
            const isActive = index === stepIndex;
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 transition-colors",
                  isActive
                    ? "border-brand/40 bg-brand-dim/40"
                    : isDone
                      ? "border-border"
                      : "border-border opacity-60",
                )}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center"
                  aria-hidden="true"
                >
                  {isDone ? (
                    <span className="pc-check-pop grid size-6 place-items-center rounded-full bg-verify-dim text-verify">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : isActive ? (
                    <span className="pc-step-pulse grid size-6 place-items-center rounded-full border border-brand/40 bg-brand-dim text-brand">
                      <Loader2 className="size-3.5 animate-spin" />
                    </span>
                  ) : (
                    <span className="size-2 rounded-full border border-muted-foreground/50" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive ? "text-brand" : "",
                    isDone && "text-muted-foreground",
                  )}
                >
                  {step.label}
                  {isActive && (
                    <span className="sr-only"> (in progress)</span>
                  )}
                </span>
                {isDone && (
                  <span className="ml-auto font-mono text-[11px] text-verify">
                    done
                  </span>
                )}
                {isActive && (
                  <span className="ml-auto font-mono text-[11px] text-brand">
                    running...
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Terminal panel */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
            <span className="size-2 rounded-full bg-critical/70" aria-hidden="true" />
            <span className="size-2 rounded-full bg-medium/70" aria-hidden="true" />
            <span className="size-2 rounded-full bg-verify/70" aria-hidden="true" />
            <span className="ml-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              analysis log
            </span>
          </div>
          <div
            ref={terminalRef}
            className="code-scroll h-[340px] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed lg:h-[420px]"
            style={{ backgroundColor: "var(--code-bg)" }}
            aria-label="Live analysis events"
          >
            {events.map((event, index) => (
              <p
                key={`${event}-${index}`}
                className={cn(
                  "text-[color:var(--code-fg)]",
                  index === events.length - 1 && "pc-caret",
                )}
              >
                <span className="mr-2 text-brand">$</span>
                {event}
              </p>
            ))}
            {events.length === 0 && (
              <p className="text-muted-foreground/60">waiting for events...</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}