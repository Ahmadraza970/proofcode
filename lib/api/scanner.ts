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

/* ------------------------------------------------------------------ */
/* Language pack (2026-11-05): PHP, Java, C/C++, HTML and CSS.         */
/* Line-pattern detectors in the same style as the Python pack.        */
/* fixAvailable stays "none" — no automated fix is offered for these   */
/* languages yet, rather than pretending one exists.                   */
/* ------------------------------------------------------------------ */

type PatternRule = {
  detector: string;
  severity: IssueInput["severity"];
  title: string;
  explanation: string;
  why: string;
  category: string;
  fixSuggested: string;
  re: RegExp;
};

function runPatternRules(source: string, relPath: string, rules: PatternRule[]): IssueInput[] {
  const out: IssueInput[] = [];
  const lines = source.split("\n");
  for (const r of rules) {
    for (const m of source.matchAll(r.re)) {
      const line = indexToLine(lines, m.index ?? 0);
      out.push({
        detector: r.detector,
        severity: r.severity,
        title: r.title,
        explanation: r.explanation,
        whyItMatters: r.why,
        fileName: relPath,
        line,
        column: (m.index ?? 0) - lineStartOffset(lines, line),
        category: r.category,
        fixAvailable: "none",
        fixSuggested: r.fixSuggested,
      });
    }
  }
  return out;
}

const PHP_RULES: PatternRule[] = [
  {
    detector: "php-sql-injection",
    severity: "critical",
    title: "SQL Query Built From User Input",
    explanation: "A SQL query receives $_GET/$_POST/$_REQUEST/$_COOKIE data or a concatenated variable directly.",
    why: "Unescaped input inside SQL lets an attacker read, change or delete the whole database — the classic PHP breach.",
    category: "Security",
    fixSuggested: "Use prepared statements (PDO prepare/bindParam or mysqli prepare) so input is never part of the SQL text.",
    re: /(?:\bmysqli_query|\bmysql_query)\s*\([^;]*\$_(?:GET|POST|REQUEST|COOKIE)|->\s*(?:query|exec)\s*\([^;]*\$_(?:GET|POST|REQUEST|COOKIE)|(?:->\s*query|\bmysqli_query|\bmysql_query|->\s*exec)\s*\([^)]*"\s*\.\s*\$|\$\w+\s*=\s*"[^"\n]*\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b[^"\n]*(?:\$\{?\w|\$_(?:GET|POST|REQUEST|COOKIE))/gi,
  },
  {
    detector: "php-command-execution",
    severity: "critical",
    title: "Shell Command From User Input",
    explanation: "system()/shell_exec()/passthru()/popen() receives request data directly.",
    why: "Request data inside a shell command is remote code execution on the server.",
    category: "Security",
    fixSuggested: "Never pass request data to shell functions; if a command is unavoidable, use escapeshellarg() on a strict allow-list.",
    re: /(?<![\w$.>-])(?:system|shell_exec|passthru|popen|proc_open)\s*\([^;]*\$_(?:GET|POST|REQUEST|COOKIE)/g,
  },
  {
    detector: "php-command-execution",
    severity: "high",
    title: "Shell Command Built From a Variable",
    explanation: "A shell function is called with a variable instead of a fixed literal command.",
    why: "Any value that flows into the variable becomes part of the command the shell runs.",
    category: "Security",
    fixSuggested: "Avoid shell calls; where unavoidable, build commands from a fixed allow-list and escape arguments.",
    re: /(?<![\w$.>-])(?:system|shell_exec|passthru)\s*\(\s*\$[a-zA-Z_]/g,
  },
  {
    detector: "php-eval",
    severity: "high",
    title: "eval / create_function Used",
    explanation: "Dynamic code evaluation executes a string as PHP code.",
    why: "Any string reaching eval() becomes code running with the app's full privileges.",
    category: "Security",
    fixSuggested: "Remove the eval; use a parser, a lookup table or explicit conditionals instead.",
    re: /\beval\s*\(|\bcreate_function\s*\(/g,
  },
  {
    detector: "php-xss",
    severity: "high",
    title: "User Input Printed Without Escaping",
    explanation: "echo/print outputs $_GET/$_POST/$_REQUEST/$_COOKIE data directly.",
    why: "Unescaped request data in the page is reflected XSS — scripts run in the visitor's browser.",
    category: "Security",
    fixSuggested: "Escape output with htmlspecialchars($value, ENT_QUOTES, 'UTF-8') before printing.",
    re: /(?:\becho|\bprint)\s+\(?\s*\$_(?:GET|POST|REQUEST|COOKIE)|<\?=\s*\$_(?:GET|POST|REQUEST|COOKIE)/g,
  },
  {
    detector: "php-file-inclusion",
    severity: "high",
    title: "File Include From User Input",
    explanation: "include/require is given a path straight from request data.",
    why: "Attackers turn this into local file disclosure or remote code execution by choosing the included file.",
    category: "Security",
    fixSuggested: "Map an allow-list of page names to fixed files; never include a raw request value.",
    re: /\b(?:include|include_once|require|require_once)\s*\(?\s*\$_(?:GET|POST|REQUEST|COOKIE)/g,
  },
  {
    detector: "php-file-inclusion",
    severity: "medium",
    title: "File Include From a Variable",
    explanation: "include/require is given a variable path rather than a fixed file.",
    why: "If the variable can be influenced by a request, the include becomes a file-disclosure or code-execution hole.",
    category: "Security",
    fixSuggested: "Include fixed files, or validate the variable against an allow-list of known pages.",
    re: /\b(?:include|include_once|require|require_once)\s*\(?\s*\$[a-zA-Z_]/g,
  },
];

const JAVA_RULES: PatternRule[] = [
  {
    detector: "java-sql-injection",
    severity: "critical",
    title: "SQL Query Built With String Concatenation",
    explanation: "An execute/executeQuery call or SQL-looking string is assembled with + concatenation.",
    why: "Concatenated input inside SQL is injection — the database cannot tell data from commands.",
    category: "Security",
    fixSuggested: "Use PreparedStatement with ? placeholders and setString/setInt for every value.",
    re: /\b(?:executeQuery|execute|executeUpdate)\s*\([^)]*\+|"\s*(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b[^"\n]*"\s*\+/gi,
  },
  {
    detector: "java-command-execution",
    severity: "high",
    title: "Runtime.exec With a Built Command",
    explanation: "Runtime.exec() receives a variable or concatenated command rather than a fixed literal.",
    why: "A command shaped by input runs with the server process's privileges.",
    category: "Security",
    fixSuggested: "Pass a fixed command plus an argument array, and validate arguments against an allow-list.",
    re: /Runtime\.getRuntime\(\)\.exec\s*\([^)]*(?:\+|[a-zA-Z_]\w*\s*\))/g,
  },
  {
    detector: "java-command-execution",
    severity: "medium",
    title: "ProcessBuilder From a Variable",
    explanation: "A ProcessBuilder is constructed from a variable command or argument list.",
    why: "If the variable is influenced by input, the spawned process and its arguments can be attacker-chosen.",
    category: "Security",
    fixSuggested: "Build the command from fixed literals and validated arguments only.",
    re: /new\s+ProcessBuilder\s*\(\s*[a-zA-Z_]/g,
  },
  {
    detector: "java-deserialization",
    severity: "high",
    title: "Unsafe Deserialization",
    explanation: "ObjectInputStream.readObject() or XMLDecoder is used — Java native deserialization of untrusted data.",
    why: "Crafted serialized objects execute gadget chains during readObject — a well-known remote code execution route.",
    category: "Security",
    fixSuggested: "Do not deserialize untrusted data with Java serialization; use JSON with a strict schema instead.",
    re: /\bObjectInputStream\b|\breadObject\s*\(|\bXMLDecoder\b/g,
  },
];

const C_RULES: PatternRule[] = [
  {
    detector: "c-buffer-overflow",
    severity: "high",
    title: "Unbounded String Function",
    explanation: "strcpy/strcat/gets/sprintf copies data with no length limit.",
    why: "These functions overflow fixed buffers — the oldest and most reliably exploitable C bug class.",
    category: "Security",
    fixSuggested: "Use the bounded variants (strncpy/strncat/snprintf/fgets) with the destination size, and check lengths.",
    re: /\b(?:strcpy|strcat|gets|vsprintf|sprintf)\s*\(/g,
  },
  {
    detector: "c-command-execution",
    severity: "high",
    title: "system() With a Built Command",
    explanation: "system() is called with a variable rather than a fixed literal command.",
    why: "A variable command string that input can reach is shell command injection.",
    category: "Security",
    fixSuggested: "Avoid system(); use exec-family calls with a fixed argument array and no shell.",
    re: /\bsystem\s*\(\s*[a-zA-Z_]/g,
  },
  {
    detector: "c-command-execution",
    severity: "medium",
    title: "popen() With a Built Command",
    explanation: "popen() is called with a variable command string.",
    why: "popen() runs the string through a shell — influenced values become commands.",
    category: "Security",
    fixSuggested: "Replace popen() with pipe+fork+exec using fixed arguments, or validate the command strictly.",
    re: /\bpopen\s*\(\s*[a-zA-Z_]/g,
  },
  {
    detector: "c-format-string",
    severity: "medium",
    title: "Variable Used as Format String",
    explanation: "printf() is given a variable as its format string.",
    why: "Attacker-controlled format strings (%x, %n) read the stack and can write memory.",
    category: "Security",
    fixSuggested: 'Use a fixed format: printf("%s", value).',
    re: /\bprintf\s*\(\s*[a-zA-Z_]\w*\s*\)/g,
  },
];

const HTML_RULES: PatternRule[] = [
  {
    detector: "html-mixed-content",
    severity: "medium",
    title: "Resource Loaded Over Plain HTTP",
    explanation: "A script/stylesheet/media tag loads from an http:// URL.",
    why: "On an HTTPS page, plain-HTTP resources can be intercepted and replaced in transit — including scripts.",
    category: "Security",
    fixSuggested: "Load every resource over https:// (or a relative URL).",
    re: /<(?:script|link|img|iframe|audio|video|source)\b[^>]*(?:src|href)\s*=\s*["']http:\/\//gi,
  },
  {
    detector: "html-target-blank",
    severity: "low",
    title: "target=_blank Without rel=noopener",
    explanation: 'A link opens a new tab without rel="noopener", leaving window.opener set.',
    why: "The opened page can navigate the original tab (reverse tabnabbing) to a phishing copy.",
    category: "Security",
    fixSuggested: 'Add rel="noopener noreferrer" to links with target="_blank".',
    re: /<a\b[^>]*target\s*=\s*["']_blank["'](?![^>]*rel\s*=\s*["'][^"']*noopener)/gi,
  },
  {
    detector: "html-iframe-no-sandbox",
    severity: "low",
    title: "iframe Without sandbox Attribute",
    explanation: "An iframe embeds content without a sandbox attribute.",
    why: "Unsandboxed embedded pages can navigate the top page, open popups and run forms as if trusted.",
    category: "Security",
    fixSuggested: "Add a sandbox attribute with only the permissions the embed genuinely needs.",
    re: /<iframe\b(?![^>]*\bsandbox\b)[^>]*>/gi,
  },
];

const CSS_RULES: PatternRule[] = [
  {
    detector: "css-mixed-content",
    severity: "low",
    title: "CSS Resource Over Plain HTTP",
    explanation: "A url() or @import in the stylesheet points at an http:// address.",
    why: "Plain-HTTP subresources can be modified in transit; imported stylesheets fully restyle the page.",
    category: "Security",
    fixSuggested: "Use https:// URLs in url() and @import.",
    re: /(?:url\(\s*["']?|@import\s+(?:url\(\s*)?["']?)http:\/\//gi,
  },
];

export function scanPhp(source: string, relPath: string): IssueInput[] {
  return runPatternRules(source, relPath, PHP_RULES);
}

export function scanJava(source: string, relPath: string): IssueInput[] {
  return runPatternRules(source, relPath, JAVA_RULES);
}

export function scanC(source: string, relPath: string): IssueInput[] {
  return runPatternRules(source, relPath, C_RULES);
}

export function scanHtml(source: string, relPath: string): IssueInput[] {
  return runPatternRules(source, relPath, HTML_RULES);
}

export function scanCss(source: string, relPath: string): IssueInput[] {
  return runPatternRules(source, relPath, CSS_RULES);
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

const LANGUAGE_BY_EXT: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".php": "PHP",
  ".java": "Java",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".hpp": "C++",
  ".html": "HTML",
  ".css": "CSS",
};

export interface ScanSummary {
  issues: ApiIssue[];
  language: string;
  fileCount: number;
  coverage: {
    /** Files that were read and checked (at minimum by the secrets scan). */
    scannedFiles: number;
    /** Files a real detector actually ran over (JS/TS, Python, PHP, Java, C/C++, HTML, CSS). */
    codeFiles: number;
    /** Every file present in the workspace. */
    totalFiles: number;
    /** Unscannable code extensions seen, by count (e.g. { ".php": 12 }). */
    unsupported: Record<string, number>;
    oversizeSkipped: number;
  };
}

/** Runs every detector over the project workspace and returns real findings. */
export async function scanWorkspace(id: string): Promise<ScanSummary> {
  const { files, unsupported, totalSeen, oversizeSkipped } = await listSourceFiles(id);
  let codeFiles = 0;
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
      codeFiles += 1;
      candidates.push(...scanJsTs(source, file.relPath));
    }
    if (file.ext === ".py") {
      codeFiles += 1;
      candidates.push(...scanPython(source, file.relPath));
    }
    if (file.ext === ".php") {
      codeFiles += 1;
      candidates.push(...scanPhp(source, file.relPath));
    }
    if (file.ext === ".java") {
      codeFiles += 1;
      candidates.push(...scanJava(source, file.relPath));
    }
    if ([".c", ".h", ".cpp", ".cc", ".cxx", ".hpp"].includes(file.ext)) {
      codeFiles += 1;
      candidates.push(...scanC(source, file.relPath));
    }
    if (file.ext === ".html") {
      codeFiles += 1;
      candidates.push(...scanHtml(source, file.relPath));
    }
    if (file.ext === ".css") {
      codeFiles += 1;
      candidates.push(...scanCss(source, file.relPath));
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
    language = LANGUAGE_BY_EXT[sortedExts[0]] ?? "Mixed";
  }

  candidatesAll.push(...issueInputs.map((i) => makeIssue(i)));
  candidatesAll.sort((a, b) => severityRank(a) - severityRank(b) || a.fileName.localeCompare(b.fileName) || a.line - b.line);
  const scannedFiles = files.filter((f) => !f.skipped).length;
  return {
    issues: candidatesAll,
    language,
    fileCount: scannedFiles,
    coverage: { scannedFiles, codeFiles, totalFiles: totalSeen, unsupported, oversizeSkipped },
  };
}

function severityRank(i: ApiIssue): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[i.severity];
}