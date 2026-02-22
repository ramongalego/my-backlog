'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Gamepad2, Check, X, EyeOff, Archive } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

type GameStatus = 'backlog' | 'finished' | 'dropped' | 'hidden';

interface GameDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: string, date: string, notes: string, rating: number | null) => void;
  gameName: string;
  headerImage: string | null;
  initialStatus: GameStatus;
  initialDate?: string | null;
  initialNotes?: string | null;
  initialRating?: number | null;
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
    value: 'finished',
    label: 'Finished',
    icon: <Check className="w-3.5 h-3.5" />,
    activeClass: 'bg-emerald-600 text-white border-emerald-600',
  },
  {
    value: 'dropped',
    label: 'Dropped',
    icon: <X className="w-3.5 h-3.5" />,
    activeClass: 'bg-zinc-600 text-white border-zinc-500',
  },
  {
    value: 'hidden',
    label: 'Hidden',
    icon: <EyeOff className="w-3.5 h-3.5" />,
    activeClass: 'bg-zinc-700 text-white border-zinc-600',
  },
];

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
}: GameDetailModalProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [status, setStatus] = useState<GameStatus>(initialStatus);
  const [date, setDate] = useState(initialDate ?? today);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [rating, setRating] = useState<string>(initialRating != null ? String(initialRating) : '');

  const showDateField = status === 'finished' || status === 'dropped';
  const dateLabel = status === 'finished' ? 'Finished on' : 'Dropped on';

  function handleConfirm() {
    const parsedRating = rating !== '' ? parseInt(rating, 10) : null;
    onConfirm(status, date, notes, parsedRating);
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
        {/* Gradient overlay so title reads cleanly */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
        <h2 className="absolute bottom-3 left-6 right-12 text-xl font-bold text-white leading-tight line-clamp-2">
          {gameName}
        </h2>
      </div>

      <div className="space-y-5 mt-5">
        {/* Status pills */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2.5">Status</p>
          <div className="grid grid-cols-4 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`cursor-pointer flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border text-xs font-medium transition-colors ${
                  status === opt.value
                    ? opt.activeClass
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date — only for finished/dropped */}
        {showDateField && (
          <div>
            <label
              className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5"
              htmlFor="detail-date"
            >
              {dateLabel}
            </label>
            <input
              id="detail-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500"
            />
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
            onChange={(e) => setRating(e.target.value)}
            placeholder="Unrated"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
          />
        </div>

        {/* Notes */}
        <div>
          <label
            className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5"
            htmlFor="detail-notes"
          >
            Notes
          </label>
          <textarea
            id="detail-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any thoughts?"
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleConfirm}
            className="cursor-pointer flex-1 py-2 px-4 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Save Changes
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
