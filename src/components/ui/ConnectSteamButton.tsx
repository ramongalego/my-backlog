'use client';

import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SteamIcon } from '@/components/ui/SteamIcon';
import { useConnectSteam } from '@/hooks/useConnectSteam';

/**
 * Once pressed, the Steam mark turns into a spinner until Steam's sign-in page
 * takes over (a second or two); the label stays, so the width holds.
 */
export function ConnectSteamButton({
  onClick,
  size = 'md',
  className = '',
  children = 'Connect Steam',
}: {
  /** `connect` from `useConnectSteam`, handed down by the page. */
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** The label, where "Connect Steam" would repeat what's beside it. */
  children?: ReactNode;
}) {
  const { connecting } = useConnectSteam();
  const icon = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      onClick={onClick}
      // Not `disabled`, which would drop its focus while Steam's page loads;
      // a second press starts nothing (see useConnectSteam).
      aria-disabled={connecting || undefined}
      aria-busy={connecting || undefined}
      className={`cursor-pointer aria-disabled:cursor-default ${className}`}
    >
      {connecting ? (
        <Loader2 className={`${icon} animate-spin motion-reduce:animate-none`} aria-hidden="true" />
      ) : (
        <SteamIcon className={icon} />
      )}
      <span>{children}</span>
    </Button>
  );
}
