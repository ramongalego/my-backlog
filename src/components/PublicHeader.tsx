'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { AuthMode } from '@/types/auth';

// The auth forms pull in supabase-js; load them only when the modal opens.
const AuthModal = dynamic(() => import('@/components/auth/AuthModal').then((m) => m.AuthModal));

/**
 * Header for the marketing pages. The proxy only lets signed-out visitors
 * reach them, so unlike the app Header this needs no auth state or queries.
 */
export function PublicHeader() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-ink-800 bg-ink-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-accent-400 shrink-0" aria-hidden="true" />
            <span className="text-lg font-semibold tracking-tight text-ink-50">MyBacklog</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setAuthMode('login')}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => setAuthMode('signup')}>
              Get Started
            </Button>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        {authMode && <AuthModal isOpen onClose={() => setAuthMode(null)} initialMode={authMode} />}
      </Suspense>
    </>
  );
}
