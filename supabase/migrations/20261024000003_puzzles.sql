-- One ready generation per problem. Service role only: the canonical graphs,
-- the compiled Python, and the hidden tests must never leave through PostgREST.

create table public.puzzles (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  model text not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  -- Canonical graph, plan, complexity, hints. Null while pending.
  brute jsonb,
  optimized jsonb,
  -- The cases both solutions agree on.
  tests jsonb check (tests is null or jsonb_typeof(tests) = 'array'),
  created_at timestamptz not null default now(),
  check (status <> 'ready' or (brute is not null and optimized is not null and tests is not null))
);

-- Dedupes generation per problem: at most one in-flight or ready row.
-- Failed rows are kept as history. An abandoned pending row is marked
-- failed by the server before a new one is inserted.
create unique index puzzles_one_live_per_problem
  on public.puzzles (problem_id)
  where status in ('pending', 'ready');

create index puzzles_problem_id_idx on public.puzzles (problem_id);

alter table public.puzzles enable row level security;

-- No policies for anon or authenticated, and no grants either.
revoke all on public.puzzles from anon, authenticated;
