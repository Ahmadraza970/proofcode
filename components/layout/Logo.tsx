import { cn } from "@/lib/utils";

/**
 * ProofCode mark — a shield with a check above code brackets, drawn inline so
 * it inherits the current theme's tokens. `markOnly` renders just the glyph.
 */
export function Logo({
  className,
  markOnly = false,
}: {
  className?: string;
  markOnly?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <svg
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="size-6 shrink-0"
      >
        {/* Shield */}
        <path
          d="M14 2.2 24 5.2v6.9c0 5.2-4 9.9-10 11.7-6-1.8-10-6.5-10-11.7V5.2L14 2.2Z"
          fill="var(--brand)"
        />
        {/* Check */}
        <path
          d="m9.2 12.3 3 3 6.4-7"
          stroke="var(--brand-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Code brackets */}
        <path
          d="M14 7.8l-2 2.4 2 2.4M14 12.6l2-2.4-2-2.4"
          stroke="var(--brand-foreground)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
      </svg>
      {!markOnly && (
        <span className="text-[15px] font-semibold tracking-tight">
          Proof<span className="text-[var(--brand)]">Code</span>
        </span>
      )}
    </span>
  );
}