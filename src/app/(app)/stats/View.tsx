'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Gamepad2, Pencil } from 'lucide-react';

import { useMutation } from '@tanstack/react-query';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { useStats } from '@/hooks/useStats';
import { useAuth } from '@/hooks/useAuth';
import { useAddToQueue } from '@/hooks/useNowPlaying';
import { updateGameStatus } from '@/lib/games/status';
import { useInvalidateQueries } from '@/lib/mutations';
import { toast } from 'sonner';
import type { Stats } from '@/hooks/useStats';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
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

const PANEL = 'bg-ink-900 rounded-xl p-5 sm:p-6';

function formatYears(years: number): string {
  if (years < 1) return 'under a year';
  const rounded = years < 10 ? Math.round(years * 10) / 10 : Math.round(years);
  return `~${rounded} year${rounded === 1 ? '' : 's'}`;
}

// How long the current backlog would take at the user's recent finishing rate.
function BacklogPace({ stats }: { stats: Stats }) {
  const { backlog, finishedLastYear } = stats;
  return (
    <div className={PANEL}>
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
    </div>
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
    { label: 'Finished', pct: stats.finishedPct, count: stats.finished, color: 'bg-emerald-500' },
    { label: 'Dropped', pct: stats.droppedPct, count: stats.dropped, color: 'bg-rose-500' },
    { label: 'Backlog', pct: stats.backlogPct, count: stats.backlog, color: 'bg-ink-500' },
  ].filter((s) => s.count > 0);

  return (
    <div className={PANEL}>
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
    </div>
  );
}

function TopTags({ stats }: { stats: Stats }) {
  if (stats.topTags.length === 0) {
    return (
      <div className={PANEL}>
        <SectionTitle>Top tags in your library</SectionTitle>
        <p className="text-sm text-ink-500">
          No tag data yet. Tags fill in on the next metadata sync.
        </p>
      </div>
    );
  }

  const max = stats.topTags[0].count;

  return (
    <div className={PANEL}>
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
    </div>
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
    <div className={`${PANEL} flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Games by year</SectionLabel>
        <div className="flex gap-0.5 rounded-lg bg-ink-800 p-0.5 text-xs font-medium" role="group">
          {(['finished', 'released'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-2.5 py-1 rounded-md cursor-pointer capitalize transition-colors ${
                view === v ? 'bg-ink-600 text-ink-50' : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
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
                    ? 'bg-emerald-500/80 hover:bg-emerald-500'
                    : 'bg-ink-500 hover:bg-ink-400'
                }`}
                style={{ height: `${Math.max((count / max) * 65, 3)}%` }}
              />
              <span
                className={`text-[11px] mt-1 tabular-nums ${data.length <= 14 || i % 2 === 0 ? 'text-ink-400' : 'invisible'}`}
              >
                {year}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingHistogram({ stats }: { stats: Stats }) {
  const totalRated = stats.ratingDistribution.reduce((sum, b) => sum + b.count, 0);
  if (totalRated < 3) return null;

  const max = Math.max(...stats.ratingDistribution.map((b) => b.count), 1);
  const BAR_MAX_HEIGHT = 80;

  return (
    <div className={PANEL}>
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
    </div>
  );
}

function TagCompletion({ stats }: { stats: Stats }) {
  if (stats.tagCompletion.length === 0) return null;

  return (
    <div className={PANEL}>
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
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-ink-500 tabular-nums">
              {finished} of {total} finished
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MostPlayedUnfinished({
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
  if (stats.mostPlayedUnfinished.length === 0) return null;

  return (
    <div className={PANEL}>
      <SectionTitle>Most played but still in backlog</SectionTitle>
      <div className="space-y-3">
        {stats.mostPlayedUnfinished.map(
          ({ app_id, name, playtime_forever, main_story_hours, header_image, deck_compat }) => {
            const hours = Math.round(playtime_forever / 60);
            const barPct =
              main_story_hours && main_story_hours > 0
                ? Math.min((hours / main_story_hours) * 100, 100)
                : (hours / Math.round(stats.mostPlayedUnfinished[0].playtime_forever / 60)) * 100;
            return (
              <div key={name} className="flex items-center gap-3">
                <button
                  onClick={() =>
                    onEdit(
                      app_id,
                      name,
                      header_image,
                      main_story_hours,
                      playtime_forever,
                      deck_compat,
                    )
                  }
                  aria-label={`Edit ${name}`}
                  className="group relative w-16 h-[30px] shrink-0 rounded-md overflow-hidden bg-ink-800 cursor-pointer"
                >
                  {header_image && (
                    <Image
                      src={header_image}
                      alt={name}
                      fill
                      className="object-cover"
                      sizes="64px"
                      quality={90}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Pencil className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-200 truncate">{name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-ink-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ink-400 rounded-full"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-400 shrink-0 w-20 text-right tabular-nums">
                      {hours}h{main_story_hours ? ` / ${main_story_hours}h` : ' played'}
                    </span>
                  </div>
                </div>
              </div>
            );
          },
        )}
      </div>
    </div>
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
        <div className="py-16 flex flex-col items-center text-center">
          <Gamepad2 className="w-8 h-8 text-ink-600 mb-4" aria-hidden="true" />
          <p className="text-ink-200 font-medium">No stats yet</p>
          <p className="text-ink-400 text-sm mt-1 max-w-sm">
            Sync your Steam library to see your stats.
          </p>
        </div>
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

          {/* Most played unfinished + backlog pace */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {stats.mostPlayedUnfinished.length > 0 && (
              <MostPlayedUnfinished stats={stats} onEdit={handleEdit} />
            )}
            <BacklogPace stats={stats} />
          </div>
        </div>
      )}
    </Page>
  );
}
