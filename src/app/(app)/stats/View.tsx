'use client';

import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';

import { useMutation } from '@tanstack/react-query';
import { CoverEditHint, CoverThumb } from '@/components/games/CoverArt';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { useStats } from '@/hooks/useStats';
import { useAuth } from '@/hooks/useAuth';
import { useAddToQueue } from '@/hooks/useNowPlaying';
import { updateGameStatus } from '@/lib/games/status';
import { useInvalidateQueries } from '@/lib/mutations';
import { toast } from 'sonner';
import type { Stats } from '@/hooks/useStats';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { STATUS_STYLE } from '@/lib/games/status-style';
import { StatsContentSkeleton } from './Skeleton';

interface EditModalState {
  appId: number;
  gameName: string;
  headerImage: string | null;
  mainStoryHours: number | null;
  playtimeMinutes: number;
  deckCompat: number | null;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <SectionLabel className="mb-4">{children}</SectionLabel>;
}

function formatYears(years: number): string {
  if (years < 1) return 'under a year';
  const rounded = years < 10 ? Math.round(years * 10) / 10 : Math.round(years);
  return `~${rounded} year${rounded === 1 ? '' : 's'}`;
}

// How long the current backlog would take at the user's recent finishing rate.
function BacklogPace({ stats }: { stats: Stats }) {
  const { backlog, finishedLastYear } = stats;
  return (
    <Panel>
      <SectionTitle>Backlog pace</SectionTitle>
      {finishedLastYear > 0 ? (
        <>
          <p className="text-3xl font-semibold tracking-tight text-ink-50">
            {formatYears(backlog / finishedLastYear)}
          </p>
          <p className="mt-2 text-sm text-ink-400 max-w-sm">
            to clear {backlog} backlog games at your current pace of {finishedLastYear} finished in
            the last 12 months.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-400 max-w-sm">
          You haven&apos;t finished a game in the last 12 months. Finish one to see how long your
          backlog would take at your pace.
        </p>
      )}
    </Panel>
  );
}

function Summary({ items }: { items: { label: string; value: string | number; sub?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px overflow-hidden rounded-xl bg-ink-800">
      {items.map(({ label, value, sub }) => (
        <div key={label} className="bg-ink-900 px-5 py-4 flex flex-col">
          <dt className="text-sm text-ink-400">{label}</dt>
          <dd className="order-first text-2xl font-semibold tracking-tight text-ink-50">{value}</dd>
          {sub && <dd className="mt-0.5 text-xs text-ink-500">{sub}</dd>}
        </div>
      ))}
    </dl>
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

  return (
    <Panel>
      <SectionTitle>Library breakdown</SectionTitle>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px mb-5">
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
    </Panel>
  );
}

function TopTags({ stats }: { stats: Stats }) {
  if (stats.topTags.length === 0) {
    return (
      <Panel>
        <SectionTitle>Top tags in your library</SectionTitle>
        <p className="text-sm text-ink-500">
          No tag data yet. Tags fill in on the next metadata sync.
        </p>
      </Panel>
    );
  }

  const max = stats.topTags[0].count;

  return (
    <Panel>
      <SectionTitle>Top tags in your library</SectionTitle>
      <div className="space-y-3">
        {stats.topTags.map(({ tag, count }) => (
          <div key={tag} className="flex items-center gap-3">
            <span className="text-sm text-ink-300 w-20 sm:w-32 truncate shrink-0">{tag}</span>
            <div className="flex-1 h-1.5 bg-ink-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-ink-400 rounded-full"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-ink-400 w-6 text-right shrink-0 tabular-nums">
              {count}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

type YearView = 'finished' | 'released';

function YearChart({ stats }: { stats: Stats }) {
  const [view, setView] = useState<YearView>('finished');

  const data = view === 'finished' ? stats.finishedByYear : stats.gamesByReleaseYear;
  const max = data.length > 0 ? Math.max(...data.map((y) => y.count)) : 1;

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
        <div className="flex-1 flex items-end gap-1.5 min-h-[160px]">
          {data.map(({ year, count }, i) => (
            <div key={year} className="self-stretch flex-1 flex flex-col items-center min-w-0">
              <div className="flex-1" />
              <span className="text-xs font-semibold text-ink-300 mb-1 tabular-nums">{count}</span>
              <div
                className={`w-full rounded-sm transition-colors ${
                  view === 'finished'
                    ? `${STATUS_STYLE.finished.fill} opacity-80 hover:opacity-100`
                    : 'bg-ink-500 hover:bg-ink-400'
                }`}
                style={{ height: `${Math.max((count / max) * 65, 3)}%` }}
              />
              <span
                className={`text-xs mt-1 tabular-nums ${data.length <= 14 || i % 2 === 0 ? 'text-ink-400' : 'invisible'}`}
              >
                {year}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RatingHistogram({ stats }: { stats: Stats }) {
  const totalRated = stats.ratingDistribution.reduce((sum, b) => sum + b.count, 0);
  if (totalRated < 3) return null;

  const max = Math.max(...stats.ratingDistribution.map((b) => b.count), 1);
  const BAR_MAX_HEIGHT = 80;

  return (
    <Panel>
      <SectionTitle>Rating distribution</SectionTitle>
      <div className="flex items-end gap-2">
        {stats.ratingDistribution.map(({ rating, count }) => (
          <div key={rating} className="flex-1 flex flex-col items-center gap-1.5">
            <span
              className={`text-xs font-semibold tabular-nums ${count > 0 ? 'text-ink-300' : 'text-transparent'}`}
            >
              {count}
            </span>
            <div
              className={`w-full rounded-sm transition-colors ${count > 0 ? 'bg-amber-400/80 hover:bg-amber-400' : 'bg-ink-800'}`}
              style={{
                height: `${Math.max((count / max) * BAR_MAX_HEIGHT, count > 0 ? 4 : 2)}px`,
              }}
            />
            <span className="text-xs text-ink-400 tabular-nums">{rating}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TagCompletion({ stats }: { stats: Stats }) {
  if (stats.tagCompletion.length === 0) return null;

  return (
    <Panel>
      <SectionTitle>Completion rate by tag</SectionTitle>
      <p className="text-sm text-ink-400 mb-5 -mt-2">Tags with 3+ games in your library</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
        {stats.tagCompletion.map(({ tag, total, finished, pct }) => (
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
                className={`h-full rounded-full ${STATUS_STYLE.finished.fill}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-500 tabular-nums">
              {finished} of {total} finished
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Backlog games that are probably not backlog any more (see playedALot), with
 * a quick way to mark them. The other half of Home's Pick Up row.
 */
function PlayedALot({
  stats,
  onEdit,
}: {
  stats: Stats;
  onEdit: (
    appId: number,
    gameName: string,
    headerImage: string | null,
    mainStoryHours: number | null,
    playtimeMinutes: number,
    deckCompat: number | null,
  ) => void;
}) {
  return (
    <Panel>
      <SectionTitle>Played a lot, still in your backlog</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-ink-400 max-w-md">
        Finished these, or play them rather than finish them? Updating them keeps your backlog count
        and pace honest.
      </p>
      <ul className="space-y-3">
        {stats.playedALot.map(
          ({ app_id, name, playtime_forever, main_story_hours, header_image, deck_compat }) => {
            const edit = () =>
              onEdit(app_id, name, header_image, main_story_hours, playtime_forever, deck_compat);
            return (
              <li key={app_id} className="flex items-center gap-3">
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
                    {Math.round(playtime_forever / 60)}h played
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
          },
        )}
      </ul>
    </Panel>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StatsView() {
  const { stats, loading, hasPlayingGame } = useStats();
  const { games: invalidateGames } = useInvalidateQueries();
  const { user } = useAuth();
  const addGameToQueue = useAddToQueue(user?.id ?? null);
  const [editModal, setEditModal] = useState<EditModalState | null>(null);

  const statusMutation = useMutation({
    mutationFn: async (vars: {
      appId: number;
      status: string;
      date: string;
      notes: string;
      rating: number | null;
    }) => {
      await updateGameStatus(vars.appId, vars.status, {
        finishedAt: vars.status === 'finished' ? vars.date : undefined,
        droppedAt: vars.status === 'dropped' ? vars.date : undefined,
        notes: vars.notes,
        rating: vars.rating,
      });
    },
    onError: () => toast.error('Failed to update game. Please try again.'),
    onSettled: () => invalidateGames(),
  });

  const handleEdit = (
    appId: number,
    gameName: string,
    headerImage: string | null,
    mainStoryHours: number | null,
    playtimeMinutes: number,
    deckCompat: number | null,
  ) => {
    setEditModal({ appId, gameName, headerImage, mainStoryHours, playtimeMinutes, deckCompat });
  };

  const handleAddToQueue = () => {
    if (!editModal) return;
    setEditModal(null);
    addGameToQueue({
      app_id: editModal.appId,
      name: editModal.gameName,
      header_image: editModal.headerImage,
      main_story_hours: editModal.mainStoryHours,
      playtime_forever: editModal.playtimeMinutes,
      deck_compat: editModal.deckCompat,
    });
  };

  const handleConfirm = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!editModal) return;
    statusMutation.mutate({ appId: editModal.appId, status, date, notes, rating });
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
            gameName={editModal.gameName}
            headerImage={editModal.headerImage}
            mainStoryHours={editModal.mainStoryHours}
            playtimeMinutes={editModal.playtimeMinutes}
            deckCompat={editModal.deckCompat}
            initialStatus="backlog"
            disablePlaying={hasPlayingGame}
            onAddToQueue={hasPlayingGame ? handleAddToQueue : undefined}
          />
        )
      }
    >
      <PageHeader
        title="Stats"
        description={<>Your library at a glance, not counting hidden and won&apos;t play games.</>}
      />

      {loading ? (
        <StatsContentSkeleton />
      ) : !stats ? (
        <EmptyState icon={Gamepad2} title="No stats yet">
          Sync your Steam library to see your stats.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <Summary
            items={[
              { label: 'Games', value: stats.total, sub: 'not counting hidden' },
              {
                label: 'Finished',
                value: stats.finished,
                sub: `${stats.finishedPct}% of library`,
              },
              {
                label: 'Hours played',
                value: `${stats.totalPlaytimeHours.toLocaleString()}h`,
                sub: 'across all games',
              },
              { label: 'Days played', value: `${stats.totalPlaytimeDays}d`, sub: 'of your life' },
              {
                label: 'Backlog hours',
                value: `~${stats.estimatedBacklogHours.toLocaleString()}h`,
                sub: 'estimated to beat',
              },
              {
                label: 'Avg rating',
                value: stats.avgRating !== null ? `${stats.avgRating}/10` : '—',
                sub:
                  stats.ratedCount > 0
                    ? `from ${stats.ratedCount} rated game${stats.ratedCount === 1 ? '' : 's'}`
                    : 'no ratings yet',
              },
            ]}
          />

          {/* Library breakdown */}
          <LibraryBreakdown stats={stats} />

          {/* Tags + Year chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopTags stats={stats} />
            <YearChart stats={stats} />
          </div>

          {/* Tag completion */}
          <TagCompletion stats={stats} />

          {/* Rating distribution */}
          <RatingHistogram stats={stats} />

          {/* Played a lot but still backlog + backlog pace */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {stats.playedALot.length > 0 && <PlayedALot stats={stats} onEdit={handleEdit} />}
            <BacklogPace stats={stats} />
          </div>
        </div>
      )}
    </Page>
  );
}
