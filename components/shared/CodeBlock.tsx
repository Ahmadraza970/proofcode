import { cn } from "@/lib/utils";

/**
 * Quiet code block for diffs and snippets. `header` renders a small mono label
 * in the top bar; `highlightLines` tints whole lines to draw attention.
 */
export function CodeBlock({
  code,
  header,
  highlightLines,
  className,
}: {
  code: string;
  header?: string;
  highlightLines?: number[];
  className?: string;
}) {
  const lines = code.split("\n");
  const highlights = new Set(highlightLines ?? []);

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border border-border bg-[var(--code-bg,oklch(0.16 0.018 60))]",
        className,
      )}
      data-code-block
    >
      {header && (
        <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-1.5">
          <span className="flex gap-1.5">
            <span className="size-2 rounded-full bg-critical/60" />
            <span className="size-2 rounded-full bg-medium/60" />
            <span className="size-2 rounded-full bg-verify/60" />
          </span>
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            {header}
          </span>
        </div>
      )}
      <pre className="code-scroll overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code className="font-mono">
          {lines.map((line, index) => (
            <span
              key={index}
              className={cn(
                "block whitespace-pre pr-4",
                highlights.has(index + 1) && "bg-brand-dim",
                line.trim() === "" && "h-[1.2em]",
              )}
            >
              <span className="mr-3 inline-block w-4 select-none text-right text-muted-foreground/40 tabular-nums">
                {index + 1}
              </span>
              <span className="text-[color:var(--code-fg,oklch(0.9 0.015 80))]">
                {line || " "}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}