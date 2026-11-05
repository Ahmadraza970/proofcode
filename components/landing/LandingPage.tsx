import type { CSSProperties } from "react";
import Link from "next/link";
import {
  BrainCircuit,
  CheckCircle2,
  Download,
  FileSearch,
  FlaskConical,
  KeyRound,
  RefreshCw,
  Rocket,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { HealthRing } from "@/components/shared/HealthRing";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { WorkflowStrip } from "@/components/shared/WorkflowStrip";
import { GoogleIcon } from "@/components/shared/BrandIcons";
import { APK_DOWNLOAD_URL } from "@/lib/site";
import type { Severity } from "@/lib/types";

const STEPS: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: ScanSearch,
    title: "Detect",
    body: "Upload a ZIP or paste a public GitHub repository URL. Eleven detectors scan the code for vulnerability patterns.",
  },
  {
    icon: FileSearch,
    title: "Explain",
    body: "Each finding names the file and line, shows the code involved, and explains what an attacker could do with it.",
  },
  {
    icon: Wrench,
    title: "Patch",
    body: "Fix Issue writes the corrected code and shows the before and after lines. When an AI model is busy, the request retries and a fallback model takes over.",
  },
  {
    icon: RefreshCw,
    title: "Re-scan",
    body: "The project is scanned again after patching. A finding closes only when the vulnerable pattern is actually gone.",
  },
  {
    icon: FlaskConical,
    title: "Verify",
    body: "Run the project\u2019s own tests when it has a suite, and record a snapshot of the new health score beside the old one.",
  },
];

const JS_DETECTORS: { name: string; severity: Severity; body: string }[] = [
  {
    name: "Dynamic SQL Query",
    severity: "critical",
    body: "Queries built from dynamic input, open to injection.",
  },
  {
    name: "Unsafe innerHTML & insertAdjacentHTML",
    severity: "high",
    body: "Dynamic content assigned as HTML, an XSS vector.",
  },
  {
    name: "eval / new Function Used",
    severity: "high",
    body: "Strings executed as program code.",
  },
  {
    name: "Dynamic Shell Command",
    severity: "high",
    body: "Shell commands built from non-constant strings.",
  },
  {
    name: "Possible Hardcoded Secret",
    severity: "medium",
    body: "Credential-like values assigned in source code.",
  },
  {
    name: "Internal Error Sent to Client",
    severity: "medium",
    body: "Raw error objects returned to callers, leaking internals.",
  },
];

const PY_DETECTORS: { name: string; severity: Severity; body: string }[] = [
  {
    name: "Dynamic SQL Query",
    severity: "critical",
    body: "execute() calls built with f-strings or concatenation.",
  },
  {
    name: "eval / exec Used",
    severity: "high",
    body: "Dynamic code execution.",
  },
  {
    name: "Untrusted pickle.loads",
    severity: "high",
    body: "Pickle loading can execute arbitrary code during deserialization.",
  },
  {
    name: "Shell Execution",
    severity: "high",
    body: "os.system, or subprocess with shell=True.",
  },
  {
    name: "os.system / popen With Variable",
    severity: "medium",
    body: "Shell commands built from variables instead of literals.",
  },
];

const PHP_DETECTORS: { name: string; severity: Severity; body: string }[] = [
  {
    name: "SQL Query Built From User Input",
    severity: "critical",
    body: "Queries receiving request data or concatenated strings.",
  },
  {
    name: "Shell Command From User Input",
    severity: "critical",
    body: "system() and similar functions fed straight from a request.",
  },
  {
    name: "eval / create_function Used",
    severity: "high",
    body: "Strings executed as PHP code.",
  },
  {
    name: "User Input Printed Without Escaping",
    severity: "high",
    body: "Request data echoed raw — reflected XSS.",
  },
  {
    name: "File Include From a Variable",
    severity: "high",
    body: "include / require paths an attacker can steer.",
  },
];

const JAVA_DETECTORS: { name: string; severity: Severity; body: string }[] = [
  {
    name: "SQL Built With String Concatenation",
    severity: "critical",
    body: "Queries assembled with + instead of PreparedStatement.",
  },
  {
    name: "Runtime.exec With a Built Command",
    severity: "high",
    body: "Shell commands shaped by variables.",
  },
  {
    name: "Unsafe Deserialization",
    severity: "high",
    body: "ObjectInputStream / XMLDecoder on untrusted data.",
  },
];

const PRIVACY_POINTS: {
  icon: LucideIcon;
  title: string;
  body: string;
  accent: string;
}[] = [
  {
    icon: UserRound,
    title: "Private to your account",
    body: "Sign-in is Google-only. Other signed-in users cannot see or change your projects.",
    accent: "text-brand bg-brand-dim border-brand/25",
  },
  {
    icon: BrainCircuit,
    title: "AI only when you ask",
    body: "Your code is sent to an AI provider only when you request an AI-generated fix, and only the code relevant to that fix.",
    accent: "text-brand bg-brand-dim border-brand/25",
  },
  {
    icon: KeyRound,
    title: "Bring your own key",
    body: "Add your own Gemini key in Settings and fixes run on your key. It is stored only in your browser, never on the server.",
    accent: "text-brand bg-brand-dim border-brand/25",
  },
  {
    icon: Trash2,
    title: "Delete means delete",
    body: "Deleting a project removes its record, its stored file copies, and its server workspace. Nothing is kept in an archive.",
    accent: "text-verify bg-verify-dim border-verify/25",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function DetectorList({
  items,
}: {
  items: { name: string; severity: Severity; body: string }[];
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <SeverityBadge severity={item.severity} />
          </div>
          <p className="text-sm text-muted-foreground">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function LandingPage() {
  return (
    <div className="flex flex-col gap-12">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-12 sm:px-10 sm:py-16"
        aria-labelledby="landing-title"
      >
        <div
          aria-hidden="true"
          className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative grid items-start gap-10 lg:grid-cols-[1.02fr_1fr]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-dim px-3 py-1 text-xs font-medium text-brand">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Code security for JS, TS, Python, PHP, Java, C/C++ &amp; the web
            </span>
            <h1
              id="landing-title"
              className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
            >
              Don&rsquo;t just trust AI-generated code.{" "}
              <span className="text-brand">Prove it.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              ProofCode scans your project for security flaws, explains each
              finding in plain language, generates the fix, and scans again to
              confirm the fix worked. Every project gets a security health
              score from 0 to 100.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-11 px-5">
                <Link href="/login">
                  <Rocket className="size-4" aria-hidden="true" />
                  Launch the app
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-5">
                <Link href="/login">
                  <GoogleIcon className="size-4" aria-hidden="true" />
                  Sign in with Google
                </Link>
              </Button>
              {APK_DOWNLOAD_URL ? (
                <Button asChild variant="outline" size="lg" className="h-11 px-5">
                  <a href={APK_DOWNLOAD_URL}>
                    <Download className="size-4" aria-hidden="true" />
                    Download the Android app
                  </a>
                </Button>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Free to use. Your projects stay private to your account.
            </p>
            <div className="mt-10">
              <WorkflowStrip aria-hidden />
            </div>
          </div>

          {/* Example report: a real run on ProofCode's own two-finding test file */}
          <div className="min-w-0 rounded-xl border border-border bg-background/70 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Example report</h2>
              <span className="font-mono text-xs text-muted-foreground">
                index.js &middot; 1 file
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              A real run on a two-finding test file.
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity="critical" />
                <span className="font-medium">Dynamic SQL Query</span>
                <span className="font-mono text-xs text-muted-foreground">
                  index.js:9
                </span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity="high" />
                <span className="font-medium">eval / new Function Used</span>
                <span className="font-mono text-xs text-muted-foreground">
                  index.js:16
                </span>
              </li>
            </ul>
            <div className="mt-4 flex min-w-0 flex-col gap-3">
              <CodeBlock
                header="index.js:9 — before"
                code="db.query(query, (err, rows) => {"
              />
              <CodeBlock
                header="index.js:9 — after the fix"
                code={'db.query("SELECT * FROM users WHERE id = ?", [id], (err, rows) => {'}
                highlightLines={[1]}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <HealthRing score={81} size={92} stroke={8} />
              <p className="min-w-44 flex-1 text-sm text-muted-foreground">
                Health <span className="font-mono font-semibold text-foreground">81</span>{" "}
                with both findings open. Fix the critical finding and the score
                rises to{" "}
                <span className="font-mono font-semibold text-foreground">93</span>.
                Fix both and it reaches{" "}
                <span className="font-mono font-semibold text-foreground">100</span>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-label="How ProofCode works">
        <SectionLabel>How it works</SectionLabel>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card
                key={step.title}
                className="reveal"
                style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="grid size-10 place-items-center rounded-lg border border-brand/25 bg-brand-dim text-brand">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <span className="font-mono text-sm font-semibold text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
                </CardContent>
              </Card>
            );
          })}
          <Card className="reveal" style={{ "--reveal-delay": "450ms" } as CSSProperties}>
            <CardContent className="p-5">
              <div className="grid size-10 place-items-center rounded-lg border border-verify/25 bg-verify-dim text-verify">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">One pass, start to finish</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                The stages run in order on your real code, and each stage&rsquo;s
                output feeds the next.
              </p>
              <div className="mt-4">
                <WorkflowStrip />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What it catches */}
      <section aria-label="What ProofCode catches">
        <SectionLabel>What it catches</SectionLabel>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h3 className="font-semibold">JavaScript &amp; TypeScript</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Parsed and checked with AST detectors.
              </p>
              <div className="mt-2">
                <DetectorList items={JS_DETECTORS} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h3 className="font-semibold">Python</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Line-based checks in the style of Bandit.
              </p>
              <div className="mt-2">
                <DetectorList items={PY_DETECTORS} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h3 className="font-semibold">PHP</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Line-based checks for the classic PHP vulnerability patterns.
              </p>
              <div className="mt-2">
                <DetectorList items={PHP_DETECTORS} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h3 className="font-semibold">Java</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Line-based checks for injection and unsafe deserialization.
              </p>
              <div className="mt-2">
                <DetectorList items={JAVA_DETECTORS} />
              </div>
            </CardContent>
          </Card>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          C and C++ projects are checked for unbounded string functions,
          built shell commands and variable format strings; HTML and CSS are
          checked for plain-HTTP resources and unsafe embedding patterns.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Scanning is deterministic and runs on ProofCode&rsquo;s servers.
          Nothing is sent to an AI provider during a scan. Code goes to a
          provider only when you request an AI-generated fix.
        </p>
      </section>

      {/* Health score */}
      <section aria-label="How the health score works">
        <SectionLabel>The health score</SectionLabel>
        <div className="mt-4 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="text-base leading-relaxed text-muted-foreground">
              Every project starts at{" "}
              <span className="font-mono font-semibold text-foreground">100</span>.
              Each open finding subtracts points by severity:{" "}
              <span className="font-mono font-semibold text-foreground">12</span>{" "}
              for a critical,{" "}
              <span className="font-mono font-semibold text-foreground">7</span>{" "}
              for a high,{" "}
              <span className="font-mono font-semibold text-foreground">4</span>{" "}
              for a medium,{" "}
              <span className="font-mono font-semibold text-foreground">1</span>{" "}
              for a low. Fixed findings stop counting, and the score never
              falls below{" "}
              <span className="font-mono font-semibold text-foreground">5</span>.
            </p>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              The example at the top of this page is the arithmetic working
              end to end: one critical and one high finding cost 19 points,
              so the project scored 81. Fixing the critical raised it to 93,
              and fixing both reached 100.
            </p>
          </div>
          <div className="flex flex-wrap items-start justify-center gap-6">
            <HealthRing score={81} size={104} stroke={9} label="Both findings open" />
            <HealthRing score={93} size={104} stroke={9} label="Critical fixed" />
            <HealthRing score={100} size={104} stroke={9} label="Both fixed" />
          </div>
        </div>
      </section>

      {/* Privacy & BYOK */}
      <section aria-label="Privacy and your own AI key">
        <SectionLabel>Privacy and your own key</SectionLabel>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {PRIVACY_POINTS.map((point, index) => {
            const Icon = point.icon;
            return (
              <Card
                key={point.title}
                className="reveal"
                style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
              >
                <CardContent className="p-5">
                  <div
                    className={`grid size-10 place-items-center rounded-lg border ${point.accent}`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold">{point.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{point.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          The full details live in the{" "}
          <Link
            href="/privacy"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            privacy policy
          </Link>
          , including what is stored and how deletion works.
        </p>
      </section>

      {/* Android app */}
      <section aria-label="ProofCode on Android">
        <SectionLabel>On your phone</SectionLabel>
        <Card className="mt-4">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand-dim text-brand">
                <Smartphone className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold">ProofCode on Android</h3>
                {APK_DOWNLOAD_URL ? (
                  <>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      Download the Android app, or install the web app from
                      your browser instead: open this site in Chrome, open
                      the browser menu, and choose Install app or Add to Home
                      screen. Either way it opens full-screen from its own
                      icon, signed in to the same account.
                    </p>
                    <div className="mt-4">
                      <Button asChild size="lg" className="h-11 px-5">
                        <a href={APK_DOWNLOAD_URL}>
                          <Download className="size-4" aria-hidden="true" />
                          Download the Android app
                        </a>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    ProofCode is an installable web app. Open this site in
                    Chrome on your Android phone, open the browser menu, and
                    choose Install app or Add to Home screen. It then opens
                    full-screen from its own home-screen icon, signed in to
                    the same account.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Final CTA */}
      <section
        className="rounded-2xl border border-border bg-card px-6 py-10 text-center sm:px-10"
        aria-labelledby="landing-final-cta"
      >
        <h2
          id="landing-final-cta"
          className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
        >
          Run your first scan
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          Upload a project or paste a GitHub URL, and get a health score with
          the findings to back it up.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-5">
            <Link href="/login">
              <Rocket className="size-4" aria-hidden="true" />
              Launch the app
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-5">
            <Link href="/login">
              <GoogleIcon className="size-4" aria-hidden="true" />
              Sign in with Google
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
