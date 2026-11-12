'use client';

import { Trophy, CalendarDays } from 'lucide-react';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
import { useDiaryPage } from '@/hooks/useDiaryPage';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { DiaryListSkeleton } from './Skeleton';
import { EmptyStateSkeleton } from '@/components/layout/Skeleton';
import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';
import { useAuth } from '@/hooks/useAuth';
import { useManualGameActions } from '@/hooks/useManualGameActions';
import { monthName } from '@/lib/diary/date-utils';
import { ALL_YEARS } from '@/lib/diary/timeline';
import { DiaryRow } from '@/components/diary/DiaryRow';

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
    selectedYear,
    setSelectedYear,
    timeline,
  } = useDiaryPage();
  const libraryMeta = useCachedLibraryMeta();
  const { user } = useAuth();
  const manualGames = useManualGameActions(user?.id ?? null);

  return (
    <Page
      overlay={
        detailModal && (
          <GameDetailModal
            isOpen={true}
            onClose={handleCloseDetail}
            onConfirm={handleConfirmDetail}
            game={detailModal.game}
            initialStatus={detailModal.initialStatus}
            initialDate={detailModal.initialDate}
            initialNotes={detailModal.initialNotes}
            initialRating={detailModal.initialRating}
            manual={manualGames.dialogProps(detailModal.game)}
            playing={
              hasPlayingGame ? { name: playingName, onPlayInstead: handlePlayInstead } : undefined
            }
          />
        )
      }
    >
      <PageHeader
        title="Diary"
        description={!loading && !loadError && timeline.summary}
        actions={
          !loading &&
          !loadError && (
            <div className="flex items-center gap-6">
              {timeline.years.length >= 2 && entries.length >= 5 && (
                <Dropdown
                  value={selectedYear}
                  onChange={setSelectedYear}
                  icon={<CalendarDays className="w-4 h-4" />}
                  aria-label="Filter by year"
                  options={[
                    { value: ALL_YEARS, label: 'All time' },
                    ...timeline.years.map((year) => ({ value: year, label: year })),
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
          {timeline.groups.map((yg, yi) => (
            <div key={yg.year}>
              {selectedYear === ALL_YEARS && (
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
                      className={`text-sm font-medium text-ink-300 pb-1 ${selectedYear !== ALL_YEARS && yi === 0 ? 'pt-2' : 'pt-6'}`}
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
          {timeline.undated.length > 0 && (
            <div className="mt-12">
              <SectionLabel className="pb-2 border-b border-ink-800">No date</SectionLabel>
              {timeline.undated.map((entry) => (
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
