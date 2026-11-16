'use client';

import { type ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EXPORT_CHOICES, useDataDownload } from '@/hooks/useDataDownload';
import type { ExportFormat } from '@/lib/account/export';
import type { ApiResult } from '@/lib/client/request';

/**
 * A line and the two ways to download a copy of your data, side by side: the
 * games as a spreadsheet, or everything as one file. In the two dialogs that
 * delete what was logged (disconnecting Steam, deleting the account), where
 * it's the last chance to keep it. The Account panel has them in a menu
 * (ExportDataMenu).
 */
export function DownloadData({
  children,
  onDownload,
}: {
  /** The line beside the buttons. */
  children: ReactNode;
  /** Fetches the file and hands it to the browser to save. */
  onDownload: (format: ExportFormat) => Promise<ApiResult>;
}) {
  const { preparing, download } = useDataDownload(onDownload);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="min-w-0 text-sm text-ink-400">{children}</p>
      {/* -mx-3: the first button's label lines up with the text when the
          buttons wrap under it, and the last one's with the dialog's edge. */}
      <div role="group" aria-label="Download a copy of your data" className="-mx-3 flex flex-wrap">
        {EXPORT_CHOICES.map(({ format, label }) => (
          <Button
            key={format}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => download(format)}
            // Not `disabled`: the one pressed has the focus while its file is
            // fetched (the ref guards it), and gets it back usable.
            aria-disabled={preparing !== null || undefined}
            aria-busy={preparing === format || undefined}
            className="cursor-pointer whitespace-nowrap aria-disabled:cursor-default aria-disabled:opacity-50"
          >
            {preparing === format ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
