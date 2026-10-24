-- Cached LeetCode (or bundled) problems. Public read for free problems.

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('leetcode', 'bundled')),
  slug text not null,
  title text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  tags text[] not null default '{}',
  content_text text not null,
  -- Array of { input, output }.
  examples jsonb not null default '[]' check (jsonb_typeof(examples) = 'array'),
  python_stub text not null,
  -- Paid slugs are stored only so we do not fetch them again.
  is_paid boolean not null default false,
  fetched_at timestamptz not null default now(),
  unique (source, slug)
);

alter table public.problems enable row level security;

create policy "Anyone can read free problems"
  on public.problems for select
  to anon, authenticated
  using (is_paid = false);

-- No client writes. The server uses the service role.
revoke insert, update, delete on public.problems from anon, authenticated;
