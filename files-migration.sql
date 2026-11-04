-- ProofCode — Files migration: durable project source files.
-- Run this ONCE in the Supabase SQL editor for the ProofCode project.
--
-- Why: project metadata and findings live in public.proofcode, but the
-- source files themselves used to live only in the host's ephemeral
-- workspace directory. Any restart or redeploy (Render free tier included)
-- orphaned every project: "Fix Issue" and verify re-read the files from
-- disk and failed with ENOENT. This table is the durable copy; the disk
-- workspace is now just a working cache that stages rehydrate from here.
--
-- What it does:
--   * Adds public.proofcode_files — one row per source file:
--     (pid, path) → text content. Only text source files are stored
--     (the same extension/size gates as the scanner, 25 MB per project).
--   * pid references public.proofcode(pid) ON DELETE CASCADE, so deleting
--     a project removes its files too — delete means delete. The API also
--     deletes these rows explicitly, so behaviour is identical even if the
--     constraint is ever dropped.
--   * RLS stays enabled with no public policies, like every other
--     ProofCode table: the app connects with the service_role key and
--     enforces per-user scoping server-side (lib/api/auth.ts).
--
-- Safe to run more than once (IF NOT EXISTS throughout). Until it is run,
-- the API degrades gracefully: durable writes are skipped silently and the
-- app behaves as the old disk-only version did.

create table if not exists public.proofcode_files (
  pid        text not null references public.proofcode (pid) on delete cascade,
  path       text not null,
  content    text not null,
  updated_at timestamptz not null default now(),
  primary key (pid, path)
);

comment on table public.proofcode_files is
  'Durable copy of a project''s text source files (relative path → content). The on-disk workspace is a cache rehydrated from here after restarts.';

create index if not exists proofcode_files_pid_idx
  on public.proofcode_files (pid);

alter table public.proofcode_files enable row level security;
