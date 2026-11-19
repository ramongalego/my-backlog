-- Usernames: the name in a profile's address (/u/<username>). Every profile
-- has one, unique: given when the profile is made (from the name it has, or
-- "player" and a number), and the player's to change through the app's API.
-- Never made from the email, which would publish part of it.
-- With them, what a name shown to others can't be: an offensive username or
-- display name is refused, as is a display name that passes for the app's staff.
-- Safe to run again: it only names the profiles that have no username yet.

alter table profiles
  add column if not exists username text,
  -- Still the one it was given: a first Steam link may rename it after the
  -- Steam name (rename_given_username). False once the player picks their own.
  add column if not exists username_auto boolean not null default true;

-- Lowercase letters, numbers, _ and -, 3 to 20 of them, not all punctuation.
alter table profiles drop constraint if exists profiles_username_format;
alter table profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9_-]{3,20}$' and username ~ '[a-z0-9]');

create unique index if not exists profiles_username_key on profiles (username);

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

drop trigger if exists profiles_give_username on profiles;
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

-- The profiles from before usernames, oldest first, so the earliest account
-- with a name gets it as it is. The name the player chose, else the Steam one.
do $$
declare
  profile record;
begin
  for profile in
    select id, display_name, steam_username
    from public.profiles
    where username is null
    order by created_at, id
  loop
    update public.profiles
      set username = public.free_username(
        coalesce(public.username_from(profile.display_name), profile.steam_username)
      )
      where id = profile.id;
  end loop;
end;
$$;

alter table profiles alter column username set not null;

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
