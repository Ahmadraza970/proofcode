"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  FileCode2,
  FolderGit2,
  Loader2,
  LockKeyhole,
  PlayCircle,
  TerminalSquare,
  UploadCloud,
} from "lucide-react";
import { GithubIcon } from "@/components/shared/BrandIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { useProof } from "@/lib/store";
import {
  ensureToken,
  createProjectFromZip,
  createProjectFromUrl,
  analyzeProject,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";

const SUPPORTED = ["JavaScript", "TypeScript", "Python", "React", "Node.js"];

export default function UploadPage() {
  const { startAnalysis } = useProof();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const acceptFile = useCallback((file: File) => {
    setFileName(file.name);
    setFileObj(file);
    toast.info(`${file.name} (${(file.size / 1024).toFixed(0)} KB) staged.`);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      if (!file.name.endsWith(".zip")) {
        toast.error("Only .zip archives are supported in the demo.");
        return;
      }
      acceptFile(file);
    },
    [acceptFile],
  );

  const onBrowse = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      toast.error("Only .zip archives are supported in the demo.");
      return;
    }
    acceptFile(file);
  }, [acceptFile]);

  const startDemo = useCallback(() => {
    startAnalysis("snapcart-api");
    router.push("/analysis");
  }, [router, startAnalysis]);

  const handleStart = async () => {
    const hasFile = !!fileObj;
    const url = githubUrl.trim();
    if (!hasFile && !url) {
      toast.error("Upload a ZIP or paste a GitHub repository URL first.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await ensureToken();
      let created;
      if (hasFile && fileObj) {
        toast.info(`Uploading ${fileObj.name}…`);
        created = await createProjectFromZip(fileObj);
      } else {
        toast.info(`Cloning ${url}…`);
        created = await createProjectFromUrl(url);
      }
      const project = created.project;
      toast.info("Project staged. Running analysis…");
      const analyzed = await analyzeProject(token, project.id);
      toast.success(analyzed.project.status === "analyzed" ? "Analysis complete." : "Project recorded.");
      router.push(`/report/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Analyze a project"
        description="Upload your codebase and let ProofCode inspect it."
      />

      <Card>
        <CardContent className="p-6">
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop your project ZIP here or browse files"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "relative grid min-h-56 cursor-pointer place-items-center rounded-xl border-2 border-dashed p-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              dragging
                ? "border-brand bg-brand-dim"
                : "border-border hover:border-brand/50 hover:bg-muted/40",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              className="sr-only"
              onChange={onBrowse}
              aria-hidden="true"
              tabIndex={-1}
            />
            <div>
              <div className="mx-auto grid size-14 place-items-center rounded-full border border-border bg-background">
                {fileName ? (
                  <Archive className="size-6 text-brand" aria-hidden="true" />
                ) : (
                  <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <p className="mt-4 font-medium">
                {fileName ?? "Drop your project ZIP here"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {fileName ? (
                  <>
                    Ready.
                    <Button
                      variant="link"
                      className="h-auto px-1 py-0 text-sm text-brand"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFileName(null);
                        setFileObj(null);
                      }}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    or <span className="font-medium text-brand">browse files</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GitHub source */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <FolderGit2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-semibold">Paste GitHub Repository URL</h2>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <GithubIcon className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="url"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
                className="pl-9 font-mono text-sm"
                aria-label="GitHub repository URL"
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setGithubUrl("https://github.com/demo/snapcart-api");
                setFileName(null);
              }}
            >
              <GithubIcon />
              Use demo repo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Supported types + security note */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium">Supported project types</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUPPORTED.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
              >
                <FileCode2 className="size-3.5" aria-hidden="true" />
                {type}
              </span>
            ))}
          </div>
        </div>
        <p className="flex max-w-md items-start gap-2 text-xs leading-relaxed text-muted-foreground md:text-sm">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          Your project is analyzed in an isolated workflow. Never upload secrets
          or production credentials.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="h-11 flex-1 px-6" onClick={handleStart} disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <TerminalSquare className="size-4" aria-hidden="true" />
          )}
          {submitting ? "Analyzing…" : "Start Analysis"}
        </Button>
        <Button size="lg" variant="outline" className="h-11 px-6" onClick={startDemo}>
          <PlayCircle className="size-4" aria-hidden="true" />
          Run the demo instead
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Looking for the report screens?{" "}
        <Link href="/report/snapcart-api" className="font-medium text-brand underline underline-offset-2">
          Open the sample report
        </Link>
      </p>
    </div>
  );
}