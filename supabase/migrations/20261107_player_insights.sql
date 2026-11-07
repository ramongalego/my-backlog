-- The player profile on Stats ("What your library says about you") and its
-- roast replace the public Steam roast.
--
-- player_insights keeps the last profile and roast written for each player, so
-- one is only written again when the library changes in a way it talks about
-- (the signature). Written only by /api/insights with the server's key; a
-- player can read their own.
create table player_insights (
  user_id uuid not null references auth.users (id) on delete cascade,
  tone text not null check (tone = any (array['profile', 'roast'])),
  headline text not null,
  paragraphs jsonb not null,
  signature text not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, tone)
);

alter table player_insights enable row level security;

create policy "Users can view own insights" on player_insights
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on player_insights from anon, authenticated;

-- The public roast's cache, no longer used.
drop table if exists roast_cache;
