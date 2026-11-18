'use client';

import { useEffect, useEffectEvent, useId, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  title?: string;
  /** Accessible name for dialogs that render their own heading instead of `title`. */
  ariaLabel?: string;
  /** Id of a heading inside the content that names the dialog, when it renders its own. */
  labelledBy?: string;
  size?: 'md' | 'lg' | 'xl' | '3xl';
  /**
   * `top` pins the dialog near the top so it grows downward, for content that
   * changes height as you use it (search results); centered dialogs re-center
   * and move under the pointer.
   */
  align?: 'center' | 'top';
  /**
   * Renders the children without the panel, title or close button, for a dialog
   * that draws its own (the Add game quick search).
   */
  bare?: boolean;
  /**
   * Opens with focus on the title, so a phone's keyboard or a saved-password list
   * doesn't open before the form is read. Tab goes on to the first field.
   */
  startOnTitle?: boolean;
  /** Plays a bare dialog's exit; the parent unmounts it once that's done. */
  closing?: boolean;
  /**
   * Called on close when the dialog's opener is no longer on the page, so the
   * parent can place focus instead of letting it fall back to the page.
   */
  onOpenerGone?: () => void;
}

// xl is a nudge wider than lg (32rem), so a 6-column status grid has room.
const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-[34rem]',
  // The favorites picker's grid of game art.
  '3xl': 'max-w-3xl',
};

// Disabled controls and hidden inputs are left out: the browser skips them, so
// counting one as the last stop would let Tab walk out instead of wrapping.
const FOCUSABLE = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  ariaLabel,
  labelledBy,
  size = 'md',
  align = 'center',
  bare = false,
  startOnTitle = false,
  closing = false,
  onOpenerGone,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Read through an effect event so a new onClose identity on each parent
  // render doesn't re-run the open/close effect (which would steal focus).
  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    // Nested popovers (e.g. the date picker) handle their own Escape first.
    if (e.key === 'Escape' && !e.defaultPrevented) {
      onClose?.();
      return;
    }

    if (e.key !== 'Tab' || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus is outside the dialog (the button that had it was disabled while
    // saving, say): bring it back in rather than tab through the page behind.
    if (!dialogRef.current.contains(document.activeElement)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  const openerGone = useEffectEvent(() => onOpenerGone?.());

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    // Opened with a click: focus goes back to the button on close, but
    // without the keyboard focus ring that closing with Escape would draw.
    const openedByPointer = !!previousFocus && !previousFocus.matches(':focus-visible');
    document.body.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      (
        dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
        dialog?.querySelector<HTMLElement>(FOCUSABLE)
      )?.focus();
    });

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousFocus?.isConnected) {
        previousFocus.focus({ focusVisible: !openedByPointer } as FocusOptions);
      } else {
        openerGone();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  if (bare)
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="min-h-full flex justify-center items-start p-4 pt-[8vh]">
          <div
            className={`fixed inset-0 bg-black/70 backdrop-blur-[2px] ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            className={`relative z-10 w-full ${SIZE_CLASS[size]} origin-top ${
              closing
                ? 'animate-drop-out motion-reduce:animate-overlay-out'
                : 'animate-drop-in motion-reduce:animate-overlay-in'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : ariaLabel}
          >
            {children}
          </div>
        </div>
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className={`min-h-full flex justify-center p-4 ${align === 'top' ? 'items-start pt-[8vh]' : 'items-center'}`}
      >
        <div
          className="fixed inset-0 bg-black/75 animate-overlay-in"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={dialogRef}
          className={`relative z-10 w-full ${SIZE_CLASS[size]} bg-ink-900 rounded-2xl border border-ink-800 animate-dialog-in motion-reduce:animate-overlay-in`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : labelledBy}
          aria-label={title || labelledBy ? undefined : ariaLabel}
        >
          {onClose && (
            <button
              onClick={onClose}
              // The dark disc lets the X read over a game's art, which tops most dialogs.
              className="absolute top-3 right-3 p-2 rounded-full bg-ink-950/60 text-ink-200 hover:bg-ink-950/85 hover:text-ink-50 transition-colors z-10 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          {title && (
            <div className="p-4 sm:p-6 pb-0 sm:pb-0">
              <h2
                id={titleId}
                tabIndex={startOnTitle ? -1 : undefined}
                data-autofocus={startOnTitle ? true : undefined}
                className="text-xl font-semibold tracking-tight text-ink-50 outline-none"
              >
                {title}
              </h2>
            </div>
          )}
          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
