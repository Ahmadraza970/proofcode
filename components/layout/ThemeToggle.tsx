"use client";

import { useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reads and writes the theme straight off <html class + data-theme>, which the
 * inline script in app/layout.tsx has already applied before first paint.
 *
 * Deliberately holds no React state: the correct icon is chosen by CSS from the
 * ancestor [data-theme] attribute (see globals.css), so the server HTML is valid
 * for either theme — no hydration mismatch, no flash.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    root.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode — the attribute still applies for this session */
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
      className={cn(
        "grid h-9 min-w-9 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Sun className="hidden size-[15px] dark:block" aria-hidden="true" />
      <Moon className="block size-[15px] dark:hidden" aria-hidden="true" />
    </button>
  );
}