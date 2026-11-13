'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ADD_STATUSES, GAME_STATUSES, type AddStatus, type GameStatus } from '@/lib/games/status';
import { todayIso } from '@/lib/diary/date-utils';
import { GameMetaRow } from './GameCardInfo';
import { ArtHeader } from './ArtHeader';
import { ConsolePicker } from './ConsolePicker';
import { ConsoleBadge } from './ConsoleBadge';
import { ReleaseBadge } from './ReleaseBadge';
import { isReleased, upcomingRelease } from '@/lib/games/release-date';
import { HoursField } from '@/components/games/detail/HoursField';
import { StatusPicker, type DetailStatus } from '@/components/games/detail/StatusPicker';
import { CompletionDateField } from '@/components/games/detail/CompletionDateField';
import { ReviewFields } from '@/components/games/detail/ReviewFields';
import { ManualGameActions } from '@/components/games/detail/ManualGameActions';
import { ArtPicker } from '@/components/games/detail/ArtPicker';
import { Tooltip } from '@/components/ui/Tooltip';

interface AddGameValues {
  status: AddStatus;
  platform: string;
  hours?: number;
  date: string;
  notes: string;
  rating: number | null;
}

/**
 * The game a dialog is about: what its header and summary row show. These are
 * the games table's column names, so a page passes the row it already has;
 * anything the row doesn't carry is simply not shown.
 */
interface DialogGame {
  name: string;
  header_image: string | null;
  main_story_hours?: number | null;
  steam_review_score?: number | null;
  steam_review_count?: number | null;
  critic_score?: number | null;
  critic_count?: number | null;
  /** Minutes played. Also what the hours field starts from, for a console game. */
  playtime_forever?: number;
  last_played_at?: string | null;
  deck_compat?: number | null;
  /** An unreleased game gets "Out Nov 5" in the header, beside its console. */
  release_date?: string | null;
}

interface GameDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (
    status: GameStatus,
    date: string,
    notes: string,
    rating: number | null,
  ) => void | Promise<void>;
  game: DialogGame;
  /** The header art isn't known yet: a placeholder holds its place. */
  headerLoading?: boolean;
  initialStatus: GameStatus;
  /**
   * The status the game has now, when the dialog opens on another one: Home's
   * and the Queue's Finish and Drop open it on Finished or Dropped, and that
   * is already a change to save.
   */
  savedStatus?: GameStatus;
  /**
   * The only statuses to offer, when it isn't all of them: Home's and the
   * Queue's Finish and Drop save one of those two and nothing else.
   */
  statuses?: readonly GameStatus[];
  initialDate?: string | null;
  initialNotes?: string | null;
  initialRating?: number | null;
  /**
   * Another game is being played (`name`). Playing then means playing this
   * one instead (`onPlayInstead`: the other goes to the top of the queue),
   * offered beside Queue; without `onPlayInstead`, Playing isn't offered.
   */
  playing?: { name: string | null; onPlayInstead?: () => void | Promise<void> };
  onAddToQueue?: () => void;
  /**
   * The game is in the playing queue: its status shows as Queue, and choosing
   * Backlog takes it off the queue (`onRemove`). Any other status takes it off
   * too, as the server does for every status but backlog.
   */
  queued?: { onRemove: () => void };
  /**
   * The game is in the library, so its art can be chosen: a button on the art
   * swaps the dialog's fields for the images to pick from.
   */
  art?: { gameId: number };
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

/** The dialog's props as a page's hook hands them over: everything but whether it's open. */
export type GameDialogProps = Omit<GameDetailModalProps, 'isOpen'>;

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
  game,
  headerLoading = false,
  initialStatus,
  savedStatus,
  statuses = GAME_STATUSES,
  initialDate,
  initialNotes,
  initialRating,
  playing,
  onAddToQueue,
  queued,
  art,
  manual,
  adding,
}: GameDetailModalProps) {
  const playtimeMinutes = game.playtime_forever;
  const releaseDate = game.release_date;
  const disablePlaying = !!playing;
  const onPlayInstead = playing?.onPlayInstead;
  const initialHours = playtimeMinutes ? String(Math.round((playtimeMinutes / 60) * 10) / 10) : '';
  const [hours, setHours] = useState(initialHours);
  const [platform, setPlatform] = useState(adding?.defaultConsole ?? '');
  const [status, setStatus] = useState<DetailStatus>(queued ? 'queue' : initialStatus);
  const [hasDate, setHasDate] = useState(!!initialDate);
  const [date, setDate] = useState(initialDate || todayIso());
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [rating, setRating] = useState<string>(initialRating != null ? String(initialRating) : '');
  // The fields as the dialog opened, to tell whether anything has changed.
  const [opened] = useState({ status, hasDate, date, notes, rating });

  // Choose art: the picker takes the fields' place. The header shows the pick
  // being looked at, then the art saved here, ahead of the page's own copy of
  // the game catching up.
  const [choosingArt, setChoosingArt] = useState(false);
  const [previewArt, setPreviewArt] = useState<string | null | undefined>(undefined);
  const [savedArt, setSavedArt] = useState<string | null | undefined>(undefined);
  const shownArt = savedArt !== undefined ? savedArt : game.header_image;
  const headerArt = choosingArt && previewArt !== undefined ? previewArt : shownArt;
  // A pick whose image hasn't arrived in the header yet.
  const [pendingArt, setPendingArt] = useState<string | null>(null);
  const previewPick = (url: string | null) => {
    // The same art as is showing loads nothing, so there's nothing to wait for.
    if (url !== headerArt) setPendingArt(url);
    setPreviewArt(url);
  };
  const artButton = useRef<HTMLButtonElement>(null);
  const wasChoosingArt = useRef(false);
  // Back from the picker, whose buttons are gone: focus returns to the button
  // that opened it.
  useEffect(() => {
    if (wasChoosingArt.current && !choosingArt) artButton.current?.focus();
    wasChoosingArt.current = choosingArt;
  }, [choosingArt]);
  const closeArtPicker = () => {
    setChoosingArt(false);
    setPreviewArt(undefined);
    setPendingArt(null);
  };

  // The API only stores date, rating and notes for finished/dropped games.
  const showDateField = status === 'finished' || status === 'dropped';
  const hadReview = !!initialNotes || initialRating != null;
  const clearsReview = hadReview && (status === 'wont_play' || status === 'hidden');
  const showHours = !!manual || !!adding;
  const pickedConsole = platform.trim();
  // Another game is being played and this one can be played instead.
  const switching = disablePlaying && !!onPlayInstead;

  // Save is only offered once something it would save has changed: the
  // status, a console game's hours, or a finished or dropped game's date,
  // rating and notes. (Art is saved by its own picker.) Adding a game is
  // always something to save.
  const statusChanged = status !== (queued ? 'queue' : (savedStatus ?? initialStatus));
  const hoursChanged = showHours && hours !== initialHours;
  const reviewChanged =
    showDateField &&
    (hasDate !== opened.hasDate ||
      (hasDate && date !== opened.date) ||
      notes !== opened.notes ||
      rating !== opened.rating);
  const changed = !!adding || statusChanged || hoursChanged || reviewChanged;

  function handleStatusChange(next: DetailStatus) {
    setStatus(next);
    // Back on the status the dialog opened on: its date as it was, so going
    // away and back is no change. A game newly finished or dropped gets
    // today's date ticked.
    if (next === opened.status) setHasDate(opened.hasDate);
    else if (next === 'finished' || next === 'dropped') setHasDate(true);
  }

  // A save on its way. The button shows it from the next redraw; this stops
  // a second click or Enter that lands before then from saving twice.
  const submitting = useRef(false);

  const [saveState, save, saving] = useActionState(async (): Promise<SaveState> => {
    try {
      return await saveFields();
    } finally {
      submitting.current = false;
    }
  }, {});

  async function saveFields(): Promise<SaveState> {
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
          // Already queued: nothing to change but the hours above.
          if (!queued) onAddToQueue?.();
        } else if (status === 'backlog' && queued) {
          queued.onRemove();
        } else if (status === 'playing' && switching) {
          await onPlayInstead?.();
        } else {
          await onConfirm?.(status, hasDate ? date : '', notes, parsedRating);
        }
      }
    } catch (err) {
      return { error: (err as Error).message };
    }
    onClose();
    return {};
  }

  const ratingError = saveState.rating?.value === rating ? saveState.rating.error : null;
  const hoursError = saveState.hours?.value === hours ? saveState.hours.error : null;

  // When adding, the status buttons are the five places a new game can go;
  // otherwise every status (or the ones the page asked for). While another game is being played, Playing
  // switches to this one (`switching`), and Queue sits beside it. A queued
  // game always has Queue, as its status. A game that isn't out yet can't be
  // started (unless it's the one playing).
  const canStart = isReleased(releaseDate) || initialStatus === 'playing';
  const statusOptions: DetailStatus[] = (
    adding
      ? [...ADD_STATUSES]
      : statuses.flatMap((value): DetailStatus[] =>
          value !== 'playing'
            ? [value]
            : [
                ...(queued || (disablePlaying && onAddToQueue) ? ['queue' as const] : []),
                ...(!disablePlaying || switching ? [value] : []),
              ],
        )
  ).filter((value) => value !== 'playing' || canStart);
  const replacesPlaying =
    status !== 'playing'
      ? null
      : adding
        ? adding.playingName
        : switching
          ? (playing?.name ?? null)
          : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      ariaLabel={adding ? `Add ${game.name}` : game.name}
      align={adding ? 'top' : 'center'}
    >
      {/* The title runs along the bottom, so the console sits top-left here. */}
      <ArtHeader
        src={headerArt}
        title={game.name}
        loading={headerLoading}
        artPending={pendingArt !== null}
        onArtSettled={() => setPendingArt(null)}
        action={
          art &&
          !adding &&
          !choosingArt && (
            <Tooltip content="Choose art">
              <button
                ref={artButton}
                type="button"
                onClick={() => setChoosingArt(true)}
                aria-label="Choose art"
                // The close button's twin: a dark disc, so it reads over any art.
                className="p-2 rounded-full bg-ink-950/60 text-ink-200 hover:bg-ink-950/85 hover:text-ink-50 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </Tooltip>
          )
        }
      >
        {(manual?.platform || upcomingRelease(releaseDate)) && (
          <>
            {manual?.platform && <ConsoleBadge platform={manual.platform} />}
            <ReleaseBadge releaseDate={releaseDate} />
          </>
        )}
      </ArtHeader>

      {choosingArt && art ? (
        <ArtPicker
          gameId={art.gameId}
          shown={shownArt}
          onPreview={previewPick}
          onDone={(saved) => {
            setSavedArt(saved);
            closeArtPicker();
          }}
          onCancel={closeArtPicker}
        />
      ) : adding ? (
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
            mainStoryHours={game.main_story_hours}
            steamReviewScore={game.steam_review_score}
            steamReviewCount={game.steam_review_count}
            criticScore={game.critic_score}
            criticCount={game.critic_count}
            playtimeMinutes={playtimeMinutes}
            // Only Steam's date is shown: with a console, the row leaves it out.
            lastPlayedAt={game.last_played_at}
            deckCompat={game.deck_compat}
            platform={manual?.platform}
          />
        </div>
      )}

      <div className="space-y-5 mt-4" hidden={choosingArt}>
        {/* A form, so Enter in a field saves. Not a form action: React resets
            a form after its action runs, and these fields are controlled. */}
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if ((adding && !pickedConsole) || !changed || submitting.current) return;
            submitting.current = true;
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
              disabled={(!!adding && !pickedConsole) || !changed}
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
