'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import type { AuthMode } from '@/types/auth';
import { Hero } from './Hero';
import { PickerDemo } from './PickerDemo';
import { LibraryPreview } from './LibraryPreview';
import { ProgressPreview } from './ProgressPreview';
import { FinalCta } from './FinalCta';

// The auth forms pull in supabase-js; load them only when the modal opens.
const AuthModal = dynamic(() => import('@/components/auth/AuthModal').then((m) => m.AuthModal));

/**
 * The public landing page: what MyBacklog does, section by section, each with
 * a sample of the app. Every call to action opens sign-up (or sign-in).
 */
export function LandingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  const openModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col">
      <main id="main-content" className="pt-16 flex-1">
        <Hero onOpen={openModal} />
        <PickerDemo onSignUp={() => openModal('signup')} />
        <LibraryPreview />
        <ProgressPreview />
        <FinalCta onOpen={openModal} />
      </main>

      <Suspense fallback={null}>
        {isAuthModalOpen && (
          <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} initialMode={authMode} />
        )}
      </Suspense>
    </div>
  );
}
