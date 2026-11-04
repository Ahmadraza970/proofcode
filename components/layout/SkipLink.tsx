export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[60] rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
  );
}