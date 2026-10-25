-- 1. game_metadata is a cache shared by every user. Signed-in users could
--    insert and update any row (names, hours, cover images), and bulk sync
--    copies those values into other users' libraries. Writes now come only
--    from the server via the secret key (which bypasses RLS); users can read.
drop policy if exists "Anyone can insert game metadata" on game_metadata;
drop policy if exists "Anyone can update game metadata" on game_metadata;

-- 2. Wrap auth.uid() in a subselect so Postgres evaluates it once per query
--    instead of once per row (Supabase's recommended RLS pattern), and scope
--    the policies to signed-in users.
drop policy if exists "Users can insert own games" on games;
drop policy if exists "Users can delete own games" on games;
drop policy if exists "Users can update own games" on games;
drop policy if exists "Users can view own games" on games;
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

drop policy if exists "Users manage own queue" on playing_queue;
create policy "Users manage own queue" on playing_queue
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can view own profile" on profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can insert own profile" on profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users can update own profile" on profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users create their own shared completions" on shared_completions;
drop policy if exists "Users delete their own shared completions" on shared_completions;
create policy "Users create their own shared completions" on shared_completions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users delete their own shared completions" on shared_completions
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own tickets" on support_tickets;
create policy "Users can insert their own tickets" on support_tickets
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- 3. SECURITY DEFINER functions should pin search_path so they can't be
--    pointed at objects in another schema.
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
