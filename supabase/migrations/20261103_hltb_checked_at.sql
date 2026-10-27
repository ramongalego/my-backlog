-- When a game added by hand was last looked up on HowLongToBeat. A game with
-- no time yet (often not out, or just out) is looked up again once a week,
-- until HowLongToBeat has one.
alter table games add column if not exists hltb_checked_at timestamptz;
