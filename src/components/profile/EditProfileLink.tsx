import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { buttonClass } from '@/components/ui/button-class';

/**
 * On the player's own Profile only: to Settings, where the name, the avatar and
 * the username are changed. On phones it is the pencil alone, so the name
 * beside it keeps its room; the words are still its name for a screen reader.
 */
export function EditProfileLink() {
  return (
    <Link
      href="/settings"
      className={`${buttonClass({ variant: 'secondary', size: 'sm' })} shrink-0 whitespace-nowrap max-sm:w-8 max-sm:px-0`}
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="max-sm:sr-only">Edit profile</span>
    </Link>
  );
}
