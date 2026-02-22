'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { Gamepad2, Pencil, Trophy } from 'lucide-react';
import { Header } from '@/components/Header';
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
          <div className="w-16 h-10 sm:w-24 sm:h-14 bg-zinc-800 rounded shrink-0" />
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

function TruncatedNotes({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (ref.current) {
      setTruncated(ref.current.scrollWidth > ref.current.clientWidth);
    }
  }, [text]);

  return (
    <div className="relative group/notes min-w-0">
      <p ref={ref} className="text-sm text-zinc-500 italic truncate">
        {text}
      </p>
      {truncated && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover/notes:block z-50 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 w-72 whitespace-normal shadow-xl">
          {text}
        </div>
      )}
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
      <div className="relative w-16 h-10 sm:w-24 sm:h-14 shrink-0 rounded overflow-hidden bg-zinc-800 flex items-center justify-center">
        {entry.header_image ? (
          <Image
            src={entry.header_image}
            alt={entry.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 64px, 96px"
          />
        ) : (
          <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600" />
        )}
      </div>

      {/* Game name + rating stacked on mobile */}
      <div className="min-w-0 flex-[2]">
        <p className="font-medium text-zinc-100 truncate text-base">{entry.name}</p>
        {entry.rating != null && (
          <p className="text-sm text-zinc-400 sm:hidden mt-0.5">{entry.rating}/10</p>
        )}
      </div>

      {/* Rating — desktop only */}
      <div className="hidden sm:block shrink-0 w-14 text-right">
        {entry.rating != null && <span className="text-base text-zinc-300">{entry.rating}/10</span>}
      </div>

      {/* Notes — hidden on mobile, tooltip only when truncated */}
      <div className="hidden sm:block min-w-0 flex-[1]">
        {entry.notes && <TruncatedNotes text={entry.notes} />}
      </div>

      {/* Edit button — always visible */}
      <button
        onClick={() => onEdit(entry.app_id)}
        aria-label={`Edit ${entry.name}`}
        className="cursor-pointer shrink-0 p-1 text-zinc-500 hover:text-zinc-100 transition-colors"
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
  const undatedEntries = entries.filter((e) => !e.finished_at);

  const monthGroups: MonthGroup[] = [];
  for (const entry of datedEntries) {
    const key = getMonthKey(entry.finished_at!);
    const existing = monthGroups.find((g) => g.key === key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      monthGroups.push({ key, entries: [entry] });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          {/* Page heading */}
          <div className="flex items-baseline gap-3 mb-8">
            <h1 className="text-2xl font-bold text-zinc-100">Diary</h1>
          </div>

          {loading ? (
            <DiaryLoadingSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              {/* Dated entries grouped by month */}
              {monthGroups.map((group) => {
                const label = formatMonthLabel(group.entries[0].finished_at!);
                return (
                  <div key={group.key}>
                    <p className="text-sm font-semibold text-zinc-300 tracking-wide pt-6 pb-2">
                      {label.month} {label.year}
                    </p>
                    {group.entries.map((entry) => (
                      <DiaryRow key={entry.app_id} entry={entry} onEdit={handleOpenDetail} />
                    ))}
                  </div>
                );
              })}

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
