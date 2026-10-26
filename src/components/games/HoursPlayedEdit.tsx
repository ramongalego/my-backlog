'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fieldClass } from '@/components/ui/Input';

/**
 * Hours played for a game on a console, edited where it's shown: the playing
 * card's "12h played" becomes a field. Steam keeps its own games' hours, so
 * those show plain `Playtime` instead.
 */
export function HoursPlayedEdit({
  minutes,
  platform,
  onSave,
  className = '',
  after,
}: {
  minutes: number;
  platform: string;
  onSave: (hours: number) => void | Promise<void>;
  className?: string;
  /** What follows the hours ("~27h to beat"), hidden while the field is open. */
  after?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const hours = Math.round(minutes / 60);

  const open = () => {
    // Tenths, as in the detail dialog, so 2.5h isn't rounded away by an edit.
    setValue(minutes ? String(Math.round((minutes / 60) * 10) / 10) : '');
    setInvalid(false);
    setEditing(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const parsed = value.trim() === '' ? 0 : Number(value);
    if (!(parsed >= 0 && parsed <= 100000)) {
      setInvalid(true);
      return;
    }
    setEditing(false);
    // Saved optimistically everywhere the game shows; a failure puts the old
    // hours back with a toast.
    if (Math.round(parsed * 60) !== minutes) void onSave(parsed);
  };

  if (!editing) {
    return (
      <>
        <button
          type="button"
          onClick={open}
          aria-label={`Edit hours played on ${platform}, ${hours}h now`}
          // A 44px tap target on phones, without taking more room.
          className={`group/hours cursor-pointer inline-flex items-center gap-1.5 py-3 -my-3 rounded-md hover:text-ink-50 transition-colors ${className}`}
        >
          <span>{hours}h played</span>
          <Pencil
            className="w-3 h-3 text-ink-500 group-hover/hours:text-ink-200 transition-colors"
            aria-hidden="true"
          />
        </button>
        {after}
      </>
    );
  }

  return (
    <form
      onSubmit={save}
      // Our own check and red border, not the browser's bubble.
      noValidate
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Only the field closes, not a dialog or menu around it.
          e.stopPropagation();
          setEditing(false);
        }
      }}
      className="inline-flex items-center gap-2"
    >
      <input
        type="number"
        min={0}
        step={0.5}
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        aria-label={`Hours played on ${platform}`}
        aria-invalid={invalid || undefined}
        placeholder="0"
        className={`${fieldClass(invalid)} w-20 h-8 px-2.5 text-sm`}
      />
      <Button type="submit" size="sm" variant="secondary" className="cursor-pointer">
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setEditing(false)}
        className="cursor-pointer"
      >
        Cancel
      </Button>
    </form>
  );
}
