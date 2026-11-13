-- The next game's art, shown beside its name on a share page. Share pages made
-- before this have none, and show the name alone.
alter table shared_completions add column if not exists next_game_image text;
