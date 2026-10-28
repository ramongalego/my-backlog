-- Writes that only the server makes, after checking them. Signed-in users
-- could otherwise use the public API key to write these tables directly and
-- skip the app's checks and rate limits.

-- Profiles: the Steam id is only ever set by the Steam sign-in (with the
-- server's key), so a user can't claim a Steam account they haven't signed in
-- to. New profiles come from the handle_new_user trigger.
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
revoke insert, update on profiles from anon, authenticated;

-- Support tickets: saved by /api/support, which limits their length and how
-- many a user sends.
drop policy if exists "Users can insert their own tickets" on support_tickets;
revoke insert on support_tickets from anon, authenticated;

-- Share pages: public pages on our domain, saved by /api/share/completion,
-- which checks the text and image and picks the page's address.
drop policy if exists "Users create their own shared completions" on shared_completions;
revoke insert on shared_completions from anon, authenticated;

-- Games are still the user's to write, but not without limit: the same caps
-- as the app's forms. NOT VALID: they apply to new writes, so a row saved
-- before them can't stop this migration.
alter table games
  add constraint games_notes_length check (char_length(notes) <= 1000) not valid,
  add constraint games_platform_length check (char_length(platform) <= 60) not valid,
  add constraint games_name_length check (char_length(name) <= 500) not valid;
