-- A name and a picture the player chooses for their Profile page, in place of
-- the ones the account already has (the Steam name, or the email before its @;
-- the Steam avatar, or their initial). Null means "use those".

alter table profiles
  add column if not exists display_name text
    check (display_name is null or char_length(display_name) between 1 and 40),
  -- The picture's public URL, in the avatars bucket below.
  add column if not exists avatar_url text;

-- Profiles stay written by the server only (see schema.sql): the name and the
-- picture are saved through the app's API, which checks them first.

-- The pictures: small squares the browser makes before uploading, public to
-- read (an avatar is shown wherever the player is), written only by the
-- server, so there are no policies for players to write here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
