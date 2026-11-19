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
  -- The name in the profile's address (/u/<username>): lowercase letters,
  -- numbers, _ and -, 3 to 20 of them, not all punctuation. Given by the
  -- profiles_give_username trigger when the profile is made, and the player's
  -- to change through the app's API (claim_username).
  username text not null
    constraint profiles_username_format
    check (username ~ '^[a-z0-9_-]{3,20}$' and username ~ '[a-z0-9]'),
  -- Still the one it was given: a first Steam link may rename it after the
  -- Steam name (rename_given_username). False once the player picks their own.
  username_auto boolean not null default true,
  -- Seen by anyone with its address (/u/<username>) unless its player makes it
  -- private on Settings.
  is_private boolean not null default false,
  -- The player turned the AI features off on Settings: the app then sends
  -- nothing from their library to OpenAI (the routes that would refuse).
  ai_disabled boolean not null default false,
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
-- dates, rating, hours or platform, its going on or off the queue or the
-- favorites, and its getting a note or losing it, is kept here as it happens
-- (the triggers below write it, and say how; nothing reads it yet). See
-- migrations/20261117_history_fixes.sql, which defines all of it.
create table game_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  game_id bigint not null,
  -- What happened: the game arrived (added by hand, or bought on Steam since
  -- the library was imported), its status moved (which carries any dates and
  -- rating saved with it), a date, rating or platform was changed by itself,
  -- it went on or off the queue, it became a favorite or stopped being one,
  -- it got a note or lost it, or only the hours changed.
  kind text not null
    check (kind in ('added', 'status', 'edit', 'queue', 'favorite', 'note', 'playtime')),
  -- Each column that changed, as [before, after]: status, started_at,
  -- finished_at, dropped_at, rating, playtime_forever (minutes), platform,
  -- queued (whether it is on the queue), favorite (whether it is one of the
  -- favorites), noted (whether it has a note: never the note's words), and
  -- last_played_at when it changed along with one of those. For a game
  -- arriving, it is what the game started with, every "before" null.
  changes jsonb not null,
  -- When the first change of the event was made, and the last one folded
  -- into it (changes within a minute of each other are one event).
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Removing a game (or disconnecting Steam, or deleting the account) takes
  -- its history with it, as the privacy policy says.
  foreign key (user_id, game_id) references games (user_id, id) on delete cascade
);

-- What went wrong when a change couldn't be recorded. Recording never stops
-- the change it rides on, so a history that has stopped recording would
-- otherwise say nothing: any row here means events are missing. Only the
-- triggers write it (game_event_failed), and only the server can read it.
create table game_event_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- The trigger function it happened in.
  source text not null,
  user_id uuid references auth.users (id) on delete cascade,
  game_id bigint,
  message text not null
);

-- What Pick My Game and Random came up with: one row for each game shown to
-- a player as a pick, with how it was picked, their answers to the questions,
-- the reason given and what they did with it. Kept so the picks can be
-- studied later (which answers lead where, which picks are taken); nothing
-- reads it yet. Written only by the server, with its own key (/api/suggest
-- for a pick from the questions, /api/suggest/picks for a random one and for
-- what the player chose). See migrations/20261117_game_picks.sql.
create table game_picks (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  game_id bigint not null,
  -- How it was picked: from the three questions, or at random.
  kind text not null check (kind in ('questions', 'random')),
  -- What it was picked for: to play now (nothing was being played), or for
  -- the queue (a game was being played, so the pick would wait its turn).
  -- A random pick to play is Home's Random; one for the queue is the
  -- picker's "leave it to chance".
  mode text not null check (mode in ('play', 'queue')),
  -- The answers to the questions, as the questions' own values were at the
  -- time (they are not listed here, so a new answer needs no migration).
  mood text,
  energy text,
  time text,
  -- Which pick of the sitting: 1, then 2 after one reroll, and so on.
  attempt integer not null default 1 check (attempt >= 1),
  -- The reason shown with the game, and the model that wrote it.
  reasoning text,
  model text,
  -- What the player did with it: started it, queued it or rolled again
  -- ('played', 'queued', 'rerolled'). Null when they saw it and closed the
  -- picker without choosing; 'unseen' when the picker was closed before the
  -- pick arrived, so it was never shown. It is the button they pressed:
  -- whether the game then stayed that way is in its history.
  outcome text check (outcome in ('played', 'queued', 'rerolled', 'unseen')),
  created_at timestamptz not null default now(),
  -- When they chose.
  answered_at timestamptz,
  -- A pick from the questions has all three answers; a random one has none,
  -- and no reason.
  constraint game_picks_answers check (
    case kind
      when 'questions' then mood is not null and energy is not null and time is not null
      else mood is null and energy is null and time is null
        and reasoning is null and model is null
    end
  ),
  constraint game_picks_answered check ((outcome is null) = (answered_at is null)),
  -- Removing a game (or disconnecting Steam, or deleting the account) takes
  -- its picks with it, like its history.
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

create unique index profiles_username_key on profiles (username);
create index idx_game_metadata_synced_at on game_metadata (synced_at);
create index idx_game_metadata_refresh on game_metadata (type, main_story_hours, synced_at);
create unique index games_one_playing_per_user on games (user_id) where status = 'playing';
-- One manual entry per game and platform.
create unique index games_manual_unique on games (user_id, igdb_id, platform) where source = 'manual';
create index playing_queue_user_position on playing_queue (user_id, position);
-- A player's history, newest first; and one game's, for the trigger's lookup.
create index game_events_user_time on game_events (user_id, id desc);
create index game_events_game on game_events (user_id, game_id, id desc);
-- A player's picks, newest first; and one game's, for the cascade.
create index game_picks_user_time on game_picks (user_id, id desc);
create index game_picks_game on game_picks (user_id, game_id);

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table games enable row level security;
alter table game_metadata enable row level security;
alter table playing_queue enable row level security;
alter table favorite_games enable row level security;
alter table game_events enable row level security;
alter table game_event_failures enable row level security;
alter table game_picks enable row level security;
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

-- A queue entry is a game's place in the queue: a player moves it up and down
-- and nothing else. Pointing an entry at another game would queue that game
-- with no history of it.
revoke update on playing_queue from authenticated;
grant update (position) on playing_queue to authenticated;

create policy "Users manage own favorites" on favorite_games
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A player can read their own history. Nobody writes it but the trigger.
create policy "Users can view own game events" on game_events
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on game_events from anon;
revoke insert, update, delete, truncate on game_events from authenticated;
-- Said outright, so the history works whatever a project grants new tables
-- by default: a player reads their own, the server reads and tidies.
grant select on game_events to authenticated;
grant select, insert, update, delete on game_events to service_role;

-- Only the triggers write what couldn't be recorded, and only the server
-- reads it.
revoke all on game_event_failures from anon, authenticated;
grant select, delete on game_event_failures to service_role;

-- A player can read their own picks. Nobody writes them but the server.
create policy "Users can view own game picks" on game_picks
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on game_picks from anon;
revoke insert, update, delete, truncate on game_picks from authenticated;
-- Said outright, so the table works whatever a project grants new tables by
-- default: a player reads, the server (with its own key) reads and writes.
grant select on game_picks to authenticated;
grant select, insert, update, delete on game_picks to service_role;

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

-- Usernames. Every profile has one, unique: given when the profile is made
-- (from the name it has, or "player" and a number; never from the email, which
-- would publish part of it), and the player's to change through the app's API.

-- Names no profile can take: the app's own words, and ones that would pass
-- for its staff. Checked when a username is given or picked, not by a
-- constraint: a word added here later must not stop a profile that already
-- has it from being saved.
create or replace function public.username_reserved(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_username = any (array[
    'admin', 'administrator', 'mod', 'moderator', 'staff', 'support', 'help',
    'official', 'team', 'owner', 'system', 'root', 'security', 'abuse',
    'mybacklog', 'my-backlog', 'my_backlog', 'backlog',
    'anonymous', 'guest', 'deleted', 'everyone', 'null', 'undefined',
    'me', 'you', 'user', 'users', 'player', 'players', 'profile', 'profiles',
    'api', 'www', 'app', 'home', 'games', 'queue', 'diary', 'stats', 'usage',
    'settings', 'account', 'login', 'signin', 'signup', 'auth',
    'privacy', 'terms', 'about', 'contact', 'billing'
  ]);
$$;

-- Slurs and the like, which no profile is given or can pick. Basic on
-- purpose: it stops the plain cases, with numbers read as the letters they
-- stand for and - and _ dropped. Whatever gets past it is for a rename by hand.
create or replace function public.username_offensive(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    -- Wherever they sit, even spelled out across - and _.
    plain.joined ~ lists.anywhere
    -- Inside one word only: read across two words these turn up by accident
    -- ("chin_king", "king_ookami").
    or exists (
      select 1
      from regexp_split_to_table(plain.spelled, '[-_]+') as word
      where word ~ (lists.anywhere || '|(chink|gook|beaner|tranny)')
        or word = any (lists.whole)
    )
    -- Only as the whole name or a whole word of it: inside other words these
    -- letters are innocent (grape, therapist, torpedo, raccoon, spicy, Nazir).
    or plain.joined = any (lists.whole)
    or exists (
      select 1
      from regexp_split_to_table(coalesce(p_username, ''), '[^a-z]+') as word
      where word = any (lists.whole)
    )
  from
    (
      select
        translate(coalesce(p_username, ''), '013457', 'oieast') as spelled,
        translate(coalesce(p_username, ''), '013457-_', 'oieast') as joined
    ) as plain,
    (
      select
        '(nigger|nigga|faggot|wetback|raghead|towelhead|hitler|molester|pedophile|pedofile|paedophile|whitepower|gaschamber)'
          as anywhere,
        array[
          'nazi', 'nazis', 'rape', 'raper', 'rapist', 'rapists', 'pedo', 'paedo',
          'spic', 'coon', 'fag', 'fags'
        ] as whole
    ) as lists;
$$;

-- Whether a name can be shown to others: a display name the player picks, or
-- the Steam name a profile goes by. Not when it's offensive, or passes for the
-- app or its staff. Compatibility forms (full-width and styled letters) and
-- accents are read as plain letters first, and everything between words as a
-- break.
create or replace function public.name_allowed(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    not public.username_offensive(plain.words)
    and replace(plain.words, '_', '') !~ '^(admin|administrator|mod|moderator|staff|support|system|official)$'
    and replace(plain.words, '_', '') !~ '^(the|team|official)*mybacklog(team|support|staff|admin|mod|moderator|official|help|app)*$'
  from (
    select btrim(
      regexp_replace(
        lower(translate(
          normalize(coalesce(p_name, ''), NFKC),
          'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
          'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
        )),
        '[^a-z0-9]+', '_', 'g'
      ),
      '_'
    ) as words
  ) as plain;
$$;

-- The player's display name, saved only when it can be shown to others. Null
-- clears it. Answers 'ok', 'refused', 'invalid' (too long) or 'no_profile'.
create or replace function public.set_display_name(p_user uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_name is not null and not public.name_allowed(p_name) then
    return 'refused';
  end if;
  update public.profiles
    set display_name = p_name, updated_at = now()
    where id = p_user;
  if not found then
    return 'no_profile';
  end if;
  return 'ok';
exception
  when check_violation then
    return 'invalid';
end;
$$;

-- A name as a username: accents dropped, lowercased, and everything a
-- username can't hold taken out. Null when too little is left, or it's
-- reserved or offensive.
create or replace function public.username_from(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(made.username) >= 3
      and not public.username_reserved(made.username)
      and not public.username_offensive(made.username)
    then made.username
  end
  from (
    select left(
      btrim(
        regexp_replace(
          lower(translate(
            coalesce(p_name, ''),
            'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
            'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
          )),
          '[^a-z0-9_-]', '', 'g'
        ),
        '-_'
      ),
      20
    ) as username
  ) as made;
$$;

-- A username nobody has: the name's own when it's free, the name and a
-- number when it's taken, "player" and a number when the name gives none.
create or replace function public.free_username(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := public.username_from(p_name);
  digits int;
  candidate text;
begin
  -- One at a time, until the transaction ends: two accounts made at the same
  -- moment can't be given the same one.
  perform pg_advisory_xact_lock(hashtext('profiles.username'));
  if base is not null
    and not exists (select 1 from public.profiles where username = base) then
    return base;
  end if;
  digits := case when base is null then 4 else 2 end;
  base := coalesce(base, 'player');
  for attempt in 1..200 loop
    candidate := left(base, 20 - digits)
      || (floor(random() * 9 * power(10, digits - 1)) + power(10, digits - 1))::bigint::text;
    if not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
    -- Running short of numbers this long: a longer one.
    if attempt % 10 = 0 and digits < 9 then
      digits := digits + 1;
    end if;
  end loop;
  raise exception 'no free username for %', base;
end;
$$;

-- Whoever makes a profile (handle_new_user, or the server), it gets a username.
create or replace function public.profiles_give_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username is null then
    new.username := public.free_username(
      coalesce(public.username_from(new.display_name), new.steam_username)
    );
    new.username_auto := true;
  end if;
  return new;
end;
$$;

create trigger profiles_give_username
  before insert on profiles
  for each row execute function public.profiles_give_username();

-- The player picks their own. Answers 'ok', 'taken', 'reserved' (or
-- offensive), 'invalid' (not a username at all) or 'no_profile'.
create or replace function public.claim_username(p_user uuid, p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_username is null then
    return 'invalid';
  end if;
  -- The same lock as a username being given, so neither takes the other's.
  perform pg_advisory_xact_lock(hashtext('profiles.username'));
  -- Keeping the one they have, which a word reserved since doesn't take away.
  if exists (select 1 from public.profiles where id = p_user and username = p_username) then
    update public.profiles set username_auto = false where id = p_user;
    return 'ok';
  end if;
  -- One answer for both: an offensive one isn't told apart.
  if public.username_reserved(p_username) or public.username_offensive(p_username) then
    return 'reserved';
  end if;
  if exists (select 1 from public.profiles where username = p_username) then
    return 'taken';
  end if;
  update public.profiles
    set username = p_username, username_auto = false, updated_at = now()
    where id = p_user;
  if not found then
    return 'no_profile';
  end if;
  return 'ok';
exception
  when check_violation then
    return 'invalid';
end;
$$;

-- A profile still on the "player" username it was given takes one made from
-- its name (its Steam name, when Steam is first linked). The new username, or
-- null when nothing changed: the player picked their own, it was already made
-- from a name, or this name gives none.
create or replace function public.rename_given_username(p_user uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  renamed text;
begin
  if public.username_from(p_name) is null then
    return null;
  end if;
  update public.profiles
    set username = public.free_username(p_name), updated_at = now()
    where id = p_user and username_auto and username ~ '^player[0-9]+$'
    returning username into renamed;
  return renamed;
end;
$$;

-- Run by the trigger and the server only; never callable through the API.
revoke execute on function
  public.username_reserved(text),
  public.username_offensive(text),
  public.name_allowed(text),
  public.set_display_name(uuid, text),
  public.username_from(text),
  public.free_username(text),
  public.profiles_give_username(),
  public.claim_username(uuid, text),
  public.rename_given_username(uuid, text)
  from public, anon, authenticated;
grant execute on function
  public.set_display_name(uuid, text),
  public.claim_username(uuid, text),
  public.rename_given_username(uuid, text)
  to service_role;

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
-- change to a game within a minute of its last one is folded into that
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
    or (coalesce(old.notes, '') = '') is distinct from (coalesce(new.notes, '') = '')
  )
  execute function public.record_game_event();

-- Not on update: that is the queue being reordered.
create trigger playing_queue_record_added
  after insert on playing_queue
  for each row
  execute function public.record_queue_event();

create trigger playing_queue_record_removed
  after delete on playing_queue
  for each row
  execute function public.record_queue_event();

-- Not on update: there is none (a save replaces the rows).
create trigger favorite_games_record_added
  after insert on favorite_games
  for each row
  execute function public.record_favorite_event();

create trigger favorite_games_record_removed
  after delete on favorite_games
  for each row
  execute function public.record_favorite_event();

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

-- How many people use the app, for the owner's usage page (/usage): counts
-- only. Server key only. See migrations/20261118_usage_stats.sql.
create or replace function public.usage_stats(p_exclude uuid[] default '{}')
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with players as (
    select id, created_at, steam_id, display_name, avatar_url
    from public.profiles
    where not (id = any (coalesce(p_exclude, '{}')))
  ),
  -- Anything a player did, and when: a change to a game, a pick, a profile or
  -- roast written, and signing in or the app refreshing their session, which
  -- it does while they have it open.
  activity as (
    select a.user_id, a.at
    from (
      select user_id, created_at as at from public.game_events
      union all select user_id, created_at from public.game_picks
      union all select user_id, generated_at from public.player_insights
      union all select user_id, created_at from auth.sessions
      union all select user_id, updated_at from auth.sessions
    ) a
    join players p on p.id = a.user_id
    where a.at is not null
  ),
  picks as (
    select k.created_at, k.user_id, k.kind, k.outcome, k.mood, k.energy, k.time
    from public.game_picks k
    join players p on p.id = k.user_id
  ),
  recent_picks as (
    select * from picks where created_at > now() - interval '30 days'
  ),
  -- A finish is its date being set, not the status changing (a game moved
  -- off Finished by mistake and back is the same finish).
  finishes as (
    select e.created_at, e.user_id
    from public.game_events e
    join players p on p.id = e.user_id
    where e.changes ? 'finished_at'
      and e.changes -> 'finished_at' ->> 0 is null
      and e.changes -> 'finished_at' ->> 1 is not null
  ),
  -- The games in libraries as the app counts them: no hidden ones, and none of
  -- the tools and soundtracks Steam lists.
  library as (
    select g.user_id, g.source, g.notes, g.rating, g.art_chosen
    from public.games g
    join players p on p.id = g.user_id
    where g.status <> 'hidden' and coalesce(g.type, 'game') = 'game'
  ),
  weeks as (
    select start, start + interval '1 week' as finish
    from generate_series(
      date_trunc('week', now()) - interval '7 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) as start
  )
  select jsonb_build_object(
    'players', (select count(*) from players),
    'steamConnected', (select count(*) from players where steam_id is not null),
    'withGames', (select count(distinct user_id) from library),
    'activeDay', (select count(distinct user_id) from activity where at > now() - interval '1 day'),
    'activeWeek', (select count(distinct user_id) from activity where at > now() - interval '7 days'),
    'activeMonth', (select count(distinct user_id) from activity where at > now() - interval '30 days'),
    -- Did something on a later day than the one they signed up on.
    'cameBack', (
      select count(*) from players p
      where exists (
        select 1 from activity a where a.user_id = p.id and a.at >= p.created_at + interval '1 day'
      )
    ),
    -- How they signed in: an account can have more than one way.
    'signups', jsonb_build_object(
      'email', (
        select count(distinct i.user_id) from auth.identities i
        join players p on p.id = i.user_id where i.provider = 'email'
      ),
      'google', (
        select count(distinct i.user_id) from auth.identities i
        join players p on p.id = i.user_id where i.provider = 'google'
      ),
      'discord', (
        select count(distinct i.user_id) from auth.identities i
        join players p on p.id = i.user_id where i.provider = 'discord'
      ),
      'unconfirmed', (
        select count(*) from auth.users u
        join players p on p.id = u.id where u.email_confirmed_at is null
      )
    ),
    'libraries', jsonb_build_object(
      'medianGames', (
        select coalesce(round(percentile_cont(0.5) within group (order by n)::numeric), 0)
        from (select count(*) as n from library group by user_id) s
      ),
      'steamGames', (select count(*) from library where source = 'steam'),
      'manualGames', (select count(*) from library where source = 'manual'),
      'manualOnly', (
        select count(*) from (
          select user_id from library group by user_id
          having bool_and(source = 'manual')
        ) s
      )
    ),
    -- Players who have used each feature, ever (or have it now, where only
    -- the present is kept: favorites, notes, ratings, art, a profile or roast).
    'features', jsonb_build_object(
      'queue', (
        select count(*) from players p
        where exists (select 1 from public.game_events e where e.user_id = p.id and e.kind = 'queue')
          or exists (select 1 from public.playing_queue q where q.user_id = p.id)
      ),
      'favorites', (
        select count(distinct f.user_id) from public.favorite_games f
        join players p on p.id = f.user_id
      ),
      'notes', (select count(distinct user_id) from library where coalesce(notes, '') <> ''),
      'ratings', (select count(distinct user_id) from library where rating is not null),
      'addedByHand', (select count(distinct user_id) from library where source = 'manual'),
      'chosenArt', (select count(distinct user_id) from library where art_chosen),
      'shareCards', (
        select count(distinct s.user_id) from public.shared_completions s
        join players p on p.id = s.user_id
      ),
      'nameOrPicture', (
        select count(*) from players where display_name is not null or avatar_url is not null
      ),
      'profile', (
        select count(*) from public.player_insights i
        join players p on p.id = i.user_id where i.tone = 'profile'
      ),
      'roast', (
        select count(*) from public.player_insights i
        join players p on p.id = i.user_id where i.tone = 'roast'
      )
    ),
    'pickMyGame', jsonb_build_object(
      'questions', (select count(*) from recent_picks where kind = 'questions'),
      'random', (select count(*) from recent_picks where kind = 'random'),
      'played', (select count(*) from recent_picks where outcome = 'played'),
      'queued', (select count(*) from recent_picks where outcome = 'queued'),
      'rerolled', (select count(*) from recent_picks where outcome = 'rerolled'),
      'closed', (select count(*) from recent_picks where outcome is null),
      -- The three answers given most to each question.
      'moods', (
        select coalesce(jsonb_agg(jsonb_build_object('answer', mood, 'picks', n) order by n desc, mood), '[]')
        from (
          select mood, count(*) as n from recent_picks where mood is not null
          group by mood order by n desc, mood limit 3
        ) s
      ),
      'energies', (
        select coalesce(jsonb_agg(jsonb_build_object('answer', energy, 'picks', n) order by n desc, energy), '[]')
        from (
          select energy, count(*) as n from recent_picks where energy is not null
          group by energy order by n desc, energy limit 3
        ) s
      ),
      'times', (
        select coalesce(jsonb_agg(jsonb_build_object('answer', time, 'picks', n) order by n desc, time), '[]')
        from (
          select time, count(*) as n from recent_picks where time is not null
          group by time order by n desc, time limit 3
        ) s
      )
    ),
    'weeks', (
      select jsonb_agg(
        jsonb_build_object(
          'start', w.start,
          'signups', (select count(*) from players p where p.created_at >= w.start and p.created_at < w.finish),
          'active', (select count(distinct a.user_id) from activity a where a.at >= w.start and a.at < w.finish),
          'picks', (select count(*) from picks k where k.created_at >= w.start and k.created_at < w.finish),
          'finishes', (select count(*) from finishes f where f.created_at >= w.start and f.created_at < w.finish)
        )
        order by w.start desc
      )
      from weeks w
    ),
    'month', jsonb_build_object(
      'picks', (select count(*) from recent_picks),
      'picksTaken', (select count(*) from recent_picks where outcome in ('played', 'queued')),
      'pickers', (select count(distinct user_id) from recent_picks),
      'finishes', (select count(*) from finishes where created_at > now() - interval '30 days'),
      'finishers', (select count(distinct user_id) from finishes where created_at > now() - interval '30 days'),
      -- Only the latest profile and roast are kept, so this counts players
      -- whose latest one is from this month.
      'insightWriters', (
        select count(distinct i.user_id) from public.player_insights i
        join players p on p.id = i.user_id
        where i.generated_at > now() - interval '30 days'
      ),
      'supportTickets', (
        select count(*) from public.support_tickets t
        join players p on p.id = t.user_id
        where t.created_at > now() - interval '30 days'
      )
    )
  );
$$;

revoke all on function public.usage_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.usage_stats(uuid[]) to service_role;

-- Profile pictures: small squares made in the browser, public to read, written
-- only by the server (no policies for players). See
-- migrations/20261116_profile_name_and_avatar.sql.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
