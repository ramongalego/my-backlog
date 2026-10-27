'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Gamepad2, CalendarDays, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FIELD_LABEL, fieldClass } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { GAME_STATUSES, STATUS_STYLE, type GameStatus } from '@/lib/games/status-style';
import { todayIso, toLocalIsoDate } from '@/lib/diary/date-utils';

const DayPicker = dynamic(() => import('react-day-picker').then((mod) => mod.DayPicker), {
  ssr: false,
});
import { GameMetaRow } from './GameCardInfo';
import { GameArt } from './GameArt';
import { ConsolePicker } from './ConsolePicker';
import { ConsoleBadge } from './ConsoleBadge';

type InternalStatus = GameStatus | 'queue';

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
    /** Throws with a message to show if the game can't be added. */
    onAdd: (values: AddGameValues) => Promise<void>;
    onChangeGame: () => void;
  };
}

// Converts "YYYY-MM-DD" → Date (local time, no timezone shift)
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLabel(iso: string): string {
  return isoToDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_BUTTON =
  'cursor-pointer flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap';
const STATUS_IDLE = 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50';

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
  manual,
  adding,
}: GameDetailModalProps) {
  const today = todayIso();
  const initialHours = playtimeMinutes ? String(Math.round((playtimeMinutes / 60) * 10) / 10) : '';
  const [hours, setHours] = useState(initialHours);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [platform, setPlatform] = useState(adding?.defaultConsole ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [status, setStatus] = useState<InternalStatus>(initialStatus);
  const [hasDate, setHasDate] = useState(!!initialDate);
  const [date, setDate] = useState(initialDate || today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [rating, setRating] = useState<string>(initialRating != null ? String(initialRating) : '');
  const [ratingError, setRatingError] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // The API only stores date, rating and notes for finished/dropped games.
  const showDateField = status === 'finished' || status === 'dropped';
  const hadReview = !!initialNotes || initialRating != null;
  const clearsReview = hadReview && (status === 'wont_play' || status === 'hidden');
  const dateLabel = status === 'finished' ? 'Finished on' : 'Dropped on';
  const showHours = !!manual || !!adding;

  function handleStatusChange(next: InternalStatus) {
    setStatus(next);
    if (next === 'finished' || next === 'dropped') {
      setHasDate(true);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    // Capture phase so this runs before the modal's own Escape handler, which
    // skips events that were already handled.
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setCalendarOpen(false);
    }
    if (calendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [calendarOpen]);

  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    // Check every field before saving any of them, so a bad rating can't
    // leave the hours saved and the rest not.
    const parsedRating = showDateField && rating !== '' ? parseInt(rating, 10) : null;
    const ratingInvalid =
      parsedRating !== null && (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 10);
    setRatingError(ratingInvalid ? 'Rating must be between 0 and 10' : null);
    const parsedHours = hours.trim() === '' ? 0 : Number(hours);
    const hoursInvalid = showHours && !(parsedHours >= 0);
    setHoursError(hoursInvalid ? 'Hours played must be a number, like 12 or 3.5' : null);
    if (ratingInvalid || hoursInvalid) return;

    setSaving(true);
    setSaveError(null);
    try {
      if (adding) {
        await adding.onAdd({
          status: status as AddStatus,
          platform: platform.trim(),
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
      setSaveError((err as Error).message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
  }

  // When adding, the status buttons are the five places a new game can go;
  // otherwise every status, with Queue taking Playing's place while another
  // game is being played.
  const statusOptions: InternalStatus[] = adding
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
      {/* Hero image */}
      <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 h-44 overflow-hidden rounded-t-2xl">
        {headerLoading ? (
          <div className="w-full h-full bg-ink-800 animate-pulse" data-testid="header-loading" />
        ) : headerImage ? (
          <GameArt src={headerImage} alt="" sizes="(max-width: 640px) 100vw, 544px" priority />
        ) : (
          <div className="w-full h-full bg-ink-800 flex items-center justify-center">
            <Gamepad2 className="w-10 h-10 text-ink-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
        {/* The title runs along the bottom, so the console sits top-left here. */}
        {manual?.platform && (
          <div className="absolute top-3 left-4 sm:left-6">
            <ConsoleBadge platform={manual.platform} />
          </div>
        )}
        <h2 className="absolute bottom-2 left-4 sm:left-6 right-12 text-xl font-semibold tracking-tight text-ink-50 leading-tight line-clamp-2">
          {gameName}
        </h2>
      </div>

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
        {adding?.fromSteam && (
          <p className="text-sm text-ink-300">
            {adding.movedTo
              ? `It’s in your library on ${adding.movedTo}, from Steam. Adding it again moves it to the console you pick.`
              : 'It’s in your Steam library. Adding it here moves that entry to the console you pick, so the game is only listed once.'}
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
          <div>
            <label className={FIELD_LABEL} htmlFor="detail-hours">
              Hours played
              {manual?.platform ? ` on ${manual.platform}` : ''}
              {adding && <span className="text-ink-500 font-normal"> (optional)</span>}
            </label>
            <input
              id="detail-hours"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              value={hours}
              onChange={(e) => {
                setHours(e.target.value);
                setHoursError(null);
              }}
              placeholder="Not tracked"
              aria-invalid={hoursError ? true : undefined}
              aria-describedby={hoursError ? 'detail-hours-error' : undefined}
              className={`${fieldClass(!!hoursError)} px-3 py-2 text-sm`}
            />
            {hoursError && (
              <p id="detail-hours-error" className="text-rose-400 text-xs mt-1" role="alert">
                {hoursError}
              </p>
            )}
          </div>
        )}

        {/* Status pills */}
        <div>
          <p className="text-sm font-medium text-ink-300 mb-2" id="status-label">
            Status
          </p>
          <div
            role="group"
            aria-labelledby="status-label"
            className={`grid gap-2 grid-cols-3 ${
              statusOptions.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-6'
            }`}
          >
            {statusOptions.map((value) => {
              const isActive = status === value;
              if (value === 'queue') {
                return (
                  <button
                    key="queue"
                    type="button"
                    onClick={() => handleStatusChange('queue')}
                    aria-pressed={isActive}
                    className={`${STATUS_BUTTON} ${isActive ? STATUS_STYLE.playing.solid : STATUS_IDLE}`}
                  >
                    <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Queue</span>
                  </button>
                );
              }
              const opt = STATUS_STYLE[value];
              const Icon = opt.icon;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleStatusChange(value)}
                  aria-pressed={isActive}
                  className={`${STATUS_BUTTON} ${isActive ? opt.solid : STATUS_IDLE}`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
          {replacesPlaying && (
            <p className="mt-2 text-xs text-ink-400">
              {replacesPlaying} goes back to your backlog.
            </p>
          )}
        </div>

        {/* Date — only for finished/dropped */}
        {showDateField && (
          <div className="flex items-center gap-2.5">
            <input
              id="date-toggle"
              type="checkbox"
              checked={hasDate}
              onChange={(e) => {
                const checked = e.target.checked;
                setHasDate(checked);
                if (checked && !date) setDate(today);
                setCalendarOpen(false);
              }}
              className="w-4 h-4 rounded accent-accent-500 cursor-pointer shrink-0"
            />
            <label
              htmlFor="date-toggle"
              className="text-sm text-ink-300 cursor-pointer select-none shrink-0"
            >
              {hasDate ? dateLabel : 'No date selected'}
            </label>

            {hasDate && (
              <div className="relative" ref={calendarRef}>
                <button
                  type="button"
                  data-testid="detail-date"
                  onClick={() => setCalendarOpen((o) => !o)}
                  aria-expanded={calendarOpen}
                  className="cursor-pointer flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 rounded-lg px-2.5 py-1 text-sm text-ink-100 transition-colors"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-ink-400" />
                  <span>{formatDateLabel(date)}</span>
                </button>

                {calendarOpen && (
                  <div className="absolute left-0 top-full mt-2 sm:left-full sm:top-1/2 sm:-translate-y-1/2 sm:mt-0 sm:ml-2 z-50 bg-ink-800 border border-ink-700 rounded-xl shadow-2xl px-4 py-2">
                    <Suspense fallback={null}>
                      <DayPicker
                        mode="single"
                        captionLayout="dropdown"
                        startMonth={new Date(2000, 0)}
                        endMonth={new Date()}
                        selected={isoToDate(date)}
                        defaultMonth={isoToDate(date)}
                        onSelect={(day) => {
                          if (day) {
                            setDate(toLocalIsoDate(day));
                            setCalendarOpen(false);
                          }
                        }}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {clearsReview && (
          <p className="text-xs text-amber-400">
            Saving will clear the rating and notes for this game.
          </p>
        )}

        {showDateField && (
          <>
            {/* Rating */}
            <div>
              <label className={FIELD_LABEL} htmlFor="detail-rating">
                Your rating (0–10)
              </label>
              <input
                id="detail-rating"
                type="number"
                min={0}
                max={10}
                value={rating}
                onChange={(e) => {
                  setRating(e.target.value);
                  setRatingError(null);
                }}
                placeholder="Unrated"
                aria-invalid={ratingError ? true : undefined}
                aria-describedby={ratingError ? 'detail-rating-error' : undefined}
                className={`${fieldClass(!!ratingError)} px-3 py-2 text-sm`}
              />
              {ratingError && (
                <p id="detail-rating-error" className="text-rose-400 text-xs mt-1" role="alert">
                  {ratingError}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-ink-300" htmlFor="detail-notes">
                  Notes
                </label>
                {notes.length > 0 && (
                  <span
                    id="detail-notes-count"
                    className={`text-xs tabular-nums ${notes.length >= 1000 ? 'text-rose-400' : 'text-ink-500'}`}
                  >
                    {notes.length}/1000
                  </span>
                )}
              </div>
              <textarea
                id="detail-notes"
                aria-describedby={notes.length > 0 ? 'detail-notes-count' : undefined}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any thoughts?"
                rows={4}
                maxLength={1000}
                className={`${fieldClass()} px-3 py-2 text-sm resize-none`}
              />
            </div>
          </>
        )}

        {saveError && (
          <p className="text-sm text-rose-400" role="alert">
            {saveError}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
            className="flex-1 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            isLoading={saving}
            disabled={!!adding && !platform.trim()}
            aria-describedby={adding && !platform.trim() ? 'needs-console' : undefined}
            // With the console already known, Enter adds it straight away.
            data-autofocus={adding?.defaultConsole ? true : undefined}
            className="flex-1 cursor-pointer"
          >
            {adding
              ? adding.fromSteam
                ? saving
                  ? 'Moving…'
                  : platform.trim()
                    ? `Move to ${platform.trim()}`
                    : 'Move from Steam'
                : saving
                  ? 'Adding…'
                  : 'Add to library'
              : saving
                ? 'Saving…'
                : 'Save changes'}
          </Button>
        </div>
        {adding && !platform.trim() && (
          <p id="needs-console" className="-mt-3 text-xs text-ink-400 text-right">
            Pick the console you play it on
          </p>
        )}

        {manual?.onMoveToSteam &&
          (confirmingDelete ? (
            // Outlined rather than filled, so its (filled) button stands out.
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700 px-3 py-2.5">
              <p className="text-sm text-ink-200">
                Play it on Steam again? Steam&rsquo;s hours replace the ones you entered.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Keep
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    manual.onMoveToSteam?.();
                  }}
                >
                  Move to Steam
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="cursor-pointer mx-auto block text-sm text-ink-400 hover:text-ink-100 transition-colors"
            >
              Play on Steam instead
            </button>
          ))}

        {manual?.onDelete &&
          (confirmingDelete ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-800 px-3 py-2.5">
              <p className="text-sm text-ink-200">Remove it from your library?</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Keep
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    onClose();
                    manual.onDelete?.();
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="cursor-pointer mx-auto block text-sm text-ink-400 hover:text-rose-400 transition-colors"
            >
              Remove from library
            </button>
          ))}
      </div>
    </Modal>
  );
}
