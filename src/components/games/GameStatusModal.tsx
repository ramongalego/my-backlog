'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  Gamepad2,
  Check,
  X,
  EyeOff,
  Archive,
  Play,
  CalendarDays,
  ListOrdered,
  Loader2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

const DayPicker = dynamic(() => import('react-day-picker').then((mod) => mod.DayPicker), {
  ssr: false,
});
import { GameMetaRow } from './GameCardInfo';

type GameStatus = 'backlog' | 'playing' | 'finished' | 'dropped' | 'hidden';
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

const STATUS_OPTIONS: {
  value: GameStatus;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
}[] = [
  {
    value: 'backlog',
    label: 'Backlog',
    icon: <Archive className="w-3.5 h-3.5" />,
    activeClass: 'bg-violet-600 text-white border-violet-600',
  },
  {
    value: 'playing',
    label: 'Playing',
    icon: <Play className="w-3.5 h-3.5" />,
    activeClass: 'bg-sky-600 text-white border-sky-600',
  },
  {
    value: 'finished',
    label: 'Finished',
    icon: <Check className="w-3.5 h-3.5" />,
    activeClass: 'bg-emerald-600 text-white border-emerald-600',
  },
  {
    value: 'dropped',
    label: 'Dropped',
    icon: <X className="w-3.5 h-3.5" />,
    activeClass: 'bg-rose-600 text-white border-rose-600',
  },
  {
    value: 'hidden',
    label: 'Hidden',
    icon: <EyeOff className="w-3.5 h-3.5" />,
    activeClass: 'bg-zinc-700 text-white border-zinc-600',
  },
];

// Converts "YYYY-MM-DD" → Date (local time, no timezone shift)
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Converts Date → "YYYY-MM-DD"
function dateToIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
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
  const today = new Date().toISOString().slice(0, 10);

  const [status, setStatus] = useState<InternalStatus>(initialStatus);
  const [hasDate, setHasDate] = useState(!!initialDate);
  const [date, setDate] = useState(initialDate || today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [rating, setRating] = useState<string>(initialRating != null ? String(initialRating) : '');
  const [ratingError, setRatingError] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const showDateField = status === 'finished' || status === 'dropped';
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
    if (calendarOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {/* Hero image */}
      <div className="relative -mx-6 -mt-6 h-44 overflow-hidden rounded-t-2xl">
        {headerImage ? (
          <Image
            src={headerImage}
            alt={gameName}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Gamepad2 className="w-10 h-10 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
        <h2 className="absolute bottom-2 left-6 right-12 text-xl font-bold text-white leading-tight line-clamp-2">
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
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2.5">Status</p>
          <div
            className={`grid gap-2 ${disablePlaying && !onAddToQueue ? 'grid-cols-4' : 'grid-cols-5'}`}
          >
            {STATUS_OPTIONS.map((opt) => {
              // Replace the Playing slot with Queue (or nothing) when playing is disabled
              if (opt.value === 'playing' && disablePlaying) {
                if (!onAddToQueue) return null;
                const isActive = status === 'queue';
                return (
                  <button
                    key="queue"
                    onClick={() => handleStatusChange('queue')}
                    className={`cursor-pointer flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    Queue
                  </button>
                );
              }
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`cursor-pointer flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border text-xs font-medium transition-colors ${
                    status === opt.value
                      ? opt.activeClass
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
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
              className="w-4 h-4 rounded accent-violet-500 cursor-pointer shrink-0"
            />
            <label
              htmlFor="date-toggle"
              className="text-sm text-zinc-300 cursor-pointer select-none shrink-0"
            >
              {hasDate ? dateLabel : 'No date selected'}
            </label>

            {hasDate && (
              <div className="relative" ref={calendarRef}>
                <button
                  data-testid="detail-date"
                  onClick={() => setCalendarOpen((o) => !o)}
                  className="cursor-pointer flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded-lg px-2.5 py-1 text-sm text-zinc-100 transition-colors"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-zinc-400" />
                  {formatDateLabel(date)}
                </button>

                {calendarOpen && (
                  <div className="absolute left-0 top-full mt-2 sm:left-full sm:top-1/2 sm:-translate-y-1/2 sm:mt-0 sm:ml-2 z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl px-4 py-2">
                    <DayPicker
                      mode="single"
                      captionLayout="dropdown"
                      startMonth={new Date(2000, 0)}
                      endMonth={new Date()}
                      selected={isoToDate(date)}
                      defaultMonth={isoToDate(date)}
                      onSelect={(day) => {
                        if (day) {
                          setDate(dateToIso(day));
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

        {/* Rating */}
        <div>
          <label
            className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5"
            htmlFor="detail-rating"
          >
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
            className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none placeholder:text-zinc-600 ${ratingError ? 'border-rose-500 focus:border-rose-500' : 'border-zinc-700 focus:border-zinc-500'}`}
          />
          {ratingError && <p className="text-rose-400 text-xs mt-1">{ratingError}</p>}
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              className="text-xs text-zinc-500 uppercase tracking-wider"
              htmlFor="detail-notes"
            >
              Notes
            </label>
            {notes.length > 0 && (
              <span
                className={`text-xs ${notes.length >= 1000 ? 'text-rose-400' : 'text-zinc-600'}`}
              >
                {notes.length}/1000
              </span>
            )}
          </div>
          <textarea
            id="detail-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any thoughts?"
            rows={4}
            maxLength={1000}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="cursor-pointer flex-1 py-2 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
