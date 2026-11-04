<div align="center">

# ProofCode

**AI-assisted code security platform — Detect → Explain → Patch → Re-scan → Test → Verify**

Upload a project (ZIP or GitHub URL). ProofCode runs real static analysis, explains every
finding, patches what it safely can, re-scans to prove the fix, runs your own test suite,
and gives the project a Security Health Score.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8) ![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E)

</div>

## The workflow

```
UPLOAD → ANALYZE → FIND → EXPLAIN → FIX → TEST → VERIFY
```

1. **Upload** a `.zip` or paste a GitHub repo URL (`/upload`).
2. **Analyze** — clones/unzips into an isolated workspace (with a zip-bomb budget) and scans:
   - **JavaScript/TypeScript** via a real AST (typescript-estree): SQL injection, XSS (`innerHTML` / `insertAdjacentHTML`), `eval` / `new Function`, command injection, sensitive-error exposure.
   - **Python** via heuristics: SQL injection, `eval`, `pickle`, shell execution, OS commands.
   - **Secrets**: hardcoded credential-like values (placeholder-style values such as `demo` / `*-free` dummies are ignored).
3. **Find & explain** — each issue gets a severity, a plain-language why-it-matters, and a suggested fix.
4. **Fix** — deterministic patches first (e.g. `innerHTML` → `textContent`); riskier findings can use an LLM rewrite (Gemini, or an OpenRouter-compatible API). Every fix is **verified by re-scanning the rewritten line** — nothing is called "fixed" unless the detector stops firing.
5. **Test** — runs the project's own suite (`npm test` or `pytest`) in a scrubbed environment that never sees the server's secrets, plus a critical-findings check.
6. **Verify** — computes the resulting Health Score and verdict.

Health Score = `100 − Σ (open severity weights)`, floored at 5. Weights: critical 12, high 7, medium 4, low 1.

## Security posture

- Token-authenticated API (reads and writes); in production the owner token is set on the
  server via `PROOFCODE_OWNER_TOKEN` and is never served to anonymous callers.
- Rate limits on the expensive endpoints (analyze, fix, verify, project creation).
- Uploaded code is analysed in a scratch workspace; test runs get an allow-listed
  environment only (no server secrets), and extraction is size/entry capped.
- The revival build passed an adversarial self-audit (bug-hunter method): 5 real findings
  were found, fixed, and re-verified — alongside a clean production build and an
  end-to-end suite that passes repeatedly.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your own values
npm run dev                  # http://localhost:3000
```

Environment (all server-side; never expose the service-role key to the browser):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Persistence (projects, issues, history). Without them, an in-memory fallback is used and data is not persisted. |
| `PROOFCODE_OWNER_TOKEN` | **Set this in production.** Becomes the API token; the app then refuses anonymous token issuance and requires the token on every API call. |
| `GEMINI_API_KEY` (optional) | Enables LLM-assisted fixes (Gemini). Without a key, fixes that need an LLM are honestly refused; deterministic fixes still work. |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` (optional) | Fallback LLM provider (OpenRouter-compatible). |

## API (`/api/v1/*`)

Every endpoint requires the workspace token (`Authorization: Bearer <token>` or
`x-api-key`). In local development (no `PROOFCODE_OWNER_TOKEN` set), fetch it from
`GET /api/v1/keys`; in production it is the server-configured owner token.

| Method & path | Purpose |
|---|---|
| `GET /api/v1/projects` | List projects |
| `POST /api/v1/projects` | Create (JSON `{url}` or `.zip` multipart) |
| `GET /api/v1/projects/[id]` | Read one project |
| `DELETE /api/v1/projects/[id]` | Delete a project and its stored data |
| `POST /api/v1/analyze` | Run a scan |
| `POST /api/v1/issues/[issueId]/fix` | Fix one issue (deterministic → LLM) |
| `POST /api/v1/fix-all` | Attempt every open fixable issue |
| `POST /api/v1/verify` | Run tests + critical-findings check, produce a snapshot |
| `GET /api/v1/keys` | Dev mode: fetch the workspace token. Production: authenticated callers only |

## Verification

```bash
npm run build              # next build (Turbopack) — type-checks + builds
node scripts/e2e-api.mjs   # full API E2E (server must be running)
```

## Project layout

- `lib/api/` — engine: `db` (Supabase persistence + token/health), `workspace` (clone/unzip/list), `scanner` (AST + heuristics), `fixer` (deterministic + LLM), `verify` (tests + snapshot), `analyze`, `auth`, `rate-limit`.
- `app/api/v1/` — Next.js route handlers for the API.
- `app/` + `components/` — the UI (pages, shared components, live-mode components), all driven by the real API — there is no demo data.
- `scripts/e2e-api.mjs` — end-to-end API test. `scripts/fixtures/vuln-node` — a deliberately vulnerable sample app used by the tests.

## Privacy

Projects you submit are analysed in a server-side scratch workspace; analysis results
(issues, scores, history) are stored in the project's own Supabase database. Your code is
sent to an AI provider **only** when you request an AI-generated fix for a specific issue.
Deleting a project deletes its stored data. The deployed site carries the full policy at
`/privacy`.

## Status & honest limits

- Revival build, verified 2026-11-04: clean production build, end-to-end suite all-pass
  (run repeatedly), Supabase persistence proven across restarts, and a real-project
  acceptance test on [MarkBot](https://github.com/Ahmadraza970/markbot) whose single
  finding was hand-checked as a false positive (a placeholder string, not a secret) —
  the detector was refined accordingly.
- Single-user workspace by design for now (one owner token); multi-user accounts are
  planned on top of Supabase Auth.
- Public deployment is in progress; this README will link it here when it is live.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui
(radix-nova) · Supabase Postgres · typescript-estree

---

<div align="center">

Made by **Ahmad Raza** — Ahmad Digital Studio · [ahmadrazaa.me](https://ahmadrazaa.me)

</div>
