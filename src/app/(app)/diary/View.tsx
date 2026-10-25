'use client';

import { ExternalLink, Pencil, Trophy, Star, MessageCircle, CalendarDays } from 'lucide-react';

import { CoverThumb } from '@/components/games/CoverArt';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDiary } from '@/hooks/useDiary';
import { useUrlState } from '@/hooks/useUrlState';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { DiaryListSkeleton } from './Skeleton';
import type { DiaryEntry } from '@/hooks/useDiary';
import { getMonthKey, formatDay } from '@/lib/diary/date-utils';

// ─── Sub-components ────────────────────────────────────────────────────────────

function monthName(isoDate: string): string {
  const d = new Date(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, 1);
  return d.toLocaleString('en-US', { month: 'long' });
}

function NotesTooltip({ text }: { text: string }) {
  return (
    <div className="relative group/notes">
      <button
        type="button"
        aria-label="Show notes"
        className="block p-1 text-ink-500 hover:text-ink-200 transition-colors cursor-default rounded"
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
      </button>
      <div
        role="tooltip"
        className="absolute right-full top-1/2 -translate-y-1/2 mr-2 hidden group-hover/notes:block group-focus-within/notes:block z-50 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-ink-200 w-72 whitespace-normal shadow-xl shadow-black/40"
      >
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
    <div className="flex items-center gap-3 sm:gap-4 py-3 border-b border-ink-800/70">
      {/* Day */}
      <div className="w-6 shrink-0 text-right text-sm text-ink-400 tabular-nums">{day ?? ''}</div>

      {/* Cover image */}
      <CoverThumb src={entry.header_image} alt={entry.name} />

      {/* Game name + rating stacked on mobile */}
      <div className="min-w-0 flex-[2]">
        <a
          href={`https://store.steampowered.com/app/${entry.app_id}/`}
          target="_blank"
          rel="noopener noreferrer"
          title={entry.name}
          className="group/title inline-flex items-center gap-1 font-medium text-ink-100 hover:text-ink-50 transition-colors sm:truncate max-w-full"
        >
          <span className="sm:truncate min-w-0">{entry.name}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity mb-px" />
        </a>
        {entry.rating != null && (
          <p className="flex items-center gap-1 text-sm text-ink-300 tabular-nums sm:hidden mt-0.5">
            <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" />
            <span>{entry.rating}/10</span>
          </p>
        )}
      </div>

      {/* Rating — desktop only */}
      <div className="hidden sm:block shrink-0 w-20 text-right">
        {entry.rating != null && (
          <span className="flex items-center justify-end gap-1 text-sm font-medium text-ink-200 tabular-nums">
            <Star className="w-3.5 h-3.5 shrink-0 fill-amber-400 text-amber-400" />
            <span>{entry.rating}/10</span>
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
        className="cursor-pointer shrink-0 p-1.5 text-ink-500 hover:text-ink-100 transition-colors"
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

export default function DiaryView() {
  const {
    entries,
    loading,
    hasPlayingGame,
    detailModal,
    handleOpenDetail,
    handleCloseDetail,
    handleConfirmDetail,
  } = useDiary();

  const [selectedYear, setSelectedYear] = useUrlState<string>('year', 'all');

  // Split into dated and undated
  const datedEntries = entries.filter((e) => e.finished_at);
  const undatedEntries = entries
    .filter((e) => !e.finished_at)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Collect available years (descending)
  const availableYears = [...new Set(datedEntries.map((e) => e.finished_at!.slice(0, 4)))].sort(
    (a, b) => b.localeCompare(a),
  );

  // Filter entries by selected year
  const filteredDated =
    selectedYear === 'all'
      ? datedEntries
      : datedEntries.filter((e) => e.finished_at!.startsWith(selectedYear));
  const filteredUndated = selectedYear === 'all' ? undatedEntries : [];
  const filteredEntries = selectedYear === 'all' ? entries : filteredDated;

  // Build year → month hierarchy
  const yearGroups: YearGroup[] = [];
  for (const entry of filteredDated) {
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

  const summaryText = (() => {
    if (filteredEntries.length === 0) return "You haven't finished any games yet";
    const count = `${filteredEntries.length} game${filteredEntries.length === 1 ? '' : 's'} finished`;
    if (selectedYear !== 'all') return `${count} in ${selectedYear}`;
    const thisYearCount = entries.filter((e) =>
      e.finished_at?.startsWith(String(new Date().getFullYear())),
    ).length;
    return thisYearCount > 0 ? `${count} · ${thisYearCount} this year` : count;
  })();

  return (
    <Page
      overlay={
        detailModal && (
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
            disablePlaying={hasPlayingGame}
          />
        )
      }
    >
      <PageHeader
        title="Diary"
        description={!loading && summaryText}
        actions={
          !loading &&
          availableYears.length >= 2 &&
          entries.length >= 5 && (
            <Dropdown
              value={selectedYear}
              onChange={setSelectedYear}
              icon={<CalendarDays className="w-4 h-4" />}
              options={[
                { value: 'all', label: 'All time' },
                ...availableYears.map((year) => ({ value: year, label: year })),
              ]}
            />
          )
        }
      />

      {loading ? (
        <DiaryListSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState icon={Trophy} title="No finished games yet">
          When you finish a game, it lands here with the date, your rating and any notes.
        </EmptyState>
      ) : (
        <div>
          {/* Dated entries grouped by year → month */}
          {yearGroups.map((yg, yi) => (
            <div key={yg.year}>
              {selectedYear === 'all' && (
                <h2
                  className={`text-xl font-semibold tracking-tight text-ink-50 pb-2 border-b border-ink-800 ${yi === 0 ? 'mt-2' : 'mt-12'}`}
                >
                  {yg.year}
                </h2>
              )}
              {yg.months.map((mg) => {
                return (
                  <div key={mg.key}>
                    <h3
                      className={`text-sm font-medium text-ink-300 pb-1 ${selectedYear !== 'all' && yi === 0 ? 'pt-2' : 'pt-6'}`}
                    >
                      {monthName(mg.entries[0].finished_at!)}
                    </h3>
                    {mg.entries.map((entry) => (
                      <DiaryRow key={entry.app_id} entry={entry} onEdit={handleOpenDetail} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Undated entries */}
          {filteredUndated.length > 0 && (
            <div className="mt-12">
              <SectionLabel className="pb-2 border-b border-ink-800">No date</SectionLabel>
              {filteredUndated.map((entry) => (
                <DiaryRow key={entry.app_id} entry={entry} onEdit={handleOpenDetail} />
              ))}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
