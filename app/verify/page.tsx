"use client";

import { useMemo, type ReactNode, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LiveVerify } from "@/components/live/LiveVerify";
import {
  Activity,
  Check,
  CheckCircle2,
  FileCode2,
  FlaskConical,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import { useProof } from "@/lib/store";
import type { VerificationSummary } from "@/lib/store";
import type { Project } from "@/lib/types";

function defaultSummary(project?: Project): VerificationSummary {
  return {
    projectId: project?.id ?? "snapcart-api",
    projectName: project?.name ?? "snapcart-api",
    beforeHealth: 82,
    afterHealth: 94,
    before: { critical: 2, high: 5, medium: 7, low: 0 },
    after: { critical: 0, high: 2, medium: 4, low: 0 },
    tests: { passed: 12, total: 12 },
    whatChanged: [
      "Added safer input handling",
      "Added regression test",
      "Improved API error handling",
    ],
  };
}

function StatRow({
  icon,
  label,
  detail,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  detail: ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <span
        className={
          tone === "success"
            ? "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-verify-dim text-verify"
            : "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-brand-dim text-brand"
        }
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

function VerifyPageContent() {
  const { state, getProject, startAnalysis } = useProof();
  const router = useRouter();
  const searchParams = useSearchParams();
  const liveId = searchParams.get("live");

  const project = useMemo(() => getProject("snapcart-api"), [getProject]);
  const summary = useMemo<VerificationSummary>(
    () => state.lastVerification ?? defaultSummary(project),
    [state, project],
  );

  const runFullScan = () => {
    startAnalysis(summary.projectId);
    router.push("/analysis");
  };

  if (liveId) {
    return (
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center gap-3 py-24" aria-busy="true">
            <Loader2 className="size-6 animate-spin text-brand" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Verifying {liveId}…</p>
          </div>
        }
      >
        <LiveVerify id={liveId} />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Success hero */}
      <section
        aria-labelledby="verification-complete"
        className="relative overflow-hidden rounded-2xl border border-verify/30 bg-card px-6 py-14 text-center sm:py-16"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[30rem] -translate-x-1/2 rounded-full bg-verify/10 blur-3xl"
        />
        <div className="relative flex flex-col items-center" aria-live="polite">
          <span className="pc-check-pop grid size-16 place-items-center rounded-full border border-verify/40 bg-verify-dim text-verify">
            <Check className="size-9" strokeWidth={3} aria-hidden="true" />
          </span>
          <h1
            id="verification-complete"
            className="mt-6 font-mono text-3xl font-semibold tracking-tight text-verify sm:text-4xl"
          >
            VERIFIED
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Fix successfully applied and verified.
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {summary.projectName} · regression suite passed · security scan clean
          </p>
        </div>
      </section>

      <WorkflowStrip current={6} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Result summary */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Verification results
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              <StatRow
                icon={<FlaskConical className="size-4" aria-hidden="true" />}
                label="Tests"
                detail={
                  <span className="font-medium text-verify">
                    {summary.tests.passed} / {summary.tests.total} Passed
                  </span>
                }
                tone="success"
              />
              <StatRow
                icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                label="Security Scan"
                detail="Critical Issues: 2 → 0"
                tone="success"
              />
              <StatRow
                icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
                label="Regression Check"
                detail={<span className="font-medium text-verify">Passed</span>}
                tone="success"
              />
              <StatRow
                icon={<Activity className="size-4" aria-hidden="true" />}
                label="Project Health"
                detail={
                  <span className="font-medium text-verify">
                    {summary.beforeHealth} → {summary.afterHealth}
                  </span>
                }
                tone="success"
              />
            </ul>
          </CardContent>
        </Card>

        {/* Before / After */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Before vs. after
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Before
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-medium">
                    {summary.beforeHealth}
                    <span className="text-sm text-muted-foreground">/100</span>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li><span className="font-mono text-critical">{summary.before.critical}</span> Critical</li>
                    <li><span className="font-mono text-high">{summary.before.high}</span> High</li>
                    <li><span className="font-mono text-medium">{summary.before.medium}</span> Medium</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-verify/30 bg-verify-dim/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-verify">
                    After
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-verify">
                    {summary.afterHealth}
                    <span className="text-sm text-muted-foreground">/100</span>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li><span className="font-mono text-verify">{summary.after.critical}</span> <span className="text-muted-foreground">Critical</span></li>
                    <li><span className="font-mono text-high">{summary.after.high}</span> <span className="text-muted-foreground">High</span></li>
                    <li><span className="font-mono text-medium">{summary.after.medium}</span> <span className="text-muted-foreground">Medium</span></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-4 text-brand" aria-hidden="true" />
                What changed?
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {summary.whatChanged.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2
                      className="size-4 shrink-0 text-verify"
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="h-11 px-6">
          <Link href={`/projects/${summary.projectId}?tab=changes`}>
            <FileCode2 className="size-4" aria-hidden="true" />
            View Changes
          </Link>
        </Button>
        <Button size="lg" variant="outline" className="h-11 px-6" onClick={runFullScan}>
          <RefreshCcw className="size-4" aria-hidden="true" />
          Run Full Scan
        </Button>
        <Button asChild size="lg" variant="ghost" className="h-11 px-6">
          <Link href={`/projects/${summary.projectId}`}>Back to Project</Link>
        </Button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 py-24" aria-busy="true">
          <Loader2 className="size-6 animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Loading verification…</p>
        </div>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}