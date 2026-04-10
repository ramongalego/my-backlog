-- Tie shared completions to the user who created them
alter table shared_completions
  add column user_id uuid references auth.users(id) on delete cascade;

-- Replace the permissive INSERT policy with one scoped to the authenticated user
drop policy if exists "Authenticated users can create shared completions" on shared_completions;

create policy "Users create their own shared completions"
  on shared_completions for insert
  to authenticated
  with check (user_id = auth.uid());

-- Allow users to delete only their own shares
create policy "Users delete their own shared completions"
  on shared_completions for delete
  to authenticated
  using (user_id = auth.uid());
