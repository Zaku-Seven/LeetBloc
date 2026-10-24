-- Writes an attempt and its progress update in one transaction.
-- The API decides what the attempt earns (p_solves_brute / p_solves_optimized),
-- this function only applies it. Solved timestamps are never overwritten.

create function public.record_attempt(
  p_user_id uuid,
  p_puzzle_id uuid,
  p_approach text,
  p_workspace jsonb,
  p_passed boolean,
  p_tests_passed integer,
  p_tests_total integer,
  p_solves_brute boolean,
  p_solves_optimized boolean
)
returns public.progress
language plpgsql
set search_path = ''
as $$
declare
  result public.progress;
begin
  if p_user_id is null then
    raise exception 'record_attempt requires a user';
  end if;
  if (p_solves_brute or p_solves_optimized) and not p_passed then
    raise exception 'a failing attempt cannot solve a round';
  end if;

  insert into public.attempts (user_id, puzzle_id, approach, workspace, passed, tests_passed, tests_total)
  values (p_user_id, p_puzzle_id, p_approach, p_workspace, p_passed, p_tests_passed, p_tests_total);

  insert into public.progress as p (user_id, puzzle_id, brute_solved_at, optimized_solved_at, attempt_count)
  values (
    p_user_id,
    p_puzzle_id,
    case when p_solves_brute then now() end,
    case when p_solves_optimized then now() end,
    1
  )
  on conflict (user_id, puzzle_id) do update set
    attempt_count = p.attempt_count + 1,
    brute_solved_at = coalesce(p.brute_solved_at, excluded.brute_solved_at),
    optimized_solved_at = coalesce(p.optimized_solved_at, excluded.optimized_solved_at)
  returning * into result;

  return result;
end;
$$;

-- Server only. Clients must not be able to record their own grades.
revoke execute on function public.record_attempt from public, anon, authenticated;
grant execute on function public.record_attempt to service_role;
