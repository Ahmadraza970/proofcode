import { cn } from "@/lib/utils";

export function healthColor(score: number) {
  if (score >= 90) return "var(--verify)";
  if (score >= 75) return "var(--severity-medium)";
  if (score >= 60) return "var(--severity-high)";
  return "var(--severity-critical)";
}

export function healthLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Needs Attention";
  if (score >= 60) return "At Risk";
  return "Critical";
}

/**
 * Circular health gauge. `score` 0-100; tracks "fixed" values too via `delta`
 * (the raw movement before -> after) so the gauge can animate forward on a fix.
 */
export function HealthRing({
  score,
  size = 148,
  stroke = 10,
  label,
  sub,
  delta,
  display,
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
  delta?: number;
  /** Overrides the centre number (e.g. "—" when no score exists). */
  display?: string;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));

  return (
    <div
      className={cn("inline-flex flex-col items-center gap-2", className)}
      role="img"
      aria-label={display ? (label ?? "No health score") : `Health score ${score} out of 100`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={healthColor(score)}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress / 100)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-4xl font-semibold tabular-nums tracking-tight"
            style={{ color: display ? "var(--muted-foreground)" : healthColor(score) }}
          >
            {display ?? score}
          </span>
          {!display && <span className="font-mono text-xs text-muted-foreground">/100</span>}
        </div>
      </div>
      {label && <span className="text-sm font-medium">{label}</span>}
      {sub && <span className="-mt-1 text-xs text-muted-foreground">{sub}</span>}
      {typeof delta === "number" && delta !== 0 && (
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums",
            delta > 0
              ? "bg-verify-dim text-verify"
              : "bg-critical/15 text-critical",
          )}
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </div>
  );
}