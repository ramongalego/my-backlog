-- Rerolls fade instead of counting against a game forever. A reroll usually
-- means "not tonight", so suggestions penalise a game less as its last reroll
-- ages, and the count starts over once it's been a couple of months.
--
-- record_reroll also makes the increment atomic (the API route used to read the
-- count and write it back, which could lose quick rerolls). It runs with the
-- caller's privileges, so RLS on games still applies.

alter table games add column if not exists last_rerolled_at timestamptz;

create or replace function public.record_reroll(p_app_id integer)
returns void
language sql
security invoker
set search_path = public
as $$
  update games
  set
    reroll_count = case
      when last_rerolled_at is null or last_rerolled_at < now() - interval '60 days' then 1
      else coalesce(reroll_count, 0) + 1
    end,
    last_rerolled_at = now()
  where user_id = (select auth.uid()) and app_id = p_app_id;
$$;

revoke all on function public.record_reroll(integer) from public, anon;
grant execute on function public.record_reroll(integer) to authenticated;
