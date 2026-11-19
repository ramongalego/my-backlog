import Link from 'next/link';
import { Pencil } from 'lucide-react';

/**
 * On the player's own Profile only: to Settings, where the name, the avatar and
 * the username are changed. On phones it is the pencil alone, so the name
 * beside it keeps its room; the words are still its name for a screen reader.
 */
export function EditProfileLink() {
  return (
    <Link
      href="/settings"
      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-ink-800 px-3 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-700 max-sm:w-8 max-sm:px-0"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="max-sm:sr-only">Edit profile</span>
    </Link>
  );
}
