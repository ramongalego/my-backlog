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
  created_at timestamptz not null default now()
);

-- Allow anyone to read shared completions (public share pages)
alter table shared_completions enable row level security;

create policy "Shared completions are publicly readable"
  on shared_completions for select
  using (true);

-- Only authenticated users can insert
create policy "Authenticated users can create shared completions"
  on shared_completions for insert
  to authenticated
  with check (true);
