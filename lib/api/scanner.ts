import { promises as fs } from "node:fs";
import { parse } from "@typescript-eslint/typescript-estree";
import { makeIssue, type IssueInput } from "./db";
import { listSourceFiles } from "./workspace";
import type { ApiIssue } from "./types";

type Node = {
  type: string;
  loc?: unknown;
  range?: [number, number];
  [key: string]: unknown;
};

const SQL_METHODS = new Set(["query", "raw", "execute", "queryRow"]);

/** AST detectors that identify real, concrete problems. */
export function scanJsTs(source: string, relPath: string): IssueInput[] {
  const locationErrors: IssueInput[] = [];
  let root: Node | undefined;
  try {
    root = parse(source, {
      loc: true,
      range: true,
      comment: false,
      jsx: relPath.endsWith("x"),
      sourceType: "module",
      tolerant: true,
    } as never) as unknown as Node;
  } catch {
    return locationErrors;
  }
  if (!root) return locationErrors;

  const isDynamicLiteralExpr = (node: Node | undefined): boolean => {
    if (!node) return false;
    if (node.type === "TemplateLiteral") {
      const expressions = (node.expressions as Node[]) ?? [];
      return expressions.length > 0;
    }
    if (node.type === "BinaryExpression") {
      const op = String(node.operator);
      return op === "+" || op === "-" || op === "*" || op === "/";
    }
    if (node.type === "CallExpression") {
      const callee = node.callee as Node;
      return callee.type === "MemberExpression" && (callee.property as Node)?.type === "Identifier";
    }
    return false;
  };

  // Lightweight file-scope dataflow: const/let/var bindings -> is the init dynamic?
  const bindings = new Map<string, Node | undefined>();
  walk(root, (node) => {
    if (node.type === "VariableDeclarator") {
      const idNode = node.id as Node;
      if (idNode?.type === "Identifier" && node.init) {
        bindings.set(String(idNode.name), node.init as Node);
      }
    }
  });

  const resolveDynamic = (name: string, depth = 0): boolean => {
    if (depth > 6) return false;
    const init = bindings.get(name);
    return init ? isDynamic(init, depth + 1) : false;
  };

  const isDynamic = (node: Node | undefined, depth = 0): boolean => {
    if (!node) return false;
    if (isDynamicLiteralExpr(node)) return true;
    if (node.type === "Identifier" && bindings.has(String(node.name))) {
      return resolveDynamic(String(node.name), depth);
    }
    return false;
  };

  const info = (node: Node): { kind: string; name?: string; arg?: Node; args: Node[] } | null => {
    if (node.type === "CallExpression" && node.callee && (node.callee as Node).type === "MemberExpression") {
      const callee = node.callee as Node;
      const prop = callee.property as Node;
      if (prop?.type !== "Identifier") return null;
      return { kind: "member-call", name: String(prop.name), arg: (node.arguments as Node[])[0], args: node.arguments as Node[] };
    }
    if (node.type === "CallExpression" && node.callee && (node.callee as Node).type === "Identifier") {
      return { kind: "plain-call", name: String((node.callee as Node).name), arg: (node.arguments as Node[])[0], args: node.arguments as Node[] };
    }
    if (node.type === "NewExpression" && node.callee && (node.callee as Node).type === "Identifier") {
      const name = String((node.callee as Node).name);
      return { kind: "plain-call", name, arg: (node.arguments as Node[])[0], args: node.arguments as Node[] };
    }
    return null;
  };

  const src = (xn: Node): string => {
    const r = xn.range;
    return r ? source.slice(r[0], r[1]) : "";
  };

  walk(root, (node) => {
    const line = (node.loc as { start: { line: number; column: number } } | undefined)?.start.line ?? 1;
    const col = (node.loc as { start: { line: number; column: number } } | undefined)?.start.column ?? 0;

    // XSS via innerHTML assignment (runs for non-call nodes too)
    if (node.type === "AssignmentExpression" && node.left && (node.left as Node).type === "MemberExpression") {
      const left = node.left as Node;
      const prop = left.property as Node;
      if (prop?.type === "Identifier" && String(prop.name) === "innerHTML" && isDynamic(node.right as Node)) {
        const right = node.right as Node;
        locationErrors.push({
          detector: "xss-innerhtml",
          severity: "high",
          title: "Unsafe innerHTML Assignment",
          explanation: `Setting innerHTML with dynamic content (${src(right).slice(0, 140)}) lets a page render raw HTML from inputs or other sources — an XSS vector.`,
          whyItMatters: "Scripts injected via innerHTML run with full page privileges and can steal sessions, keys, or perform actions as the user.",
          fileName: relPath,
          line,
          column: col,
          category: "Security",
          fixAvailable: "auto",
          fixSuggested: 'Assign via textContent instead (plain text), or sanitize with a library when HTML is genuinely required.',
        });
      }
    }

    const c = info(node);
    if (!c) return;

    const dynamic = isDynamic(c.arg);
    const argSrc = c.arg ? src(c.arg).slice(0, 140) : "";

    // SQL injection
    if (c.kind === "member-call" && SQL_METHODS.has(c.name ?? "") && dynamic) {
      locationErrors.push({
        detector: "sql-injection",
        severity: "critical",
        title: "Dynamic SQL Query",
        explanation: `A ${c.name}() call is built from dynamic input: ${argSrc || "(non-literal argument)"}. When user input is concatenated into SQL, a crafted payload can alter the query (injection).`,
        whyItMatters: "SQL injection can read, modify, or delete entire tables. It is the most reliably exploitable class of web vulnerability.",
        fileName: relPath,
        line,
        column: col,
        category: "Security",
        fixAvailable: "llm",
        fixSuggested:
          "Replace the concatenated string with a bound-parameter query (e.g. pass values as an array: query(sql, [value]) for pg, or ? placeholders for mysql2).",
      });
    }

    // XSS via insertAdjacentHTML
    if (c.kind === "member-call" && c.name === "insertAdjacentHTML" && dynamic) {
      locationErrors.push({
        detector: "xss-innerhtml",
        severity: "high",
        title: "Unsafe insertAdjacentHTML Call",
        explanation: `insertAdjacentHTML receives dynamic content: ${argSrc || "(non-literal argument)"}. It parses the string as HTML.`,
        whyItMatters: "Any HTML parsed from untrusted data can smuggle scripts or break the page layout.",
        fileName: relPath,
        line,
        column: col,
        category: "Security",
        fixAvailable: "llm",
        fixSuggested: "Insert plain text nodes or sanitize the markup before insertion.",
      });
    }

    // eval / new Function
    if (c.kind === "plain-call" && (c.name === "eval" || c.name === "Function")) {
      locationErrors.push({
        detector: "eval-usage",
        severity: "high",
        title: "eval / new Function Used",
        explanation: `Evaluating dynamic code (${c.name}(...)) executes arbitrary strings as program source.`,
        whyItMatters: "Any string reaching eval (directly or via new Function) can become remote code execution.",
        fileName: relPath,
        line,
        column: col,
        category: "Security",
        fixAvailable: "llm",
        fixSuggested: "Remove the eval; parse data with JSON.parse / a parser instead of evaluating code.",
      });
    }

    // Command execution with dynamic args
    if (
      c.kind === "member-call" &&
      (c.name === "exec" || c.name === "execSync" || c.name === "spawn" || c.name === "spawnSync") &&
      dynamic
    ) {
      locationErrors.push({
        detector: "command-injection",
        severity: "high",
        title: "Dynamic Shell Command",
        explanation: `${c.name}() receives a non-constant command/argument string: ${argSrc || "(dynamic)"}. Shell metacharacters in it can run arbitrary commands.`,
        whyItMatters: "Command injection gives an attacker the privileges of your server process.",
        fileName: relPath,
        line,
        column: col,
        category: "Security",
        fixAvailable: "llm",
        fixSuggested: "Avoid building shell strings; pass arguments as an array to spawn() without shell:true.",
      });
    }

    // Raw error strings exposed to clients
    if (c.kind === "member-call" && c.name === "json" && c.arg && c.arg.type === "CallExpression") {
      const inner = c.arg as Node;
      if (inner.callee && (inner.callee as Node).type === "Identifier" && String((inner.callee as Node).name) === "String") {
        locationErrors.push({
          detector: "sensitive-error-exposure",
          severity: "medium",
          title: "Internal Error Sent to Client",
          explanation: `An error object is converted with String() and returned to the caller (${src(inner).slice(0, 120)}). Stack traces and internals leak.`,
          whyItMatters: "Error details are reconnaissance goldmines; they expose the shape of the app to attackers.",
          fileName: relPath,
          line,
          column: col,
          category: "Reliability",
          fixAvailable: "llm",
          fixSuggested: "Log the full error server-side and return a generic { error, requestId } payload.",
        });
      }
    }
  });

  return locationErrors;
}

/** Python detectors — bandit-style line checks without a runtime dependency. */
export function scanPython(source: string, relPath: string): IssueInput[] {
  const out: IssueInput[] = [];
  const patterns: Array<{
    detector: string;
    severity: IssueInput["severity"];
    title: string;
    explanation: string;
    why: string;
    category: string;
    fixAvailable: IssueInput["fixAvailable"];
    fixSuggested: string;
    re: RegExp;
  }> = [
    {
      detector: "py-eval",
      severity: "high",
      title: "eval / exec Used",
      explanation: "Dynamic code execution via eval() or exec().",
      why: "Any string that reaches eval()/exec() becomes Python code running on your server.",
      category: "Security",
      fixAvailable: "none",
      fixSuggested: "Remove the eval; use ast.literal_eval for literals or a proper parser.",
      re: /\beval\s*\(|\bexec\s*\(/g,
    },
    {
      detector: "py-pickle",
      severity: "high",
      title: "Untrusted pickle.loads",
      explanation: "pickle.load/loads can execute arbitrary code during deserialization.",
      why: "Pickle is not safe for untrusted data — loading a crafted file is remote code execution.",
      category: "Security",
      fixAvailable: "llm",
      fixSuggested: "Switch to a safe serialization format (JSON / msgpack), or verify the source before unpickling.",
      re: /\bpickle\.(?:load|loads)\s*\(/g,
    },
    {
      detector: "py-shell",
      severity: "high",
      title: "Shell Execution",
      explanation: "os.system / subprocess with shell=True or a dynamic command string.",
      why: "Shell metacharacters in a dynamic command can run arbitrary commands on the host.",
      category: "Security",
      fixAvailable: "llm",
      fixSuggested: "Drop shell=True and pass arguments as a list; avoid building command strings.",
      re: /(?:os\.system\s*\(|subprocess\.(?:call|run|Popen)\s*\([^\n]*shell\s*=\s*True)/g,
    },
    {
      detector: "py-sql-injection",
      severity: "critical",
      title: "Dynamic SQL Query",
      explanation: "An execute() call is built with an f-string or string concatenation.",
      why: "User input concatenated into SQL enables full database takeover.",
      category: "Security",
      fixAvailable: "llm",
      fixSuggested: "Use bound parameters (?, %s placeholders) instead of embedding values in the SQL text.",
      re: /\b(?:execute|cursor\.execute|conn\.execute|engine\.execute|db\.execute|session\.execute)\s*\([\s\S]{0,120}?f["'](?=.*?(?:SELECT|INSERT|UPDATE|DELETE))|execute\s*\(\s*["'][^"']*["']\s*\+/gi,
    },
    {
      detector: "py-os-command",
      severity: "medium",
      title: "os.system / popen With Variable",
      explanation: "A shell command string appears to be built from a variable rather than a literal.",
      why: "Injected values become part of the command line executed by the shell.",
      category: "Security",
      fixAvailable: "llm",
      fixSuggested: "Use subprocess with an argument list and shell=False.",
      re: /(?:os\.(?:system|popen)\s*\(\s*[a-zA-Z_]|[A-Za-z_]+\s*\+|f["'])/g,
    },
  ];

  const sourceLines = source.split("\n");
  for (const p of patterns) {
    const matches = [...source.matchAll(p.re)];
    for (const m of matches) {
      const line = indexToLine(sourceLines, m.index ?? 0);
      out.push({
        detector: p.detector,
        severity: p.severity,
        title: p.title,
        explanation: p.explanation,
        whyItMatters: p.why,
        fileName: relPath,
        line,
        column: (m.index ?? 0) - lineStartOffset(sourceLines, line),
        category: p.category,
        fixAvailable: p.fixAvailable,
        fixSuggested: p.fixSuggested,
      });
    }
  }
  return out;
}

function lineStartOffset(lines: string[], line1: number): number {
  let len = 0;
  for (let i = 0; i < line1 - 1 && i < lines.length; i++) len += lines[i].length + 1;
  return len;
}

function indexToLine(lines: string[], index: number): number {
  let len = 0;
  for (let i = 0; i < lines.length; i++) {
    len += lines[i].length + 1;
    if (len > index) return i + 1;
  }
  return lines.length;
}

const SECRET_RE =
  /(?:api[_-]?key|apikey|secret|access[_-]?key|auth[_-]?token|client[_-]?secret|private[_-]?key|password|passwd|token)\s*[:=]\s*["']([^\n"'`]{12,})["']/gi;

export function scanSecrets(source: string, relPath: string): IssueInput[] {
  const out: IssueInput[] = [];
  const lines = source.split("\n");
  for (const m of source.matchAll(SECRET_RE)) {
    const value = m[1] ?? "";
    if (/demo|example|sample|changeme|your[-_]|xxxx|placeholder|password\b|dummy|fake|public|no[-_]?key|[-_]free\b|free[-_]/i.test(value) && value.length < 40) continue;
    const line = indexToLine(lines, m.index ?? 0);
    const excerpt = m[0].replace(/([:=]\s*["']).{6}.*/, "$1…").slice(0, 80);
    out.push({
      detector: "hardcoded-secret",
      severity: "medium",
      title: "Possible Hardcoded Secret",
      explanation: `A value assigned to a credential-like key looks like a real secret: ${excerpt}${m[0].length > 80 ? "…" : ""}`,
      whyItMatters: "Committed secrets get scanned by public engines, forked, and abused within hours of being pushed.",
      fileName: relPath,
      line,
      column: 0,
      category: "Security",
      fixAvailable: "none",
      fixSuggested: "Move the value to an environment variable or a secret manager and rotate the credential.",
    });
  }
  return out;
}

function walk(node: Node | null | undefined, visit: (n: Node) => void): void {
  if (!node) return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range" || key === "parent") continue;
    const value = (node as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item === "object" && typeof (item as Node).type === "string") walk(item as Node, visit);
    } else if (value && typeof value === "object" && typeof (value as Node).type === "string") {
      walk(value as Node, visit);
    }
  }
}

function isTsLike(ext: string): boolean {
  return [".ts", ".tsx"].includes(ext);
}

export interface ScanSummary {
  issues: ApiIssue[];
  language: string;
  fileCount: number;
}

/** Runs every detector over the project workspace and returns real findings. */
export async function scanWorkspace(id: string): Promise<ScanSummary> {
  const files = await listSourceFiles(id);
  const issueInputs: IssueInput[] = [];
  const candidatesAll: ApiIssue[] = [];
  const seen = new Set<string>();
  let language = "Mixed";

  const extensions = new Map<string, number>();
  for (const file of files) {
    if (file.skipped) continue;
    extensions.set(file.ext, (extensions.get(file.ext) ?? 0) + 1);
    let source: string;
    try {
      source = await fs.readFile(file.filePath, "utf8");
    } catch {
      continue;
    }

    const candidates: IssueInput[] = [];
    if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(file.ext)) {
      candidates.push(...scanJsTs(source, file.relPath));
      // TS-only additions could live here in the future.
    }
    if (file.ext === ".py") {
      candidates.push(...scanPython(source, file.relPath));
    }
    candidates.push(...scanSecrets(source, file.relPath));

    for (const candidate of candidates) {
      const key = `${candidate.detector}@${candidate.line}@${candidate.fileName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issueInputs.push(candidate);
    }
  }

  const sortedExts = [...extensions.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  if (sortedExts.length > 0) {
    language = isTsLike(sortedExts[0])
      ? "TypeScript"
      : sortedExts[0] === ".py"
        ? "Python"
        : sortedExts[0].startsWith(".")
          ? "JavaScript"
          : "Mixed";
  }

  candidatesAll.push(...issueInputs.map((i) => makeIssue(i)));
  candidatesAll.sort((a, b) => severityRank(a) - severityRank(b) || a.fileName.localeCompare(b.fileName) || a.line - b.line);
  return { issues: candidatesAll, language, fileCount: files.filter((f) => !f.skipped).length };
}

function severityRank(i: ApiIssue): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[i.severity];
}