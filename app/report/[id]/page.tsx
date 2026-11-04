"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveReport } from "@/components/live/LiveReport";

/**
 * Every report is rendered from the real API. There is no demo branch: any
 * project ID is served by LiveReport, which loads the project record and
 * shows an honest error state for unknown IDs.
 */
export default function ReportPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="flex flex-col gap-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
      >
        <Link href="/projects">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All projects
        </Link>
      </Button>
      <LiveReport id={params.id} />
    </div>
  );
}
