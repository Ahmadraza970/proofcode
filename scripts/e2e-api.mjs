import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROOFCODE_URL ?? "http://localhost:3000";
const FIXTURE = path.join(SCRIPTS, "fixtures", "vuln-node");
const tmpZip = path.join(SCRIPTS, ".tmp-e2e.zip");

let failed = 0;
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!cond) failed += 1;
}

async function json(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = { raw: body.slice(0, 300) };
  }
  return { status: res.status, body: parsed };
}

async function main() {
  // 0. token
  const keys = await json(`${BASE}/api/v1/keys`);
  check("token issued", keys.status === 200 && typeof keys.body.token === "string");
  const auth = { Authorization: `Bearer ${keys.body.token}` };

  // 1. stage a fresh zip upload
  const zip = new AdmZip();
  for (const rel of ["package.json", "app.js", "public/client.js", "routes/api.js", "tests/smoke.test.js"]) {
    const file = await fs.readFile(path.join(FIXTURE, rel));
    zip.addFile(rel, file);
  }
  await fs.writeFile(tmpZip, zip.toBuffer());

  const form = new FormData();
  form.append("file", new Blob([await fs.readFile(tmpZip)], { type: "application/zip" }), `fixture-${Date.now()}.zip`);
  await fs.rm(tmpZip, { force: true });

  const created = await json(`${BASE}/api/v1/projects`, { method: "POST", headers: auth, body: form });
  if (created.status !== 201) {
    console.error("PROJECT CREATION FAILED", created);
    return;
  }
  const projectId = created.body.project.id;
  console.log(`project ${projectId} created`);
  displayProject(created.body.project);

  // 2. analyze
  const analyzed = await json(`${BASE}/api/v1/analyze`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  check("analyze succeeds", analyzed.status === 200 && analyzed.body.project?.status === "analyzed", JSON.stringify({ status: analyzed.status, s: analyzed.body.project?.status, e: analyzed.body.project?.error }));
  const issues = analyzed.body.project?.issues ?? [];
  displayProject(analyzed.body.project);

  const byDetector = issues.reduce((m, i) => ((m[i.detector] = (m[i.detector] ?? 0) + 1), m), {});
  check("sql-injection found", (byDetector["sql-injection"] ?? 0) >= 1, JSON.stringify(byDetector));
  check("xss-innerhtml found", (byDetector["xss-innerhtml"] ?? 0) >= 1, JSON.stringify(byDetector));
  check("eval-usage found", byDetector["eval-usage"] === 1, JSON.stringify(byDetector));
  check("hardcoded-secret found", (byDetector["hardcoded-secret"] ?? 0) >= 2, JSON.stringify(byDetector));

  // 3. fix the xss issue (deterministic auto patch)
  const xssIssue = issues.find((i) => i.detector === "xss-innerhtml");
  const fixed = await json(`${BASE}/api/v1/issues/${xssIssue.id}/fix`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  check("xss fix applied", fixed.status === 200 && fixed.body.ok === true, fixed.status === 200 ? JSON.stringify(fixed.body.outcome) : JSON.stringify(fixed.body));
  check("xss fix verified clean", fixed.body.outcome?.verified === true);

  // 4. sql-injection should be auto-unfixable without an LLM key
  const sqlIssue = issues.find((i) => i.detector === "sql-injection");
  const sqlFix = await json(`${BASE}/api/v1/issues/${sqlIssue.id}/fix`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  check("sql fix honest without LLM", sqlFix.body.ok === false && /OPENAI_API_KEY|no safe/i.test(sqlFix.body.outcome?.message ?? ""), JSON.stringify(sqlFix.body.outcome ?? sqlFix.body));

  // 5. verify (test suite is present and passes)
  const verified = await json(`${BASE}/api/v1/verify`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  check("verify runs", verified.status === 200, JSON.stringify(verified.body));
  check("tests recorded", Array.isArray(verified.body.tests) && verified.body.tests.length > 0);

  // 6. fetch full project
  const got = await json(`${BASE}/api/v1/projects/${projectId}`, { headers: auth });
  check("project fetch", got.status === 200 && got.body.id === projectId);
  check("xss issue closed", got.body.issues.find((i) => i.id === xssIssue.id)?.status === "fixed");
  check("health risen", got.body.health < 90, `health=${got.body.health}`);

  // 7. cleanup
  const del = await json(`${BASE}/api/v1/projects/${projectId}`, { method: "DELETE", headers: auth });
  check("cleanup delete", del.status === 200 && del.body.ok === true);

  console.log(failed === 0 ? "\nE2E: ALL PASS" : `\nE2E: ${failed} FAILURE(S)`);
  process.exit(failed === 0 ? 0 : 1);
}

function displayProject(p) {
  console.log(
    `  status=${p?.status} health=${p?.health} files=${p?.fileCount} lang=${p?.language}`,
  );
  for (const i of p?.issues ?? []) {
    console.log(`    [${i.severity}] ${i.detector} @ ${i.fileName}:${i.line} fix=${i.fixAvailable}`);
  }
}

main().catch((error) => {
  console.error("E2E crashed:", error);
  process.exit(1);
});