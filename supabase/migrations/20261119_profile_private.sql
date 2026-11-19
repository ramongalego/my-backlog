-- A profile can be seen by anyone with its address (/u/<username>) unless its
-- player makes it private on Settings. Profiles stay written by the server
-- only (see schema.sql): the switch is saved through the app's API.
-- Safe to run again.

alter table profiles
  add column if not exists is_private boolean not null default false;
