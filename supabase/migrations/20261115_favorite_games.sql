-- The games a player picks as their favorites for their Profile page: up to
-- four, in the order they chose. With none picked, the page shows their
-- highest rated games instead.

create table if not exists favorite_games (
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

alter table favorite_games enable row level security;

drop policy if exists "Users manage own favorites" on favorite_games;
create policy "Users manage own favorites" on favorite_games
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
