import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}