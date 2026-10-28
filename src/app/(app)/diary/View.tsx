'use client';

import { useState } from 'react';
import { ExternalLink, Trophy, MessageSquarePlus, CalendarDays } from 'lucide-react';
import { Rating } from '@/components/games/Rating';

import { CoverArt, CoverEditHint } from '@/components/games/CoverArt';
import { Playtime } from '@/components/games/GameCardInfo';
import { DiaryNoteEditor, DiaryNoteText, ROW_REVEAL } from '@/components/diary/DiaryNote';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDiary } from '@/hooks/useDiary';
import { useUrlState } from '@/hooks/useUrlState';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { DiaryListSkeleton } from './Skeleton';
import type { DiaryEntry } from '@/hooks/useDiary';
import { steamStoreUrl } from '@/lib/games/store-link';
import { consoleOf } from '@/lib/games/manual';
import { steamLastPlayed } from '@/lib/games/consoles';
import { useAuth } from '@/hooks/useAuth';
import { useManualGameActions } from '@/hooks/useManualGame';
import { getMonthKey, formatDay } from '@/lib/diary/date-utils';

// ─── Sub-components ────────────────────────────────────────────────────────────

/** "20 Aug" from an ISO date, for the date chip on phones. */
function shortDate(isoDate: string): string {
  const d = new Date(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short' });
}

function monthName(isoDate: string): string {
  const d = new Date(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, 1);
  return d.toLocaleString('en-US', { month: 'long' });
}

interface DiaryRowProps {
  entry: DiaryEntry;
  onEdit: (gameId: number) => void;
  onSaveNotes: (gameId: number, notes: string) => void;
}

// On desktop the day, rating and buttons line up with the cover, whose height
// follows from its width at the shared 460:215 ratio (192px → 90px, 224px →
// 105px). On phones the cover is full width above the text, so they sit on the
// title line instead.
const COVER_WIDTH = 'w-full sm:w-48 lg:w-56';
const COVER_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 192px, 224px';
const COVER_HEIGHT = 'sm:min-h-[90px] lg:min-h-[105px]';
const ALIGN_WITH_COVER = 'h-[90px] lg:h-[105px] flex items-center';

/**
 * The hours a finished game took, styled to sit beside the rating: for a
 * finished game it's the number worth seeing with it. The other details are
 * in the modal.
 */
function HoursPlayed({ entry, size = 'sm' }: { entry: DiaryEntry; size?: 'sm' | 'md' }) {
  if (entry.playtime_forever < 60) return null;
  return (
    <Playtime
      compact
      showLabel
      minutes={entry.playtime_forever}
      lastPlayedAt={steamLastPlayed(entry)}
      className="text-sm font-medium text-ink-200 tabular-nums"
      iconClassName={`${size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} shrink-0 text-ink-400`}
    />
  );
}

function AddNoteButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Add a note for ${name}`}
      className={`cursor-pointer p-1.5 rounded text-ink-500 hover:text-ink-100 ${ROW_REVEAL}`}
    >
      <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}

function DiaryRow({ entry, onEdit, onSaveNotes }: DiaryRowProps) {
  const [editingNote, setEditingNote] = useState(false);
  const day = entry.finished_at ? formatDay(entry.finished_at) : null;
  const canAddNote = !entry.notes && !editingNote;
  const startNote = () => setEditingNote(true);
  const edit = () => onEdit(entry.id);
  const storeUrl = steamStoreUrl(entry);

  return (
    // content-visibility lets the browser skip laying out and drawing rows
    // that are off screen, so a diary of hundreds of games scrolls smoothly.
    // The intrinsic size (a row's usual height: about 19rem stacked on phones,
    // 8rem side by side) keeps the scrollbar steady until a row is drawn.
    <div className="group/row flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 py-4 sm:py-3 border-b border-ink-800/70 [content-visibility:auto] [contain-intrinsic-size:auto_19rem] sm:[contain-intrinsic-size:auto_8rem]">
      {/* Day — desktop */}
      <div
        className={`${ALIGN_WITH_COVER} hidden sm:flex justify-end w-6 shrink-0 text-sm text-ink-400 tabular-nums`}
      >
        {day ?? ''}
      </div>

      {/* The art opens the entry, as on every other card. */}
      <button
        type="button"
        onClick={edit}
        aria-label={`Edit ${entry.name}`}
        className={`group ${COVER_WIDTH} shrink-0 block rounded-lg cursor-pointer select-none focus-visible:-outline-offset-2`}
      >
        <CoverArt
          src={entry.header_image}
          alt=""
          sizes={COVER_SIZES}
          interactive
          platform={consoleOf(entry)}
        >
          <CoverEditHint />
          {/* On phones the date rides on the art. */}
          {entry.finished_at && (
            <span className="sm:hidden absolute top-2 left-2 rounded-md bg-ink-950/90 px-2 py-0.5 text-xs font-medium text-ink-100 tabular-nums">
              {shortDate(entry.finished_at)}
            </span>
          )}
        </CoverArt>
      </button>

      {/* Title, the note, and on phones the rating and buttons */}
      <div className={`min-w-0 flex-1 ${COVER_HEIGHT} flex flex-col sm:justify-center`}>
        <div className="flex items-start gap-2">
          {storeUrl ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={entry.name}
              className="group/title flex-1 min-w-0 inline-flex items-center gap-1 font-medium text-ink-100 hover:text-ink-50 transition-colors"
            >
              <span className="sm:truncate min-w-0">{entry.name}</span>
              <ExternalLink
                className="w-3 h-3 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity mb-px"
                aria-hidden="true"
              />
            </a>
          ) : (
            <p title={entry.name} className="flex-1 min-w-0 font-medium text-ink-100 sm:truncate">
              {entry.name}
            </p>
          )}
          <div className="sm:hidden flex items-center gap-1 shrink-0 -my-1 -mr-1.5">
            {entry.playtime_forever >= 60 && (
              <span className="mr-2.5">
                <HoursPlayed entry={entry} />
              </span>
            )}
            {entry.rating != null && (
              <span className="mr-1.5">
                <Rating rating={entry.rating} />
              </span>
            )}
            {canAddNote && <AddNoteButton name={entry.name} onClick={startNote} />}
          </div>
        </div>
        {/* The console shows on the art; this is its name for screen readers. */}
        {consoleOf(entry) && <p className="sr-only">On {consoleOf(entry)}</p>}
        {editingNote ? (
          <DiaryNoteEditor
            initialText={entry.notes ?? ''}
            gameName={entry.name}
            onCancel={() => setEditingNote(false)}
            onSave={(notes) => {
              setEditingNote(false);
              if (notes !== (entry.notes ?? '')) onSaveNotes(entry.id, notes);
            }}
          />
        ) : (
          entry.notes && (
            <DiaryNoteText text={entry.notes} gameName={entry.name} onEdit={startNote} />
          )
        )}
      </div>

      {/* Hours played, rating and buttons — desktop */}
      <div className={`${ALIGN_WITH_COVER} hidden sm:flex justify-end shrink-0 w-28`}>
        <HoursPlayed entry={entry} size="md" />
      </div>
      <div className={`${ALIGN_WITH_COVER} hidden sm:flex justify-end shrink-0 w-20`}>
        {entry.rating != null && <Rating rating={entry.rating} size="md" />}
      </div>
      <div className={`${ALIGN_WITH_COVER} hidden sm:flex justify-center shrink-0 w-8`}>
        {canAddNote && <AddNoteButton name={entry.name} onClick={startNote} />}
      </div>
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
    handleSaveNotes,
  } = useDiary();
  const { user } = useAuth();
  const manualGames = useManualGameActions(user?.id ?? null);

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
            mainStoryHours={detailModal.game.main_story_hours}
            steamReviewScore={detailModal.game.steam_review_score}
            steamReviewCount={detailModal.game.steam_review_count}
            criticScore={detailModal.game.critic_score}
            criticCount={detailModal.game.critic_count}
            playtimeMinutes={detailModal.game.playtime_forever}
            lastPlayedAt={steamLastPlayed(detailModal.game)}
            deckCompat={detailModal.game.deck_compat}
            manual={manualGames.dialogProps(detailModal.game)}
            disablePlaying={hasPlayingGame}
          />
        )
      }
    >
      <PageHeader
        title="Diary"
        description={!loading && summaryText}
        actions={
          !loading && (
            <div className="flex items-center gap-6">
              {availableYears.length >= 2 && entries.length >= 5 && (
                <Dropdown
                  value={selectedYear}
                  onChange={setSelectedYear}
                  icon={<CalendarDays className="w-4 h-4" />}
                  aria-label="Filter by year"
                  options={[
                    { value: 'all', label: 'All time' },
                    ...availableYears.map((year) => ({ value: year, label: year })),
                  ]}
                />
              )}
            </div>
          )
        }
      />

      {loading ? (
        <DiaryListSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState icon={Trophy} title="No finished games yet">
          When you finish a game, it lands here with the date, your rating and any notes
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
                      <DiaryRow
                        key={entry.id}
                        entry={entry}
                        onEdit={handleOpenDetail}
                        onSaveNotes={handleSaveNotes}
                      />
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
                <DiaryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={handleOpenDetail}
                  onSaveNotes={handleSaveNotes}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
