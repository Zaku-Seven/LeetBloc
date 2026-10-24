-- Grades. Users can read their own rows. Only the server (service role)
-- writes, because passed and the solved timestamps are computed there.

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  -- Nullable per the design, but visitor attempts are not written.
  user_id uuid references public.profiles (id) on delete cascade,
  puzzle_id uuid not null references public.puzzles (id) on delete cascade,
  approach text not null check (approach in ('brute', 'optimized')),
  -- Blockly workspace JSON they submitted.
  workspace jsonb not null,
  -- Tests passed, and required blocks present for the optimized round.
  passed boolean not null,
  tests_passed integer not null check (tests_passed >= 0),
  tests_total integer not null check (tests_total >= 0),
  created_at timestamptz not null default now(),
  check (tests_passed <= tests_total)
);

create index attempts_user_puzzle_idx on public.attempts (user_id, puzzle_id, created_at desc);
create index attempts_puzzle_id_idx on public.attempts (puzzle_id);

alter table public.attempts enable row level security;

create policy "Users can read their own attempts"
  on public.attempts for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.attempts from anon, authenticated;

-- One row per user per puzzle. The progress page renders this table.

create table public.progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  puzzle_id uuid not null references public.puzzles (id) on delete cascade,
  brute_solved_at timestamptz,
  optimized_solved_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  primary key (user_id, puzzle_id)
);

create index progress_puzzle_id_idx on public.progress (puzzle_id);

alter table public.progress enable row level security;

create policy "Users can read their own progress"
  on public.progress for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.progress from anon, authenticated;
