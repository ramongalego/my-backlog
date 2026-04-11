-- Support for the weekly metadata refresh cron.
--
-- `hltb_attempts` tracks how many consecutive null-HLTB results we've seen for
-- a game so the cron can back off exponentially: newly-released games whose
-- HLTB page doesn't exist yet get retried on a 3d → 7d → 14d → 30d → 90d
-- schedule, then effectively dormant. Resets to 0 when HLTB finally returns a
-- value.

alter table game_metadata
  add column if not exists hltb_attempts integer not null default 0;

-- Index for the cron's two refresh queries:
--   1) null-HLTB retry   → type = 'game' AND main_story_hours IS NULL
--   2) stale review pass → type = 'game' AND main_story_hours IS NOT NULL
-- Both order by synced_at ascending (oldest first).
create index if not exists idx_game_metadata_refresh
  on game_metadata (type, main_story_hours, synced_at);
