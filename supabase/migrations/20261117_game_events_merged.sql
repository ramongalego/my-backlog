-- Corrections to the history, found by running every way the app changes a
-- game against it and by an independent review. Applied after
-- 20261117_game_events_added.sql.
--
-- 1. One sitting is one event. An action in the app is often several writes
--    to a game (adding one as finished is an insert, then a status change;
--    undoing a switch is three), and an Undo is a second change that cancels
--    the first. Recording each write left entries that meant nothing: a start
--    date "edited" to nothing after a switch was undone, a game "added to the
--    backlog" and "finished" in the same second. Worse, the old rule dropped
--    both entries whenever a status went straight back, even when the Undo
--    had not put everything back (stopping a game and undoing it restarts it
--    with today as its start date), so a real change went unrecorded.
--
--    Now a change to a game within 30 seconds of its last one is folded into
--    that event, which holds the net change: what each value was before the
--    first write and what it is after the last. If that comes to nothing, the
--    event goes; if something is left, it stays, as what really changed. An
--    arrival stays an arrival, with what the game ended up starting with.
--
-- 2. An Undo is folded in however late it comes. Its toast waits while the
--    tab is in the background, so the click can come minutes after the
--    change, and a move from Finished to Hidden undone that late read as the
--    game being finished a second time. The app now says when a change is an
--    Undo (apply_status_change, below), and the history folds it into the
--    game's last event whatever its age.
--
-- 3. Where a game is played is part of its history. Moving a Steam game to a
--    console replaces its hours with the ones entered for the console, and
--    moving it back lets Steam's return: both looked like hours played. The
--    platform is now recorded when it changes (see "Reading hours").
--
-- 4. Hours carry the day they were played. Steam reports when a game was
--    last played, and a console game is dated when its hours are logged. That
--    date is kept with the change it came with, since the event itself is
--    dated when the app noticed, which can be days later.
--
-- 5. Dates are always written in UTC, whatever time zone the session that
--    made the change asked for: a date read off the text was a day out, and
--    the same moment written two ways didn't cancel.
--
-- 6. Nothing in here can stop a game being saved. The first version worked
--    the changes out before its error handler began.
--
-- Reading hours: playtime_forever is a running total for one platform. The
-- time played is the sum of its increases, leaving out any change recorded in
-- the same event as a platform change, the first change after one, the
-- starting value of an arrival, and decreases (corrections).
--
-- Reading dates: a finish or a drop happened on the finished_at or dropped_at
-- it carries, which the player chose; one without a date is undated. The
-- event's own created_at is when it was logged.

-- When the event last took a change in: what the 30 seconds are counted from.
alter table game_events add column if not exists updated_at timestamptz not null default now();

-- The columns of a game that the history records, as they are in one version
-- of its row. Dates are written in UTC.
create or replace function public.game_event_snapshot(g public.games)
returns jsonb
language sql
stable
set search_path = ''
set timezone = 'UTC'
as $$
  select jsonb_build_object(
    'status', g.status,
    'started_at', g.started_at,
    'finished_at', g.finished_at,
    'dropped_at', g.dropped_at,
    'rating', g.rating,
    'playtime_forever', g.playtime_forever,
    'platform', g.platform,
    'last_played_at', g.last_played_at
  );
$$;

-- Each recorded column that differs between two versions of a game's row, as
-- [before, after]. A column missing from "before" counts as null.
create or replace function public.game_event_changes(p_before jsonb, p_after jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      now_is.key,
      jsonb_build_array(coalesce(p_before -> now_is.key, 'null'::jsonb), now_is.value)
    ),
    '{}'::jsonb
  )
  from jsonb_each(p_after) as now_is
  where coalesce(p_before -> now_is.key, 'null'::jsonb) <> now_is.value;
$$;

-- Two sets of changes to one game, one after the other, as a single set:
-- each value as it was before the first and as it is after the second. A
-- value that ends where it began drops out.
create or replace function public.game_event_net(p_earlier jsonb, p_later jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(net.name, jsonb_build_array(net.was, net.is_now)), '{}'::jsonb)
  from (
    select
      name,
      case when p_earlier ? name then p_earlier -> name -> 0 else p_later -> name -> 0 end as was,
      case when p_later ? name then p_later -> name -> 1 else p_earlier -> name -> 1 end as is_now
    from (
      select jsonb_object_keys(p_earlier) as name
      union
      select jsonb_object_keys(p_later)
    ) as names
  ) as net
  where net.was <> net.is_now;
$$;

-- What kind of event a set of changes is, or null when it is none: when a
-- game was last played is only ever recorded alongside something else.
create or replace function public.game_event_kind(p_changes jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_changes ? 'status' then 'status'
    when p_changes ?| array['started_at', 'finished_at', 'dropped_at', 'rating', 'platform'] then 'edit'
    when p_changes ? 'playtime_forever' then 'playtime'
  end;
$$;

-- What a game arrived with: every value it has, each "before" null, leaving
-- out what it doesn't have (and hours when there are none yet).
create or replace function public.game_event_arrival(p_changes jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, jsonb_build_array('null'::jsonb, value -> 1)), '{}'::jsonb)
  from jsonb_each(p_changes)
  where value -> 1 <> 'null'::jsonb
    and not (key = 'playtime_forever' and value -> 1 = '0'::jsonb);
$$;

revoke execute on function public.game_event_snapshot(public.games) from public, anon, authenticated;
revoke execute on function public.game_event_changes(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.game_event_net(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.game_event_kind(jsonb) from public, anon, authenticated;
revoke execute on function public.game_event_arrival(jsonb) from public, anon, authenticated;

-- A change to a game already in the library.
create or replace function public.record_game_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_changes jsonb;
  v_net jsonb;
  v_kind text;
  v_undoing boolean;
  v_last public.game_events%rowtype;
begin
  v_changes := public.game_event_changes(
    public.game_event_snapshot(old),
    public.game_event_snapshot(new)
  );
  -- Set by apply_status_change for a change the app sends as an Undo.
  v_undoing := coalesce(current_setting('mybacklog.undoing', true), '') = 'true';

  select e.* into v_last
  from public.game_events e
  where e.user_id = new.user_id and e.game_id = new.id
  order by e.id desc
  limit 1;

  -- Part of the same sitting, or the Undo of it: the event becomes the net
  -- change.
  if found and (v_undoing or v_last.updated_at > now() - interval '30 seconds') then
    v_net := public.game_event_net(v_last.changes, v_changes);
    if v_last.kind = 'added' then
      update public.game_events
      set changes = public.game_event_arrival(v_net), updated_at = now()
      where id = v_last.id;
    elsif public.game_event_kind(v_net) is null then
      delete from public.game_events where id = v_last.id;
    else
      update public.game_events
      set kind = public.game_event_kind(v_net), changes = v_net, updated_at = now()
      where id = v_last.id;
    end if;
    return null;
  end if;

  v_kind := public.game_event_kind(v_changes);
  if v_kind is not null then
    insert into public.game_events (user_id, game_id, kind, changes)
    values (new.user_id, new.id, v_kind, v_changes);
  end if;
  return null;
exception when others then
  raise warning 'record_game_event: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke execute on function public.record_game_event() from public, anon, authenticated;

-- Games arriving, once for each statement that adds any: a game added by
-- hand always, a Steam game when it reads as bought and not imported (see
-- 20261117_game_events_added.sql).
create or replace function public.record_games_added()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
begin
  insert into public.game_events (user_id, game_id, kind, changes)
  select
    g.user_id,
    g.id,
    'added',
    public.game_event_arrival(
      public.game_event_changes('{}'::jsonb, public.game_event_snapshot(g))
    )
  from added a
  join public.games g on g.id = a.id
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
          from public.games older
          where older.user_id = arriving.user_id
            and older.source = 'steam'
            and older.created_at < now() - interval '10 minutes'
        )
    )
  order by g.id;
  return null;
exception when others then
  raise warning 'record_games_added: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke execute on function public.record_games_added() from public, anon, authenticated;

-- The platform is one of the changes that are recorded now.
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
    or old.platform is distinct from new.platform
  )
  execute function public.record_game_event();

-- Saves a status change (as 20261113_apply_status_change_bulk.sql), and now
-- tells the history which items are an Undo: the app sends "undo": true with
-- them. An item without it, as every version of the app before this sent,
-- is an ordinary change.
create or replace function public.apply_status_change(
  p_updates jsonb,
  p_pause_ids bigint[] default '{}'
)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_update jsonb;
  v_game_id bigint;
  v_top integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_updates is null
    or jsonb_typeof(p_updates) <> 'array'
    or jsonb_array_length(p_updates) not between 1 and 2000
  then
    raise exception 'Expected between 1 and 2000 updates' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_updates) loop
    v_game_id := (v_item ->> 'id')::bigint;
    v_update := v_item -> 'update';
    -- An item sent as an Undo ("undo": true) says so to the history, which
    -- folds it into the change it undoes however long ago that was
    -- (record_game_event). For this transaction only.
    perform set_config('mybacklog.undoing', coalesce(v_item ->> 'undo', 'false'), true);

    update games
    set
      status = v_update ->> 'status',
      started_at = case when v_update ? 'started_at'
        then (v_update ->> 'started_at')::timestamptz else started_at end,
      finished_at = case when v_update ? 'finished_at'
        then (v_update ->> 'finished_at')::timestamptz else finished_at end,
      dropped_at = case when v_update ? 'dropped_at'
        then (v_update ->> 'dropped_at')::timestamptz else dropped_at end,
      notes = case when v_update ? 'notes' then v_update ->> 'notes' else notes end,
      rating = case when v_update ? 'rating'
        then (v_update ->> 'rating')::smallint else rating end,
      last_played_at = case when v_update ? 'last_played_at'
        then (v_update ->> 'last_played_at')::timestamptz else last_played_at end
    where user_id = v_user_id and id = v_game_id;

    if not found then
      raise exception 'Game not found' using errcode = 'P0002';
    end if;

    -- The queue only holds backlog games.
    if v_update ->> 'status' <> 'backlog' then
      delete from playing_queue where user_id = v_user_id and game_id = v_game_id;
    end if;
  end loop;
  perform set_config('mybacklog.undoing', 'false', true);

  -- Paused games go first in the queue, ahead of what's there now.
  if coalesce(array_length(p_pause_ids, 1), 0) > 0 then
    select coalesce(min(position), 1) - 1 into v_top
    from playing_queue
    where user_id = v_user_id;

    insert into playing_queue (user_id, game_id, position)
    select v_user_id, g.id, v_top - (paused.ord - 1)::integer
    from unnest(p_pause_ids) with ordinality as paused(game_id, ord)
    join games g
      on g.user_id = v_user_id and g.id = paused.game_id and g.status = 'backlog'
    on conflict (user_id, game_id) do update set position = excluded.position;
  end if;
end;
$$;
