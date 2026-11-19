-- Changes to a game within a minute of each other are one event in its
-- history (one sitting), and an Undo looks back over the same minute.
-- Only the function that records an event changes; the history already
-- recorded stays as it is. Safe to run more than once.

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
    -- touched since: the minute is the sitting it may have joined.
    v_ago := coalesce(current_setting('mybacklog.undo_ago', true), '');
    v_since := now() - make_interval(secs => (60 + case
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
      and v_into.updated_at > now() - interval '1 minute'
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
