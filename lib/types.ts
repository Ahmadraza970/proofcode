export type Severity = "critical" | "high" | "medium" | "low";

export type IssueStatus = "open" | "fixing" | "fixed" | "dismissed";

export interface Issue {
  id: string;
  severity: Severity;
  title: string;
  explanation: string;
  whyItMatters: string;
  fileName: string;
  line: number;
  category: string;
  before: string;
  after: string;
  status: IssueStatus;
}

export interface ScoreCard {
  id: "security" | "reliability" | "testing" | "codeQuality" | "dependencies";
  label: string;
  /** Current (pre-fix) score value */
  before: number;
  /** Post-fix score if improved by a fix, else same as before */
  after: number;
  hint: string;
}

export interface TestCase {
  name: string;
  status: "passed" | "failed" | "skipped";
  duration: string;
}

export interface CodeChange {
  fileName: string;
  summary: string;
  linesAdded: number;
  linesRemoved: number;
  before: string;
  after: string;
}

export interface VerificationEntry {
  date: string;
  label: string;
  health: number;
  critical: number;
  high: number;
  medium: number;
  result: "verified" | "pending" | "failed";
}

export interface Project {
  id: string;
  name: string;
  description: string;
  language: string;
  framework: string;
  lastAnalyzed: string;
  health: number;
  /** Target health once the current fix is verified (82 -> 94). */
  healthAfter?: number;
  status: "excellent" | "good" | "needs-attention" | "at-risk";
  scores: ScoreCard[];
  issues: Issue[];
  tests: TestCase[];
  changes: CodeChange[];
  history: VerificationEntry[];
}

export interface AnalysisStep {
  id: string;
  label: string;
  done?: boolean;
  active?: boolean;
}

export interface FixStep {
  id: string;
  label: string;
  done?: boolean;
  active?: boolean;
}

export type AnalysisStatus = "idle" | "running" | "complete" | "failed";
export type FixStatus = "idle" | "running" | "complete" | "failed";

export interface AnalysisJob {
  projectId: string;
  status: AnalysisStatus;
  startedAt: string;
}

export interface FixJob {
  issueId: string;
  projectId: string;
  status: FixStatus;
  startedAt: string;
}

/** Lifecycle mirrors the product story: UPLOAD -> ANALYZE -> FIND -> EXPLAIN -> FIX -> TEST -> VERIFY */
export type WorkflowStage =
  | "upload"
  | "analyze"
  | "find"
  | "explain"
  | "fix"
  | "test"
  | "verify";