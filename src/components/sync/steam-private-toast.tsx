import { toast } from 'sonner';
import { STEAM_PRIVACY_URL, STEAM_PRIVATE_HELP, STEAM_PRIVATE_TITLE } from '@/lib/steam/privacy';

// Long enough to read, and to go and change the setting.
const DURATION_MS = 20_000;

/**
 * Steam is connected but shared no library. Called after connecting and after
 * a refresh the player asked for; the id keeps it to one at a time.
 */
export function steamPrivateToast() {
  toast.error(STEAM_PRIVATE_TITLE, {
    id: 'steam-private',
    duration: DURATION_MS,
    // Not the toast's action button: that takes a third of the width, and the
    // text runs to nine lines beside it.
    description: (
      <>
        {STEAM_PRIVATE_HELP}
        <a
          href={STEAM_PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-fit py-1 font-medium text-ink-50 underline decoration-ink-500 underline-offset-4 hover:decoration-ink-200"
        >
          Open Steam&apos;s privacy settings
        </a>
      </>
    ),
  });
}
