'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { chipClass } from '@/components/ui/ToggleGroup';
import { PAGE_CONTAINER } from '@/components/layout/Page';
import { BULK_STATUSES, type BulkStatus } from '@/lib/games/status';
import { STATUS_STYLE } from '@/lib/games/status-style';

const QUIET_BUTTON =
  'h-8 cursor-pointer rounded-lg px-2.5 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50 disabled:pointer-events-none';

/** Moving is two steps, pick a status then press Move, so nothing moves by a stray click. */
export function GamesBulkBar({
  count,
  total,
  onSelectAll,
  onClear,
  moves,
  reviewsCleared,
  onMove,
  pending,
  onClose,
}: {
  count: number;
  /** Games the page lists that can be ticked. */
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** The ticked games not already in that status. */
  moves: (status: BulkStatus) => number;
  reviewsCleared: (status: BulkStatus) => number;
  onMove: (status: BulkStatus) => void;
  pending: boolean;
  onClose: () => void;
}) {
  // Kept while it would move nothing, so it counts again once a game it would move is ticked.
  const [chosen, setChosen] = useState<BulkStatus | null>(null);
  // With nothing ticked, every status can be picked ahead of the games.
  const pointless = (status: BulkStatus) => count > 0 && moves(status) === 0;
  const target = chosen && !pointless(chosen) ? chosen : null;
  const bar = useRef<HTMLDivElement>(null);

  // Lets toasts (a move's Undo) sit above the bar, not over it (globals.css).
  useEffect(() => {
    const element = bar.current;
    if (!element) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--bulk-bar', `${element.offsetHeight}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--bulk-bar');
    };
  }, []);

  // An open dialog or menu takes the Escape, but has usually closed by the time
  // the key gets here, so whether one was open is noted in the capture phase.
  useEffect(() => {
    let overlayOpen = false;
    const onKeyDownFirst = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        overlayOpen = !!document.querySelector('[role="dialog"], [role="listbox"]');
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !overlayOpen && !e.defaultPrevented) onClose();
    };
    document.addEventListener('keydown', onKeyDownFirst, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDownFirst, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // The pick stays during the save: the page closes Select mode once it's saved,
  // and on failure the bar is as it was, to try again.
  const move = () => {
    if (target) onMove(target);
  };

  const cleared = target && count > 0 ? reviewsCleared(target) : 0;

  return (
    <div
      ref={bar}
      role="region"
      aria-label="Selected games"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-800 bg-ink-900 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.7)]"
    >
      {/* Below lg the move controls take their own line; the close button stays on the first. */}
      <div className={`${PAGE_CONTAINER} flex flex-wrap items-center gap-y-3 py-3`}>
        <div className="order-1 flex items-center gap-1">
          <p className="mr-2 text-sm text-ink-300" aria-live="polite">
            <span className="font-semibold text-ink-50">{count}</span> selected
          </p>
          {count < total && (
            <button type="button" onClick={onSelectAll} disabled={pending} className={QUIET_BUTTON}>
              Select all {total}
            </button>
          )}
          {count > 0 && (
            <button type="button" onClick={onClear} disabled={pending} className={QUIET_BUTTON}>
              Clear
            </button>
          )}
        </div>

        <div className="order-3 flex basis-full flex-wrap items-center gap-3 lg:order-2 lg:ml-auto lg:basis-auto">
          <div role="group" aria-label="Move to" className="flex flex-wrap items-center gap-1.5">
            {BULK_STATUSES.map((status) => {
              const picked = target === status;
              const unavailable = pointless(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={picked}
                  disabled={pending || unavailable}
                  onClick={() => setChosen(picked ? null : status)}
                  className={`${chipClass(picked)} disabled:cursor-default ${
                    unavailable ? 'opacity-40 hover:bg-ink-800 hover:text-ink-300' : ''
                  }`}
                >
                  {STATUS_STYLE[status].label}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={move}
            disabled={!target || count === 0}
            isLoading={pending}
            className="h-10 basis-full cursor-pointer px-5 sm:h-8 sm:basis-auto"
          >
            {pending ? 'Moving…' : 'Move'}
          </Button>
        </div>

        <span className="order-4 mx-3 hidden h-5 w-px bg-ink-700 lg:block" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close selection"
          className="order-2 ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50 lg:order-5 lg:ml-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {target && cleared > 0 && (
          // Ends where Move does: clear of the hairline (25px with its margins) and close (32px).
          <p
            className="order-6 basis-full text-xs text-amber-400 lg:pr-[57px] lg:text-right"
            role="status"
          >
            {cleared === count
              ? count === 1
                ? 'It has'
                : count === 2
                  ? 'Both have'
                  : `All ${count} have`
              : `${cleared} of these ${cleared === 1 ? 'has' : 'have'}`}{' '}
            a rating or notes. Moving to {STATUS_STYLE[target].label} clears them.
          </p>
        )}
      </div>
    </div>
  );
}
