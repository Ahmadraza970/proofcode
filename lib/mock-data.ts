import type { Issue, Project, ScoreCard, TestCase, VerificationEntry } from "./types";

export const WORKFLOW_STEPS = [
  "Upload",
  "Analyze",
  "Find",
  "Explain",
  "Fix",
  "Test",
  "Verify",
] as const;

export const ANALYSIS_STEPS = [
  { id: "uploaded", label: "Project uploaded" },
  { id: "map", label: "Building project map" },
  { id: "deps", label: "Inspecting dependencies" },
  { id: "static", label: "Running static analysis" },
  { id: "ai", label: "AI code analysis" },
  { id: "tests", label: "Generating verification tests" },
  { id: "report", label: "Preparing report" },
] as const;

export const ANALYSIS_EVENTS: Record<string, string[]> = {
  uploaded: ["Source package accepted", "Analyzing 1,482 files in snapcart-api"],
  map: [
    "Building project map...",
    "Identified 412 modules across 14 packages",
    "Indexing entry points: server.ts, workers/, api/**",
  ],
  deps: [
    "Resolving dependency graph...",
    "node_modules: 1,213 packages scanned",
    "Checking dependency configuration...",
    "8 transitive dependencies flagged for review",
  ],
  static: [
    "Scanning src/auth...",
    "Inspecting API handlers...",
    "Running rule set: security, reliability, correctness",
    "Checking error handling paths...",
  ],
  ai: [
    "Reading candidate results from static scan...",
    "Tracing data flow through critical paths...",
    "Analyzing error handling coverage...",
    "Cross-referencing 34 findings against known patterns",
  ],
  tests: [
    "Generating verification cases...",
    "Writing regression tests for suspected inputs",
    "Preparing test harness for 12 scenarios",
  ],
  report: [
    "Ranking findings by severity...",
    "Writing explanations and suggested fixes",
    "Report ready.",
  ],
};

export const FIX_STEPS = [
  { id: "understand", label: "Understanding affected code" },
  { id: "patch", label: "Generating patch" },
  { id: "apply", label: "Applying changes" },
  { id: "regression", label: "Generating regression test" },
  { id: "verify", label: "Running verification" },
] as const;

export const FIX_EVENTS: Record<string, string[]> = {
  understand: [
    "Reading src/api/users.ts:42...",
    "Tracing callers of getUser query...",
  ],
  patch: [
    "Preparing parameterized query patch...",
    "Validating patch against 3 call sites...",
  ],
  apply: [
    "Applying changes to 2 files...",
    "Formatting updated source...",
  ],
  regression: [
    "Writing regression test: rejects malicious input...",
    "Wiring test into verification suite...",
  ],
  verify: [
    "Running 12/12 tests...",
    "Security scan: critical findings 0",
    "Verification passed.",
  ],
};

const userApiIssue: Issue = {
  id: "sql-injection",
  severity: "critical",
  title: "Potential SQL Injection",
  explanation:
    "User-controlled input is being interpolated directly into a SQL query string. An attacker who controls the query parameter could alter the query's logic and read, modify, or delete data they should not have access to.",
  whyItMatters:
    "SQL injection is one of the most exploited web vulnerabilities. A single vulnerable endpoint can expose the entire database — including credentials, payment data, and user records — and it is a common source of production breaches.",
  fileName: "src/api/users.ts",
  line: 42,
  category: "Security",
  before: `router.get("/users/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  const sql = \`SELECT * FROM users WHERE id = \${id}\`;
  const rows = await db.query(sql); // unsafe
  res.json(rows);
});`,
  after: `router.get("/users/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "invalid id" });
  }
  const sql = "SELECT * FROM users WHERE id = $1";
  const rows = await db.query(sql, [id]); // parameterized
  res.json(rows);
});`,
  status: "open",
};

const issueFactory = (
  partial: Omit<Issue, "status" | "whyItMatters" | "before" | "after"> &
    Partial<Pick<Issue, "status" | "whyItMatters" | "before" | "after">>,
): Issue => ({
  status: "open",
  whyItMatters:
    "Unaddressed, this degrades the reliability and security of the codebase and accelerates technical debt.",
  before: "",
  after: "",
  ...partial,
});

export const snapcartIssues: Issue[] = ((): Issue[] => {
  const issues: Issue[] = [
    userApiIssue,
    {
      id: "sensitive-error-exposure",
      severity: "critical",
      title: "Sensitive Data in Error Responses",
      explanation:
        "Unhandled exceptions bubble up raw stack traces and internal query shapes to the API client, leaking schema details and potentially sensitive values.",
      whyItMatters:
        "Error output is a reconnaissance goldmine for attackers. Once the exposed shape of the system is known, every other vulnerability becomes much easier to exploit.",
      fileName: "src/middleware/error.ts",
      line: 9,
      category: "Security",
      before: `export function onError(err: unknown, req: Request, res: Response) {
  console.error(err);
  // raw stack is returned to the client:
  res.status(500).json({ error: String(err) });
}`,
      after: `export function onError(err: unknown, req: Request, res: Response) {
  console.error(err);
  const code = err instanceof AppError ? err.status : 500;
  res.status(code).json({
    error: "internal error",
    requestId: req.id,
  });
}`,
      status: "open",
    },
    {
      id: "input-validation-profile",
      severity: "high",
      title: "Missing Input Validation",
      explanation:
        "The profile update handler trusts the request body without checking types, lengths, or allowed fields, so malformed or oversized payloads are processed as-is.",
      whyItMatters:
        "Unvalidated input is the root cause behind most injection, overflow, and data-integrity bugs. Validating at the boundary stops the class of bug before it starts.",
      fileName: "src/api/profile.ts",
      line: 18,
      category: "Security",
      before: `router.patch("/profile", async (req: Request, res: Response) => {
  const body = req.body; // unvalidated
  const updated = await updateProfile(req.userId, body);
  res.json(updated);
});`,
      after: `const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().url().optional(),
}).strict();

router.patch("/profile", async (req: Request, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const updated = await updateProfile(req.userId, parsed.data);
  res.json(updated);
});`,
      status: "open",
    },
    {
      id: "unsafe-redirect",
      severity: "high",
      title: "Open Redirect in Callback",
      explanation:
        "The OAuth callback forwards users to a URL provided in the query string without host validation, allowing phishing links that start on a trusted domain.",
      whyItMatters:
        "Open redirects trivially bypass a user's trust in the domain and are a standard stepping stone in credential phishing.",
      fileName: "src/api/auth/callback.ts",
      line: 64,
      category: "Security",
      before: `router.get("/callback", async (req, res) => {
  const session = await exchangeCode(req.query.code as string);
  const next = req.query.next as string;
  res.redirect(next || "/"); // attacker-controlled host
});`,
      after: `const SAFE_ORIGINS = new Set(["https://snapcart.app"]);

router.get("/callback", async (req, res) => {
  const session = await exchangeCode(req.query.code as string);
  const requested = req.query.next as string;
  const next = requested && new URL(requested, "https://snapcart.app").origin
    === "https://snapcart.app"
    ? requested
    : "/";
  res.redirect(next);
});`,
      status: "open",
    },
    {
      id: "unhandled-rejection",
      severity: "high",
      title: "Unhandled Promise Rejection",
      explanation:
        "The order webhook handler fires an async processing task without attaching a rejection handler, so failures drop silently into the void.",
      whyItMatters:
        "Silent failures in payment-adjacent flows are the worst kind: the customer sees success, the system records a failure state, and money or inventory drifts out of sync.",
      fileName: "src/api/webhooks/order.ts",
      line: 87,
      category: "Reliability",
      before: `router.post("/order", async (req, res) => {
  const event = validateSignature(req);
  res.status(202).json({ accepted: true });
  processOrder(event).catch(() => void 0); // swallowed
});`,
      after: `router.post("/order", async (req, res) => {
  const event = validateSignature(req);
  res.status(202).json({ accepted: true });
  try {
    await processOrder(event);
  } catch (err) {
    reportService.recordFailure("order", event.id, err);
  }
});`,
      status: "open",
    },
    {
      id: "unsanitized-html",
      severity: "high",
      title: "Unsanitized HTML Rendered",
      explanation:
        "Client review comments are injected into the DOM via innerHTML without sanitization, creating a stored XSS channel.",
      whyItMatters:
        "Stored XSS lets any commenter run arbitrary script for every visitor, making it one of the most damaging bugs a marketplace can ship.",
      fileName: "src/client/review.ts",
      line: 31,
      category: "Security",
      before: `function renderReview(comment: string, el: HTMLElement) {
  el.innerHTML = \`<p>\${comment}</p>\`; // dangerous
}`,
      after: `function renderReview(comment: string, el: HTMLElement) {
  const p = el.querySelector("p");
  if (p) p.textContent = comment; // safe
}`,
      status: "open",
    },
    {
      id: "error-handling-payment",
      severity: "medium",
      title: "Missing Error Handling",
      explanation:
        "The payment capture call is not wrapped in a try/catch and its failure is treated as success by the caller, so charge failures can silently mark orders as paid.",
      whyItMatters:
        "Payment flows that ignore errors produce real financial damage — chargebacks, duplicate charges, and inconsistent order state.",
      fileName: "src/services/payment.ts",
      line: 73,
      category: "Reliability",
      before: `export async function capture(orderId: string) {
  const intent = await paymentGateway.authorize(orderId);
  const charge = await paymentGateway.capture(intent.id); // may throw
  return { ok: true, charge };
}`,
      after: `export async function capture(orderId: string) {
  try {
    const intent = await paymentGateway.authorize(orderId);
    const charge = await paymentGateway.capture(intent.id);
    return { ok: true, charge };
  } catch (err) {
    await markChargeFailed(orderId, err);
    return { ok: false };
  }
}`,
      status: "open",
    },
    {
      id: "no-request-timeout",
      severity: "medium",
      title: "Outbound Requests Without Timeout",
      explanation:
        "External API calls are never given a timeout, so a hanging third-party service can pin Node workers indefinitely until they exhaust the process pool.",
      whyItMatters:
        "A single slow dependency can take the whole service down. Timeouts turn a slow-failure scenario into a fast, contained one.",
      fileName: "src/client/throttle.ts",
      line: 21,
      category: "Reliability",
      before: `export function fetchFromProvider(url: string) {
  // no timeout ever applied
  return fetch(url).then((r) => r.json());
}`,
      after: `export function fetchFromProvider(url: string) {
  return fetch(url, {
    signal: AbortSignal.timeout(5_000), // bounded
  }).then((r) => r.json());
}`,
      status: "open",
    },
    {
      id: "no-webhook-retry",
      severity: "medium",
      title: "Webhook Delivery Has No Retry",
      explanation:
        "A webhook whose first delivery fails is dropped, so downstream services can miss inventory and fulfillment events permanently.",
      whyItMatters:
        "Event-driven systems without retry policy silently lose messages, producing state drift that is very hard to debug later.",
      fileName: "src/services/events.ts",
      line: 57,
      category: "Reliability",
      before: `export async function publishWebhook(url: string, payload: unknown) {
  await fetch(url, { method: "POST", body: JSON.stringify(payload) });
}`,
      after: `export async function publishWebhook(url: string, payload: unknown) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
    await sleep(attempt * 1_000); // exponential-ish backoff
  }
  await enqueueDeadLetter(url, payload);
}`,
      status: "open",
    },
    {
      id: "unsafe-any",
      severity: "medium",
      title: "Unsafe `any` Propagation",
      explanation:
        "A terse cast is used to silence a type mismatch, and the resulting any silently passes through three layers of the inventory service.",
      whyItMatters:
        "Each any bypasses the type checker at a boundary where a refactor could skew a field silently — precisely the bugs tests usually miss.",
      fileName: "src/services/inventory.ts",
      line: 102,
      category: "Code Quality",
      before: `const item = raw as any; // unsafe
return stock.sync(item);`,
      after: `const item = InventoryItemSchema.parse(raw);
return stock.sync(item);`,
      status: "open",
    },
    {
      id: "duplicate-logic",
      severity: "medium",
      title: "Duplicated Price Logic",
      explanation:
        "Discount computation is copied across checkout and invoice modules and has already drifted by a rounding rule in one of them.",
      whyItMatters:
        "Duplicated business logic guarantees eventual drift, and drift in pricing produces the least trusted kind of bug: invisible and financial.",
      fileName: "src/services/invoice.ts",
      line: 41,
      category: "Code Quality",
      before: `// rounded differently than checkout.ts
const total = Math.round(subtotal * 0.9);`,
      after: `const total = applyDiscount(subtotal, tenPercentDiscount()); // one source of truth`,
      status: "open",
    },
    {
      id: "lint-disabled",
      severity: "medium",
      title: "Disabled Lint Rule on Bundle-Critical File",
      explanation:
        "eslint-disable blocks three warnings in the analytics script, including a no-unused-vars condition hiding what looks like a dead branch.",
      whyItMatters:
        "Disabling rules without a deliberate review cadence hides the exact errors static analysis is meant to catch.",
      fileName: "src/analytics/track.ts",
      line: 12,
      category: "Code Quality",
      before: `// eslint-disable-next-line @typescript-eslint/no-unused-vars
const flag = computeFlag(config); // appears unused`,
      after: `const flag = computeFlag(config);
void flag; // intentionally kept for side effect`,
      status: "open",
    },
    {
      id: "batch-limit",
      severity: "medium",
      title: "Unbounded Batch Query",
      explanation:
        "The export endpoint reads every row matching a filter into memory in a single query, which grows without bound as sales data accumulates.",
      whyItMatters:
        "Unbounded queries are the quiet production killer: they degrade slowly until a threshold tips the process into OOM.",
      fileName: "src/api/export.ts",
      line: 55,
      category: "Reliability",
      before: `const rows = await db.query(
  "SELECT * FROM orders WHERE status = $1",
  [status],
);`,
      after: `const rows = await streamRowsByPage(
  "SELECT * FROM orders WHERE status = $1",
  [status],
  { pageSize: 500 },
);`,
      status: "open",
    },
    {
      id: "low-secret-in-config",
      severity: "low",
      title: "Service Account Env Fallback",
      explanation:
        "A development service account lives in a committed env fallback used when CI lacks real credentials.",
      whyItMatters:
        "Even throwaway credentials multiply exposure surface; rotate and remove them.",
      fileName: "lib/config.ts",
      line: 3,
      category: "Security",
      before: "const key = process.env.SERVICE_KEY || \"dev-service-account\";",
      after: "const key = envRequired(\"SERVICE_KEY\"); // fails fast in prod/CI",
      status: "open",
    },
    {
      id: "low-unused-export",
      severity: "low",
      title: "Unused Export",
      explanation:
        "`formatSlug` is exported but never imported, so tree-shaking keeps it and its helper bundle.",
      whyItMatters:
        "Dead exports quietly grow the client bundle and confuse future readers.",
      fileName: "src/utils/format.ts",
      line: 17,
      category: "Code Quality",
      before: "export function formatSlug(input: string): string { ... }",
      after: "function formatSlug(input: string): string { ... } // local",
      status: "open",
    },
    {
      id: "low-magic-number",
      severity: "low",
      title: "Magic Number in Retry Window",
      explanation:
        "A bare 30000 appears in the retry scheduler with no explanation of what it represents.",
      whyItMatters:
        "Magic numbers make tuning impossible without archaeology.",
      fileName: "src/services/retry.ts",
      line: 8,
      category: "Code Quality",
      before: "setInterval(flush, 30000);",
      after: "const RETRY_FLUSH_MS = 30_000;\nsetInterval(flush, RETRY_FLUSH_MS);",
      status: "open",
    },
    {
      id: "low-missing-alt",
      severity: "low",
      title: "Decorative Images Missing Alt",
      explanation:
        "Marketing images are rendered without alt text, failing non-text contrast and screen-reader guidance.",
      whyItMatters:
        "Every omitted alt is a small accessibility regression for the admin dashboard.",
      fileName: "src/admin/hero.tsx",
      line: 44,
      category: "Code Quality",
      before: '<img src="/hero.png" />',
      after: '<img src="/hero.png" alt="Snapcart launch hero" />',
      status: "open",
    },
  ];
  return issues;
})();

const scoreCards = (
  before: number,
  after: number,
): ScoreCard[] => [
  { id: "security", label: "Security", before, after, hint: after > before ? "Improved by fix" : "Based on detected findings" },
  { id: "reliability", label: "Reliability", before: 81, after: 91, hint: "Based on detected findings" },
  { id: "testing", label: "Testing", before: 72, after: 89, hint: "Regression tests added" },
  { id: "codeQuality", label: "Code Quality", before: 91, after: 93, hint: "Based on detected findings" },
  { id: "dependencies", label: "Dependencies", before: 88, after: 90, hint: "Based on detected findings" },
];

export const snapcartTests: TestCase[] = [
  { name: "auth: rejects invalid token", status: "passed", duration: "12ms" },
  { name: "users: get returns 400 on bad id", status: "passed", duration: "9ms" },
  { name: "users: get blocks injection payloads", status: "passed", duration: "11ms" },
  { name: "profile: patch validates payload schema", status: "passed", duration: "8ms" },
  { name: "orders: webhook retries on 500", status: "passed", duration: "14ms" },
  { name: "orders: webhook dead-letters after retries", status: "passed", duration: "15ms" },
  { name: "payment: capture failure marks charge failed", status: "passed", duration: "10ms" },
  { name: "inventory: schema parse rejects bad item", status: "passed", duration: "7ms" },
  { name: "export: streams large result set paged", status: "passed", duration: "18ms" },
  { name: "reviews: renders comment as text, not html", status: "passed", duration: "6ms" },
  { name: "throttle: provider call aborts after timeout", status: "passed", duration: "13ms" },
  { name: "retry: flush window uses named constant", status: "passed", duration: "5ms" },
];

export const snapcartHistory: VerificationEntry[] = [
  { date: "Aug 28, 2026 14:22", label: "Fix applied + rescan", health: 94, critical: 0, high: 2, medium: 4, result: "verified" },
  { date: "Aug 28, 2026 14:02", label: "Full analysis", health: 82, critical: 2, high: 5, medium: 7, result: "pending" },
  { date: "Aug 26, 2026 09:41", label: "Full analysis", health: 77, critical: 3, high: 6, medium: 9, result: "verified" },
  { date: "Aug 24, 2026 18:05", label: "Full analysis", health: 71, critical: 4, high: 8, medium: 11, result: "verified" },
];

export const snapcartProject: Project = {
  id: "snapcart-api",
  name: "snapcart-api",
  description:
    "Monorepo checkout, auth, and inventory API for the Snapcart marketplace demo.",
  language: "TypeScript",
  framework: "Node.js / Express",
  lastAnalyzed: "2 min ago",
  health: 82,
  healthAfter: 94,
  status: "needs-attention",
  scores: scoreCards(76, 92),
  issues: snapcartIssues,
  tests: snapcartTests,
  changes: [
    {
      fileName: "src/api/users.ts",
      summary: "Parameterized the user lookup query and validated the id parameter.",
      linesAdded: 6,
      linesRemoved: 2,
      before: userApiIssue.before,
      after: userApiIssue.after,
    },
    {
      fileName: "src/api/profile.ts",
      summary: "Introduced a strict zod schema for profile updates.",
      linesAdded: 12,
      linesRemoved: 3,
      before: "router.patch(\"/profile\", async (req, res) => {\n  const updated = await updateProfile(req.userId, req.body);\n  res.json(updated);\n});",
      after: "const schema = profileSchema.safeParse(req.body);\nif (!schema.success) return res.status(400).json(schema.error.flatten());",
    },
    {
      fileName: "src/services/payment.ts",
      summary: "Wrapped capture in error handling that fails charge state safely.",
      linesAdded: 8,
      linesRemoved: 3,
      before: "",
      after: "",
    },
  ],
  history: snapcartHistory,
};

export const cleanAuthProject: Project = {
  id: "clean-auth-svc",
  name: "clean-auth-svc",
  description:
    "Small, well-tested auth service. Passed the current checks in the last scan.",
  language: "TypeScript",
  framework: "Fastify",
  lastAnalyzed: "Yesterday",
  health: 96,
  status: "excellent",
  scores: scoreCards(97, 97),
  issues: [],
  tests: [
    { name: "login: returns session token", status: "passed", duration: "9ms" },
    { name: "refresh: rejects rotated token", status: "passed", duration: "8ms" },
    { name: "password: bcrypt rounds honored", status: "passed", duration: "16ms" },
  ] as Project["tests"],
  changes: [],
  history: [
    { date: "Aug 27, 2026 11:18", label: "Full analysis", health: 96, critical: 0, high: 0, medium: 1, result: "verified" },
    { date: "Aug 21, 2026 16:44", label: "Full analysis", health: 93, critical: 0, high: 1, medium: 2, result: "verified" },
  ],
};

export const mlScannerProject: Project = {
  id: "ml-scanner",
  name: "ml-scanner",
  description: "Model training + inference pipeline with a FastAPI gateway.",
  language: "Python",
  framework: "FastAPI",
  lastAnalyzed: "3 days ago",
  health: 88,
  status: "good",
  scores: scoreCards(86, 86),
  issues: [
    issueFactory({
      id: "ml-unpickle",
      severity: "high",
      title: "Unsafe Model Deserialization",
      explanation:
        "Trusted pickle.load is used on models downloaded from a URL that can be influenced by an advisory banner, enabling code execution if the source is ever tampered with.",
      fileName: "models/loader.py",
      line: 24,
      category: "Security",
      whyItMatters:
        "Untrusted deserialization is effectively remote code execution on the model host.",
    }),
    issueFactory({
      id: "ml-log-probe",
      severity: "medium",
      title: "Sensitive Payload Logged at INFO",
      explanation:
        "The inference gateway logs the full request body, silently capturing user-provided text that may include PII.",
      fileName: "api/predict.py",
      line: 12,
      category: "Security",
    }),
    issueFactory({
      id: "ml-cache-ttl",
      severity: "medium",
      title: "Model Cache Without TTL or Version Key",
      explanation:
        "Cached predictions are never invalidated, so stale weights keep serving after a redeploy.",
      fileName: "api/cache.py",
      line: 45,
      category: "Reliability",
    }),
  ],
  tests: [
    { name: "predict: returns 200 for valid input", status: "passed", duration: "11ms" },
    { name: "predict: rejects oversized sequence", status: "passed", duration: "7ms" },
    { name: "cache: honors version key", status: "failed", duration: "9ms" },
  ] as Project["tests"],
  changes: [],
  history: [
    { date: "Aug 25, 2026 10:02", label: "Full analysis", health: 88, critical: 0, high: 1, medium: 2, result: "verified" },
    { date: "Aug 18, 2026 12:30", label: "Full analysis", health: 84, critical: 0, high: 2, medium: 3, result: "verified" },
  ],
};

export const MOCK_PROJECTS: Project[] = [
  snapcartProject,
  cleanAuthProject,
  mlScannerProject,
];

export const CURRENT_USER = {
  name: "Ahmad Raza",
  email: "ahmad@proofcode.dev",
  initials: "AR",
  avatar: null as string | null,
};

export function byId<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

export function countBySeverity(issues: Issue[]) {
  return issues.reduce(
    (acc, issue) => {
      if (issue.status === "fixed" || issue.status === "dismissed") return acc;
      acc[issue.severity] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<import("./types").Severity, number>,
  );
}

/** Issue ids resolved together when `sql-injection` is fixed (matches the demo's 2->0, 5->2, 7->4 story). */
export const FIX_RESOLVES: Record<string, string[]> = {
  "sql-injection": [
    "sql-injection",
    "sensitive-error-exposure",
    "input-validation-profile",
    "unsafe-redirect",
    "unhandled-rejection",
    "error-handling-payment",
    "no-request-timeout",
    "batch-limit",
  ],
};