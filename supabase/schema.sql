-- Snapshot of the full public schema, for reference and for recreating the
-- database. The base tables were created in the Supabase dashboard before
-- migrations were tracked, so migrations/ only holds later changes. This file
-- reflects the state after every migration up to 20261112 has been applied.
-- Keep it in sync when adding migrations.

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  steam_id text,
  steam_username text,
  steam_avatar text,
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

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table games enable row level security;
alter table game_metadata enable row level security;
alter table playing_queue enable row level security;
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

-- Saves a status change in one transaction: each game's new columns (the app
-- works them out, lib/games/status-rules.ts), in order, taking any game that
-- leaves the backlog off the queue, then putting paused games at the top of
-- it. A column not named in "update" keeps its value. RLS still applies.
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
    or jsonb_array_length(p_updates) not between 1 and 20
  then
    raise exception 'Expected between 1 and 20 updates' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_updates) loop
    v_game_id := (v_item ->> 'id')::bigint;
    v_update := v_item -> 'update';

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
