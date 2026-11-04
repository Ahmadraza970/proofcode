"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  listProjects,
  type ProjectListItem,
} from "./api/client";
import {
  getSessionAccessToken,
  getSupabaseBrowser,
} from "./supabase-browser";
import type { ApiIssue, Severity } from "./api/types";

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/** Counts issues by severity, optionally restricted to one status. */
export function countBySeverity(
  issues: ApiIssue[],
  status?: ApiIssue["status"],
): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    if (status && issue.status !== status) continue;
    counts[issue.severity] += 1;
  }
  return counts;
}

export interface ProofContextValue {
  /** Real project summaries from GET /api/v1/projects. */
  projects: ProjectListItem[];
  loading: boolean;
  error: string | null;
  /**
   * True when this browser is not signed in, so the API answers 401.
   * Pages show the friendly sign-in/empty state instead of an
   * "unauthorized" error.
   */
  needsSignIn: boolean;
  refresh: () => Promise<void>;
}

const ProofContext = createContext<ProofContextValue | null>(null);

/**
 * Real-data store: the single source of project lists for the UI. Fetches
 * from the live API on mount; there is no seeded or demo data — when the API
 * has no projects, `projects` is empty and pages show empty states.
 */
export function ProofCodeProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjects();
      setProjects(res.projects);
      setNeedsSignIn(false);
    } catch (err) {
      // A 401 with no sign-in session is not an error from the visitor's
      // side — the workspace is private and empty until they sign
      // in. Pages render the sign-in/empty state for this flag.
      const sessionToken =
        err instanceof ApiError && err.status === 401
          ? await getSessionAccessToken()
          : null;
      if (err instanceof ApiError && err.status === 401 && !sessionToken) {
        setProjects([]);
        setError(null);
        setNeedsSignIn(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Could not load projects",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Sign-in / sign-out changes whose projects this browser may see, so the
  // list reloads whenever the Supabase session appears or disappears.
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void refresh();
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  return (
    <ProofContext.Provider
      value={{ projects, loading, error, needsSignIn, refresh }}
    >
      {children}
    </ProofContext.Provider>
  );
}

export function useProof(): ProofContextValue {
  const ctx = useContext(ProofContext);
  if (!ctx) {
    throw new Error("useProof must be used within a ProofCodeProvider");
  }
  return ctx;
}

export type { ProjectListItem, Severity };
