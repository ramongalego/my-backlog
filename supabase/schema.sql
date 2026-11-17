-- Snapshot of the full public schema, for reference and for recreating the
-- database. The base tables were created in the Supabase dashboard before
-- migrations were tracked, so migrations/ only holds later changes. This file
-- reflects the state after every migration in migrations/ has been applied.
-- Keep it in sync when adding migrations: supabase/tests checks the history
-- behaves the same built from this file and brought up by its migrations.

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  steam_id text,
  steam_username text,
  steam_avatar text,
  -- The name and picture the player chose on their Profile page, in place of
  -- the Steam ones (or the email before its @, or their initial); null uses those.
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  -- Public URL of the picture in the avatars storage bucket.
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table games (
  -- Always generated: an insert can't choose its id (ids are shared between
  -- players, so one chosen ahead of the sequence would block someone else's).
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  -- Steam app id; only Steam games have one. Games are keyed by id.
  app_id integer,
  -- Where the game came from: synced from Steam, or added by hand.
  source text not null default 'steam' check (source in ('steam', 'manual')),
  name text not null,
  playtime_forever integer default 0,
  img_icon_url text,
  created_at timestamptz default now(),
  genres text[],
  categories text[],
  description text,
  release_date text,
  header_image text,
  -- The player picked header_image themselves (Choose art), and the art the
  -- game would have otherwise, which syncs keep up to date instead.
  art_chosen boolean not null default false,
  default_header_image text,
  metadata_synced boolean default false,
  main_story_hours numeric,
  -- One of the app's six statuses (lib/games/status.ts).
  status text not null default 'backlog'
    constraint games_status_check
    check (status in ('backlog', 'playing', 'finished', 'dropped', 'wont_play', 'hidden')),
  type text,
  steam_review_score integer,
  steam_review_count integer,
  steam_review_weighted integer,
  reroll_count integer default 0,
  last_rerolled_at timestamptz,
  last_played_at timestamptz,
  platform text,
  started_at timestamptz,
  finished_at timestamptz,
  dropped_at timestamptz,
  notes text,
  rating smallint check (rating >= 0 and rating <= 10),
  tags text[],
  deck_compat integer,
  achievements_total integer,
  achievements_unlocked integer,
  -- The IGDB game a manual entry came from.
  igdb_id integer,
  -- A manual entry's Steam app id when Steam sells it too (for its reviews).
  steam_app_id integer,
  -- IGDB's average of critics' reviews (0-100), and how many it's from.
  critic_score smallint,
  critic_count smallint,
  -- When a manual entry without a time was last looked up on HowLongToBeat
  -- (it's looked up again weekly).
  hltb_checked_at timestamptz,
  unique (user_id, app_id),
  -- Referenced by playing_queue, so a queue row can only point at its own user's game.
  unique (user_id, id),
  constraint games_steam_has_app_id check (source <> 'steam' or app_id is not null),
  -- The same caps as the app's forms, since users can write their games directly.
  constraint games_notes_length check (char_length(notes) <= 1000),
  constraint games_platform_length check (char_length(platform) <= 60),
  constraint games_name_length check (char_length(name) <= 500)
);

-- Shared metadata cache, keyed by Steam app id. Written only by the server.
create table game_metadata (
  app_id integer primary key,
  type text,
  name text,
  genres text[],
  categories text[],
  description text,
  release_date text,
  header_image text,
  steam_review_score integer,
  steam_review_count integer,
  steam_review_weighted integer,
  main_story_hours numeric,
  synced_at timestamptz default now(),
  platform text,
  tags text[],
  deck_compat integer,
  -- Consecutive HLTB misses, driving the retry backoff.
  hltb_attempts integer not null default 0
);

create table playing_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id bigint not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, game_id),
  -- Deleting a game takes it off the queue.
  foreign key (user_id, game_id) references games (user_id, id) on delete cascade
);

-- The games a player picks as their favorites for their Profile page: up to
-- four, in the order they chose.
create table favorite_games (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id bigint not null,
  -- Where it sits in the row, 0 first. Four places, each held once.
  position smallint not null check (position between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (user_id, game_id),
  unique (user_id, position),
  -- Deleting a game takes it off the favorites.
  foreign key (user_id, game_id) references games (user_id, id) on delete cascade
);

-- A history of what a player does with their games: a game's row only holds
-- how things stand now, so a game arriving and each change to its status,
-- dates, rating, hours or platform is kept here as it happens (the triggers
-- below write it, and say how; nothing reads it yet). See the three
-- migrations/20261117_game_events*.sql.
create table game_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  game_id bigint not null,
  -- What happened: the game arrived (added by hand, or bought on Steam since
  -- the library was imported), its status moved (which carries any dates and
  -- rating saved with it), a date, rating or platform was changed by itself,
  -- or only the hours changed.
  kind text not null check (kind in ('added', 'status', 'edit', 'playtime')),
  -- Each column that changed, as [before, after]: status, started_at,
  -- finished_at, dropped_at, rating, playtime_forever (minutes), platform,
  -- and last_played_at when it changed along with one of those. For a game
  -- arriving, it is what the game started with, every "before" null.
  changes jsonb not null,
  -- When the first change of the event was made, and the last one folded
  -- into it (changes within 30 seconds of each other are one event).
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Removing a game (or disconnecting Steam, or deleting the account) takes
  -- its history with it, as the privacy policy says.
  foreign key (user_id, game_id) references games (user_id, id) on delete cascade
);

create table shared_completions (
  id text primary key,
  game_name text not null,
  header_image text,
  playtime_minutes integer not null default 0,
  main_story_hours real,
  rating integer,
  games_finished integer not null default 0,
  total_games integer not null default 0,
  backlog_hours_removed real,
  next_game text,
  next_game_image text,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type = any (array['bug', 'feedback', 'support'])),
  message text not null,
  created_at timestamptz not null default now()
);

-- Written only by the server (secret key): RLS on, no policies.
create table rate_limits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);

-- The last profile and roast written for each player (Stats). Written only by
-- /api/insights with the server's key; a player can read their own.
create table player_insights (
  user_id uuid not null references auth.users (id) on delete cascade,
  tone text not null check (tone = any (array['profile', 'roast'])),
  headline text not null,
  paragraphs jsonb not null,
  signature text not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, tone)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

create index idx_game_metadata_synced_at on game_metadata (synced_at);
create index idx_game_metadata_refresh on game_metadata (type, main_story_hours, synced_at);
create unique index games_one_playing_per_user on games (user_id) where status = 'playing';
-- One manual entry per game and platform.
create unique index games_manual_unique on games (user_id, igdb_id, platform) where source = 'manual';
create index playing_queue_user_position on playing_queue (user_id, position);
-- A player's history, newest first; and one game's, for the trigger's lookup.
create index game_events_user_time on game_events (user_id, id desc);
create index game_events_game on game_events (user_id, game_id, id desc);

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table games enable row level security;
alter table game_metadata enable row level security;
alter table playing_queue enable row level security;
alter table favorite_games enable row level security;
alter table game_events enable row level security;
alter table shared_completions enable row level security;
alter table support_tickets enable row level security;
alter table rate_limits enable row level security;
alter table player_insights enable row level security;

create policy "Users can view own profile" on profiles
  for select to authenticated using ((select auth.uid()) = id);
-- Profiles are written only by the server: the handle_new_user trigger, and
-- the Steam sign-in, so a Steam id can't be claimed without signing in to it.
revoke insert, update on profiles from anon, authenticated;

create policy "Users can view own games" on games
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own games" on games
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own games" on games
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own games" on games
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Anyone can read game metadata" on game_metadata
  for select to authenticated using (true);

create policy "Users manage own queue" on playing_queue
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own favorites" on favorite_games
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A player can read their own history. Nobody writes it but the trigger.
create policy "Users can view own game events" on game_events
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on game_events from anon;
revoke insert, update, delete, truncate on game_events from authenticated;

-- Share pages: no policies and no privileges, so the public API can't read,
-- list or write them. /api/share/completion creates one with the server's key
-- after its checks, and the share page and its preview image read one row by
-- its unguessable id the same way (lib/server/shared-completions.ts).
revoke all on shared_completions from anon, authenticated;

create policy "Users can view own insights" on player_insights
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on player_insights from anon, authenticated;

-- Saved only by /api/support, with the server's key, after its limits.
revoke insert on support_tickets from anon, authenticated;

-- ─── Functions and triggers ─────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

-- Only ever run as the trigger below; never callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The history (game_events) is written by the triggers below and by nothing
-- else, with the table owner's rights, since players can't write it
-- themselves. It is a record on the side: whatever goes wrong in a trigger is
-- logged and swallowed, so it never stops the change it is recording.
--
-- Arrivals. A game arriving is recorded when a player added it by hand (in
-- any state) or bought it on Steam since their library was imported, and not
-- for an import: Steam games count as bought when the library already held
-- Steam games from ten minutes or more before and no more than twenty arrive
-- at once.
--
-- One sitting is one event. An action in the app is often several writes to
-- a game (adding one as finished is an insert, then a status change), and an
-- Undo is a second change that cancels the first. So a change to a game
-- within 30 seconds of its last one is folded into that event, which holds
-- the net change: what each value was before the first write and what it is
-- after the last. If that comes to nothing the event goes; if an Undo didn't
-- put everything back, what is left stays. An arrival stays an arrival, with
-- what the game ended up starting with. A change the app sends as an Undo
-- (apply_status_change, "undo": true) is folded in however late it comes:
-- its toast waits while the tab is in the background.
--
-- Reading hours. playtime_forever is a running total for one platform, and
-- moving a game to another platform replaces it. The time played is the sum
-- of its increases, leaving out any change recorded in the same event as a
-- platform change, the first change after one, the starting value of an
-- arrival, and decreases (corrections).
--
-- Reading dates. A finish or a drop happened on the finished_at or
-- dropped_at it carries, which the player chose; one without a date is
-- undated. An event's created_at is when it was logged, and last_played_at,
-- where an event carries it, is the day the game was played. Dates are
-- written in UTC whatever the session's time zone.

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

-- One call for a whole statement, with every row it added: an import adds
-- hundreds at a time, and whether a game counts depends on the rest.
create trigger games_record_added
  after insert on games
  referencing new table as added
  for each statement
  execute function public.record_games_added();

-- The condition is on the trigger, so the function isn't even called for the
-- changes it has nothing to say about: a sync rewrites details on every game.
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

-- Replaces a player's favorites with the given games, in that order, in one
-- transaction (the places are unique, so they can't be rearranged row by row).
-- An empty list clears them.
create or replace function public.set_favorite_games(p_game_ids bigint[])
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_len integer := coalesce(array_length(p_game_ids, 1), 0);
  v_distinct_count integer;
  v_missing_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_len > 4 then
    raise exception 'At most 4 favorites' using errcode = '22023';
  end if;

  select count(distinct x) into v_distinct_count from unnest(p_game_ids) as x;
  if v_distinct_count <> v_len then
    raise exception 'Favorites contain duplicate games' using errcode = '22023';
  end if;

  select count(*) into v_missing_count
  from unnest(p_game_ids) as x
  where not exists (select 1 from games where user_id = v_user_id and id = x);
  if v_missing_count <> 0 then
    raise exception 'Favorites reference games not in the library' using errcode = '22023';
  end if;

  delete from favorite_games where user_id = v_user_id;

  insert into favorite_games (user_id, game_id, position)
  select v_user_id, picked.game_id, (picked.pos - 1)::smallint
  from unnest(p_game_ids) with ordinality as picked(game_id, pos);
end;
$$;

revoke all on function public.set_favorite_games(bigint[]) from public, anon;
grant execute on function public.set_favorite_games(bigint[]) to authenticated;

-- Whether the signed-in player's account has a password. One made by signing
-- in with Google or Discord has none until they set one (by the reset link),
-- and nothing Supabase hands the app says which: the account's sign-in methods
-- don't change when a password is set that way. Security definer, to read
-- auth.users, and it only ever answers about the caller: a yes or no.
create or replace function public.account_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.encrypted_password is not null and u.encrypted_password <> ''
      from auth.users u
      where u.id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function public.account_has_password() from public, anon;
grant execute on function public.account_has_password() to authenticated;

-- Saves a status change in one transaction: each game's new columns (the app
-- works them out, lib/games/status-rules.ts), in order, taking any game that
-- leaves the backlog off the queue, then putting paused games at the top of
-- it. A column not named in "update" keeps its value. RLS still applies.
-- An item with "undo": true is an Undo, which the history folds into the
-- change it undoes (record_game_event).
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

revoke all on function public.apply_status_change(jsonb, bigint[]) from public, anon;
grant execute on function public.apply_status_change(jsonb, bigint[]) to authenticated;

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

-- Atomic rate-limit counter used by the server (service_role only).
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
  v_reset timestamptz;
begin
  insert into rate_limits as rl (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when rl.reset_at <= now() then 1 else rl.count + 1 end,
        reset_at = case
          when rl.reset_at <= now() then now() + make_interval(secs => p_window_seconds)
          else rl.reset_at
        end
  returning rl.count, rl.reset_at into v_count, v_reset;

  if random() < 0.01 then
    delete from rate_limits where rate_limits.reset_at < now() - interval '1 day';
  end if;

  return query select v_count <= p_limit, greatest(p_limit - v_count, 0), v_reset;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Profile pictures: small squares made in the browser, public to read, written
-- only by the server (no policies for players). See
-- migrations/20261116_profile_name_and_avatar.sql.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
