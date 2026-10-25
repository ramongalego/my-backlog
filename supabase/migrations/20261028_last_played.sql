-- When the player last played each game, from Steam's rtime_last_played.
-- Shown on the playing card and used to order Pick Up Where You Left Off.
-- Null when Steam doesn't share it (private game details) or the game was
-- never played.

alter table games add column if not exists last_played_at timestamptz;
