-- Step 2 of 2 (see 20261029_game_ids.sql). Run this only after the code that
-- uses game ids is deployed: it removes what the code before it relied on.

drop trigger if exists playing_queue_fill_ids on playing_queue;
drop function if exists public.playing_queue_fill_ids();

-- The queue is keyed by game_id now; the Steam id lives on the game.
alter table playing_queue drop column if exists app_id;

drop function if exists public.reorder_playing_queue(bigint[]);
drop function if exists public.record_reroll(integer);
