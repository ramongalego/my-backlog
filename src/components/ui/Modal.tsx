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
  size?: 'md' | 'lg' | 'xl';
  /**
   * `top` pins the dialog near the top so it grows downward, for content that
   * changes height as you use it (search results); centred dialogs re-centre
   * and move under the pointer.
   */
  align?: 'center' | 'top';
}

// xl is a custom 34rem (544px) — a nudge wider than lg (32rem) so a 6-column
// status grid has a little breathing room without feeling oversized.
const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-[34rem]',
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  ariaLabel,
  labelledBy,
  size = 'md',
  align = 'center',
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

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    // Focus the element marked data-autofocus (e.g. a search box you'll type
    // into straight away), or else the first focusable element in the dialog.
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
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className={`min-h-full flex justify-center p-4 ${align === 'top' ? 'items-start pt-[8vh]' : 'items-center'}`}
      >
        <div className="fixed inset-0 bg-black/75" onClick={onClose} aria-hidden="true" />
        <div
          ref={dialogRef}
          className={`relative z-10 w-full ${SIZE_CLASS[size]} bg-ink-900 rounded-2xl border border-ink-800`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : labelledBy}
          aria-label={title || labelledBy ? undefined : ariaLabel}
        >
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-ink-400 hover:text-ink-100 hover:bg-ink-800 rounded-lg transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          {title && (
            <div className="p-4 sm:p-6 pb-0 sm:pb-0">
              <h2 id={titleId} className="text-xl font-semibold tracking-tight text-ink-50">
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
