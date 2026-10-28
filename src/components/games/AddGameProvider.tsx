'use client';

import { createContext, use, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useInvalidateQueries } from '@/lib/mutations';
import dynamic from 'next/dynamic';
import type { AddStatus } from './GameStatusModal';

// Search, the details dialog and the date picker: only loaded once it opens.
const AddGameModal = dynamic(() => import('./AddGameModal').then((m) => m.AddGameModal));

const AddGameContext = createContext<{ open: (query?: string) => void } | null>(null);

/** Opens the Add game dialog, optionally with a search filled in. */
export function useAddGame() {
  const context = use(AddGameContext);
  if (!context) throw new Error('useAddGame must be used inside AddGameProvider');
  return context;
}

// Where a newly added game shows up, for the toast and its View link.
function destination(
  status: AddStatus,
  name: string,
  movedTo?: string,
): { label: string; href: string } {
  const search = encodeURIComponent(name);
  if (movedTo && status === 'backlog')
    return { label: `Moved ${name} to ${movedTo}`, href: `/games?q=${search}` };
  switch (status) {
    case 'playing':
      return { label: `Now playing ${name}`, href: '/home' };
    case 'queue':
      return { label: `Added ${name} to your queue`, href: '/playing-queue' };
    case 'finished':
      return { label: `Added ${name} to your diary`, href: '/diary' };
    case 'dropped':
      return { label: `Added ${name} as dropped`, href: `/games?filter=dropped&q=${search}` };
    default:
      return { label: `Added ${name} to your backlog`, href: `/games?q=${search}` };
  }
}

/**
 * The Add game dialog for the whole signed-in app: the header button and an
 * empty library search both open it. A new game shows up everywhere at once
 * (games list, Stats, carousels, queue, Diary and the header's count).
 */
export function AddGameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const { gamesAndQueue: refreshLibrary } = useInvalidateQueries();
  const [initialQuery, setInitialQuery] = useState<string | null>(null);

  return (
    <AddGameContext value={{ open: (query = '') => setInitialQuery(query) }}>
      {children}
      {user && initialQuery !== null && (
        <AddGameModal
          userId={user.id}
          initialQuery={initialQuery}
          onClose={() => setInitialQuery(null)}
          onAdded={(name, status, warning, movedTo) => {
            const { label, href } = destination(status, name, movedTo);
            if (warning) toast.warning(warning);
            else
              toast.success(label, {
                // Long enough to reach the View button.
                duration: 6000,
                action: { label: 'View', onClick: () => router.push(href) },
              });
            refreshLibrary();
          }}
        />
      )}
    </AddGameContext>
  );
}
