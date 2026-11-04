import { ShieldAlert, ShieldHalf, CircleAlert, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const META: Record<
  Severity,
  { label: string; className: string; icon: typeof ShieldAlert }
> = {
  critical: {
    label: "Critical",
    className: "border-critical/30 bg-critical/15 text-critical",
    icon: ShieldAlert,
  },
  high: {
    label: "High",
    className: "border-high/30 bg-high/15 text-high",
    icon: ShieldHalf,
  },
  medium: {
    label: "Medium",
    className: "border-medium/30 bg-medium/15 text-medium",
    icon: CircleAlert,
  },
  low: {
    label: "Low",
    className: "border-low/30 bg-low/15 text-low",
    icon: Info,
  },
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const meta = META[severity];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2 py-0.5 font-medium uppercase tracking-wide", meta.className, className)}>
      <Icon className="size-3" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export function severityOrder(severity: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity];
}