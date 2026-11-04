import {
  UploadCloud,
  ScanSearch,
  SearchCheck,
  FileSearch,
  Wrench,
  FlaskConical,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "upload", label: "Upload", icon: UploadCloud },
  { key: "analyze", label: "Analyze", icon: ScanSearch },
  { key: "find", label: "Find", icon: SearchCheck },
  { key: "explain", label: "Explain", icon: FileSearch },
  { key: "fix", label: "Fix", icon: Wrench },
  { key: "test", label: "Test", icon: FlaskConical },
  { key: "verify", label: "Verify", icon: ShieldCheck },
];

/**
 * The always-on product narrative. `current` is the index (0-6) of the stage in
 * flight; pass nothing on static screens to render it as a quiet timeline.
 */
export function WorkflowStrip({
  current,
  className,
  compact = false,
}: {
  current?: number;
  className?: string;
  compact?: boolean;
}) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 sm:gap-2",
        className,
      )}
      aria-label="Verification workflow"
    >
      {STAGES.map((stage, index) => {
        const Icon = stage.icon;
        const state =
          current === undefined
            ? "static"
            : index < current
              ? "done"
              : index === current
                ? "active"
                : "upcoming";
        return (
          <li
            key={stage.key}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
              compact ? "text-[11px]" : "text-xs",
              state === "done" &&
                "border-verify/30 bg-verify-dim text-verify",
              state === "active" &&
                "border-brand/40 bg-brand-dim text-brand",
              state === "upcoming" && "border-border text-muted-foreground",
              state === "static" && "border-border text-muted-foreground",
            )}
            aria-current={state === "active" ? "step" : undefined}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="font-medium">{stage.label}</span>
            {current !== undefined && <span className="sr-only">{state}</span>}
          </li>
        );
      })}
    </ol>
  );
}