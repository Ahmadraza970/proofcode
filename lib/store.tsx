"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { listProjects, type ProjectListItem } from "./api/client";
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
  refresh: () => Promise<void>;
}

const ProofContext = createContext<ProofContextValue | null>(null);

/**
 * Real-data store: the single source of project lists for the UI. Fetches
 * from the live API on mount; there is no seeded or demo data — when the API
 * has no projects, `projects` is simply empty and pages show empty states.
 */
export function ProofCodeProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjects();
      setProjects(res.projects);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load projects",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ProofContext.Provider value={{ projects, loading, error, refresh }}>
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
