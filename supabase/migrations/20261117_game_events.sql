-- ALREADY APPLIED, AND SUPERSEDED: 20261117_history_fixes.sql defines the
-- whole history again. Don't run this file again by itself: it puts back an
-- older version of some functions, and the history then records less until
-- 20261117_history_fixes.sql is run after it.
--
-- A history of what a player does with their games. A game's row only holds
-- how things stand now (one status, one start date, one finish date), so what
-- came before is lost each time it changes. From here on every such change is
-- kept: nothing reads it yet, but a year in review, a fuller activity list
-- and replays ("finished twice") all need it, and it can't be made up later.
--
-- The database records it itself (the triggers below), so no way of changing
-- a game can skip it: the app's routes, a move of many games at once, a Steam
-- refresh, or a player writing to their own games.

create table if not exists game_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  game_id bigint not null,
  -- What kind of change: the status moved (which carries any dates and rating
  -- saved with it), a date or rating was edited by itself, or only the hours.
  kind text not null check (kind in ('status', 'edit', 'playtime')),
  -- Each column that changed, as [before, after]: status, started_at,
  -- finished_at, dropped_at, rating, playtime_forever (minutes). "before" is
  -- null for a game that was added already started, finished or dropped.
  changes jsonb not null,
  created_at timestamptz not null default now(),
  -- Removing a game (or disconnecting Steam, or deleting the account) takes
  -- its history with it, as the privacy policy says.
  foreign key (user_id, game_id) references games (user_id, id) on delete cascade
);

-- A player's history, newest first; and one game's, for the trigger's lookup
-- and the cascade.
create index if not exists game_events_user_time on game_events (user_id, id desc);
create index if not exists game_events_game on game_events (user_id, game_id, id desc);

alter table game_events enable row level security;

-- A player can read their own history. Nobody writes it but the trigger.
drop policy if exists "Users can view own game events" on game_events;
create policy "Users can view own game events" on game_events
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on game_events from anon;
revoke insert, update, delete, truncate on game_events from authenticated;

-- Writes one row for a change to a game's status, dates, rating or hours. It
-- runs with the table owner's rights, since players can't write the history
-- themselves, and reads nothing but the row being changed.
--
-- A status put straight back within half a minute (Undo, which every status
-- change offers) takes the first change out again instead of adding a second:
-- a change that was undone leaves no trace.
--
-- The history is a record on the side. Whatever goes wrong in here is logged
-- and swallowed: it must never stop the change it is recording.
create or replace function public.record_game_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := to_jsonb(new);
  v_column text;
  v_before jsonb;
  v_after jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_kind text;
  v_last public.game_events%rowtype;
begin
  foreach v_column in array
    array['status', 'started_at', 'finished_at', 'dropped_at', 'rating', 'playtime_forever']
  loop
    v_before := coalesce(v_old -> v_column, 'null'::jsonb);
    v_after := coalesce(v_new -> v_column, 'null'::jsonb);
    if v_before <> v_after then
      v_changes := v_changes || jsonb_build_object(v_column, jsonb_build_array(v_before, v_after));
    end if;
  end loop;

  if v_changes = '{}'::jsonb then
    return null;
  end if;

  v_kind := case
    when v_changes ? 'status' then 'status'
    when v_changes ?| array['started_at', 'finished_at', 'dropped_at', 'rating'] then 'edit'
    else 'playtime'
  end;

  if tg_op = 'UPDATE' and v_kind = 'status' then
    select e.* into v_last
    from public.game_events e
    where e.user_id = new.user_id and e.game_id = new.id and e.kind = 'status'
    order by e.id desc
    limit 1;

    if found
      and v_last.created_at > now() - interval '30 seconds'
      and v_last.changes -> 'status' = jsonb_build_array(v_new -> 'status', v_old -> 'status')
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

-- Only ever run as the triggers below; never callable through the API.
revoke execute on function public.record_game_event() from public, anon, authenticated;

-- The conditions are on the triggers, so the function isn't even called for
-- the changes it has nothing to say about: a Steam import adds thousands of
-- backlog games, and a sync rewrites details on every one of them.
drop trigger if exists games_record_added on games;
create trigger games_record_added
  after insert on games
  for each row
  when (new.status <> 'backlog')
  execute function public.record_game_event();

drop trigger if exists games_record_changed on games;
create trigger games_record_changed
  after update on games
  for each row
  when (
    old.status is distinct from new.status
    or old.started_at is distinct from new.started_at
    or old.finished_at is distinct from new.finished_at
    or old.dropped_at is distinct from new.dropped_at
    or old.rating is distinct from new.rating
    or old.playtime_forever is distinct from new.playtime_forever
  )
  execute function public.record_game_event();
