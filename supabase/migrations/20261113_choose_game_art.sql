-- Choose art: a player can pick a game's art from SteamGridDB in its dialog.
--
-- header_image stays the image every screen shows. These two columns say it
-- was chosen, and keep the art the game would have otherwise: syncs go on
-- updating that one instead of replacing the player's choice, and picking
-- "Original" puts it back.
alter table games add column if not exists art_chosen boolean not null default false;
alter table games add column if not exists default_header_image text;
