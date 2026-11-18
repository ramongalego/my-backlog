'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EXPORT_CHOICES, useDataDownload } from '@/hooks/useDataDownload';
import type { ExportFormat } from '@/lib/account/export';
import type { ApiResult } from '@/lib/client/request';

/** The Account panel's Export data menu. The button stays busy until the file is here. */
export function ExportDataMenu({
  onDownload,
}: {
  /** Fetches the file and hands it to the browser to save. */
  onDownload: (format: ExportFormat) => Promise<ApiResult>;
}) {
  const { preparing, download } = useDataDownload(onDownload);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const items = () =>
    Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  // Opening moves focus to the first choice, as the menu button pattern expects.
  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const pressedOutside = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', pressedOutside);
    return () => document.removeEventListener('mousedown', pressedOutside);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const choose = (format: ExportFormat) => {
    // Back to the button, which shows the file is on its way.
    close(true);
    void download(format);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      return close(true);
    }
    if (e.key === 'Tab') return close(false);
    const all = items();
    const focused = all.indexOf(document.activeElement as HTMLElement);
    const to =
      e.key === 'ArrowDown'
        ? (focused + 1) % all.length
        : e.key === 'ArrowUp'
          ? (focused - 1 + all.length) % all.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? all.length - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    all[to]?.focus();
  };

  return (
    <div ref={wrap} className="relative shrink-0" onKeyDown={handleKeyDown}>
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          if (preparing) return;
          setOpen((was) => !was);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // Not `disabled`: it has the focus while the file is fetched.
        aria-disabled={preparing !== null || undefined}
        aria-busy={preparing !== null || undefined}
        className="cursor-pointer whitespace-nowrap aria-disabled:cursor-default aria-disabled:opacity-50"
      >
        Export data
        {preparing ? (
          <Loader2
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Export data"
          className="absolute right-0 top-full z-10 mt-1 w-max origin-top-right rounded-lg border border-ink-700 bg-ink-900 py-1 shadow-lg animate-menu-in motion-reduce:animate-overlay-in"
        >
          {EXPORT_CHOICES.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => choose(format)}
              className="block w-full cursor-pointer whitespace-nowrap px-3 py-2 text-left text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 focus-visible:bg-ink-800 focus-visible:text-ink-100 focus-visible:-outline-offset-2"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
