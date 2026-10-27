-- For a game added by hand that Steam also sells: its Steam app id, so its
-- Steam reviews can be shown and kept up to date like a Steam game's. Not
-- app_id, which marks a game in your Steam library (the library sync matches
-- on it), and you don't own this one there.
alter table games add column if not exists steam_app_id integer;
