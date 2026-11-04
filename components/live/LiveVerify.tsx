"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  CheckCircle2,
  FileCode2,
  FlaskConical,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/ErrorState";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import {
  ensureToken,
  verifyProjectLive,
  getProjectLive,
  type ApiProject,
  type VerifyOutcome,
} from "@/lib/api/client";

function StatRow({
  icon,
  label,
  detail,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  detail: React.ReactNode;
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

export function LiveVerify({ id }: { id: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [result, setResult] = useState<VerifyOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await ensureToken();
        const outcome = await verifyProjectLive(token, id);
        if (!cancelled) setResult(outcome);
        if (!cancelled) setProject(await getProjectLive(id));
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Verification failed");
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const rerun = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const token = await ensureToken();
      const outcome = await verifyProjectLive(token, id);
      setResult(outcome);
      setProject(await getProjectLive(id));
      toast.success(outcome.result === "verified" ? "Verified." : "Verification recorded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setRunning(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-muted/50" />
          <div className="h-64 animate-pulse rounded-xl bg-muted/50" />
        </div>
      </div>
    );
  }

  if (error || !result || !project) {
    return (
      <ErrorState
        title="Verification unavailable"
        description={error ?? "This project could not be verified."}
      >
        <Button onClick={rerun} variant="outline" disabled={running}>
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCcw className="size-4" aria-hidden="true" />
          )}
          Try again
        </Button>
        <Button asChild>
          <Link href={`/report/${id}`}>Back to report</Link>
        </Button>
      </ErrorState>
    );
  }

  const before = project.healthAfter ?? project.health ?? 0;
  const after = result.snapshot.health;
  const passedTests = result.tests.filter((t) => t.status === "passed").length;

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="live-verification-complete"
        className="relative overflow-hidden rounded-2xl border px-6 py-14 text-center sm:py-16"
        style={{
          borderColor:
            result.result === "verified"
              ? "var(--verify)"
              : "var(--severity-high)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[30rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            backgroundColor: result.result === "verified" ? "color-mix(in oklch, var(--verify) 12%, transparent)" : "color-mix(in oklch, var(--severity-high) 12%, transparent)",
          }}
        />
        <div className="relative flex flex-col items-center" aria-live="polite">
          <span
            className="pc-check-pop grid size-16 place-items-center rounded-full border"
            style={{
              borderColor: result.result === "verified" ? "var(--verify)" : "var(--severity-high)",
              backgroundColor: result.result === "verified" ? "color-mix(in oklch, var(--verify) 14%, transparent)" : "color-mix(in oklch, var(--severity-high) 14%, transparent)",
            }}
          >
            {result.result === "verified" ? (
              <Check className="size-9" strokeWidth={3} style={{ color: "var(--verify)" }} aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-9" strokeWidth={2} style={{ color: "var(--severity-high)" }} aria-hidden="true" />
            )}
          </span>
          <h1
            id="live-verification-complete"
            className="mt-6 font-mono text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: result.result === "verified" ? "var(--verify)" : "var(--severity-high)" }}
          >
            {result.result === "verified" ? "VERIFIED" : result.result === "failed" ? "FAILED" : "REVIEW"}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {result.result === "verified"
              ? "Security scan clean and tests passed."
              : result.result === "failed"
                ? "One or more checks did not pass."
                : "No test suite was detected — security re-scan only."}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {project.name} · {result.snapshot.label || "verification"}
          </p>
        </div>
      </section>

      <WorkflowStrip current={6} />

      <div className="grid gap-6 lg:grid-cols-2">
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
                  <span className="font-medium" style={{ color: "var(--verify)" }}>
                    {passedTests} / {result.tests.length} Passed
                  </span>
                }
                tone="success"
              />
              <StatRow
                icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                label="Security Scan"
                detail={
                  result.snapshot.critical > 0
                    ? `${result.snapshot.critical} critical issue(s) open`
                    : "No critical issues"
                }
              />
              <StatRow
                icon={<Activity className="size-4" aria-hidden="true" />}
                label="Project Health"
                detail={
                  <span className="font-medium" style={{ color: "var(--verify)" }}>
                    {before} → {after}
                  </span>
                }
                tone="success"
              />
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Snapshot
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Before
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold text-medium">
                  {before}
                  <span className="text-sm text-muted-foreground">/100</span>
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>
                    <span className="font-mono text-critical">{result.snapshot.critical}</span> Critical
                  </li>
                  <li>
                    <span className="font-mono text-high">{result.snapshot.high}</span> High
                  </li>
                  <li>
                    <span className="font-mono text-medium">{result.snapshot.medium}</span> Medium
                  </li>
                </ul>
              </div>
              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "var(--verify)",
                  backgroundColor: "color-mix(in oklch, var(--verify) 8%, transparent)",
                }}
              >
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--verify)" }}>
                  After
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold" style={{ color: "var(--verify)" }}>
                  {after}
                  <span className="text-sm text-muted-foreground">/100</span>
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>
                    <span className="font-mono" style={{ color: "var(--verify)" }}>{project.issues.filter((i) => i.status === "open" && i.severity === "critical").length}</span> Critical open
                  </li>
                  <li>
                    <span className="font-mono text-high">{project.issues.filter((i) => i.status === "open" && i.severity === "high").length}</span> High
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="h-11 px-6">
          <Link href={`/report/${id}`}>
            <FileCode2 className="size-4" aria-hidden="true" />
            View Report
          </Link>
        </Button>
        <Button size="lg" variant="outline" className="h-11 px-6" onClick={rerun} disabled={running}>
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCcw className="size-4" aria-hidden="true" />
          )}
          {running ? "Verifying…" : "Re-verify"}
        </Button>
        <Button size="lg" variant="ghost" className="h-11 px-6" onClick={() => router.push("/upload")}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Analyze another
        </Button>
      </div>
    </div>
  );
}
