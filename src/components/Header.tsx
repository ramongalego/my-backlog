'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import type { User } from '@supabase/supabase-js';
import type { AuthMode } from '@/types/auth';

interface HeaderProps {
  hideGamesLink?: boolean;
}

export function Header({ hideGamesLink }: HeaderProps = {}) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  };

  const openAuthModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <>
      <header className='fixed top-0 left-0 right-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md'>
        <div className='max-w-6xl mx-auto px-6 h-16 flex items-center justify-between'>
          <div className='flex items-center gap-6'>
            <Link href='/' className='flex items-center gap-2'>
              <div className='w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg' />
              <span className='text-xl font-bold text-zinc-100'>MyBacklog</span>
            </Link>
            {user && !hideGamesLink && (
              <Link
                href='/games'
                className='text-sm text-zinc-400 hover:text-zinc-100 transition-colors'
              >
                Games
              </Link>
            )}
          </div>

          <nav className='flex items-center gap-3'>
            {isLoading ? (
              <div className='w-20 h-9 bg-zinc-800 rounded-lg animate-pulse' />
            ) : user ? (
              <div className='flex items-center gap-4'>
                <span className='text-sm text-zinc-400 hidden sm:block'>
                  {user.email}
                </span>
                <Button variant='ghost' size='sm' onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => openAuthModal('login')}
                >
                  Sign In
                </Button>
                <Button size='sm' onClick={() => openAuthModal('signup')}>
                  Get Started
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
    </>
  );
}
