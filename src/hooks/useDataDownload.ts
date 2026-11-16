'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ExportFormat } from '@/lib/account/export';
import type { ApiResult } from '@/lib/client/request';

/**
 * Downloading a copy of your data from a button: one file at a time, however
 * many times it's pressed, and which one is on its way, for the button to
 * show. The browser shows the file arriving; only a failure is said.
 */
export function useDataDownload(onDownload: (format: ExportFormat) => Promise<ApiResult>) {
  const [preparing, setPreparing] = useState<ExportFormat | null>(null);
  // A download on its way. The buttons dim from the next redraw; this stops
  // a second press before then from asking for the file twice.
  const busy = useRef(false);

  const download = async (format: ExportFormat) => {
    if (busy.current) return;
    busy.current = true;
    setPreparing(format);
    const result = await onDownload(format);
    busy.current = false;
    setPreparing(null);
    if (!result.ok) toast.error(result.error, { id: 'download-data' });
  };

  return { preparing, download };
}

/** The two files: the games as a spreadsheet, or everything as one file. */
export const EXPORT_CHOICES: { format: ExportFormat; label: string }[] = [
  { format: 'csv', label: 'Games (CSV)' },
  { format: 'json', label: 'Everything (JSON)' },
];
