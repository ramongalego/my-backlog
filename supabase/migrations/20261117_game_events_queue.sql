-- The history records a game going on the queue and coming off it. Applied
-- after 20261117_game_events_merged.sql.
--
-- Being queued is kept as one more thing about the game, "queued", changed by
-- what happens in playing_queue instead of in the game's own row. So it
-- follows every rule the history already has: starting a queued game is one
-- event (its status, and off the queue), pausing a game for another is one
-- (back to the backlog, and onto the queue), a game queued and taken straight
-- off again leaves nothing, and replaying a game's events says whether it is
-- queued now.
--
-- An event that is only that is a "queue" event. Reordering the queue is not
-- recorded: a game's place in it is where things stand, not something that
-- happened to the game.

alter table game_events drop constraint if exists game_events_kind_check;
alter table game_events
  add constraint game_events_kind_check
  check (kind in ('added', 'status', 'edit', 'queue', 'playtime'));

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
    when p_changes ? 'playtime_forever' then 'playtime'
  end;
$$;

-- Takes a set of changes to one game into its history: folded into the
-- game's last event when that is part of the same sitting (or the change is
-- an Undo), a new event otherwise. Called by the triggers, which catch
-- whatever goes wrong in here.
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
  v_last public.game_events%rowtype;
begin
  if p_changes = '{}'::jsonb then
    return;
  end if;
  -- Set by apply_status_change for a change the app sends as an Undo.
  v_undoing := coalesce(current_setting('mybacklog.undoing', true), '') = 'true';

  select e.* into v_last
  from public.game_events e
  where e.user_id = p_user and e.game_id = p_game
  order by e.id desc
  limit 1;

  -- Part of the same sitting, or the Undo of it: the event becomes the net
  -- change.
  if found and (v_undoing or v_last.updated_at > now() - interval '30 seconds') then
    v_net := public.game_event_net(v_last.changes, p_changes);
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
    return;
  end if;

  v_kind := public.game_event_kind(p_changes);
  if v_kind is not null then
    insert into public.game_events (user_id, game_id, kind, changes)
    values (p_user, p_game, v_kind, p_changes);
  end if;
end;
$$;

revoke execute on function public.game_event_kind(jsonb) from public, anon, authenticated;
revoke execute on function public.game_event_record(uuid, bigint, jsonb) from public, anon, authenticated;

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
  return null;
end;
$$;

revoke execute on function public.record_game_event() from public, anon, authenticated;

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
  return null;
end;
$$;

revoke execute on function public.record_queue_event() from public, anon, authenticated;

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
