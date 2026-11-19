import { type ReactNode } from 'react';
import { TruncatedText } from '@/components/ui/TruncatedText';

export function AccountRow({
  label,
  value,
  note,
  action,
  wideAction,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  /** The action is wider than a button: on the narrowest phones it goes under the value. */
  wideAction?: boolean;
}) {
  return (
    // A list, not a description list: a row also holds its button, which a
    // description list has no place for.
    <li
      className={`flex items-center justify-between gap-3 py-3 ${
        wideAction ? 'max-[359px]:flex-col max-[359px]:items-start' : ''
      }`}
    >
      <div className="min-w-0 max-w-full">
        <p className="text-xs text-ink-500">{label}</p>
        {typeof value === 'string' ? (
          <TruncatedText as="p" className="mt-0.5 truncate text-sm text-ink-100">
            {value}
          </TruncatedText>
        ) : (
          <p className="mt-0.5 truncate text-sm text-ink-100">{value}</p>
        )}
        {/* Wraps: it's read to check the address, so none of it is cut. */}
        {note && <p className="mt-0.5 text-xs text-ink-400 [overflow-wrap:anywhere]">{note}</p>}
      </div>
      {action}
    </li>
  );
}
