export type Severity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "fixed" | "dismissed";

export interface ApiIssue {
  id: string;
  detector: string;
  severity: Severity;
  title: string;
  explanation: string;
  whyItMatters: string;
  fileName: string;
  line: number;
  column: number;
  category: string;
  status: IssueStatus;
  before?: string;
  after?: string;
  fixAvailable: "auto" | "llm" | "none";
  fixSuggested?: string;
}

export interface ApiTest {
  name: string;
  status: "passed" | "failed" | "skipped";
  duration: string;
}

export interface ApiScore {
  label: string;
  before: number;
  after: number;
  hint: string;
}

export interface ApiSnapshot {
  date: string;
  label: string;
  health: number;
  critical: number;
  high: number;
  medium: number;
  result: "verified" | "pending" | "failed" | "skipped";
}

export interface ApiProject {
  id: string;
  name: string;
  source: "url" | "upload";
  url?: string;
  language: string;
  framework: string;
  createdAt: string;
  lastAnalyzed: string | null;
  health: number | null;
  healthAfter: number | null;
  status: "pending" | "analyzing" | "analyzed" | "error";
  error?: string;
  fileCount: number;
  issues: ApiIssue[];
  tests: ApiTest[];
  scores: ApiScore[];
  history: ApiSnapshot[];
}