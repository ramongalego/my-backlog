// Public display columns of a shared completion. Never `select('*')`: the row
// also holds the sharer's user_id, which public pages must not expose.
export const SHARED_COMPLETION_COLUMNS =
  'id, game_name, header_image, playtime_minutes, main_story_hours, rating, games_finished, total_games, backlog_hours_removed, next_game, created_at';
