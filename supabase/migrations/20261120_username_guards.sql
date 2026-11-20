-- Two guards on usernames, after the Nov 20, 2026 security review. Both only
-- replace a function: nothing stored changes, and no profile is renamed.
-- Safe to run again.

-- 1. A username can't pass for the app or its staff by dressing a reserved
--    word up: "mybacklog-support", "admin_", "official_mod1". Before, only
--    the exact words were refused.
create or replace function public.username_reserved(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    -- The app's name anywhere in it, however it is joined up.
    replace(replace(p_username, '-', ''), '_', '') like '%mybacklog%'
    -- Made of nothing but staff words, joined up or apart, with numbers or not.
    or regexp_replace(p_username, '[-_0-9]+', '', 'g')
      ~ '^(the|real)*(admin|administrator|mod|moderator|staff|support|help|official|team|owner|system|security)+$'
    or p_username = any (array[
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

-- 2. A new account that brings no name gets "player" and nine digits, not
--    four. A profile can be seen by anyone with its address, and four digits
--    are 9,000 addresses to try in turn.
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
  digits := case when base is null then 9 else 2 end;
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

-- As before: run by the trigger and the server only, never through the API.
revoke execute on function
  public.username_reserved(text),
  public.free_username(text)
  from public, anon, authenticated;
