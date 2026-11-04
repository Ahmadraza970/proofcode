"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  FIX_RESOLVES,
  MOCK_PROJECTS,
} from "./mock-data";
import type {
  AnalysisJob,
  FixJob,
  Issue,
  Project,
  Severity,
  WorkflowStage,
} from "./types";

export interface Counts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface VerificationSummary {
  projectId: string;
  projectName: string;
  beforeHealth: number;
  afterHealth: number;
  before: Counts;
  after: Counts;
  tests: { passed: number; total: number };
  whatChanged: string[];
}

export interface ProofState {
  projects: Project[];
  analysisJob: AnalysisJob | null;
  fixJob: FixJob | null;
  lastVerification: VerificationSummary | null;
}

type ProofAction =
  | { type: "START_ANALYSIS"; projectId: string }
  | { type: "COMPLETE_ANALYSIS"; projectId: string }
  | { type: "FAIL_ANALYSIS"; projectId: string }
  | { type: "DISMISS_ISSUE"; projectId: string; issueId: string }
  | { type: "START_FIX"; projectId: string; issueId: string }
  | { type: "COMPLETE_FIX"; projectId: string; issueId: string }
  | { type: "FAIL_FIX"; projectId: string; issueId: string }
  | { type: "START_FIX_ALL"; projectId: string }
  | { type: "COMPLETE_FIX_ALL"; projectId: string }
  | { type: "FAIL_FIX_ALL"; projectId: string };

/** Placeholder issue id identifying the "Fix All Bugs" job in fixJob. */
const FIX_ALL_ID = "__fix_all__";

function countOpen(issues: Issue[]): Counts {
  return issues.reduce<Counts>(
    (acc, issue) => {
      if (issue.status === "fixed" || issue.status === "dismissed") return acc;
      acc[issue.severity] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}

function totalOpen(counts: Counts) {
  return counts.critical + counts.high + counts.medium + counts.low;
}

function buildVerification(
  project: Project,
  fixJob: FixJob,
  before: Counts,
): VerificationSummary {
  const after = countOpen(project.issues);
  return {
    projectId: project.id,
    projectName: project.name,
    beforeHealth: project.health,
    afterHealth: project.healthAfter ?? project.health,
    before,
    after,
    tests: { passed: 12, total: 12 },
    whatChanged: [
      "Added safer input handling",
      "Added regression test",
      "Improved API error handling",
    ],
  };
}

function withProjectIssues(
  project: Project,
  mutate: (issues: Issue[]) => Issue[],
): Project {
  return { ...project, issues: mutate(project.issues) };
}

function reducer(state: ProofState, action: ProofAction): ProofState {
  switch (action.type) {
    case "START_ANALYSIS": {
      const job: AnalysisJob = {
        projectId: action.projectId,
        status: "running",
        startedAt: new Date().toISOString(),
      };
      return { ...state, analysisJob: job };
    }
    case "COMPLETE_ANALYSIS": {
      const job = state.analysisJob;
      if (!job || job.projectId !== action.projectId) return state;
      return {
        ...state,
        analysisJob: { ...job, status: "complete" },
      };
    }
    case "FAIL_ANALYSIS": {
      const job = state.analysisJob;
      if (!job || job.projectId !== action.projectId) return state;
      return { ...state, analysisJob: { ...job, status: "failed" } };
    }
    case "DISMISS_ISSUE":
      return {
        ...state,
        projects: state.projects.map((project) =>
          project.id === action.projectId
            ? withProjectIssues(project, (issues) =>
                issues.map((issue) =>
                  issue.id === action.issueId
                    ? { ...issue, status: "dismissed" as const }
                    : issue,
                ),
              )
            : project,
        ),
      };
    case "START_FIX": {
      const job: FixJob = {
        issueId: action.issueId,
        projectId: action.projectId,
        status: "running",
        startedAt: new Date().toISOString(),
      };
      return {
        ...state,
        fixJob: job,
        projects: state.projects.map((project) =>
          project.id === action.projectId
            ? withProjectIssues(project, (issues) =>
                issues.map((issue) =>
                  issue.id === action.issueId
                    ? { ...issue, status: "fixing" as const }
                    : issue,
                ),
              )
            : project,
        ),
      };
    }
    case "COMPLETE_FIX": {
      const job = state.fixJob;
      if (!job) return state;
      const project = state.projects.find((p) => p.id === action.projectId);
      if (!project || !job.issueId) return state;
      const before = countOpen(project.issues);
      const resolved = FIX_RESOLVES[job.issueId] ?? [job.issueId];
      const resolvedSet = new Set(resolved);
      const updated: Project = withProjectIssues(project, (issues) =>
        issues.map((issue) =>
          resolvedSet.has(issue.id) ? { ...issue, status: "fixed" } : issue,
        ),
      );
      const next = {
        ...updated,
        health: updated.healthAfter ?? updated.health,
        lastAnalyzed: "Just now",
        history: [
          {
            date: "Aug 28, 2026 14:22",
            label: "Fix applied + rescan",
            health: updated.healthAfter ?? updated.health,
            critical: 0,
            high: 2,
            medium: 4,
            result: "verified" as const,
          },
          ...updated.history,
        ],
      };
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? next : p,
        ),
        fixJob: { ...job, status: "complete" },
        lastVerification: buildVerification(next, job, before),
      };
    }
    case "FAIL_FIX": {
      const job = state.fixJob;
      if (!job) return state;
      return {
        ...state,
        fixJob: { ...job, status: "failed" },
        projects: state.projects.map((project) =>
          project.id === action.projectId
            ? withProjectIssues(project, (issues) =>
                issues.map((issue) =>
                  issue.id === job.issueId
                    ? { ...issue, status: "open" as const }
                    : issue,
                ),
              )
            : project,
        ),
      };
    }
    case "START_FIX_ALL": {
      const job: FixJob = {
        issueId: FIX_ALL_ID,
        projectId: action.projectId,
        status: "running",
        startedAt: new Date().toISOString(),
      };
      return {
        ...state,
        fixJob: job,
        projects: state.projects.map((project) =>
          project.id === action.projectId
            ? withProjectIssues(project, (issues) =>
                issues.map((issue) =>
                  issue.status === "open" || issue.status === "fixing"
                    ? { ...issue, status: "fixing" as const }
                    : issue,
                ),
              )
            : project,
        ),
      };
    }
    case "COMPLETE_FIX_ALL": {
      const job = state.fixJob;
      if (!job || job.projectId !== action.projectId) return state;
      const project = state.projects.find((p) => p.id === action.projectId);
      if (!project) return state;
      const before = countOpen(project.issues);
      const updated: Project = withProjectIssues(project, (issues) =>
        issues.map((issue) =>
          issue.status === "open" || issue.status === "fixing"
            ? { ...issue, status: "fixed" }
            : issue,
        ),
      );
      const after = countOpen(updated.issues);
      const next = {
        ...updated,
        health: updated.healthAfter ?? updated.health,
        lastAnalyzed: "Just now",
        history: [
          {
            date: "Aug 28, 2026 14:22",
            label: "Fix all applied + rescan",
            health: updated.healthAfter ?? updated.health,
            critical: after.critical,
            high: after.high,
            medium: after.medium,
            result: "verified" as const,
          },
          ...updated.history,
        ],
      };
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? next : p,
        ),
        fixJob: { ...job, status: "complete" },
        lastVerification: buildVerification(next, job, before),
      };
    }
    case "FAIL_FIX_ALL": {
      const job = state.fixJob;
      if (!job) return state;
      return {
        ...state,
        fixJob: { ...job, status: "failed" },
        projects: state.projects.map((project) =>
          project.id === action.projectId
            ? withProjectIssues(project, (issues) =>
                issues.map((issue) =>
                  issue.status === "fixing"
                    ? { ...issue, status: "open" as const }
                    : issue,
                ),
              )
            : project,
        ),
      };
    }
    default:
      return state;
  }
}

const initialState: ProofState = {
  projects: MOCK_PROJECTS.map((project) => ({
    ...project,
    healthAfter: project.healthAfter ?? undefined,
  })),
  analysisJob: null,
  fixJob: null,
  lastVerification: null,
};

interface ProofContextValue {
  state: ProofState;
  getProject: (id: string) => Project | undefined;
  getIssue: (projectId: string, issueId: string) => Issue | undefined;
  countOpenIssues: (project: Project) => Counts;
  startAnalysis: (projectId: string) => void;
  completeAnalysis: (projectId: string) => void;
  failAnalysis: (projectId: string) => void;
  dismissIssue: (projectId: string, issueId: string) => void;
  startFix: (projectId: string, issueId: string) => void;
  completeFix: (projectId: string, issueId: string) => void;
  failFix: (projectId: string, issueId: string) => void;
  startFixAll: (projectId: string) => void;
  completeFixAll: (projectId: string) => void;
  failFixAll: (projectId: string) => void;
  /** Array of [stage, isCurrent] pairs rendered as the always-on workflow strip. */
  workflow: WorkflowStage[];
}

const ProofContext = createContext<ProofContextValue | null>(null);

const WORKFLOW: WorkflowStage[] = [
  "upload",
  "analyze",
  "find",
  "explain",
  "fix",
  "test",
  "verify",
];

export function ProofCodeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const getProject = useCallback(
    (id: string) => state.projects.find((project) => project.id === id),
    [state.projects],
  );

  const getIssue = useCallback(
    (projectId: string, issueId: string) =>
      getProject(projectId)?.issues.find((issue) => issue.id === issueId),
    [getProject],
  );

  const countOpenIssues = useCallback(
    (project: Project) => countOpen(project.issues),
    [],
  );

  const value = useMemo<ProofContextValue>(
    () => ({
      state,
      getProject,
      getIssue,
      countOpenIssues,
      startAnalysis: (projectId) => dispatch({ type: "START_ANALYSIS", projectId }),
      completeAnalysis: (projectId) => dispatch({ type: "COMPLETE_ANALYSIS", projectId }),
      failAnalysis: (projectId) => dispatch({ type: "FAIL_ANALYSIS", projectId }),
      dismissIssue: (projectId, issueId) =>
        dispatch({ type: "DISMISS_ISSUE", projectId, issueId }),
      startFix: (projectId, issueId) =>
        dispatch({ type: "START_FIX", projectId, issueId }),
      completeFix: (projectId, issueId) =>
        dispatch({ type: "COMPLETE_FIX", projectId, issueId }),
      failFix: (projectId, issueId) =>
        dispatch({ type: "FAIL_FIX", projectId, issueId }),
      startFixAll: (projectId) =>
        dispatch({ type: "START_FIX_ALL", projectId }),
      completeFixAll: (projectId) =>
        dispatch({ type: "COMPLETE_FIX_ALL", projectId }),
      failFixAll: (projectId) =>
        dispatch({ type: "FAIL_FIX_ALL", projectId }),
      workflow: WORKFLOW,
    }),
    [state, getProject, getIssue, countOpenIssues],
  );

  return <ProofContext.Provider value={value}>{children}</ProofContext.Provider>;
}

export function useProof(): ProofContextValue {
  const context = useContext(ProofContext);
  if (!context) {
    throw new Error("useProof must be used within a ProofCodeProvider");
  }
  return context;
}

export { countOpen, totalOpen };
export type { Severity };