'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Loader2, X } from 'lucide-react';
import { initialOf } from '@/lib/account/identity';
import { AVATAR_SIZE } from './profile-layout';

type Result = { ok: true } | { ok: false; error: string };

/** The picture itself: theirs, Steam's, or their initial. */
function Picture({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <Image
      src={src}
      // The name is right beside it.
      alt=""
      width={80}
      height={80}
      preload
      className={`${AVATAR_SIZE} rounded-xl bg-ink-800 object-cover`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${AVATAR_SIZE} flex items-center justify-center rounded-xl bg-ink-800 text-2xl font-semibold text-ink-300`}
    >
      {initialOf(name)}
    </span>
  );
}

/**
 * The player's picture, which is also how it's changed: hovering it shows a
 * camera, and a click picks a new picture to upload. A picture of their own
 * has an X in its corner that takes it off (back to Steam's, or their
 * initial). On a touchscreen, with no hover, the camera sits in a corner
 * and the X always shows.
 */
export function ProfileAvatar({
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
  const [busy, setBusy] = useState(false);
  // One change at a time: the buttons are disabled from the next redraw.
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
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        aria-label="Change picture"
        className={`${AVATAR_SIZE} relative block cursor-pointer overflow-hidden rounded-xl disabled:cursor-wait`}
      >
        <Picture src={src} name={name} />
        {/* The camera, over the picture while it's hovered or focused. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center bg-ink-950/60 text-ink-50 transition-opacity motion-reduce:transition-none ${
            busy
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 [@media(hover:none)]:hidden'
          }`}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />
          ) : (
            <Camera className="h-6 w-6" />
          )}
        </span>
        {/* No hover on a touchscreen: a small camera in the corner says it can be changed. */}
        {!busy && (
          <span
            aria-hidden="true"
            className="absolute right-1 bottom-1 hidden rounded-full bg-ink-950/80 p-1 text-ink-100 [@media(hover:none)]:block"
          >
            <Camera className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
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
      {hasOwnPicture && !busy && (
        <button
          type="button"
          onClick={() => void run(onRemove)}
          aria-label="Remove picture"
          // The favorites' X: a dark disc, 24px to hit.
          className="absolute -top-2 -right-2 cursor-pointer rounded-full border border-ink-800 bg-ink-950 p-1 text-ink-300 opacity-0 transition-[opacity,color] hover:text-ink-50 focus-visible:opacity-100 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
