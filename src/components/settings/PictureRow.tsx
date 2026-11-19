'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ProfilePicture } from '@/components/profile/ProfilePicture';
import type { ApiResult } from '@/lib/client/request';

type Result = ApiResult;

/**
 * The profile's avatar: Steam's, or the name's initial, until the player
 * uploads their own, which can then be taken off again. Drawn at the size the
 * profile shows it, so what is seen here is how it will look there. A failure
 * is said by whoever does the uploading (a toast): the row has no field to say
 * it in.
 */
export function PictureRow({
  src,
  name,
  hasOwnPicture,
  onUpload,
  onRemove,
}: {
  src: string | null;
  name: string;
  /** A picture they uploaded, which can be taken off. */
  hasOwnPicture: boolean;
  onUpload: (file: File) => Promise<Result>;
  onRemove: () => Promise<Result>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  // One change at a time, whatever is pressed meanwhile.
  const working = useRef(false);

  const run = async (change: () => Promise<Result>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await change();
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-500">Avatar</p>
        <div className="mt-2">
          {/* Keyed by the picture: a new one gets its own chance to load. */}
          <ProfilePicture key={src} src={src} name={name} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {hasOwnPicture && !busy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Remove goes as soon as it's pressed: focus moves to Change
              // first, instead of falling back to the page.
              changeButton.current?.focus();
              void run(onRemove);
            }}
            // "Remove" is what's shown; what is said for a screen reader.
            aria-label="Remove avatar"
            className="cursor-pointer"
          >
            Remove
          </Button>
        )}
        <Button
          ref={changeButton}
          variant="ghost"
          size="sm"
          onClick={() => !busy && fileInput.current?.click()}
          // Not `disabled`: it has the focus while a picture uploads, and a
          // disabled button drops it.
          aria-disabled={busy || undefined}
          aria-label={busy ? undefined : 'Change avatar'}
          className="cursor-pointer aria-disabled:cursor-wait"
        >
          {busy ? 'Saving…' : 'Change'}
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        // Picked from a button that says what it's for; the input itself is hidden.
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // The same file picked again still counts as a change.
          e.target.value = '';
          if (file) void run(() => onUpload(file));
        }}
      />
    </li>
  );
}
