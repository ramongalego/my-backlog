'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gamepad2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import { UserMenu } from '@/components/UserMenu';
import type { User } from '@supabase/supabase-js';
import type { AuthMode } from '@/types/auth';

const REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

interface HeaderProps {
  hideNavLinks?: boolean;
}

export function Header({ hideNavLinks }: HeaderProps = {}) {
  const [user, setUser] = useState<User | null>(null);
  const [steamUsername, setSteamUsername] = useState<string | null>(null);
  const [steamAvatar, setSteamAvatar] = useState<string | null>(null);
  const [gameCount, setGameCount] = useState<number | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshDisabled, setIsRefreshDisabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const last = localStorage.getItem('playtime_refresh_at');
    return !!last && Date.now() - parseInt(last) < REFRESH_COOLDOWN_MS;
  });
  const pathname = usePathname();

  // Re-enable the refresh button when the cooldown expires, whether the cooldown
  // was set in this session or carried over from a previous page load via localStorage.
  useEffect(() => {
    if (!isRefreshDisabled) return;
    const last = localStorage.getItem('playtime_refresh_at');
    if (!last) return;
    const remaining = Math.max(0, REFRESH_COOLDOWN_MS - (Date.now() - parseInt(last)));
    const id = setTimeout(() => setIsRefreshDisabled(false), remaining);
    return () => clearTimeout(id);
  }, [isRefreshDisabled]);

  useEffect(() => {
    const supabase = createClient();

    async function loadUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('steam_username, steam_avatar')
          .eq('id', user.id)
          .single();

        setSteamUsername(profile?.steam_username ?? null);
        setSteamAvatar(profile?.steam_avatar ?? null);

        const { count } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('type', 'game')
          .neq('status', 'hidden');

        setGameCount(count ?? 0);
      }

      setIsLoading(false);
    }

    loadUserData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setSteamUsername(null);
        setSteamAvatar(null);
        setGameCount(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRefreshLibrary = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/steam/refresh', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('playtime_refresh_at', Date.now().toString());
        setIsRefreshDisabled(true);
        if (data.newGames > 0 || data.updatedPlaytime > 0) {
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Failed to refresh library:', err);
    }
    setIsRefreshing(false);
  }, []);

  const openAuthModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={user ? '/home' : '/'} className="flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-violet-400" />
              <span className="text-xl font-bold text-zinc-100 -ml-1">MyBacklog</span>
            </Link>
            {user && !hideNavLinks && (
              <Link
                href="/home"
                className={`text-sm transition-colors hover:text-zinc-100 ${pathname === '/home' ? 'text-zinc-100' : 'text-zinc-400'}`}
              >
                Home
              </Link>
            )}
            {user && !hideNavLinks && (
              <Link
                href="/games"
                className={`text-sm transition-colors hover:text-zinc-100 ${pathname === '/games' ? 'text-zinc-100' : 'text-zinc-400'}`}
              >
                Games
              </Link>
            )}
            {user && !hideNavLinks && (
              <Link
                href="/playing-queue"
                className={`text-sm transition-colors hover:text-zinc-100 ${pathname === '/playing-queue' ? 'text-zinc-100' : 'text-zinc-400'}`}
              >
                Queue
              </Link>
            )}
            {user && !hideNavLinks && (
              <Link
                href="/diary"
                className={`text-sm transition-colors hover:text-zinc-100 ${pathname === '/diary' ? 'text-zinc-100' : 'text-zinc-400'}`}
              >
                Diary
              </Link>
            )}
            {user && !hideNavLinks && (
              <Link
                href="/stats"
                className={`text-sm transition-colors hover:text-zinc-100 ${pathname === '/stats' ? 'text-zinc-100' : 'text-zinc-400'}`}
              >
                Stats
              </Link>
            )}
            {!hideNavLinks && (
              <Link
                href="/roast"
                className={`text-sm transition-colors hover:text-zinc-100 ${pathname === '/roast' ? 'text-zinc-100' : 'text-zinc-400'}`}
              >
                Roast
              </Link>
            )}
          </div>

          <nav className="flex items-center gap-3">
            {isLoading ? (
              <div className="w-10 h-10 bg-zinc-800 rounded animate-pulse" />
            ) : user ? (
              <UserMenu
                user={user}
                steamUsername={steamUsername}
                steamAvatar={steamAvatar}
                gameCount={gameCount ?? undefined}
                onRefresh={handleRefreshLibrary}
                isRefreshing={isRefreshing}
                isRefreshDisabled={isRefreshDisabled}
              />
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => openAuthModal('login')}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => openAuthModal('signup')}>
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
