-- ALREADY APPLIED, AND SUPERSEDED: 20261117_history_fixes.sql defines the
-- whole history again. Don't run this file again by itself: it puts back an
-- older version of some functions, and the history then records less until
-- 20261117_history_fixes.sql is run after it.
--
-- The history also records a game arriving in the library (kind "added"),
-- which 20261117_game_events.sql left out unless the game arrived already
-- started, finished or dropped:
--
--   - a game added by hand, in any state: always;
--   - a Steam game that turns up on a refresh, which is one the player bought
--     since: yes;
--   - a Steam import: no. Connecting Steam adds a whole library at once, and
--     hundreds of "added" events would say nothing.
--
-- An arrival is told from an import by what is already there: Steam games
-- count as bought when the library already held Steam games from before (ten
-- minutes or more, so the batches of one import don't vouch for each other)
-- and no more than twenty arrive at once.

alter table game_events drop constraint if exists game_events_kind_check;
alter table game_events
  add constraint game_events_kind_check check (kind in ('added', 'status', 'edit', 'playtime'));

-- Each of a game's tracked columns that differs between two versions of its
-- row, as [before, after]. A column missing from "before" counts as null, so
-- an empty "before" gives every value the game starts with.
create or replace function public.game_event_changes(p_before jsonb, p_after jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(tracked.name, jsonb_build_array(tracked.was, tracked.is_now)), '{}'::jsonb)
  from (
    select
      name,
      coalesce(p_before -> name, 'null'::jsonb) as was,
      coalesce(p_after -> name, 'null'::jsonb) as is_now
    from unnest(
      array['status', 'started_at', 'finished_at', 'dropped_at', 'rating', 'playtime_forever']
    ) as name
  ) as tracked
  where tracked.was <> tracked.is_now;
$$;

revoke execute on function public.game_event_changes(jsonb, jsonb) from public, anon, authenticated;

-- A change to a game already in the library (as before, now for updates only).
create or replace function public.record_game_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := public.game_event_changes(to_jsonb(old), to_jsonb(new));
  v_kind text;
  v_last public.game_events%rowtype;
begin
  if v_changes = '{}'::jsonb then
    return null;
  end if;

  v_kind := case
    when v_changes ? 'status' then 'status'
    when v_changes ?| array['started_at', 'finished_at', 'dropped_at', 'rating'] then 'edit'
    else 'playtime'
  end;

  if v_kind = 'status' then
    select e.* into v_last
    from public.game_events e
    where e.user_id = new.user_id and e.game_id = new.id and e.kind = 'status'
    order by e.id desc
    limit 1;

    if found
      and v_last.created_at > now() - interval '30 seconds'
      and v_last.changes -> 'status' = jsonb_build_array(to_jsonb(new.status), to_jsonb(old.status))
    then
      delete from public.game_events where id = v_last.id;
      return null;
    end if;
  end if;

  insert into public.game_events (user_id, game_id, kind, changes)
  values (new.user_id, new.id, v_kind, v_changes);
  return null;
exception when others then
  raise warning 'record_game_event: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke execute on function public.record_game_event() from public, anon, authenticated;

-- Games arriving, once for each statement that adds any (see the top of this
-- file for which are recorded). "changes" holds what each game started with,
-- every "before" null; hours are left out when there are none yet.
create or replace function public.record_games_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.game_events (user_id, game_id, kind, changes)
  select
    a.user_id,
    a.id,
    'added',
    case
      when coalesce(a.playtime_forever, 0) > 0
        then public.game_event_changes('{}'::jsonb, to_jsonb(a))
      else public.game_event_changes('{}'::jsonb, to_jsonb(a)) - 'playtime_forever'
    end
  from added a
  where
    -- By hand, or already in a state: something the player did.
    a.source <> 'steam'
    or a.status <> 'backlog'
    -- From Steam into the backlog: only when it reads as bought, not imported.
    or a.user_id in (
      select arriving.user_id
      from (
        select n.user_id, count(*) as games
        from added n
        where n.source = 'steam' and n.status = 'backlog'
        group by n.user_id
      ) as arriving
      where arriving.games <= 20
        and exists (
          select 1
          from public.games g
          where g.user_id = arriving.user_id
            and g.source = 'steam'
            and g.created_at < now() - interval '10 minutes'
        )
    )
  order by a.id;
  return null;
exception when others then
  raise warning 'record_games_added: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke execute on function public.record_games_added() from public, anon, authenticated;

-- One call for a whole statement, with every row it added: an import adds
-- hundreds at a time, and whether a game counts depends on the rest.
drop trigger if exists games_record_added on games;
create trigger games_record_added
  after insert on games
  referencing new table as added
  for each statement
  execute function public.record_games_added();
