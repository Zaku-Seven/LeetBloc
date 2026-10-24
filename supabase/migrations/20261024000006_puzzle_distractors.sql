-- Distractor blocks are shared by both rounds of a puzzle, so they get their
-- own column instead of living inside `brute` or `optimized`.

alter table public.puzzles
  add column distractors jsonb not null default '[]'
  check (jsonb_typeof(distractors) = 'array');
