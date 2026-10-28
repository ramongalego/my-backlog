'use client';

import { startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { GAME_STATUSES, type GameStatus } from '@/lib/games/status-style';
import { todayIso } from '@/lib/diary/date-utils';
import { GameMetaRow } from './GameCardInfo';
import { ArtHeader } from './ArtHeader';
import { ConsolePicker } from './ConsolePicker';
import { ConsoleBadge } from './ConsoleBadge';
import { ReleaseBadge } from './ReleaseBadge';
import { upcomingRelease } from '@/lib/games/release-date';
import { HoursField } from './detail/HoursField';
import { StatusPicker, type DetailStatus } from './detail/StatusPicker';
import { CompletionDateField } from './detail/CompletionDateField';
import { ReviewFields } from './detail/ReviewFields';
import { ManualGameActions } from './detail/ManualGameActions';

/** Where a new game goes when it's added. */
export type AddStatus = 'backlog' | 'queue' | 'playing' | 'finished' | 'dropped';

export interface AddGameValues {
  status: AddStatus;
  platform: string;
  hours?: number;
  date: string;
  notes: string;
  rating: number | null;
}

// Adding offers where a game can go from outside the library; Won't Play and
// Hidden are for games already in it.
const ADD_STATUSES: AddStatus[] = ['backlog', 'queue', 'playing', 'finished', 'dropped'];

interface GameDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => void | Promise<void>;
  gameName: string;
  headerImage: string | null;
  /** The header art isn't known yet: a placeholder holds its place. */
  headerLoading?: boolean;
  initialStatus: GameStatus;
  initialDate?: string | null;
  initialNotes?: string | null;
  initialRating?: number | null;
  disablePlaying?: boolean;
  onAddToQueue?: () => void;
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  criticScore?: number | null;
  criticCount?: number | null;
  playtimeMinutes?: number;
  lastPlayedAt?: string | null;
  deckCompat?: number | null;
  /** An unreleased game gets "Out Nov 5" in the header, beside its console. */
  releaseDate?: string | null;
  /** For games added by hand: their console, hours played you enter, and removal. */
  manual?: {
    platform: string | null;
    onSaveHours: (hours: number) => void | Promise<void>;
    /** Games added by hand can be removed... */
    onDelete?: () => void;
    /** ...and Steam games moved to a console can go back to Steam. */
    onMoveToSteam?: () => void;
  };
  /**
   * Adding a game that isn't in the library yet: the same dialog, with the
   * console to pick and "Add to library" as its action.
   */
  adding?: {
    /** The game's consoles, best guess first (orderConsoles). */
    consoles: string[];
    defaultConsole: string;
    year: number | null;
    /** The game being played now, which starting this one would replace. */
    playingName: string | null;
    /** You own it on Steam: adding moves that entry to the console instead. */
    fromSteam?: boolean;
    /** The console that Steam entry was already moved to, if any. */
    movedTo?: string | null;
    /** You added it by hand on this console: adding it again moves it, or just saves. */
    inLibraryOn?: string | null;
    /** Throws with a message to show if the game can't be added. */
    onAdd: (values: AddGameValues) => Promise<void>;
    onChangeGame: () => void;
  };
}

/**
 * What the last save attempt found. A field's error carries the value it was
 * about, so it shows until that field is changed.
 */
interface SaveState {
  rating?: { error: string; value: string };
  hours?: { error: string; value: string };
  /** The save itself failed (e.g. a game that couldn't be added). */
  error?: string;
}

/** The save button's label: what saving will do, and that it's doing it. */
function submitLabel(adding: GameDetailModalProps['adding'], platform: string, saving: boolean) {
  const moving =
    !!adding &&
    (!!adding.fromSteam || (!!adding.inLibraryOn && !!platform && platform !== adding.inLibraryOn));
  if (moving) return saving ? 'Moving…' : platform ? `Move to ${platform}` : 'Move from Steam';
  if (adding && !adding.inLibraryOn) return saving ? 'Adding…' : 'Add to library';
  return saving ? 'Saving…' : 'Save changes';
}

export function GameDetailModal({
  isOpen,
  onClose,
  onConfirm,
  gameName,
  headerImage,
  headerLoading = false,
  initialStatus,
  initialDate,
  initialNotes,
  initialRating,
  disablePlaying = false,
  onAddToQueue,
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  criticScore,
  criticCount,
  playtimeMinutes,
  lastPlayedAt,
  deckCompat,
  releaseDate,
  manual,
  adding,
}: GameDetailModalProps) {
  const initialHours = playtimeMinutes ? String(Math.round((playtimeMinutes / 60) * 10) / 10) : '';
  const [hours, setHours] = useState(initialHours);
  const [platform, setPlatform] = useState(adding?.defaultConsole ?? '');
  const [status, setStatus] = useState<DetailStatus>(initialStatus);
  const [hasDate, setHasDate] = useState(!!initialDate);
  const [date, setDate] = useState(initialDate || todayIso());
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [rating, setRating] = useState<string>(initialRating != null ? String(initialRating) : '');

  // The API only stores date, rating and notes for finished/dropped games.
  const showDateField = status === 'finished' || status === 'dropped';
  const hadReview = !!initialNotes || initialRating != null;
  const clearsReview = hadReview && (status === 'wont_play' || status === 'hidden');
  const showHours = !!manual || !!adding;
  const pickedConsole = platform.trim();

  function handleStatusChange(next: DetailStatus) {
    setStatus(next);
    if (next === 'finished' || next === 'dropped') setHasDate(true);
  }

  const [saveState, save, saving] = useActionState(async (): Promise<SaveState> => {
    // Check every field before saving any of them, so a bad rating can't
    // leave the hours saved and the rest not.
    const parsedRating = showDateField && rating !== '' ? parseInt(rating, 10) : null;
    const ratingInvalid =
      parsedRating !== null && (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 10);
    const parsedHours = hours.trim() === '' ? 0 : Number(hours);
    const hoursInvalid = showHours && !(parsedHours >= 0);
    if (ratingInvalid || hoursInvalid) {
      return {
        rating: ratingInvalid
          ? { error: 'Rating must be between 0 and 10', value: rating }
          : undefined,
        hours: hoursInvalid
          ? { error: 'Hours played must be a number, like 12 or 3.5', value: hours }
          : undefined,
      };
    }

    try {
      if (adding) {
        await adding.onAdd({
          status: status as AddStatus,
          platform: pickedConsole,
          hours: hours.trim() === '' ? undefined : parsedHours,
          date: showDateField && hasDate ? date : '',
          notes,
          rating: parsedRating,
        });
      } else {
        if (manual && hours !== initialHours) await manual.onSaveHours(parsedHours);
        if (status === 'queue') {
          onAddToQueue?.();
        } else {
          await onConfirm?.(status, hasDate ? date : '', notes, parsedRating);
        }
      }
    } catch (err) {
      return { error: (err as Error).message };
    }
    onClose();
    return {};
  }, {});

  const ratingError = saveState.rating?.value === rating ? saveState.rating.error : null;
  const hoursError = saveState.hours?.value === hours ? saveState.hours.error : null;

  // When adding, the status buttons are the five places a new game can go;
  // otherwise every status, with Queue taking Playing's place while another
  // game is being played.
  const statusOptions: DetailStatus[] = adding
    ? ADD_STATUSES
    : GAME_STATUSES.flatMap((value) =>
        value === 'playing' && disablePlaying ? (onAddToQueue ? ['queue' as const] : []) : [value],
      );
  const replacesPlaying = !!adding?.playingName && status === 'playing' ? adding.playingName : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      ariaLabel={adding ? `Add ${gameName}` : gameName}
      align={adding ? 'top' : 'center'}
    >
      {/* The title runs along the bottom, so the console sits top-left here. */}
      <ArtHeader src={headerImage} title={gameName} loading={headerLoading}>
        {(manual?.platform || upcomingRelease(releaseDate)) && (
          <>
            {manual?.platform && <ConsoleBadge platform={manual.platform} />}
            <ReleaseBadge releaseDate={releaseDate} />
          </>
        )}
      </ArtHeader>

      {adding ? (
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-400">
          {adding.year && <span className="tabular-nums">{adding.year}</span>}
          {adding.year && <span aria-hidden="true">·</span>}
          <button
            type="button"
            onClick={adding.onChangeGame}
            className="cursor-pointer text-ink-300 underline decoration-ink-600 underline-offset-4 hover:text-ink-50"
          >
            Not this game?
          </button>
        </div>
      ) : (
        <div className="mt-1">
          <GameMetaRow
            mainStoryHours={mainStoryHours}
            steamReviewScore={steamReviewScore}
            steamReviewCount={steamReviewCount}
            criticScore={criticScore}
            criticCount={criticCount}
            playtimeMinutes={playtimeMinutes}
            lastPlayedAt={lastPlayedAt}
            deckCompat={deckCompat}
            platform={manual?.platform}
          />
        </div>
      )}

      <div className="space-y-5 mt-4">
        {/* A form, so Enter in a field saves. Not a form action: React resets
            a form after its action runs, and these fields are controlled. */}
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (adding && !pickedConsole) return;
            startTransition(save);
          }}
        >
          {adding?.fromSteam && (
            <p className="text-sm text-ink-300">
              {adding.movedTo
                ? `It’s in your library on ${adding.movedTo}, from Steam. Adding it again moves it to the console you pick.`
                : 'It’s in your Steam library. Adding it here moves that entry to the console you pick, so the game is only listed once.'}
            </p>
          )}
          {adding?.inLibraryOn && (
            <p className="text-sm text-ink-300">
              {`It’s in your library on ${adding.inLibraryOn}. Pick another console to move it there, so the game is only listed once.`}
            </p>
          )}
          {adding && (
            <ConsolePicker
              ordered={adding.consoles}
              value={platform}
              onChange={setPlatform}
              autoFocus={!adding.defaultConsole}
            />
          )}

          {showHours && (
            <HoursField
              value={hours}
              onChange={setHours}
              error={hoursError}
              platform={manual?.platform}
              optional={!!adding}
            />
          )}

          <StatusPicker
            options={statusOptions}
            value={status}
            onChange={handleStatusChange}
            replacesPlaying={replacesPlaying}
          />

          {showDateField && (
            <CompletionDateField
              label={status === 'finished' ? 'Finished on' : 'Dropped on'}
              hasDate={hasDate}
              onHasDateChange={setHasDate}
              date={date}
              onDateChange={setDate}
            />
          )}

          {clearsReview && (
            <p className="text-xs text-amber-400">
              Saving will clear the rating and notes for this game.
            </p>
          )}

          {showDateField && (
            <ReviewFields
              rating={rating}
              onRatingChange={setRating}
              ratingError={ratingError}
              notes={notes}
              onNotesChange={setNotes}
            />
          )}

          {saveState.error && !saving && (
            <p className="text-sm text-rose-400" role="alert">
              {saveState.error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={saving}
              disabled={!!adding && !pickedConsole}
              aria-describedby={adding && !pickedConsole ? 'needs-console' : undefined}
              // With the console already known, Enter adds it straight away.
              data-autofocus={adding?.defaultConsole ? true : undefined}
              className="flex-1 cursor-pointer"
            >
              {submitLabel(adding, pickedConsole, saving)}
            </Button>
          </div>
          {adding && !pickedConsole && (
            <p id="needs-console" className="-mt-3 text-xs text-ink-400 text-right">
              Pick the console you play it on
            </p>
          )}
        </form>

        {manual && (
          <ManualGameActions
            onMoveToSteam={manual.onMoveToSteam}
            onDelete={manual.onDelete}
            onClose={onClose}
          />
        )}
      </div>
    </Modal>
  );
}
