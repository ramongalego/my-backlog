-- A player can turn the AI features off on Settings (Pick My Game's questions,
-- and the player profile and roast on Stats). While it is off the app sends
-- nothing from their library to OpenAI: the routes that would refuse.
-- Safe to run more than once.
alter table profiles
  add column if not exists ai_disabled boolean not null default false;
