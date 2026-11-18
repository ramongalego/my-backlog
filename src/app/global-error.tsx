'use client';

import { CrashScreen } from '@/components/layout/CrashScreen';
import './globals.css';

/**
 * The root layout itself failed, so this brings its own <html>, <body> and
 * styles; the app's typeface isn't loaded here.
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
