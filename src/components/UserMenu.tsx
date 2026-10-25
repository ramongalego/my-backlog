'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, LogOut, Bug } from 'lucide-react';
import { SupportModal } from '@/components/SupportModal';
import { refreshKeys } from '@/hooks/useLibraryRefresh';
import type { User } from '@supabase/supabase-js';

interface UserMenuProps {
  user: User;
  steamUsername: string | null;
  steamAvatar: string | null;
  gameCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isRefreshDisabled?: boolean;
}

export function UserMenu({
  user,
  steamUsername,
  steamAvatar,
  gameCount,
  onRefresh,
  isRefreshing,
  isRefreshDisabled,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [cooldownLabel, setCooldownLabel] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Enabled items only: a disabled one (refresh on cooldown) can't take focus.
  const menuItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
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

    const last = localStorage.getItem(refreshKeys(user.id).playtime);
    if (!last) return;

    const remaining = Math.max(0, 2 * 60 * 1000 - (Date.now() - parseInt(last)));
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
    window.location.reload();
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
    const focused = items.indexOf(document.activeElement as HTMLButtonElement);

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
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer block rounded overflow-hidden hover:ring-2 hover:ring-ink-600 transition-all"
        aria-label="Open user menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {steamAvatar ? (
          <Image
            src={steamAvatar}
            alt={steamUsername ?? 'Profile'}
            width={40}
            height={40}
            className="rounded"
          />
        ) : (
          <div className="w-10 h-10 bg-ink-700 rounded flex items-center justify-center text-ink-300 text-sm font-medium">
            {steamUsername?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-ink-800 bg-ink-900 p-2 shadow-2xl"
          role="menu"
          aria-label="Account"
        >
          <div className="px-3 py-2 mb-1 border-b border-ink-800" role="none">
            <p className="text-sm font-medium text-ink-100 truncate">
              {steamUsername ?? user.email}
            </p>
            {gameCount != null && <p className="text-xs text-ink-500 mt-0.5">{gameCount} games</p>}
          </div>

          {onRefresh && (
            <button
              role="menuitem"
              onClick={onRefresh}
              disabled={isRefreshing || isRefreshDisabled}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {isRefreshing
                  ? 'Refreshing...'
                  : isRefreshDisabled
                    ? `Available in${cooldownLabel ? ` ${cooldownLabel}` : ''}`
                    : 'Refresh Library'}
              </span>
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
            <span>Sign Out</span>
          </button>
        </div>
      )}
      <SupportModal open={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
}
