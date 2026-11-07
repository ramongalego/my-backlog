import { Gamepad2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-ink-800 bg-ink-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center sm:justify-start gap-2 text-ink-500">
          <Gamepad2 className="w-4 h-4 text-accent-400" aria-hidden="true" />
          <span className="text-sm font-medium">MyBacklog</span>
        </div>
      </div>
    </footer>
  );
}
