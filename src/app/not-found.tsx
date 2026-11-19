import type { Metadata } from 'next';
import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    // The landmark the root layout's "Skip to main content" link goes to.
    <main
      id="main-content"
      className="flex-1 bg-ink-950 flex flex-col items-center justify-center text-center px-6"
    >
      <Gamepad2 className="w-8 h-8 text-ink-600 mb-8" aria-hidden="true" />
      <h1 className="text-6xl font-semibold tracking-tight text-ink-50 mb-2">404</h1>
      <p className="text-ink-400 mb-8">This page doesn&apos;t exist</p>
      <Link
        href="/"
        className="text-sm text-ink-400 hover:text-ink-100 transition-colors underline underline-offset-4"
      >
        Back to home
      </Link>
    </main>
  );
}
