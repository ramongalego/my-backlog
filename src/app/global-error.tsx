'use client';

import { CrashScreen } from '@/components/layout/CrashScreen';
import './globals.css';

/**
 * The last resort: the root layout itself failed, so this page stands in for
 * it and has to bring its own <html>, <body> and styles. It draws the same
 * screen as any other crash (the app's own typeface isn't loaded here, so the
 * text falls back to the system's).
 */
export default function GlobalError(props: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-ink-950 text-ink-100">
        <title>Something went wrong · MyBacklog</title>
        <CrashScreen {...props} />
      </body>
    </html>
  );
}
