'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Gamepad2,
  Clock,
  Inbox,
  Trophy,
  Star,
  TrendingUp,
  Pencil,
  CalendarDays,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { useStats } from '@/hooks/useStats';
import { addToQueue } from '@/lib/games/queue';
import { toast } from 'sonner';
import type { Stats } from '@/hooks/useStats';

interface EditModalState {
  appId: number;
  gameName: string;
  headerImage: string | null;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function StatsLoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl h-28" />
        ))}
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-32" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-64" />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-64" />
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl h-48" />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
      {children}
    </h2>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-zinc-500 text-xs">
        <Icon className={`w-3.5 h-3.5 ${accent ?? ''}`} />
        <span>{label}</span>
      </div>
      <p className="text-3xl font-bold text-zinc-100 leading-none">{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function LibraryBreakdown({ stats }: { stats: Stats }) {
  const segments = [
    { label: 'Finished', pct: stats.finishedPct, count: stats.finished, color: 'bg-emerald-500' },
    { label: 'Dropped', pct: stats.droppedPct, count: stats.dropped, color: 'bg-rose-500' },
    { label: 'Backlog', pct: stats.backlogPct, count: stats.backlog, color: 'bg-violet-600' },
  ].filter((s) => s.count > 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
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
            <div className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-sm text-zinc-400">{s.label}</span>
            <span className="text-sm font-semibold text-zinc-100">{s.count}</span>
            <span className="text-xs text-zinc-600">({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopTags({ stats }: { stats: Stats }) {
  if (stats.topTags.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <SectionTitle>Top tags in your library</SectionTitle>
        <p className="text-sm text-zinc-600">
          No tag data yet — tags populate on next metadata sync.
        </p>
      </div>
    );
  }

  const max = stats.topTags[0].count;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <SectionTitle>Top tags in your library</SectionTitle>
      <div className="space-y-3">
        {stats.topTags.map(({ tag, count }) => (
          <div key={tag} className="flex items-center gap-3">
            <span className="text-sm text-zinc-400 w-32 truncate shrink-0">{tag}</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 w-6 text-right shrink-0">{count}</span>
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
      : 'No release year data yet — sync your library.';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          Games by year
        </h2>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-xs">
          <button
            onClick={() => setView('finished')}
            className={`px-2.5 py-1 cursor-pointer transition-colors ${
              view === 'finished'
                ? 'bg-zinc-700 text-zinc-100'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Finished
          </button>
          <button
            onClick={() => setView('released')}
            className={`px-2.5 py-1 cursor-pointer transition-colors ${
              view === 'released'
                ? 'bg-zinc-700 text-zinc-100'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Released
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-zinc-600">{empty}</p>
      ) : (
        <div className="flex-1 flex items-end gap-1.5 min-h-[160px]">
          {data.map(({ year, count }, i) => (
            <div key={year} className="self-stretch flex-1 flex flex-col items-center min-w-0">
              <div className="flex-1" />
              <span className="text-xs font-semibold text-zinc-300 mb-1">{count}</span>
              <div
                className={`w-full rounded-sm transition-colors ${
                  view === 'finished'
                    ? 'bg-emerald-500/80 hover:bg-emerald-500'
                    : 'bg-violet-500/80 hover:bg-violet-500'
                }`}
                style={{ height: `${Math.max((count / max) * 65, 3)}%` }}
              />
              <span
                className={`text-[10px] mt-1 ${data.length <= 14 || i % 2 === 0 ? 'text-zinc-600' : 'invisible'}`}
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <SectionTitle>Rating distribution</SectionTitle>
      <div className="flex items-end gap-2">
        {stats.ratingDistribution.map(({ rating, count }) => (
          <div key={rating} className="flex-1 flex flex-col items-center gap-1.5">
            <span
              className={`text-xs font-semibold ${count > 0 ? 'text-zinc-300' : 'text-transparent'}`}
            >
              {count}
            </span>
            <div
              className="w-full bg-amber-500/70 hover:bg-amber-500 rounded-sm transition-colors"
              style={{
                height: `${Math.max((count / max) * BAR_MAX_HEIGHT, count > 0 ? 4 : 2)}px`,
              }}
            />
            <span className="text-xs text-zinc-500">{rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagCompletion({ stats }: { stats: Stats }) {
  if (stats.tagCompletion.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <SectionTitle>Completion rate by tag</SectionTitle>
      <p className="text-xs text-zinc-600 mb-5 -mt-2">Tags with 3+ games in your library</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.tagCompletion.map(({ tag, total, finished, pct }) => (
          <div key={tag} className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200 truncate pr-2">{tag}</span>
              <span
                className={`text-base font-bold shrink-0 ${pct >= 50 ? 'text-emerald-400' : 'text-zinc-400'}`}
              >
                {pct}%
              </span>
            </div>
            <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-zinc-600">
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
  onEdit: (appId: number, gameName: string, headerImage: string | null) => void;
}) {
  if (stats.mostPlayedUnfinished.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <SectionTitle>Most played but still in backlog</SectionTitle>
      <div className="space-y-3">
        {stats.mostPlayedUnfinished.map(
          ({ app_id, name, playtime_forever, main_story_hours, header_image }) => {
            const hours = Math.round(playtime_forever / 60);
            const barPct =
              main_story_hours && main_story_hours > 0
                ? Math.min((hours / main_story_hours) * 100, 100)
                : (hours / Math.round(stats.mostPlayedUnfinished[0].playtime_forever / 60)) * 100;
            return (
              <div key={name} className="flex items-center gap-3">
                <button
                  onClick={() => onEdit(app_id, name, header_image)}
                  className="group relative w-16 h-9 shrink-0 rounded overflow-hidden bg-zinc-800 cursor-pointer"
                >
                  {header_image && (
                    <Image
                      src={header_image}
                      alt={name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500/70 rounded-full"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 shrink-0">
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

export default function StatsPage() {
  const { stats, loading, refresh } = useStats();
  const [editModal, setEditModal] = useState<EditModalState | null>(null);

  const handleEdit = (appId: number, gameName: string, headerImage: string | null) => {
    setEditModal({ appId, gameName, headerImage });
  };

  const handleAddToQueue = async (appId: number) => {
    const ok = await addToQueue(appId);
    if (ok) toast.success(`${editModal?.gameName} added to the queue!`);
    setEditModal(null);
  };

  const handleConfirm = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!editModal) return;
    await fetch('/api/games/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: editModal.appId,
        status,
        ...(status === 'finished' ? { finishedAt: date } : {}),
        ...(status === 'dropped' ? { droppedAt: date } : {}),
        notes,
        rating,
      }),
    });
    setEditModal(null);
    refresh();
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-zinc-100">Stats</h1>
            <p className="text-zinc-500 text-sm mt-1">
              A look at your gaming library{' '}
              <span className="text-zinc-600">· hidden games excluded</span>
            </p>
          </div>

          {loading ? (
            <StatsLoadingSkeleton />
          ) : !stats ? (
            <div className="text-center py-20">
              <Gamepad2 className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">No data yet — sync your library first.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                  icon={Gamepad2}
                  label="Total games"
                  value={stats.total}
                  sub="non-hidden"
                  accent="text-zinc-400"
                />
                <StatCard
                  icon={Trophy}
                  label="Finished"
                  value={stats.finished}
                  sub={`${stats.finishedPct}% of library`}
                  accent="text-emerald-400"
                />
                <StatCard
                  icon={Clock}
                  label="Hours played"
                  value={`${stats.totalPlaytimeHours.toLocaleString()}h`}
                  sub="across all games"
                  accent="text-amber-400"
                />
                <StatCard
                  icon={CalendarDays}
                  label="Days played"
                  value={`${stats.totalPlaytimeDays}d`}
                  sub="of your life"
                  accent="text-amber-400"
                />
                <StatCard
                  icon={Inbox}
                  label="Backlog hours"
                  value={`~${stats.estimatedBacklogHours.toLocaleString()}h`}
                  sub="estimated to beat"
                  accent="text-violet-400"
                />
                <StatCard
                  icon={Star}
                  label="Avg rating"
                  value={stats.avgRating !== null ? `${stats.avgRating}/10` : '—'}
                  sub={
                    stats.ratedCount > 0
                      ? `from ${stats.ratedCount} rated game${stats.ratedCount === 1 ? '' : 's'}`
                      : 'no ratings yet'
                  }
                  accent="text-amber-400"
                />
              </div>

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

              {/* Most played unfinished */}
              {stats.mostPlayedUnfinished.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MostPlayedUnfinished stats={stats} onEdit={handleEdit} />
                  {stats.avgRating !== null && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center items-center text-center gap-2">
                      <TrendingUp className="w-8 h-8 text-amber-400 mb-2" />
                      <p className="text-zinc-500 text-sm">You rate finished games</p>
                      <p className="text-5xl font-bold text-zinc-100">{stats.avgRating}</p>
                      <p className="text-zinc-600 text-sm">out of 10 on average</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {editModal && (
        <GameDetailModal
          isOpen={true}
          onClose={() => setEditModal(null)}
          onConfirm={handleConfirm}
          gameName={editModal.gameName}
          headerImage={editModal.headerImage}
          initialStatus="backlog"
          disablePlaying={(stats?.playing ?? 0) > 0}
          onAddToQueue={
            (stats?.playing ?? 0) > 0 ? () => handleAddToQueue(editModal.appId) : undefined
          }
        />
      )}
    </div>
  );
}
