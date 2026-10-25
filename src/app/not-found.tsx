import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center text-center px-6">
      <Gamepad2 className="w-8 h-8 text-accent-400 mb-8" />
      <h1 className="text-6xl font-bold text-ink-100 mb-2">404</h1>
      <p className="text-ink-400 mb-8">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="text-sm text-ink-400 hover:text-ink-100 transition-colors underline underline-offset-4"
      >
        Back to home
      </Link>
    </div>
  );
}
