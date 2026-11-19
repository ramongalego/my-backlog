'use client';

import { useState } from 'react';
import Image from 'next/image';
import { initialOf } from '@/lib/account/identity';
import { AVATAR_SIZE } from './profile-layout';

const BOX = `${AVATAR_SIZE} rounded-xl`;

/**
 * The same size wherever it is drawn (a profile's header, the Settings row).
 * A picture that won't load gives way to the initial, not the browser's
 * broken-image mark.
 */
export function ProfilePicture({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? (
    <Image
      src={src}
      // The name is right beside it.
      alt=""
      width={80}
      height={80}
      preload
      onError={() => setBroken(true)}
      className={`${BOX} bg-ink-800 object-cover`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${BOX} flex items-center justify-center bg-ink-800 text-2xl font-semibold text-ink-300`}
    >
      {initialOf(name)}
    </span>
  );
}
