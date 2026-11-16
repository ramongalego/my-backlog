'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { fieldClass } from '@/components/ui/Input';
import { MAX_NAME_LENGTH } from '@/lib/validations/profile';
import type { ApiResult } from '@/lib/client/request';

type Result = ApiResult;

const ICON_BUTTON =
  'shrink-0 cursor-pointer rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50 disabled:cursor-wait disabled:opacity-60';

/**
 * The profile's name, with a pencil beside it that turns it into a field.
 * Enter or the tick saves, Escape or the X puts it back. Left empty, the name
 * goes back to the one the account has (`fallback`), which the field shows as
 * its placeholder. Focus comes back to the pencil afterwards.
 */
export function ProfileName({
  name,
  fallback,
  chosen,
  under,
  onSave,
}: {
  /** The name shown. */
  name: string;
  /** The name the account has, used when none is chosen. */
  fallback: string;
  /** The name the player chose, or null when it's the account's. */
  chosen: string | null;
  /** The line under the name ("Member since …"), which the field's hint replaces. */
  under: React.ReactNode;
  onSave: (name: string | null) => Promise<Result>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A save on its way: the buttons are disabled from the next redraw.
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  // Where focus goes when the field opens or closes, once it's drawn.
  const [focusTo, setFocusTo] = useState<'field' | 'pencil' | null>(null);

  useEffect(() => {
    if (focusTo === 'field') {
      input.current?.focus();
      input.current?.select();
    }
    if (focusTo === 'pencil') pencil.current?.focus();
  }, [focusTo]);

  const open = () => {
    setValue(chosen ?? '');
    setError(null);
    setEditing(true);
    setFocusTo('field');
  };
  const close = () => {
    setEditing(false);
    setFocusTo('pencil');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    const next = value.replace(/\s+/g, ' ').trim() || null;
    if (next === chosen) return close();
    if (next && next.length > MAX_NAME_LENGTH) {
      setError(`Keep it to ${MAX_NAME_LENGTH} characters`);
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const result = await onSave(next);
      if (result.ok) close();
      else setError(result.error);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="min-w-0 max-w-full">
        <div className="flex min-w-0 items-center gap-1">
          {/* Wraps below `lg`, as names do; beside the figures it's cut instead. */}
          <h1 className="min-w-0 text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-ink-50 [overflow-wrap:anywhere] lg:truncate">
            {name}
          </h1>
          <button
            ref={pencil}
            type="button"
            onClick={open}
            aria-label="Change name"
            className={ICON_BUTTON}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {under}
      </div>
    );
  }

  return (
    <form onSubmit={save} noValidate className="min-w-0 max-w-full">
      <div className="flex min-w-0 items-center gap-1">
        <input
          ref={input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              // Not while it's saving: the name would still change, behind a
              // field that looked canceled.
              if (!submitting.current) close();
            }
          }}
          aria-label="Name"
          aria-invalid={error ? true : undefined}
          aria-describedby="profile-name-hint"
          placeholder={fallback}
          maxLength={MAX_NAME_LENGTH + 10}
          autoComplete="nickname"
          // The heading's size, so the name doesn't jump as it becomes a field.
          className={`${fieldClass(!!error)} h-10 sm:h-11 min-w-0 w-full sm:w-72 px-2.5 text-xl sm:text-2xl font-semibold tracking-tight`}
        />
        <button type="submit" disabled={saving} aria-label="Save name" className={ICON_BUTTON}>
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={close}
          disabled={saving}
          aria-label="Cancel"
          className={ICON_BUTTON}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p
        id="profile-name-hint"
        role={error ? 'alert' : undefined}
        className={`mt-1 min-h-5 text-sm ${error ? 'text-rose-400' : 'text-ink-400'}`}
      >
        {error ?? <>Leave it empty to use {fallback}</>}
      </p>
    </form>
  );
}
