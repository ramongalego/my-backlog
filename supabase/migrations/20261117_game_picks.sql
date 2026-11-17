-- What Pick My Game and Random came up with: one row for each game shown to
-- a player as a pick, with how it was picked, their answers to the questions,
-- the reason given and what they did with it. Kept so the picks can be
-- studied later (which answers lead where, which picks are taken); nothing
-- reads it yet.
--
-- Written only by the server, with its own key (/api/suggest for a pick from
-- the questions, /api/suggest/picks for a random one and for what the player
-- chose): a player can read their own rows and write none.
--
-- Safe to run more than once.

create table if not exists game_picks (
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

-- A player's picks, newest first; and one game's, for the cascade.
create index if not exists game_picks_user_time on game_picks (user_id, id desc);
create index if not exists game_picks_game on game_picks (user_id, game_id);

alter table game_picks enable row level security;

-- A player can read their own picks. Nobody writes them but the server.
drop policy if exists "Users can view own game picks" on game_picks;
create policy "Users can view own game picks" on game_picks
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on game_picks from anon;
revoke insert, update, delete, truncate on game_picks from authenticated;
-- Said outright, so the table works whatever a project grants new tables by
-- default: a player reads, the server (with its own key) reads and writes.
grant select on game_picks to authenticated;
grant select, insert, update, delete on game_picks to service_role;
