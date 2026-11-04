import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import AdmZip from "adm-zip";
import { workspaceDir } from "./db";

export const MAX_FILES = 400;
export const MAX_FILE_BYTES = 1024 * 1024; // 1 MB per file
export const MAX_ZIP_ENTRIES = 2000;
export const MAX_ZIP_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB extracted

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".vercel",
  "dist",
  "build",
  ".venv",
  "venv",
  "__pycache__",
  ".cache",
  "out",
  "coverage",
  ".terraform",
  "vendor",
]);

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".md",
  ".sh",
  ".html",
  ".css",
]);

function runProcess(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(actionError(cmd, "timed out", err)));
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      out += String(d);
      if (out.length > 100_000) child.kill("SIGKILL");
    });
    child.stderr.on("data", (d) => (err += String(d)));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(actionError(cmd, e.message, err)));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(actionError(cmd, `exit ${code}`, err)));
    });
  });
}

function actionError(cmd: string, why: string, err: string): string {
  const tail = err.trim().split("\n").slice(-3).join(" ");
  return `${cmd} ${why}${tail ? ` — ${tail}` : ""}`;
}

/** Clones a public repo into the project workspace. */
export async function cloneRepo(id: string, url: string): Promise<void> {
  const dir = workspaceDir(id);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dir), { recursive: true });
  await runProcess("git", ["clone", "--depth", "1", "--quiet", url, dir], path.dirname(dir), 90_000);
}

/** Unzips an uploaded archive into the project workspace, flat or nested. */
export async function unzipUpload(id: string, buffer: Buffer): Promise<void> {
  const dir = workspaceDir(id);
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  // Budget the *decompressed* archive before writing anything to disk: the
  // 40 MB cap on the compressed upload alone does not stop a zip bomb.
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(
      `Archive has ${entries.length} entries; the limit is ${MAX_ZIP_ENTRIES}. Nothing was extracted.`,
    );
  }
  const totalBytes = entries.reduce((sum, e) => sum + (e.header.size ?? 0), 0);
  if (totalBytes > MAX_ZIP_TOTAL_BYTES) {
    throw new Error(
      `Archive expands past the ${MAX_ZIP_TOTAL_BYTES / (1024 * 1024)} MB extraction limit. Nothing was extracted.`,
    );
  }
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const rootEntry = entries[0];
  const nestedSingleRoot =
    !!rootEntry && rootEntry.isDirectory && entries.filter((e) => e.entryName !== rootEntry.entryName).every((e) => e.entryName.startsWith(rootEntry.entryName));
  zip.extractAllTo(dir, true);
  // If the archive wrapped everything in one folder, hoist it up one level.
  if (nestedSingleRoot && rootEntry) {
    const inner = path.join(dir, rootEntry.entryName);
    const parent = path.join(dir, "__hoisted__");
    await fs.rename(inner, parent);
    for (const entry of await fs.readdir(parent)) {
      await fs.rename(path.join(parent, entry), path.join(dir, entry));
    }
    await fs.rmdir(parent);
  }
}

/** Walks the workspace and returns an analysis-safe file record list. */
export interface ObservedFile {
  filePath: string; // absolute
  relPath: string; // POSIX, relative to workspace root
  ext: string;
  size: number;
  skipped: boolean;
}

export async function listSourceFiles(id: string): Promise<ObservedFile[]> {
  const root = workspaceDir(id);
  const results: ObservedFile[] = [];
  const stats = { files: 0, bytes: 0 };
  const skippedStat = { count: 0 };

  async function walk(dir: string, rel: string): Promise<void> {
    if (results.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= MAX_FILES) return;
      const abs = path.join(dir, entry.name);
      const relPosix = (rel ? `${rel}/` : "") + entry.name;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(abs, relPosix);
      } else if (entry.isFile()) {
        let size = 0;
        try {
          size = (await fs.stat(abs)).size;
        } catch {
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        stats.files += 1;
        if (size > MAX_FILE_BYTES) {
          skippedStat.count += 1;
          results.push({ filePath: abs, relPath: relPosix, ext, size, skipped: true });
          continue;
        }
        if (!SOURCE_EXTENSIONS.has(ext)) continue;
        stats.bytes += size;
        results.push({ filePath: abs, relPath: relPosix, ext, size, skipped: false });
      }
    }
  }

  await walk(root, "");
  return results;
}

export function languageOf(extensions: string[]): string {
  if (extensions.some((e) => [".py"].includes(e))) return "Python";
  if (extensions.some((e) => [".js", ".jsx", ".mjs", ".cjs"].includes(e))) return "JavaScript";
  if (extensions.some((e) => [".ts", ".tsx"].includes(e))) return "TypeScript";
  return "Mixed";
}