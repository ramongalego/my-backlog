-- Critic scores for every game, Steam or added by hand: IGDB's average of
-- critics' reviews (0-100) and how many reviews it's from. The app shows it
-- only from 3 reviews up, so a single review doesn't stand for a game.
alter table games add column if not exists critic_score smallint;
alter table games add column if not exists critic_count smallint;
