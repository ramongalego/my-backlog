'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, Loader2, RefreshCw, LogOut, Bug, UserRound } from 'lucide-react';
import { SteamIcon } from '@/components/ui/SteamIcon';
import { SupportModal } from '@/components/layout/SupportModal';
import { manualRefreshWait } from '@/hooks/useLibraryRefresh';
import { useConnectSteam } from '@/hooks/useConnectSteam';
import type { User } from '@supabase/supabase-js';
import { reloadAtTop } from '@/lib/reload';
import { initialOf } from '@/lib/account/identity';

interface UserMenuProps {
  user: User;
  /** The name the profile shows. */
  name: string;
  /** The picture the profile shows, or null for the initial. */
  avatar: string | null;
  gameCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isRefreshDisabled?: boolean;
  /** Shown instead of Refresh library until a Steam account is linked. */
  onConnectSteam?: () => void;
  /** The menu opened: anything else open in the header should close. */
  onOpen?: () => void;
}

export function UserMenu({
  user,
  name,
  avatar,
  gameCount,
  onRefresh,
  onConnectSteam,
  onOpen,
  isRefreshing,
  isRefreshDisabled,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [cooldownLabel, setCooldownLabel] = useState<string | null>(null);
  // Connect Steam has been pressed (here or on the page): its item is busy.
  const { connecting: connectingSteam } = useConnectSteam();
  // The picture that failed to load, if one did: a new one gets its own chance.
  const [brokenAvatar, setBrokenAvatar] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Enabled items only: a disabled one (refresh on cooldown) can't take focus.
  // Buttons, and the link to the profile.
  const menuItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );

  const closeMenu = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  // Opening moves focus to the first item, as the menu button pattern expects.
  useEffect(() => {
    if (open) menuItems()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!isRefreshDisabled || !open) return;

    const remaining = manualRefreshWait(user.id);
    if (remaining <= 0) return;

    const initialLabel = remaining > 60_000 ? '2 minutes' : '1 minute';
    const timeouts = [setTimeout(() => setCooldownLabel(initialLabel), 0)];

    if (remaining > 60_000) {
      timeouts.push(setTimeout(() => setCooldownLabel('1 minute'), remaining - 60_000));
    }

    return () => timeouts.forEach(clearTimeout);
  }, [isRefreshDisabled, open, user.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    reloadAtTop();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu(true);
      return;
    }
    if (e.key === 'Tab') {
      closeMenu(false);
      return;
    }

    const items = menuItems();
    if (!items.length) return;
    const focused = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(focused + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(focused - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  };

  return (
    <div className="relative" ref={menuRef} onKeyDown={handleMenuKeyDown}>
      <button
        ref={triggerRef}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        // The chevron says there's a menu here: an avatar alone reads as a
        // picture. The hover ring stays on the avatar. On the narrowest phones
        // (320px) the header has no room for it, and a tap on an avatar is
        // what people try there anyway.
        className="group flex cursor-pointer items-center gap-1 rounded-lg"
        aria-label="Open user menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatar && brokenAvatar !== avatar ? (
          <Image
            src={avatar}
            alt={name}
            width={40}
            height={40}
            // A picture that won't load gives way to the initial.
            onError={() => setBrokenAvatar(avatar)}
            className="rounded transition-shadow group-hover:ring-2 group-hover:ring-ink-600"
          />
        ) : (
          <div className="w-10 h-10 bg-ink-700 rounded flex items-center justify-center text-ink-300 text-sm font-medium transition-shadow group-hover:ring-2 group-hover:ring-ink-600">
            {initialOf(name)}
          </div>
        )}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-ink-400 max-[359px]:hidden transition-[color,rotate] duration-200 group-hover:text-ink-100 motion-reduce:transition-none ${
            open ? 'rotate-180 text-ink-100' : ''
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl border border-ink-800 bg-ink-900 p-2 shadow-2xl animate-menu-in motion-reduce:animate-overlay-in"
          role="menu"
          aria-label="Account"
        >
          <div className="px-3 py-2 mb-1 border-b border-ink-800" role="none">
            <p className="text-sm font-medium text-ink-100 truncate">{name}</p>
            {gameCount != null && (
              <p className="text-xs text-ink-500 mt-0.5">
                {gameCount} {gameCount === 1 ? 'game' : 'games'}
              </p>
            )}
          </div>

          <Link
            href="/profile"
            role="menuitem"
            // Focus back to the menu's button: already on Profile, nothing else
            // takes it.
            onClick={() => closeMenu(true)}
            // A link only follows Enter; in a menu, Space activates too.
            onKeyDown={(e) => {
              if (e.key === ' ') {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 transition-colors"
          >
            <UserRound className="w-4 h-4" aria-hidden="true" />
            <span>Profile</span>
          </Link>

          {onRefresh && (
            <button
              role="menuitem"
              // The refresh reports back in a toast, so the menu can go.
              onClick={() => {
                closeMenu(true);
                onRefresh();
              }}
              disabled={isRefreshing || isRefreshDisabled}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {isRefreshing
                  ? 'Refreshing…'
                  : isRefreshDisabled
                    ? `Available in${cooldownLabel ? ` ${cooldownLabel}` : ''}`
                    : 'Refresh library'}
              </span>
            </button>
          )}

          {onConnectSteam && (
            <button
              role="menuitem"
              onClick={onConnectSteam}
              // Not `disabled`: it has the focus while Steam's page is on its way.
              aria-disabled={connectingSteam || undefined}
              aria-busy={connectingSteam || undefined}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 transition-colors cursor-pointer aria-disabled:cursor-default"
            >
              {connectingSteam ? (
                <Loader2
                  className="w-4 h-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <SteamIcon className="w-4 h-4" />
              )}
              <span>Connect Steam</span>
            </button>
          )}

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setIsReportOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 transition-colors cursor-pointer"
          >
            <Bug className="w-4 h-4" aria-hidden="true" />
            <span>Report an issue</span>
          </button>

          <button
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-ink-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      )}
      <SupportModal open={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
}
