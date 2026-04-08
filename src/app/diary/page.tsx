'use client';

import Image from 'next/image';
import { ExternalLink, Gamepad2, Pencil, Trophy, Star, MessageCircle } from 'lucide-react';

import { GameDetailModal } from '@/components/games/GameStatusModal';
import { useDiary } from '@/hooks/useDiary';
import type { DiaryEntry } from '@/hooks/useDiary';
import { getMonthKey, formatMonthLabel, formatDay } from '@/lib/diary/date-utils';

// ─── Sub-components ────────────────────────────────────────────────────────────

function DiaryLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 sm:gap-4 py-3 animate-pulse">
          <div className="w-6 h-4 bg-zinc-800 rounded shrink-0" />
          <div className="w-20 h-12 sm:w-36 sm:h-20 bg-zinc-800 rounded shrink-0" />
          <div className="flex-1 h-4 bg-zinc-800 rounded" />
          <div className="w-10 h-4 bg-zinc-800 rounded hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
      <p className="text-zinc-500">No finished games yet</p>
    </div>
  );
}

function NotesTooltip({ text }: { text: string }) {
  return (
    <div className="relative group/notes">
      <MessageCircle className="w-4 h-4 text-zinc-600 hover:text-zinc-400 transition-colors cursor-default" />
      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 hidden group-hover/notes:block z-50 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 w-72 whitespace-normal shadow-xl">
        {text}
      </div>
    </div>
  );
}

interface DiaryRowProps {
  entry: DiaryEntry;
  onEdit: (appId: number) => void;
}

function DiaryRow({ entry, onEdit }: DiaryRowProps) {
  const hasDate = Boolean(entry.finished_at);
  const day = hasDate ? formatDay(entry.finished_at!) : null;

  return (
    <div className="flex items-center gap-3 sm:gap-4 py-3 border-b border-zinc-800/60">
      {/* Day */}
      <div className="w-6 shrink-0 text-right text-sm text-zinc-500">{day ?? ''}</div>

      {/* Cover image */}
      <div className="relative w-16 h-10 sm:w-28 sm:h-16 shrink-0 rounded overflow-hidden bg-zinc-800 flex items-center justify-center">
        {entry.header_image ? (
          <Image
            src={entry.header_image}
            alt={entry.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 64px, 112px"
            quality={90}
          />
        ) : (
          <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600" />
        )}
      </div>

      {/* Game name + rating stacked on mobile */}
      <div className="min-w-0 flex-[2]">
        <a
          href={`https://store.steampowered.com/app/${entry.app_id}/`}
          target="_blank"
          rel="noopener noreferrer"
          title={entry.name}
          className="group/title inline-flex items-center gap-1 font-medium text-zinc-100 hover:text-white transition-colors truncate max-w-full text-base"
        >
          <span className="truncate min-w-0">{entry.name}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity mb-px" />
        </a>
        {entry.rating != null && (
          <p className="flex items-center gap-1 text-sm text-zinc-400 sm:hidden mt-0.5">
            <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" />
            {entry.rating}/10
          </p>
        )}
      </div>

      {/* Rating — desktop only */}
      <div className="hidden sm:block shrink-0 w-20 text-right">
        {entry.rating != null && (
          <span className="flex items-center justify-end gap-1 text-base text-zinc-300">
            <Star className="w-3.5 h-3.5 shrink-0 fill-amber-400 text-amber-400" />
            {entry.rating}/10
          </span>
        )}
      </div>

      {/* Notes icon — desktop only */}
      <div className="hidden sm:flex shrink-0 w-10 items-center justify-center">
        {entry.notes && <NotesTooltip text={entry.notes} />}
      </div>

      {/* Edit button — always visible */}
      <button
        onClick={() => onEdit(entry.app_id)}
        aria-label={`Edit ${entry.name}`}
        className="cursor-pointer shrink-0 p-1.5 text-zinc-500 hover:text-zinc-100 transition-colors"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface MonthGroup {
  key: string; // "YYYY-MM"
  entries: DiaryEntry[];
}

interface YearGroup {
  year: string; // "YYYY"
  months: MonthGroup[];
}

export default function DiaryPage() {
  const {
    entries,
    loading,
    detailModal,
    handleOpenDetail,
    handleCloseDetail,
    handleConfirmDetail,
  } = useDiary();

  // Split into dated and undated
  const datedEntries = entries.filter((e) => e.finished_at);
  const undatedEntries = entries
    .filter((e) => !e.finished_at)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build year → month hierarchy
  const yearGroups: YearGroup[] = [];
  for (const entry of datedEntries) {
    const year = entry.finished_at!.slice(0, 4);
    const monthKey = getMonthKey(entry.finished_at!);

    let yg = yearGroups.find((g) => g.year === year);
    if (!yg) {
      yg = { year, months: [] };
      yearGroups.push(yg);
    }

    let mg = yg.months.find((m) => m.key === monthKey);
    if (!mg) {
      mg = { key: monthKey, entries: [] };
      yg.months.push(mg);
    }

    mg.entries.push(entry);
  }

  const thisYearCount = entries.filter((e) =>
    e.finished_at?.startsWith(String(new Date().getFullYear())),
  ).length;

  return (
    <div className="min-h-screen bg-zinc-950">
      <main className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Page heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-100">Diary</h1>
            {!loading && (
              <p className="text-zinc-500 text-sm mt-1">
                {entries.length === 0
                  ? "You haven't finished any games yet"
                  : `${entries.length} game${entries.length === 1 ? '' : 's'} finished${thisYearCount > 0 ? ` · ${thisYearCount} this year` : ''}`}
              </p>
            )}
          </div>

          {loading ? (
            <DiaryLoadingSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              {/* Dated entries grouped by year → month */}
              {yearGroups.map((yg, yi) => (
                <div key={yg.year}>
                  <h2
                    className={`text-lg font-bold text-zinc-100 pb-1 border-b border-zinc-800 ${yi === 0 ? 'mt-2' : 'mt-10'}`}
                  >
                    {yg.year}
                  </h2>
                  {yg.months.map((mg) => {
                    const { month } = formatMonthLabel(mg.entries[0].finished_at!);
                    return (
                      <div key={mg.key}>
                        <p className="text-sm font-semibold text-zinc-400 tracking-wide pt-5 pb-2">
                          {month}
                        </p>
                        {mg.entries.map((entry) => (
                          <DiaryRow key={entry.app_id} entry={entry} onEdit={handleOpenDetail} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Undated entries */}
              {undatedEntries.length > 0 && (
                <div className="mt-8">
                  <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">No date</p>
                  {undatedEntries.map((entry) => (
                    <DiaryRow key={entry.app_id} entry={entry} onEdit={handleOpenDetail} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {detailModal && (
        <GameDetailModal
          isOpen={true}
          onClose={handleCloseDetail}
          onConfirm={handleConfirmDetail}
          gameName={detailModal.gameName}
          headerImage={detailModal.headerImage}
          initialStatus={detailModal.initialStatus}
          initialDate={detailModal.initialDate}
          initialNotes={detailModal.initialNotes}
          initialRating={detailModal.initialRating}
        />
      )}
    </div>
  );
}
