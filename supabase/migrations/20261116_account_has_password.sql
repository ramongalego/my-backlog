-- Whether the signed-in player's account has a password. One made by signing
-- in with Google or Discord has none until they set one (by the reset link),
-- and nothing Supabase hands the app says which: the account's sign-in methods
-- don't change when a password is set that way. So it's read here, from the
-- account itself.
--
-- The Profile page's Account panel asks, to offer "Set password" in place of
-- "Change"; deleting the account asks, to know whether a password confirms it.
--
-- Security definer, to read auth.users, and it only ever answers about the
-- caller: a yes or no, never the password's hash.
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
