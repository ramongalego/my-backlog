'use client';

import { Trophy, CalendarDays } from 'lucide-react';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
import { useDiaryPage } from '@/hooks/useDiaryPage';
import { useUrlState } from '@/hooks/useUrlState';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { DiaryListSkeleton } from './Skeleton';
import { EmptyStateSkeleton } from '@/components/layout/Skeleton';
import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';
import type { DiaryEntry } from '@/hooks/useDiaryPage';
import { steamLastPlayed } from '@/lib/games/consoles';
import { useAuth } from '@/hooks/useAuth';
import { useManualGameActions } from '@/hooks/useManualGameActions';
import { getMonthKey, monthName } from '@/lib/diary/date-utils';
import { DiaryRow } from '@/components/diary/DiaryRow';

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
    loadError,
    retry,
    hasPlayingGame,
    detailModal,
    handleOpenDetail,
    handleCloseDetail,
    handleConfirmDetail,
    handlePlayInstead,
    playingName,
    handleSaveNotes,
  } = useDiaryPage();
  const libraryMeta = useCachedLibraryMeta();
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
    // Counted like the Games page, so an empty diary reads "0 games finished"
    // rather than repeating the empty state below it.
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
            onPlayInstead={handlePlayInstead}
            playingName={playingName}
          />
        )
      }
    >
      <PageHeader
        title="Diary"
        description={!loading && !loadError && summaryText}
        actions={
          !loading &&
          !loadError && (
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
        libraryMeta?.finishedCount === 0 ? (
          <EmptyStateSkeleton action={false} />
        ) : (
          <DiaryListSkeleton />
        )
      ) : loadError ? (
        <LoadError what="your diary" onRetry={retry} />
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
