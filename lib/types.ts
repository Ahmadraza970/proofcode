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
