-- The history (game_events), whole, as it stands after a review of it on
-- November 17, 2026. Apply after 20261117_game_events_queue.sql and
-- 20261117_game_picks.sql. It defines every function and trigger of the
-- history again, so it is also the one to run if the history is ever in
-- doubt: unlike the migrations before it, running it by itself leaves the
-- history complete. Safe to run more than once.
--
-- What it changes:
-- - An Undo is taken out of the change it undoes and never out of an older
--   event. It used to fold into the game's last event whatever that was: a
--   game started, moved back within the sitting and then put back by Undo
--   rewrote its months-old arrival to "arrived playing".
-- - A platform move is never folded into an event that only holds hours
--   played, which lost those hours.
-- - The read of the event to fold into is locked, so two changes to one game
--   at the same moment can't lose one.
-- - Steam arrivals are counted over the whole sync, not one statement of it.
-- - A failure to record is noted in game_event_failures.
-- - The history also says when a game became a favorite or stopped being
--   one, and when it got a note or lost it (not the note's words).
-- - game_events has its own grants, a queue entry can't be pointed at another
--   game, and an Undo of taking a game off the queue can say it is one
--   (add_to_queue).

-- ─── Tables ─────────────────────────────────────────────────────────────────

alter table game_events drop constraint if exists game_events_kind_check;
alter table game_events
  add constraint game_events_kind_check
  check (kind in ('added', 'status', 'edit', 'queue', 'favorite', 'note', 'playtime'));

-- What went wrong when a change couldn't be recorded. Recording never stops
-- the change it rides on, so a history that has stopped recording would
-- otherwise say nothing: any row here means events are missing. Only the
-- triggers write it (game_event_failed), and only the server can read it.
create table if not exists game_event_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- The trigger function it happened in.
  source text not null,
  user_id uuid references auth.users (id) on delete cascade,
  game_id bigint,
  message text not null
);

alter table game_event_failures enable row level security;
revoke all on game_event_failures from anon, authenticated;
grant select, delete on game_event_failures to service_role;

-- Said outright, so the history works whatever a project grants new tables
-- by default: a player reads their own, the server reads and tidies.
grant select on game_events to authenticated;
grant select, insert, update, delete on game_events to service_role;

-- A queue entry is a game's place in the queue: a player moves it up and down
-- and nothing else. Pointing an entry at another game would queue that game
-- with no history of it.
revoke update on playing_queue from authenticated;
grant update (position) on playing_queue to authenticated;

-- ─── History: functions ─────────────────────────────────────────────────────

-- The history (game_events) is written by the triggers below and by nothing
-- else, with the table owner's rights, since players can't write it
-- themselves. It is a record on the side: whatever goes wrong in a trigger is
-- swallowed, so it never stops the change it is recording, and noted in
-- game_event_failures, so a history that has stopped recording shows.
--
-- Arrivals. A game arriving is recorded when a player added it by hand (in
-- any state) or bought it on Steam since their library was imported, and not
-- for an import: Steam games count as bought when the library already held
-- Steam games from ten minutes or more before and no more than fifty have
-- arrived in the last ten minutes (an import brings hundreds, over several
-- statements).
--
-- One sitting is one event. An action in the app is often several writes to
-- a game (adding one as finished is an insert, then a status change). So a
-- change to a game within 30 seconds of its last one is folded into that
-- event, which holds the net change: what each value was before the first
-- write and what it is after the last. If that comes to nothing the event
-- goes. An arrival stays an arrival, with what the game ended up starting
-- with.
--
-- An Undo. A change the app sends as an Undo (apply_status_change with
-- "undo": true and "ago", the seconds since the change it undoes was made;
-- add_to_queue) is taken out of the event that change is in, however long its
-- toast waited: the first event of the game touched since then. If none has
-- been (the change it undoes left no event, having itself put something
-- back), the Undo is recorded as a change like any other: it never reaches
-- into an older event. If a later event has since changed the same values,
-- it is folded into the game's last event instead. If an Undo didn't put
-- everything back, what is left stays.
--
-- The queue. Being queued is one more thing about a game, "queued", changed
-- by what happens in playing_queue: so starting a queued game is one event
-- (its status, and off the queue) and pausing a game for another is one (back
-- to the backlog, and onto the queue). Reordering the queue is not recorded.
--
-- Favorites and notes. Being one of the player's favorites is "favorite",
-- changed by favorite_games (their order is not recorded). Having a note is
-- "noted": that there is one, never its words.
--
-- Reading hours. playtime_forever is a running total for one platform, and
-- moving a game to another platform replaces it: hours saved with a platform
-- change are the new platform's total, not time played (so a move is never
-- folded into an event that only holds hours played). The time played is the
-- sum of the increases, leaving out any in an event that changes the
-- platform, the starting value of an arrival, decreases (corrections), and a
-- change from or to no value.
--
-- Reading finishes. A finish is a finished_at being set, and a drop a
-- dropped_at: the day the player chose (one without a date is undated). A
-- status that goes back to finished with the date it already had is the same
-- finish put back, not a second one.
--
-- Reading dates. An event's created_at is when it was logged, and
-- last_played_at, where an event carries it, is the day the game was played.
-- Dates are written in UTC whatever the session's time zone.

-- Notes that a change couldn't be recorded. Never raises.
create or replace function public.game_event_failed(
  p_source text,
  p_user uuid,
  p_game bigint,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.game_event_failures (source, user_id, game_id, message)
  values (p_source, p_user, p_game, left(p_message, 500));
exception when others then
  null;
end;
$$;

-- The columns of a game that the history records, as they are in one version
-- of its row. Dates are written in UTC. A note is recorded as there being
-- one.
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
    'last_played_at', g.last_played_at,
    'noted', coalesce(g.notes, '') <> ''
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
    when p_changes ? 'queued' then 'queue'
    when p_changes ? 'favorite' then 'favorite'
    when p_changes ? 'noted' then 'note'
    when p_changes ? 'playtime_forever' then 'playtime'
  end;
$$;

-- What a game arrived with: every value it has, each "before" null, leaving
-- out what it doesn't have (no hours yet, no note, not queued).
create or replace function public.game_event_arrival(p_changes jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, jsonb_build_array('null'::jsonb, value -> 1)), '{}'::jsonb)
  from jsonb_each(p_changes)
  where value -> 1 <> 'null'::jsonb
    and value -> 1 <> 'false'::jsonb
    and not (key = 'playtime_forever' and value -> 1 = '0'::jsonb);
$$;

-- Takes a set of changes to one game into its history: folded into the event
-- they belong with (the same sitting, or the change an Undo undoes), a new
-- event otherwise. Called by the triggers, which catch whatever goes wrong in
-- here. The event it folds into is locked while it is read, so two changes to
-- one game at the same moment are taken one after the other.
create or replace function public.game_event_record(p_user uuid, p_game bigint, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_net jsonb;
  v_kind text;
  v_undoing boolean;
  v_ago text;
  v_since timestamptz;
  v_keys text[];
  v_into public.game_events%rowtype;
  v_fold boolean;
  v_is_last boolean;
begin
  if p_changes = '{}'::jsonb then
    return;
  end if;
  -- Set by apply_status_change and add_to_queue for a change the app sends
  -- as an Undo.
  v_undoing := coalesce(current_setting('mybacklog.undoing', true), '') = 'true';
  v_is_last := true;

  if v_undoing then
    -- The change being undone was made "ago" seconds back (a day at most; an
    -- Undo that doesn't say counts as just now). Its event is the first one
    -- touched since: the 30 seconds are the sitting it may have joined.
    v_ago := coalesce(current_setting('mybacklog.undo_ago', true), '');
    v_since := now() - make_interval(secs => (30 + case
      when v_ago ~ '^[0-9]{1,9}(\.[0-9]{1,6})?$' then least(v_ago::numeric, 86400)
      else 0
    end)::double precision);

    select e.* into v_into
    from public.game_events e
    where e.user_id = p_user and e.game_id = p_game and e.updated_at > v_since
    order by e.id
    limit 1
    for update;
    v_fold := found;

    if v_fold then
      select coalesce(array_agg(name), '{}'::text[]) into v_keys
      from jsonb_object_keys(p_changes) as name
      where name <> 'last_played_at';
      if exists (
        select 1
        from public.game_events later
        where later.user_id = p_user and later.game_id = p_game
          and later.id > v_into.id and later.changes ?| v_keys
      ) then
        -- A later change stands on what this Undo takes back: it can only go
        -- into the last event.
        select e.* into v_into
        from public.game_events e
        where e.user_id = p_user and e.game_id = p_game
        order by e.id desc
        limit 1
        for update;
        v_fold := found and v_into.updated_at > v_since;
      else
        v_is_last := not exists (
          select 1
          from public.game_events later
          where later.user_id = p_user and later.game_id = p_game and later.id > v_into.id
        );
      end if;
    end if;
  else
    select e.* into v_into
    from public.game_events e
    where e.user_id = p_user and e.game_id = p_game
    order by e.id desc
    limit 1
    for update;
    -- The same sitting. Not a platform move after hours played: the hours
    -- that come with a move are another platform's total, and folding the
    -- two would lose the time played.
    v_fold := found
      and v_into.updated_at > now() - interval '30 seconds'
      and not (
        p_changes ? 'platform'
        and v_into.kind <> 'added'
        and v_into.changes ? 'playtime_forever'
        and not v_into.changes ? 'platform'
      );
  end if;

  if v_fold then
    v_net := public.game_event_net(v_into.changes, p_changes);
    if v_into.kind = 'added' then
      update public.game_events
      set
        changes = public.game_event_arrival(v_net),
        -- An event that isn't the game's last keeps its time: the sitting
        -- that later changes join is the last event's.
        updated_at = case when v_is_last then now() else updated_at end
      where id = v_into.id;
    elsif public.game_event_kind(v_net) is null then
      delete from public.game_events where id = v_into.id;
    else
      update public.game_events
      set
        kind = public.game_event_kind(v_net),
        changes = v_net,
        updated_at = case when v_is_last then now() else updated_at end
      where id = v_into.id;
    end if;
    return;
  end if;

  v_kind := public.game_event_kind(p_changes);
  if v_kind is not null then
    insert into public.game_events (user_id, game_id, kind, changes)
    values (p_user, p_game, v_kind, p_changes);
  end if;
end;
$$;

-- A change to a game already in the library.
create or replace function public.record_game_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
begin
  perform public.game_event_record(
    new.user_id,
    new.id,
    public.game_event_changes(public.game_event_snapshot(old), public.game_event_snapshot(new))
  );
  return null;
exception when others then
  raise warning 'record_game_event: % (%)', sqlerrm, sqlstate;
  begin
    perform public.game_event_failed(
      'record_game_event', new.user_id, new.id, sqlerrm || ' (' || sqlstate || ')'
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- Games arriving, once for each statement that adds any: a game added by
-- hand always, a Steam game when it reads as bought and not imported.
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
      from (select distinct n.user_id from added n where n.source = 'steam') as arriving
      where
        -- Everything Steam has brought in the last ten minutes, this
        -- statement's games and those of the statements before it: an import
        -- is hundreds of games over several statements.
        (
          select count(*)
          from public.games recent
          where recent.user_id = arriving.user_id
            and recent.source = 'steam'
            and recent.created_at > now() - interval '10 minutes'
        ) <= 50
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
  begin
    perform public.game_event_failed(
      'record_games_added', null, null, sqlerrm || ' (' || sqlstate || ')'
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- A game put on the queue, or taken off it. Not when the game itself is
-- going (removing a game takes its queue entry and its history with it).
create or replace function public.record_queue_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
begin
  if tg_op = 'INSERT' then
    perform public.game_event_record(new.user_id, new.game_id, '{"queued": [false, true]}'::jsonb);
  elsif exists (select 1 from public.games g where g.id = old.game_id) then
    perform public.game_event_record(old.user_id, old.game_id, '{"queued": [true, false]}'::jsonb);
  end if;
  return null;
exception when others then
  raise warning 'record_queue_event: % (%)', sqlerrm, sqlstate;
  begin
    if tg_op = 'INSERT' then
      perform public.game_event_failed(
        'record_queue_event', new.user_id, new.game_id, sqlerrm || ' (' || sqlstate || ')'
      );
    else
      perform public.game_event_failed(
        'record_queue_event', old.user_id, old.game_id, sqlerrm || ' (' || sqlstate || ')'
      );
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- A game made one of the player's favorites, or no longer one. Saving the
-- favorites replaces every row (set_favorite_games), so a game that stays one
-- is taken off and put back in the same save, which comes to nothing. Not
-- when the game itself is going.
create or replace function public.record_favorite_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
begin
  if tg_op = 'INSERT' then
    perform public.game_event_record(new.user_id, new.game_id, '{"favorite": [false, true]}'::jsonb);
  elsif exists (select 1 from public.games g where g.id = old.game_id) then
    perform public.game_event_record(old.user_id, old.game_id, '{"favorite": [true, false]}'::jsonb);
  end if;
  return null;
exception when others then
  raise warning 'record_favorite_event: % (%)', sqlerrm, sqlstate;
  begin
    if tg_op = 'INSERT' then
      perform public.game_event_failed(
        'record_favorite_event', new.user_id, new.game_id, sqlerrm || ' (' || sqlstate || ')'
      );
    else
      perform public.game_event_failed(
        'record_favorite_event', old.user_id, old.game_id, sqlerrm || ' (' || sqlstate || ')'
      );
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke execute on function public.game_event_failed(text, uuid, bigint, text) from public, anon, authenticated;
revoke execute on function public.game_event_snapshot(public.games) from public, anon, authenticated;
revoke execute on function public.game_event_changes(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.game_event_net(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.game_event_kind(jsonb) from public, anon, authenticated;
revoke execute on function public.game_event_arrival(jsonb) from public, anon, authenticated;
revoke execute on function public.game_event_record(uuid, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.record_game_event() from public, anon, authenticated;
revoke execute on function public.record_games_added() from public, anon, authenticated;
revoke execute on function public.record_queue_event() from public, anon, authenticated;
revoke execute on function public.record_favorite_event() from public, anon, authenticated;

-- ─── History: triggers ──────────────────────────────────────────────────────

-- One call for a whole statement, with every row it added: an import adds
-- hundreds at a time, and whether a game counts depends on the rest.
drop trigger if exists games_record_added on games;
create trigger games_record_added
  after insert on games
  referencing new table as added
  for each statement
  execute function public.record_games_added();

-- The condition is on the trigger, so the function isn't even called for the
-- changes it has nothing to say about: a sync rewrites details on every game.
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
    or (coalesce(old.notes, '') = '') is distinct from (coalesce(new.notes, '') = '')
  )
  execute function public.record_game_event();

-- Not on update: that is the queue being reordered.
drop trigger if exists playing_queue_record_added on playing_queue;
create trigger playing_queue_record_added
  after insert on playing_queue
  for each row
  execute function public.record_queue_event();

drop trigger if exists playing_queue_record_removed on playing_queue;
create trigger playing_queue_record_removed
  after delete on playing_queue
  for each row
  execute function public.record_queue_event();

-- Not on update: there is none (a save replaces the rows).
drop trigger if exists favorite_games_record_added on favorite_games;
create trigger favorite_games_record_added
  after insert on favorite_games
  for each row
  execute function public.record_favorite_event();

drop trigger if exists favorite_games_record_removed on favorite_games;
create trigger favorite_games_record_removed
  after delete on favorite_games
  for each row
  execute function public.record_favorite_event();

-- ─── History: saving as an Undo ─────────────────────────────────────────────

-- Saves a status change in one transaction: each game's new columns (the app
-- works them out, lib/games/status-rules.ts), in order, taking any game that
-- leaves the backlog off the queue, then putting paused games at the top of
-- it. A column not named in "update" keeps its value. RLS still applies.
-- An item with "undo": true is an Undo, with "ago" the seconds since the
-- change it undoes was made: the history takes it out of that change's event
-- (game_event_record). The games an Undo pauses are part of it.
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
  v_undo boolean := false;
  v_undo_ago text := '';
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
    -- An item sent as an Undo says so to the history, and how long ago the
    -- change it undoes was made. For this transaction only.
    perform set_config('mybacklog.undoing', coalesce(v_item ->> 'undo', 'false'), true);
    perform set_config('mybacklog.undo_ago', coalesce(v_item ->> 'ago', ''), true);
    if coalesce(v_item ->> 'undo', 'false') = 'true' then
      v_undo := true;
      v_undo_ago := coalesce(v_item ->> 'ago', '');
    end if;

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

  -- Paused games go first in the queue, ahead of what's there now. When the
  -- save is an Undo, so is pausing them.
  perform set_config('mybacklog.undoing', case when v_undo then 'true' else 'false' end, true);
  perform set_config('mybacklog.undo_ago', v_undo_ago, true);
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
  perform set_config('mybacklog.undoing', 'false', true);
  perform set_config('mybacklog.undo_ago', '', true);
end;
$$;

revoke all on function public.apply_status_change(jsonb, bigint[]) from public, anon;
grant execute on function public.apply_status_change(jsonb, bigint[]) to authenticated;

-- Puts one of the caller's games last on their queue, as an Undo of taking
-- it off: "p_undo_ago" is the seconds since it was taken off, and the history
-- takes the two out together (game_event_record). A game already queued
-- stays where it is. RLS still applies.
create or replace function public.add_to_queue(p_game_id bigint, p_undo_ago numeric)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  perform set_config('mybacklog.undoing', 'true', true);
  perform set_config('mybacklog.undo_ago', trunc(greatest(coalesce(p_undo_ago, 0), 0))::text, true);

  insert into playing_queue (user_id, game_id, position)
  select v_user_id, p_game_id, coalesce(max(position), -1) + 1
  from playing_queue
  where user_id = v_user_id
  on conflict (user_id, game_id) do nothing;

  perform set_config('mybacklog.undoing', 'false', true);
  perform set_config('mybacklog.undo_ago', '', true);
end;
$$;

revoke all on function public.add_to_queue(bigint, numeric) from public, anon;
grant execute on function public.add_to_queue(bigint, numeric) to authenticated;
