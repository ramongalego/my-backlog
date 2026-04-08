'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gamepad2, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import { UserMenu } from '@/components/UserMenu';
import type { User } from '@supabase/supabase-js';
import type { AuthMode } from '@/types/auth';

const REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
const HIDDEN_ROUTES = ['/share/'];

export function Header() {
  const pathname = usePathname();

  if (HIDDEN_ROUTES.some((route) => pathname.startsWith(route))) {
    return null;
  }

  return <HeaderInner />;
}

function HeaderInner() {
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

  // Re-enable refresh button when the cooldown expires.
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
          .select('id', { count: 'exact', head: true })
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

  const handleRefreshLibrary = async () => {
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
  };

  const openAuthModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinks = [
    ...(user
      ? [
          { href: '/home', label: 'Home' },
          { href: '/games', label: 'Games' },
          { href: '/playing-queue', label: 'Queue' },
          { href: '/diary', label: 'Diary' },
          { href: '/stats', label: 'Stats' },
        ]
      : []),
    { href: '/roast', label: 'Roast' },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={user ? '/home' : '/'} className="flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-violet-400 shrink-0" />
              <span className="text-lg font-semibold text-zinc-100">MyBacklog</span>
            </Link>
            {isLoading && (
              <div className="hidden md:flex items-center gap-6">
                <div className="h-4 w-10 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-12 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-11 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-10 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-9 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-10 bg-zinc-800 rounded animate-pulse" />
              </div>
            )}
            {!isLoading && (
              <nav className="hidden md:flex items-center gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm transition-colors hover:text-zinc-100 ${pathname === link.href ? 'text-zinc-100' : 'text-zinc-400'}`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
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
            {!isLoading && (
              <button
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="md:hidden p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && !isLoading && (
          <nav className="md:hidden border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === link.href ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
    </>
  );
}
