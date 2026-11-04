import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { healthColor } from "./HealthRing";

export function ScoreCard({
  label,
  value,
  hint,
  improved,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  improved?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          {improved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-verify-dim px-1.5 py-0.5 text-[11px] font-medium text-verify">
              <TrendingUp className="size-3" aria-hidden="true" />
              fixed
            </span>
          )}
        </div>
        <p
          className="mt-1 font-mono text-2xl font-semibold tabular-nums"
          style={{ color: healthColor(value) }}
        >
          {value}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${value}%`,
              backgroundColor: healthColor(value),
            }}
          />
        </div>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}