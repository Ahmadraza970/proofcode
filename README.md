# ProofCode

AI-powered code verification. Upload a project (ZIP or GitHub URL), ProofCode runs real static analysis, explains and fixes bugs (deterministic rules + optionally Gemini), re-scans to verify each fix, runs your test suite, and produces a project Health Score and verdict.

Built with **Next.js 16 (App Router), React 19, TypeScript (strict)**, **Tailwind CSS v4**, and **shadcn/ui** (radix-nova). Also ships a fully self-contained **mock demo** that replays the whole workflow without any backend — for instant exploration of every screen.

## The workflow

```
UPLOAD → ANALYZE → FIND → EXPLAIN → FIX → TEST → VERIFY
```

1. **Upload** a `.zip` or paste a GitHub repo URL (`/upload`).
2. **Analyze** — clones/unzips into an isolated workspace and scans:
   - JavaScript/TypeScript via an AST (typescript-estree): SQL injection, XSS (`innerHTML`), `eval`/`new Function`, command injection (`exec`/`spawn`), sensitive-error exposure.
   - Python via heuristics: `eval`, `pickle`, shell execution, SQL injection, OS command.
   - Secrets: hardcoded credential keys.
3. **Find & explain** — each issue gets a severity, a why-it-matters explanation, and a suggested fix.
4. **Fix** — deterministic patches first (e.g. `innerHTML` → `textContent`); risky findings fall back to an LLM (Gemini) to rewrite the line. Every fix is **verified by re-scanning the rewritten file** — no write is claimed "fixed" unless the detector no longer fires on that line.
5. **Test** — runs the project's own test suite (`npm test` or `pytest`) plus a security re-scan.
6. **Verify** — computes the resulting Health Score and verdict.

Health Score = `100 − Σ (open severity weights)`, floored at 5. Weights: critical 12, high 7, medium 4, low 1.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

When no backend is needed (marketing walkthrough), start from **Home → View Demo**.

For a real analysis you also need a token (created automatically on first use) and, for AI fixes, a Gemini key:

```bash
cp .env.example .env.local   # then add your GEMINI_API_KEY
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Primary LLM fixer provider |
| `GEMINI_MODEL` | `gemini-flash-latest` | Gemini model for line rewrites |
| `OPENAI_API_KEY` | — | Optional fallback (OpenAI-compatible / OpenRouter) |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` | Fallback endpoint |
| `PROOF_MODEL` | `openai/gpt-4o-mini` | Fallback model |

`.env*` and `data/` are gitignored — never commit keys.

## API (`/api/v1/*`)

Read endpoints are public; write endpoints require a bearer token (`pk_*`, auto-created via `GET /api/v1/keys`).

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET/POST /api/v1/projects` | read public / write token | List or create (JSON `{url}` or `.zip` multipart) |
| `GET/DELETE /api/v1/projects/[id]` | read public / write token | Read or delete a project |
| `POST /api/v1/analyze` | token | Run a scan |
| `POST /api/v1/issues/[issueId]/fix` | token | Fix one issue (deterministic → LLM) |
| `POST /api/v1/fix-all` | token | Attempt every open fixable issue |
| `POST /api/v1/verify` | token | Run tests + security re-scan, produce snapshot |
| `GET/POST /api/v1/keys` | — | Fetch / create the workspace token |

## Verification

```bash
npm run lint       # eslint — zero errors
npm run build      # next build (Turbopack) — type-checks + builds
node scripts/e2e-api.mjs   # full API E2E (server must be running)
```

## Project layout

- `lib/api/` — engine: `db` (JSON storage + token/health), `workspace` (clone/unzip/list), `scanner` (AST + heuristics), `fixer` (deterministic + Gemini), `verify` (tests + snapshot), `analyze`, `auth`.
- `app/api/v1/` — Next.js route handlers for the API.
- `lib/store.tsx` + `lib/mock-data.ts` — the in-browser mock demo (kept separate from the live API).
- `app/` + `components/` — the UI (pages, shared components, live-mode components).
- `scripts/e2e-api.mjs` — end-to-end API test.
```
