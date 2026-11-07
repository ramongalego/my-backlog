'use client';

import { CoverEditHint, CoverThumb } from '@/components/games/CoverArt';
import { Playtime } from '@/components/games/GameCardInfo';
import type { PlayedALotGame, Stats } from '@/lib/stats/compute';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { steamLastPlayed } from '@/lib/games/consoles';
import { SectionTitle } from '@/components/stats/SectionTitle';

/**
 * Backlog games that are probably not backlog any more (see playedALot), with
 * a quick way to mark them. The other half of Home's Pick Up row.
 */
export function PlayedALot({
  stats,
  onEdit,
}: {
  stats: Stats;
  onEdit: (game: PlayedALotGame) => void;
}) {
  return (
    <Panel>
      <SectionTitle>Played a lot, still in your backlog</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-ink-400 max-w-md">
        If you&apos;ve finished these, or they&apos;re games you play rather than finish, update
        them so your backlog count and pace stay accurate
      </p>
      <ul className="space-y-3">
        {stats.playedALot.map((game) => {
          const { id, name, playtime_forever, main_story_hours, header_image } = game;
          const edit = () => onEdit(game);
          return (
            <li key={id} className="flex items-center gap-3">
              <button
                onClick={edit}
                aria-label={`Update ${name}`}
                className="group shrink-0 rounded-md cursor-pointer"
              >
                <CoverThumb src={header_image} alt="" className="w-16">
                  <CoverEditHint />
                </CoverThumb>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-200 truncate">{name}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  <Playtime minutes={playtime_forever} lastPlayedAt={steamLastPlayed(game)} />
                  {main_story_hours ? ` · story is ${main_story_hours}h` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={edit}
                aria-label={`Update ${name}`}
                className="shrink-0 cursor-pointer"
              >
                Update
              </Button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
