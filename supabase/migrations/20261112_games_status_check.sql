-- A game's status is always one of the six the app knows (lib/games/status.ts).
-- Until now the column was free text that could also be empty, so the app had
-- to treat "no status" as backlog everywhere it read one. No row has an empty
-- or unknown status today; the first statement is only there so this can't
-- fail if one appears before it runs.
update games
set status = 'backlog'
where status is null
   or status not in ('backlog', 'playing', 'finished', 'dropped', 'wont_play', 'hidden');

alter table games drop constraint if exists games_status_check;
alter table games
  alter column status set default 'backlog',
  alter column status set not null,
  add constraint games_status_check
    check (status in ('backlog', 'playing', 'finished', 'dropped', 'wont_play', 'hidden'));
