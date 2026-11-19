import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { CONTACT_EMAIL, SUPPORT_URL } from '@/lib/contact';

// py-1 -my-1: about 24px to tap, without moving anything.
const LINK = '-my-1 py-1 text-ink-400 transition-colors hover:text-ink-100';

/** Where the game data comes from: named, and linked, as each asks to be. */
const SOURCES = [
  { name: 'Steam', href: 'https://store.steampowered.com' },
  { name: 'IGDB', href: 'https://www.igdb.com' },
  { name: 'HowLongToBeat', href: 'https://howlongtobeat.com' },
  { name: 'SteamGridDB', href: 'https://www.steamgriddb.com' },
];

/**
 * Contact is the only way to write for someone signed out or locked out. The Terms
 * page says the rest: who else it isn't affiliated with, and whose trademark Steam is.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-800 bg-ink-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-ink-500">
            {/* Gray: orange is for actions, not decoration. */}
            <Gamepad2 className="w-4 h-4" aria-hidden="true" />
            <span className="font-medium text-ink-400">MyBacklog</span>
            <span>© {new Date().getFullYear()}</span>
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Link href="/privacy" className={LINK}>
              Privacy
            </Link>
            <Link href="/terms" className={LINK}>
              Terms
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
              Contact
            </a>
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
              Support MyBacklog
            </a>
          </nav>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-ink-500">
          Game data from{' '}
          {SOURCES.map((source, i) => (
            <span key={source.name}>
              {i > 0 && (i === SOURCES.length - 1 ? ' and ' : ', ')}
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="-my-1 py-1 underline decoration-ink-700 underline-offset-2 transition-colors hover:text-ink-300"
              >
                {source.name}
              </a>
            </span>
          ))}
          . Not affiliated with Valve.
        </p>
      </div>
    </footer>
  );
}
