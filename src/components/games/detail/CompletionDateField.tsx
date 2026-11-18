'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays } from 'lucide-react';
import type { DayButtonProps, DayPickerProps } from 'react-day-picker';
import { todayIso, toLocalIsoDate } from '@/lib/diary/date-utils';

const DayPicker = dynamic(
  () =>
    import('react-day-picker').then(({ DayPicker, DayButton }) => {
      // The calendar sits in the dialog's form, where a button with no type
      // submits it: picking a day must only pick it.
      const PickDay = (props: DayButtonProps) => <DayButton {...props} type="button" />;
      return function FormDayPicker(props: DayPickerProps) {
        return <DayPicker {...props} components={{ DayButton: PickDay }} />;
      };
    }),
  { ssr: false },
);

// Local time: `new Date(iso)` reads it as UTC, which can shift the day.
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

export function CompletionDateField({
  label,
  hasDate,
  onHasDateChange,
  date,
  onDateChange,
}: {
  label: string;
  hasDate: boolean;
  onHasDateChange: (hasDate: boolean) => void;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarOpen) return;
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
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [calendarOpen]);

  return (
    // Below md the calendar hangs off this row, not the date button, which
    // would run it off a phone's screen.
    <div className="relative flex items-center gap-2.5">
      <input
        id="date-toggle"
        type="checkbox"
        checked={hasDate}
        onChange={(e) => {
          const checked = e.target.checked;
          onHasDateChange(checked);
          if (checked && !date) onDateChange(todayIso());
          setCalendarOpen(false);
        }}
        className="w-4 h-4 rounded accent-accent-500 cursor-pointer shrink-0"
      />
      <label
        htmlFor="date-toggle"
        className="text-sm text-ink-300 cursor-pointer select-none shrink-0"
      >
        {/* Unticked, it says what ticking does; ticked, it reads into the date. */}
        {hasDate ? label : 'Add the date'}
      </label>

      {hasDate && (
        <div className="md:relative" ref={calendarRef}>
          <button
            type="button"
            data-testid="detail-date"
            onClick={() => setCalendarOpen((o) => !o)}
            aria-expanded={calendarOpen}
            // Named for what it does; the date it shows comes last, as it reads on screen.
            aria-label={`Change the date, ${formatDateLabel(date)}`}
            className="cursor-pointer flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 rounded-lg px-2.5 py-1 text-sm text-ink-100 transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5 text-ink-400" />
            <span>{formatDateLabel(date)}</span>
          </button>

          {calendarOpen && (
            // Below md: under the row, its days sized to fit seven across
            // (globals.css). From md there's room beside the date.
            <div className="absolute left-0 top-full mt-2 w-max max-w-full md:max-w-none md:left-full md:top-1/2 md:-translate-y-1/2 md:mt-0 md:ml-2 z-50 bg-ink-800 border border-ink-700 rounded-xl shadow-2xl px-2 py-2 md:px-4">
              <Suspense fallback={null}>
                <DayPicker
                  mode="single"
                  captionLayout="dropdown"
                  startMonth={new Date(2000, 0)}
                  endMonth={new Date()}
                  // A game can't have been finished or dropped after today.
                  disabled={{ after: new Date() }}
                  selected={isoToDate(date)}
                  defaultMonth={isoToDate(date)}
                  onSelect={(day: Date | undefined) => {
                    if (day) {
                      onDateChange(toLocalIsoDate(day));
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
  );
}
