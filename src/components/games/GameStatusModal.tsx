'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Gamepad2, CalendarDays, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FIELD_LABEL, fieldClass } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { GAME_STATUSES, STATUS_STYLE, type GameStatus } from '@/lib/games/status-style';
import { todayIso, toLocalIsoDate } from '@/lib/diary/date-utils';

import 'react-day-picker/style.css';
const DayPicker = dynamic(() => import('react-day-picker').then((mod) => mod.DayPicker), {
  ssr: false,
});
import { GameMetaRow } from './GameCardInfo';

type InternalStatus = GameStatus | 'queue';

interface GameDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => void | Promise<void>;
  gameName: string;
  headerImage: string | null;
  initialStatus: GameStatus;
  initialDate?: string | null;
  initialNotes?: string | null;
  initialRating?: number | null;
  disablePlaying?: boolean;
  onAddToQueue?: () => void;
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  playtimeMinutes?: number;
  deckCompat?: number | null;
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

export function GameDetailModal({
  isOpen,
  onClose,
  onConfirm,
  gameName,
  headerImage,
  initialStatus,
  initialDate,
  initialNotes,
  initialRating,
  disablePlaying = false,
  onAddToQueue,
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  playtimeMinutes,
  deckCompat,
}: GameDetailModalProps) {
  const today = todayIso();

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
    if (status === 'queue') {
      onAddToQueue?.();
      onClose();
      return;
    }
    const parsedRating = rating !== '' ? parseInt(rating, 10) : null;
    if (parsedRating !== null && (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 10)) {
      setRatingError('Rating must be between 0 and 10');
      return;
    }
    setRatingError(null);
    setSaving(true);
    try {
      await onConfirm(status, hasDate ? date : '', notes, parsedRating);
    } finally {
      setSaving(false);
    }
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" ariaLabel={gameName}>
      {/* Hero image */}
      <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 h-44 overflow-hidden rounded-t-2xl">
        {headerImage ? (
          <Image
            src={headerImage}
            alt={gameName}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
        ) : (
          <div className="w-full h-full bg-ink-800 flex items-center justify-center">
            <Gamepad2 className="w-10 h-10 text-ink-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
        <h2 className="absolute bottom-2 left-4 sm:left-6 right-12 text-xl font-semibold tracking-tight text-ink-50 leading-tight line-clamp-2">
          {gameName}
        </h2>
      </div>

      <div className="mt-1">
        <GameMetaRow
          mainStoryHours={mainStoryHours}
          steamReviewScore={steamReviewScore}
          steamReviewCount={steamReviewCount}
          playtimeMinutes={playtimeMinutes}
          deckCompat={deckCompat}
        />
      </div>

      <div className="space-y-5 mt-4">
        {/* Status pills */}
        <div>
          <p className="text-sm font-medium text-ink-300 mb-2">Status</p>
          <div
            className={`grid gap-2 grid-cols-3 ${
              disablePlaying && !onAddToQueue ? 'sm:grid-cols-5' : 'sm:grid-cols-6'
            }`}
          >
            {GAME_STATUSES.map((value) => {
              const opt = { value, ...STATUS_STYLE[value] };
              const Icon = opt.icon;
              // Replace the Playing slot with Queue (or nothing) when playing is disabled
              if (opt.value === 'playing' && disablePlaying) {
                if (!onAddToQueue) return null;
                const isActive = status === 'queue';
                return (
                  <button
                    key="queue"
                    onClick={() => handleStatusChange('queue')}
                    aria-pressed={isActive}
                    className={`cursor-pointer flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? STATUS_STYLE.playing.solid
                        : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50'
                    }`}
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    <span>Queue</span>
                  </button>
                );
              }
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  aria-pressed={status === opt.value}
                  className={`cursor-pointer flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    status === opt.value
                      ? opt.solid
                      : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
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
          <Button onClick={handleConfirm} isLoading={saving} className="flex-1 cursor-pointer">
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
