"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import { LiveVerify } from "@/components/live/LiveVerify";

function VerifyContent() {
  const searchParams = useSearchParams();
  const liveId = searchParams.get("live");

  if (liveId) {
    return <LiveVerify projectId={liveId} />;
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="mx-auto w-full max-w-2xl pt-6">
        <EmptyState
          icon={<ClipboardCheck className="size-6" aria-hidden="true" />}
          title="No verification selected"
          description="Verification runs against a real project. Open a project report and choose Verify, or pick a project from your reports."
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/projects">Choose a project</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports">Open Reports</Link>
            </Button>
          </div>
        </EmptyState>
      </div>
      <div className="border-t border-border pt-6">
        <WorkflowStrip current={5} />
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center gap-3 py-24 text-muted-foreground"
          aria-busy="true"
        >
          <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm">Loading verification…</p>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
