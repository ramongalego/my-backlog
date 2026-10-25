-- Hardening that the app code doesn't depend on (it works with or without
-- this migration applied).

-- 1. Shared completions are publicly readable so share pages work, but the
--    public role could also read user_id and tie every share to an account.
--    Grant read access to the display columns only.
revoke select on shared_completions from anon, authenticated;
grant select (
  id, game_name, header_image, playtime_minutes, main_story_hours, rating,
  games_finished, total_games, backlog_hours_removed, next_game, created_at
) on shared_completions to anon, authenticated;

-- 2. Only one game can be "playing" per user. The status route enforces this,
--    but a unique index makes concurrent requests safe too. Any existing
--    duplicates are moved back to the backlog first, keeping the most recent.
update games g
set status = 'backlog', started_at = null
where g.status = 'playing'
  and exists (
    select 1 from games newer
    where newer.user_id = g.user_id
      and newer.status = 'playing'
      and (coalesce(newer.started_at, '-infinity'), newer.app_id)
        > (coalesce(g.started_at, '-infinity'), g.app_id)
  );

create unique index if not exists games_one_playing_per_user
  on games (user_id)
  where status = 'playing';
