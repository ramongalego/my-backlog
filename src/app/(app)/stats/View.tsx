'use client';

import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';

import { useMutation } from '@tanstack/react-query';
import { CoverArt, CoverEditHint, CoverThumb } from '@/components/games/CoverArt';
import { Playtime } from '@/components/games/GameCardInfo';
import { Rating } from '@/components/games/Rating';
import { Figure, Lead } from '@/components/ui/Lead';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { useStats } from '@/hooks/useStats';
import { useAuth } from '@/hooks/useAuth';
import { growBar, useInView } from '@/hooks/useInView';
import { useAddToQueue } from '@/hooks/useNowPlaying';
import { updateGameStatus } from '@/lib/games/status';
import { useInvalidateQueries, usePatchGamesList } from '@/lib/mutations';
import { statusChangeFrom } from '@/lib/games/status-rules';
import { useManualGameActions } from '@/hooks/useManualGame';
import { toast } from 'sonner';
import type { PlayedALotGame, Stats } from '@/hooks/useStats';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { STATUS_STYLE } from '@/lib/games/status-style';
import { steamLastPlayed } from '@/lib/games/consoles';
import { StatsContentSkeleton } from './Skeleton';

type EditModalState = PlayedALotGame;

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <SectionLabel className="mb-4">{children}</SectionLabel>;
}

const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;

function formatYears(years: number): string {
  if (years < 1) return 'under a year';
  const rounded = years < 10 ? Math.round(years * 10) / 10 : Math.round(years);
  return `~${rounded} year${rounded === 1 ? '' : 's'}`;
}

/** Where the hours went: the total, then the games that took most of them. */
function Hours({ stats }: { stats: Stats }) {
  const { totalPlaytimeHours: hours, totalPlaytimeDays: days, mostPlayed } = stats;
  if (hours === 0) return null;
  return (
    <section aria-label="Hours played">
      <Lead>
        You&apos;ve played for <Figure>{plural(hours, 'hour')}</Figure>
        {days >= 2 && (
          <>
            , about <Figure>{Math.round(days)} days</Figure> of your life
          </>
        )}
        .{mostPlayed.length > 0 && ' Most of them went here.'}
      </Lead>
      {mostPlayed.length > 0 && (
        <ol className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
          {mostPlayed.map((game, i) => {
            const share = Math.round((game.hours / hours) * 100);
            return (
              <li key={game.id} className={i === 0 ? 'col-span-2 lg:row-span-2' : 'min-w-0'}>
                <CoverArt
                  src={game.header_image}
                  alt=""
                  rounded="xl"
                  priority={i === 0}
                  sizes={
                    i === 0 ? '(max-width: 1024px) 100vw, 640px' : '(max-width: 1024px) 50vw, 320px'
                  }
                  className="w-full"
                />
                <p
                  className={`mt-2 font-medium text-ink-100 truncate ${i === 0 ? 'text-lg' : 'text-sm'}`}
                >
                  {game.name}
                </p>
                <p className="text-sm text-ink-400 tabular-nums">
                  {count(game.hours)}h{share > 0 && ` · ${share}% of your hours`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// How soon you'd like the backlog cleared, for the hours-a-week figure, in
// months. Five years to start.
type ClearIn = '60' | '48' | '36' | '24' | '12' | '6';
const CLEAR_IN: DropdownOption<ClearIn>[] = [
  { value: '60', label: '5 years' },
  { value: '48', label: '4 years' },
  { value: '36', label: '3 years' },
  { value: '24', label: '2 years' },
  { value: '12', label: '1 year' },
  { value: '6', label: '6 months' },
];
const WEEKS_A_MONTH = 52 / 12;

/**
 * How long the backlog would take at your recent finishing rate, what it would
 * take to clear it sooner, and the library it sits in.
 */
function BacklogPace({ stats }: { stats: Stats }) {
  const { backlog, finishedLastYear, estimatedBacklogHours } = stats;
  const [clearIn, setClearIn] = useState<ClearIn>('60');
  const perWeek = Math.max(
    1,
    Math.round(estimatedBacklogHours / (Number(clearIn) * WEEKS_A_MONTH)),
  );
  return (
    <Panel>
      <SectionTitle>Backlog pace</SectionTitle>
      {finishedLastYear > 0 ? (
        <Lead>
          At {plural(finishedLastYear, 'game')} finished in the last year, your{' '}
          {plural(backlog, 'backlog game')} take{' '}
          <Figure>{formatYears(backlog / finishedLastYear)}</Figure> to clear.
        </Lead>
      ) : (
        <p className="text-ink-300 max-w-xl">
          You haven&apos;t finished a game in the last 12 months. Finish one to see how long your
          backlog would take at your pace.
        </p>
      )}
      {estimatedBacklogHours > 0 && (
        // A div, not a p: the choice of time opens a list. The choice starts its
        // own line, so picking a longer one doesn't push the text onto another.
        <div className="mt-2 text-ink-400 max-w-xl">
          That&apos;s ~{plural(estimatedBacklogHours, 'hour')} of story.{' '}
          <br className="hidden sm:inline" />
          Clearing it in{' '}
          <Dropdown
            inline
            align="left"
            value={clearIn}
            options={CLEAR_IN}
            onChange={setClearIn}
            aria-label="Clear it in"
          />{' '}
          takes about <span className="tabular-nums">{plural(perWeek, 'hour')}</span> a week.
        </div>
      )}
      <LibraryBreakdown stats={stats} />
    </Panel>
  );
}

function LibraryBreakdown({ stats }: { stats: Stats }) {
  const segments = [
    {
      label: 'Finished',
      pct: stats.finishedPct,
      count: stats.finished,
      color: STATUS_STYLE.finished.fill,
    },
    {
      label: 'Dropped',
      pct: stats.droppedPct,
      count: stats.dropped,
      color: STATUS_STYLE.dropped.fill,
    },
    {
      label: 'Backlog',
      pct: stats.backlogPct,
      count: stats.backlog,
      color: STATUS_STYLE.backlog.fill,
    },
  ].filter((s) => s.count > 0);
  const { ref, inView } = useInView<HTMLDivElement>();
  const grow = growBar('x', inView, 0);

  return (
    <div className="mt-6">
      <div
        ref={ref}
        className={`flex h-2.5 rounded-full overflow-hidden gap-px mb-4 ${grow.className}`}
        style={grow.style}
      >
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} transition-all`}
            style={{ width: `${s.pct}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${s.color}`} aria-hidden="true" />
            <span className="text-sm text-ink-400">{s.label}</span>
            <span className="text-sm font-semibold text-ink-100 tabular-nums">{s.count}</span>
            <span className="text-xs text-ink-500 tabular-nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopTags({ stats }: { stats: Stats }) {
  if (stats.topTags.length === 0) {
    return (
      <Panel>
        <SectionTitle>Top tags in your library</SectionTitle>
        <p className="text-sm text-ink-500">
          No tags yet. They&apos;re added the next time your library syncs.
        </p>
      </Panel>
    );
  }

  const max = stats.topTags[0].count;

  return (
    <Panel>
      <SectionTitle>Top tags in your library</SectionTitle>
      <TopTagBars tags={stats.topTags} max={max} />
    </Panel>
  );
}

function TopTagBars({ tags, max }: { tags: Stats['topTags']; max: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="space-y-3">
      {tags.map(({ tag, count }, i) => (
        <div key={tag} className="flex items-center gap-3">
          <span className="text-sm text-ink-300 w-20 sm:w-32 truncate shrink-0">{tag}</span>
          <div className="flex-1 h-1.5 bg-ink-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-ink-400 rounded-full ${growBar('x', inView, i).className}`}
              style={{ width: `${(count / max) * 100}%`, ...growBar('x', inView, i).style }}
            />
          </div>
          <span className="text-xs text-ink-400 w-6 text-right shrink-0 tabular-nums">{count}</span>
        </div>
      ))}
    </div>
  );
}

type YearView = 'finished' | 'released';

function YearChart({ stats }: { stats: Stats }) {
  const [view, setView] = useState<YearView>('finished');

  const data = view === 'finished' ? stats.finishedByYear : stats.gamesByReleaseYear;
  const max = data.length > 0 ? Math.max(...data.map((y) => y.count)) : 1;
  // Finished games without a date can't sit in a year; say so, so the bars add up.
  const undated = stats.finished - stats.finishedByYear.reduce((sum, y) => sum + y.count, 0);
  const { ref, inView } = useInView<HTMLDivElement>();

  const empty =
    view === 'finished'
      ? 'No finished games with dates yet.'
      : 'No release year data yet. Sync your library to fill this in.';

  return (
    <Panel className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Games by year</SectionLabel>
        <ToggleGroup
          variant="segmented"
          label="Group games by"
          value={view}
          onChange={setView}
          options={[
            { value: 'finished', label: 'Finished' },
            { value: 'released', label: 'Released' },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-ink-500">{empty}</p>
      ) : (
        <div ref={ref} className="flex-1 flex items-end gap-1.5 min-h-[160px]">
          {data.map(({ year, count }, i) => (
            <div key={year} className="self-stretch flex-1 flex flex-col items-center min-w-0">
              <div className="flex-1" />
              <span className="text-xs font-semibold text-ink-300 mb-1 tabular-nums">{count}</span>
              <div
                className={`w-full rounded-sm transition-colors ${growBar('y', inView, i).className} ${
                  view === 'finished'
                    ? `${STATUS_STYLE.finished.fill} opacity-80 hover:opacity-100`
                    : 'bg-ink-500 hover:bg-ink-400'
                }`}
                style={{
                  height: `${Math.max((count / max) * 65, 3)}%`,
                  ...growBar('y', inView, i).style,
                }}
              />
              <span
                className={`text-xs mt-1 tabular-nums ${data.length <= 14 || i % 2 === 0 ? 'text-ink-400' : 'invisible'}`}
              >
                {/* Short on phones, where four digits a bar run together. */}
                <span className="sm:hidden" aria-hidden="true">
                  &rsquo;{year.slice(2)}
                </span>
                <span className="max-sm:sr-only">{year}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {view === 'finished' && undated > 0 && data.length > 0 && (
        <p className="mt-4 text-xs text-ink-500">
          {plural(undated, 'finished game')} without a finish date{' '}
          {undated === 1 ? "isn't" : "aren't"} counted here.
        </p>
      )}
    </Panel>
  );
}

/** Your best-rated games as art, beside how your ratings spread. */
function Favourites({ stats }: { stats: Stats }) {
  const { favourites, ratedCount, avgRating } = stats;
  const showBars = ratedCount >= 3;
  if (favourites.length === 0 && !showBars) return null;

  return (
    <Panel>
      {/* The heading sits in the games' column, so the ratings beside them
          centre on the whole panel, not just on the art. */}
      <div
        className={`grid gap-8 ${favourites.length > 0 && showBars ? 'lg:grid-cols-[minmax(0,1fr)_18rem]' : ''}`}
      >
        <div>
          <SectionTitle>Your favourites</SectionTitle>
          {favourites.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-4 content-start">
              {favourites.map((game) => (
                <li key={game.id} className="min-w-0">
                  <CoverArt
                    src={game.header_image}
                    alt=""
                    sizes="(max-width: 640px) 50vw, 220px"
                    className="w-full"
                  >
                    {game.rating != null && (
                      <Rating
                        rating={game.rating}
                        onArt
                        className="absolute bottom-1.5 right-1.5"
                      />
                    )}
                  </CoverArt>
                  <p className="mt-1.5 text-sm text-ink-200 truncate">{game.name}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {showBars && (
          <div className="lg:self-center">
            <p className="mb-4 text-sm text-ink-400">
              You average <span className="font-semibold text-ink-100">{avgRating}/10</span> across{' '}
              {plural(ratedCount, 'rated game')}
            </p>
            <RatingBars bars={stats.ratingDistribution} />
          </div>
        )}
      </div>
    </Panel>
  );
}

function RatingBars({ bars }: { bars: Stats['ratingDistribution'] }) {
  const max = Math.max(...bars.map((b) => b.count), 1);
  const BAR_MAX_HEIGHT = 80;
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex items-end gap-2">
      {bars.map(({ rating, count }, i) => (
        <div key={rating} className="flex-1 flex flex-col items-center gap-1.5">
          <span
            className={`text-xs font-semibold tabular-nums ${count > 0 ? 'text-ink-300' : 'text-transparent'}`}
          >
            {count}
          </span>
          <div
            className={`w-full rounded-sm transition-colors ${growBar('y', inView, i).className} ${count > 0 ? 'bg-amber-400/80 hover:bg-amber-400' : 'bg-ink-800'}`}
            style={{
              height: `${Math.max((count / max) * BAR_MAX_HEIGHT, count > 0 ? 4 : 2)}px`,
              ...growBar('y', inView, i).style,
            }}
          />
          <span className="text-xs text-ink-400 tabular-nums">{rating}</span>
        </div>
      ))}
    </div>
  );
}

// "turn-based strategy games", but "JRPG games" and "2D games".
const tagNoun = (tag: string) => (/^[A-Z0-9-]+$/.test(tag) ? tag : tag.toLowerCase());

function TagCompletion({ stats }: { stats: Stats }) {
  const { tagCompletion, finishContrast } = stats;
  if (tagCompletion.length === 0) return null;

  return (
    <Panel>
      <SectionTitle>What you finish</SectionTitle>
      {finishContrast ? (
        <p className="-mt-1 mb-6 max-w-2xl text-ink-300">
          You finish <Figure>{finishContrast.high.pct}%</Figure> of the{' '}
          {tagNoun(finishContrast.high.tag)} games you own, but only{' '}
          <Figure>{finishContrast.low.pct}%</Figure> of the {tagNoun(finishContrast.low.tag)} ones.
        </p>
      ) : (
        <p className="text-sm text-ink-400 mb-5 -mt-2">Tags with 3+ games in your library</p>
      )}
      <TagCompletionGrid tags={tagCompletion} />
    </Panel>
  );
}

function TagCompletionGrid({ tags }: { tags: Stats['tagCompletion'] }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
      {tags.map(({ tag, total, finished, pct }, i) => (
        <div key={tag} className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-ink-200 truncate">{tag}</span>
            <span
              className={`text-sm font-semibold tabular-nums shrink-0 ${pct >= 50 ? 'text-emerald-400' : 'text-ink-300'}`}
            >
              {pct}%
            </span>
          </div>
          <div className="mt-2 h-1 bg-ink-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${STATUS_STYLE.finished.fill} ${growBar('x', inView, i).className}`}
              style={{ width: `${pct}%`, ...growBar('x', inView, i).style }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-500 tabular-nums">
            {finished} of {total} finished
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Backlog games that are probably not backlog any more (see playedALot), with
 * a quick way to mark them. The other half of Home's Pick Up row.
 */
function PlayedALot({ stats, onEdit }: { stats: Stats; onEdit: (game: PlayedALotGame) => void }) {
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StatsView() {
  const { stats, loading, hasPlayingGame } = useStats();
  const { statusChanged } = useInvalidateQueries();
  const { user } = useAuth();
  const gamesList = usePatchGamesList(user?.id ?? null);
  const manualGames = useManualGameActions(user?.id ?? null);
  const addGameToQueue = useAddToQueue(user?.id ?? null);
  const [editModal, setEditModal] = useState<EditModalState | null>(null);

  const statusMutation = useMutation({
    mutationFn: async (vars: {
      gameId: number;
      status: string;
      date: string;
      notes: string;
      rating: number | null;
    }) => {
      await updateGameStatus(vars.gameId, vars.status, {
        finishedAt: vars.status === 'finished' ? vars.date : undefined,
        droppedAt: vars.status === 'dropped' ? vars.date : undefined,
        notes: vars.notes,
        rating: vars.rating,
      });
    },
    // Stats reads the shared games list, so the change shows straight away.
    onMutate: (vars) => ({ previous: gamesList.patch(statusChangeFrom(vars)) }),
    onError: (_err, _vars, context) => {
      gamesList.restore(context?.previous);
      toast.error('Failed to update game. Please try again.');
    },
    onSettled: () => statusChanged(),
  });

  const handleEdit = (game: PlayedALotGame) => setEditModal(game);

  const handleAddToQueue = () => {
    if (!editModal) return;
    setEditModal(null);
    addGameToQueue(editModal);
  };

  const handleConfirm = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!editModal) return;
    statusMutation.mutate({ gameId: editModal.id, status, date, notes, rating });
    setEditModal(null);
  };

  return (
    <Page
      overlay={
        editModal && (
          <GameDetailModal
            isOpen={true}
            onClose={() => setEditModal(null)}
            onConfirm={handleConfirm}
            gameName={editModal.name}
            headerImage={editModal.header_image}
            mainStoryHours={editModal.main_story_hours}
            playtimeMinutes={editModal.playtime_forever}
            lastPlayedAt={steamLastPlayed(editModal)}
            deckCompat={editModal.deck_compat}
            manual={manualGames.dialogProps(editModal)}
            initialStatus="backlog"
            disablePlaying={hasPlayingGame}
            onAddToQueue={hasPlayingGame ? handleAddToQueue : undefined}
          />
        )
      }
    >
      <PageHeader
        title="Stats"
        description={<>Your whole library, except games you&apos;ve hidden or won&apos;t play</>}
      />

      {loading ? (
        <StatsContentSkeleton />
      ) : !stats ? (
        <EmptyState icon={Gamepad2} title="No stats yet">
          Add games to your library, or connect Steam, to see your stats here.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {/* Your games first: where the hours went, then what's left and
              what you loved, then the patterns. */}
          <div className="pb-4">
            <Hours stats={stats} />
          </div>
          <BacklogPace stats={stats} />
          <Favourites stats={stats} />
          <TagCompletion stats={stats} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopTags stats={stats} />
            <YearChart stats={stats} />
          </div>
          {stats.playedALot.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PlayedALot stats={stats} onEdit={handleEdit} />
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
