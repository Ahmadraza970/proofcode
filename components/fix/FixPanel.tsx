"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Terminal } from "lucide-react";
import { FIX_EVENTS, FIX_STEPS } from "@/lib/mock-data";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Runs the 5-step fix agent and calls onComplete once the last step lands.
 * Mirrors the analysis machine: timed steps + a small live event feed.
 */
export function FixPanel({
  onComplete,
  className,
}: {
  onComplete: () => void;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unit = reduced ? 110 : 300;

    if (stepIndex >= FIX_STEPS.length) {
      const timer = setTimeout(onComplete, reduced ? 120 : 650);
      return () => clearTimeout(timer);
    }

    const step = FIX_STEPS[stepIndex];
    const stepEvents = FIX_EVENTS[step.id] ?? [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    stepEvents.forEach((event, index) => {
      timers.push(
        setTimeout(() => setEvents((prev) => [...prev, event]), (index + 1) * unit),
      );
    });

    timers.push(
      setTimeout(
        () => setStepIndex((index) => index + 1),
        stepEvents.length * unit + (reduced ? 120 : 360),
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [stepIndex, reduced, onComplete]);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [events, reduced]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 sm:p-6",
        className,
      )}
      aria-label="Fixing issue agent progress"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
        <h3 className="font-semibold">Fixing issue...</h3>
      </div>

      <ol className="mt-5 flex flex-col gap-2.5" aria-label="Fix steps">
        {FIX_STEPS.map((step, index) => {
          const isDone = index < stepIndex;
          const isActive = index === stepIndex;
          return (
            <li key={step.id} className="flex items-center gap-3">
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
                {isDone ? (
                  <Check className="size-4 text-verify" strokeWidth={3} />
                ) : isActive ? (
                  <Loader2 className="size-4 animate-spin text-brand" />
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                )}
              </span>
              <span
                className={cn(
                  "text-sm",
                  isDone && "text-muted-foreground line-through decoration-muted-foreground/40",
                  isActive && "font-medium text-brand",
                )}
              >
                {step.label}
              </span>
              {isActive && (
                <span className="sr-only">in progress</span>
              )}
            </li>
          );
        })}
      </ol>

      <div
        ref={logRef}
        className="code-scroll mt-5 h-28 overflow-y-auto rounded-lg border border-border/70 p-3 font-mono text-[12px] leading-relaxed"
        style={{ backgroundColor: "var(--code-bg)" }}
        aria-label="Fix agent events"
      >
        {events.length === 0 && (
          <p className="text-muted-foreground/60">waiting for events...</p>
        )}
        {events.map((event, index) => (
          <p key={`${event}-${index}`} className="text-[color:var(--code-fg)]">
            <Terminal className="mr-2 inline size-3 text-brand" aria-hidden="true" />
            {event}
          </p>
        ))}
      </div>
    </div>
  );
}