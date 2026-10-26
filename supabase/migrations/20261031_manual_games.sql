-- Games added by hand (consoles, other stores), with their details from IGDB.
-- They use the existing columns: source = 'manual', platform for the console,
-- playtime_forever for the hours you enter yourself, header_image for the art.

-- The IGDB game a manual entry came from.
alter table games add column if not exists igdb_id integer;

-- One entry per game and platform: the same game on Switch and PS5 can both
-- be in the library, but not Switch twice.
create unique index if not exists games_manual_unique
  on games (user_id, igdb_id, platform)
  where source = 'manual';
