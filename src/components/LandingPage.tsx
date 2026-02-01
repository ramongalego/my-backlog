'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import type { User } from '@supabase/supabase-js';

interface LandingPageProps {
  user: User | null;
  onConnectSteam: () => void;
}

export function LandingPage({ user, onConnectSteam }: LandingPageProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className='min-h-screen bg-zinc-950 flex flex-col'>
      <Header />

      <main className='pt-16 flex-1'>
        <section className='max-w-4xl mx-auto px-6 py-24 md:py-32'>
          <div className='text-center'>
            <h1 className='text-4xl md:text-5xl font-bold text-zinc-100 leading-tight mb-6'>
              Stop scrolling.{' '}
              <span className='text-transparent bg-clip-text bg-linear-to-r from-violet-400 to-fuchsia-400'>
                Start playing.
              </span>
            </h1>
            <p className='text-lg text-zinc-400 mb-10 max-w-xl mx-auto'>
              Connect your Steam library and let us pick your next game based on
              your mood and available time.
            </p>

            {user ? (
              <Button size='lg' onClick={onConnectSteam}>
                Connect Your Steam
              </Button>
            ) : (
              <Button size='lg' onClick={() => setIsAuthModalOpen(true)}>
                Get Started
              </Button>
            )}
          </div>

          <div className='mt-32 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16'>
            <div className='flex items-center gap-4'>
              <span className='text-4xl font-light text-violet-400'>1</span>
              <span className='text-zinc-400'>Connect Steam</span>
            </div>

            <div className='hidden md:block w-12 h-px bg-zinc-800' />

            <div className='flex items-center gap-4'>
              <span className='text-4xl font-light text-violet-400'>2</span>
              <span className='text-zinc-400'>Set your mood</span>
            </div>

            <div className='hidden md:block w-12 h-px bg-zinc-800' />

            <div className='flex items-center gap-4'>
              <span className='text-4xl font-light text-violet-400'>3</span>
              <span className='text-zinc-400'>Play</span>
            </div>
          </div>
        </section>
      </main>

      <footer className='py-6 border-t border-zinc-800'>
        <div className='max-w-4xl mx-auto px-6 text-center'>
          <p className='text-sm text-zinc-500'>MyBacklog</p>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode='signup'
      />
    </div>
  );
}
