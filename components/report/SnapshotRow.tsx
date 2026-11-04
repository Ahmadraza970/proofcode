import { CheckCircle2, Clock3, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function SnapshotRow({
  date,
  label,
  health,
  critical,
  high,
  medium,
  result,
}: {
  date: string;
  label: string;
  health: number;
  critical: number;
  high: number;
  medium: number;
  result: "verified" | "pending" | "failed" | "skipped";
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3" aria-hidden="true" />
          {date}
        </p>
      </div>
      <p className="font-mono text-sm font-semibold tabular-nums">
        <span
          className={cn(
            health >= 90
              ? "text-verify"
              : health >= 75
                ? "text-medium"
                : "text-critical",
          )}
        >
          {health}
        </span>
        <span className="text-muted-foreground">/100</span>
      </p>
      <span className="font-mono text-xs text-muted-foreground">
        <span className="text-critical">{critical}</span>C ·{" "}
        <span className="text-high">{high}</span>H ·{" "}
        <span className="text-medium">{medium}</span>M
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
          result === "verified" && "border-verify/30 bg-verify-dim text-verify",
          result === "pending" && "border-medium/30 bg-medium/15 text-medium",
          result === "failed" && "border-critical/30 bg-critical/15 text-critical",
          result === "skipped" && "border-border bg-muted/50 text-muted-foreground",
        )}
      >
        {result === "verified" && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
        {result === "failed" && <XCircle className="size-3.5" aria-hidden="true" />}
        {result === "skipped" && <MinusCircle className="size-3.5" aria-hidden="true" />}
        {result}
      </span>
    </div>
  );
}