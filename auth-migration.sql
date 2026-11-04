-- ProofCode — Auth migration: per-user project scoping for Google sign-in
-- (Supabase Auth). Run this ONCE in the Supabase SQL editor for the
-- ProofCode project, BEFORE enabling Google sign-in in production.
--
-- What it does:
--   * Adds `user_id` to public.proofcode — the Supabase Auth user id
--     (auth.users.id) of the user who created the project.
--   * NULL means "owner-token project": every project that exists today,
--     and every project the owner token creates later. Those stay visible
--     to the owner token only; signed-in users only ever see rows stamped
--     with their own id. The API enforces this server-side on every
--     request (see lib/api/auth.ts) — no RLS policy change is needed,
--     because the app still connects with the service_role key and RLS
--     stays enabled with no public policies.
--   * Adds an index so per-user project lists stay fast.
--
-- Safe to run more than once (IF NOT EXISTS throughout). Existing rows
-- are untouched apart from gaining a NULL user_id.

alter table public.proofcode
  add column if not exists user_id uuid;

comment on column public.proofcode.user_id is
  'Supabase Auth user id (auth.users.id) of the creating user; NULL = owner-token project, visible to the owner token only.';

create index if not exists proofcode_user_id_idx
  on public.proofcode (user_id);
