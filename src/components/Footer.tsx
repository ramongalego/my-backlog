import Link from 'next/link';
import { Gamepad2, Flame } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-500">
            <Gamepad2 className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium">MyBacklog</span>
          </div>

          <nav className="flex items-center gap-6">
            <Link
              href="/roast"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Flame className="w-3.5 h-3.5" />
              Roast My Steam
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
