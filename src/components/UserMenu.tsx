'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, LogOut, Bug } from 'lucide-react';
import { SupportModal } from '@/components/SupportModal';
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

  useEffect(() => {
    if (!isRefreshDisabled || !open) return;

    const last = localStorage.getItem('playtime_refresh_at');
    if (!last) return;

    const remaining = Math.max(0, 2 * 60 * 1000 - (Date.now() - parseInt(last)));
    if (remaining <= 0) return;

    const initialLabel = remaining > 60_000 ? '2 minutes' : '1 minute';
    const timeouts = [setTimeout(() => setCooldownLabel(initialLabel), 0)];

    if (remaining > 60_000) {
      timeouts.push(setTimeout(() => setCooldownLabel('1 minute'), remaining - 60_000));
    }

    return () => timeouts.forEach(clearTimeout);
  }, [isRefreshDisabled, open]);

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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer block rounded overflow-hidden hover:ring-2 hover:ring-zinc-600 transition-all"
        aria-label="Open user menu"
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
          <div className="w-10 h-10 bg-zinc-700 rounded flex items-center justify-center text-zinc-300 text-sm font-medium">
            {steamUsername?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
          <div className="px-3 py-2 mb-1 border-b border-zinc-800">
            <p className="text-sm font-medium text-zinc-100 truncate">
              {steamUsername ?? user.email}
            </p>
            {gameCount != null && <p className="text-xs text-zinc-500 mt-0.5">{gameCount} games</p>}
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing || isRefreshDisabled}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing
                ? 'Refreshing...'
                : isRefreshDisabled
                  ? `Available in${cooldownLabel ? ` ${cooldownLabel}` : ''}`
                  : 'Refresh Library'}
            </button>
          )}

          <button
            onClick={() => {
              setOpen(false);
              setIsReportOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Bug className="w-4 h-4" />
            Report an issue
          </button>

          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
      <SupportModal open={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
}
