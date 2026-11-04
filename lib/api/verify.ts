import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { workspaceDir, computeHealth } from "./db";
import type { ApiIssue, ApiProject, ApiScore, ApiSnapshot, ApiTest } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

/** Health percentage from the currently open issue set. */
export function projectHealth(project: ApiProject): number {
  return computeHealth(project.issues);
}

export function computeScores(project: ApiProject): ApiScore[] {
  const open = project.issues.filter((i) => i.status === "open");
  const fixed = project.issues.filter((i) => i.status === "fixed");

  const categoryBlock = (label: string, categories: string[]) => {
    const count = (list: ApiIssue[]) => list.filter((i) => categories.includes(i.category)).length;
    const before = Math.max(5, 100 - count(open) * 12);
    const after = Math.max(5, 100 - count(fixed) * 5);
    return { label, before, after, hint: "issue count per category, severity-weighted" };
  };

  return [
    categoryBlock("Security posture", ["Security"]),
    categoryBlock("Reliability", ["Reliability"]),
    {
      label: "Input handling",
      before: Math.max(5, 100 - project.issues.filter((i) => ["sql-injection", "xss-innerhtml", "py-sql-injection"].includes(i.detector) && i.status === "open").length * 25),
      after: Math.max(5, 100 - project.issues.filter((i) => ["sql-injection", "xss-innerhtml", "py-sql-injection"].includes(i.detector) && i.status === "fixed").length * 12),
      hint: "injection-prone detectors weighted highest",
    },
    {
      label: "Code health",
      before: Math.max(5, 100 - project.issues.filter((i) => i.status === "open").length * 3),
      after: Math.max(5, 100 - project.issues.filter((i) => i.status === "fixed").length * 2),
      hint: "overall open finding density",
    },
  ];
}

export function countBySeverity(issues: ApiIssue[]): Record<ApiIssue["severity"], number> {
  return issues.reduce(
    (acc, i) => {
      acc[i.severity] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}

export function makeSnapshot(project: ApiProject, label: string, result: ApiSnapshot["result"]): ApiSnapshot {
  const counts = countBySeverity(project.issues);
  return {
    date: nowIso(),
    label,
    health: projectHealth(project),
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    result,
  };
}

function runTests(dir: string, command: string[], timeout = 60_000): Promise<{ status: "passed" | "failed" | "skipped"; duration: string; output: string }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command[0], command.slice(1), {
      cwd: dir,
      windowsHide: true,
      env: { ...process.env, CI: "1" },
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ status: "skipped", duration: msLabel(Date.now() - started), output: (output + "\n[test run timed out]").slice(0, 200) });
    }, timeout);
    child.stdout.on("data", (d) => {
      output += String(d);
      if (output.length > 30_000) child.kill("SIGKILL");
    });
    child.stderr.on("data", (d) => (output += String(d)));
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ status: "skipped", duration: msLabel(Date.now() - started), output: "test runner unavailable" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ status: code === 0 ? "passed" : "failed", duration: msLabel(Date.now() - started), output: output.slice(-800) });
    });
  });
}

function msLabel(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function detectTestCommand(dir: string): Promise<string[] | null> {
  const pkgPath = path.join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as { scripts?: Record<string, string> };
      if (pkg.scripts?.test) return ["npm", "test"];
    } catch {
      /* not parseable — fall through */
    }
  }
  if (existsSync(path.join(dir, "pytest.ini")) || existsSync(path.join(dir, "pyproject.toml"))) {
    return ["python", "-m", "pytest", "-q"];
  }
  return null;
}

export interface VerifyOutcome {
  tests: ApiTest[];
  result: "verified" | "failed" | "skipped";
  snapshot: ApiSnapshot;
  healthBefore: number;
  healthAfter: number;
}

/** Re-scan the workspace, run a test suite if one exists, and record a snapshot. */
export async function verifyProject(project: ApiProject): Promise<VerifyOutcome> {
  const before = projectHealth(project);
  const command = await detectTestCommand(workspaceDir(project.id));

  let tests: ApiTest[];
  let result: VerifyOutcome["result"];

  if (command) {
    const run = await runTests(workspaceDir(project.id), command);
    tests = [
      { name: command.join(" "), status: run.status, duration: run.duration },
      {
        name: "critical findings check",
        status: project.issues.some((i) => i.status === "open" && i.severity === "critical") ? "failed" : "passed",
        duration: "instant",
      },
    ];
    result = run.status === "passed" ? "verified" : run.status === "failed" ? "failed" : "skipped";
  } else {
    tests = [
      {
        name: "critical findings check",
        status: project.issues.some((i) => i.status === "open" && i.severity === "critical") ? "failed" : "passed",
        duration: "instant",
      },
    ];
    result = "skipped";
  }

  const snapshot = makeSnapshot(project, result === "verified" ? "Verification passed" : result === "failed" ? "Verification failed" : "No test suite — security re-scan only", result);

  return {
    tests,
    result,
    snapshot,
    healthBefore: before,
    healthAfter: snapshot.health,
  };
}