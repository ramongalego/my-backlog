-- Games are identified by their own row id instead of Steam's app id, so the
-- app isn't tied to Steam. Step 1 of 2, additive only: the code running
-- before this deploy keeps working against it. 20261030_drop_queue_app_id.sql
-- removes what that old code still needs, once the new code is live.

-- ─── games ──────────────────────────────────────────────────────────────────

-- Where each game came from. Every game so far was synced from Steam.
alter table games add column if not exists source text not null default 'steam';
alter table games add constraint games_source_check check (source in ('steam', 'manual'));

-- Only Steam games have a Steam app id.
alter table games alter column app_id drop not null;
alter table games add constraint games_steam_has_app_id check (source <> 'steam' or app_id is not null);

-- The queue references (user_id, id), so a queue row can only ever point at
-- one of the same user's games.
alter table games add constraint games_user_id_id_key unique (user_id, id);

-- ─── playing_queue ──────────────────────────────────────────────────────────

alter table playing_queue add column if not exists game_id bigint;

update playing_queue as q
set game_id = g.id
from games as g
where g.user_id = q.user_id and g.app_id = q.app_id and q.game_id is null;

-- Queue rows whose game is no longer in the library; they never showed anyway.
delete from playing_queue where game_id is null;

-- Until the old code is gone, fill in whichever id an insert leaves out: the
-- old code inserts app_id only, the new code game_id only.
create or replace function public.playing_queue_fill_ids()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.game_id is null and new.app_id is not null then
    select id into new.game_id from games where user_id = new.user_id and app_id = new.app_id;
  elsif new.app_id is null and new.game_id is not null then
    select app_id into new.app_id from games where user_id = new.user_id and id = new.game_id;
  end if;
  return new;
end;
$$;

create trigger playing_queue_fill_ids
  before insert on playing_queue
  for each row execute function public.playing_queue_fill_ids();

alter table playing_queue alter column game_id set not null;
alter table playing_queue alter column app_id drop not null;
alter table playing_queue add constraint playing_queue_user_id_game_id_key unique (user_id, game_id);
-- Deleting a game takes it off the queue.
alter table playing_queue
  add constraint playing_queue_game_fkey foreign key (user_id, game_id)
  references games (user_id, id) on delete cascade;

-- ─── Functions keyed by game id ─────────────────────────────────────────────

-- Atomically reorders the caller's queue (validated, RLS still applies).
create or replace function public.reorder_queue(p_game_ids bigint[])
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_len integer := coalesce(array_length(p_game_ids, 1), 0);
  v_existing_count integer;
  v_distinct_count integer;
  v_missing_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_order_len = 0 then
    raise exception 'Order must not be empty' using errcode = '22023';
  end if;

  select count(*) into v_existing_count from playing_queue where user_id = v_user_id;
  if v_existing_count <> v_order_len then
    raise exception 'Order length does not match queue size' using errcode = '22023';
  end if;

  select count(distinct x) into v_distinct_count from unnest(p_game_ids) as x;
  if v_distinct_count <> v_order_len then
    raise exception 'Order contains duplicate games' using errcode = '22023';
  end if;

  select count(*) into v_missing_count
  from unnest(p_game_ids) as x
  where not exists (select 1 from playing_queue where user_id = v_user_id and game_id = x);
  if v_missing_count <> 0 then
    raise exception 'Order references games not in queue' using errcode = '22023';
  end if;

  -- position has no unique constraint, so one UPDATE can rearrange freely.
  update playing_queue as pq
  set position = (new_order.pos - 1)::integer
  from unnest(p_game_ids) with ordinality as new_order(game_id, pos)
  where pq.user_id = v_user_id
    and pq.game_id = new_order.game_id;
end;
$$;

revoke all on function public.reorder_queue(bigint[]) from public, anon;
grant execute on function public.reorder_queue(bigint[]) to authenticated;

-- Counts a reroll; the count starts over 60 days after the last one (RLS still applies).
create or replace function public.record_game_reroll(p_game_id bigint)
returns void
language sql
set search_path to 'public'
as $$
  update games
  set
    reroll_count = case
      when last_rerolled_at is null or last_rerolled_at < now() - interval '60 days' then 1
      else coalesce(reroll_count, 0) + 1
    end,
    last_rerolled_at = now()
  where user_id = (select auth.uid()) and id = p_game_id;
$$;

revoke all on function public.record_game_reroll(bigint) from public, anon;
grant execute on function public.record_game_reroll(bigint) to authenticated;
