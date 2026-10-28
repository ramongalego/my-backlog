'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gamepad2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
import { UserMenu } from '@/components/UserMenu';
import { AddGameButton } from '@/components/games/AddGameButton';
import { useAuth } from '@/hooks/useAuth';
import { useLibraryMeta } from '@/hooks/useLibraryMeta';
import { useLibraryRefresh, refreshKeys } from '@/hooks/useLibraryRefresh';
import { connectSteam } from '@/lib/steam/connect';
import type { AuthMode } from '@/types/auth';

// The auth forms pull in supabase-js; load them only when the modal opens.
const AuthModal = dynamic(() => import('@/components/auth/AuthModal').then((m) => m.AuthModal));

const REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

export function Header() {
  const { user, profile, authResolved } = useAuth();
  const { gameCount, loaded: libraryMetaLoaded } = useLibraryMeta(user?.id ?? null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshDisabled, setIsRefreshDisabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const last = localStorage.getItem(refreshKeys(user?.id).playtime);
    return !!last && Date.now() - Number(last) < REFRESH_COOLDOWN_MS;
  });
  const { refresh } = useLibraryRefresh();
  const pathname = usePathname();

  const isLoading = !authResolved;
  const steamUsername = profile?.steam_username ?? null;
  const steamAvatar = profile?.steam_avatar ?? null;

  // Re-enable refresh button when the cooldown expires.
  useEffect(() => {
    if (!isRefreshDisabled) return;
    const last = localStorage.getItem(refreshKeys(user?.id).playtime);
    if (!last) return;
    const remaining = Math.max(0, REFRESH_COOLDOWN_MS - (Date.now() - Number(last)));
    const id = setTimeout(() => setIsRefreshDisabled(false), remaining);
    return () => clearTimeout(id);
  }, [isRefreshDisabled, user?.id]);

  const handleRefreshLibrary = async () => {
    setIsRefreshing(true);
    const result = await refresh({ manual: true });
    if (result.success) {
      setIsRefreshDisabled(true);
    }
    setIsRefreshing(false);
  };

  const openAuthModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  // Remembering which path the menu was opened on closes it automatically after
  // any navigation, not just taps on its own links.
  const [menuOpenedOn, setMenuOpenedOn] = useState<string | null>(null);
  const mobileMenuOpen = menuOpenedOn === pathname;
  const closeMobileMenu = () => setMenuOpenedOn(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpenedOn(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const navLinks = user
    ? [
        { href: '/home', label: 'Home' },
        { href: '/games', label: 'Games' },
        { href: '/playing-queue', label: 'Queue' },
        { href: '/diary', label: 'Diary' },
        { href: '/stats', label: 'Stats' },
      ]
    : [];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-ink-800 bg-ink-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-6 self-stretch">
            <Link href={user ? '/home' : '/'} className="flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-accent-400 shrink-0" aria-hidden="true" />
              <span className="text-lg font-semibold tracking-tight text-ink-50">MyBacklog</span>
            </Link>
            {isLoading && (
              <div className="hidden md:flex items-center gap-6">
                <div className="h-4 w-10 bg-ink-800 rounded animate-pulse" />
                <div className="h-4 w-12 bg-ink-800 rounded animate-pulse" />
                <div className="h-4 w-11 bg-ink-800 rounded animate-pulse" />
                <div className="h-4 w-10 bg-ink-800 rounded animate-pulse" />
                <div className="h-4 w-9 bg-ink-800 rounded animate-pulse" />
              </div>
            )}
            {!isLoading && (
              <nav className="hidden md:flex self-stretch gap-6" aria-label="Main navigation">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={pathname === link.href ? 'page' : undefined}
                    className={`relative flex items-center text-sm font-medium transition-colors hover:text-ink-50 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors ${pathname === link.href ? 'text-ink-50 after:bg-accent-500' : 'text-ink-400 after:bg-transparent'}`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="w-10 h-10 bg-ink-800 rounded animate-pulse" />
            ) : user ? (
              <>
                <AddGameButton />
                <UserMenu
                  user={user}
                  steamUsername={steamUsername}
                  steamAvatar={steamAvatar}
                  gameCount={libraryMetaLoaded ? gameCount : undefined}
                  // Without Steam there's no library to refresh, only one to link.
                  onRefresh={profile?.steam_id ? handleRefreshLibrary : undefined}
                  onConnectSteam={profile?.steam_id ? undefined : connectSteam}
                  isRefreshing={isRefreshing}
                  isRefreshDisabled={isRefreshDisabled}
                />
              </>
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
            {!isLoading && navLinks.length > 0 && (
              <button
                onClick={() => setMenuOpenedOn(mobileMenuOpen ? null : pathname)}
                className="md:hidden p-2 text-ink-400 hover:text-ink-100 transition-colors"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && !isLoading && (
          <nav
            id="mobile-navigation"
            className="md:hidden border-t border-ink-800 bg-ink-950"
            aria-label="Mobile navigation"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === link.href ? 'text-ink-50 bg-ink-800' : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/50'}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      {isAuthModalOpen && (
        <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} initialMode={authMode} />
      )}
    </>
  );
}
