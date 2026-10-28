import { FIELD_LABEL, fieldClass } from '@/components/ui/Input';

/** Hours played, for games added by hand (Steam tracks its own). */
export function HoursField({
  value,
  onChange,
  error,
  platform,
  optional = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  /** The console it's played on, named in the label. */
  platform?: string | null;
  optional?: boolean;
}) {
  return (
    <div>
      <label className={FIELD_LABEL} htmlFor="detail-hours">
        Hours played
        {platform ? ` on ${platform}` : ''}
        {optional && <span className="text-ink-500 font-normal"> (optional)</span>}
      </label>
      <input
        id="detail-hours"
        type="number"
        min={0}
        step={0.5}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Not tracked"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'detail-hours-error' : undefined}
        className={`${fieldClass(!!error)} px-3 py-2 text-sm`}
      />
      {error && (
        <p id="detail-hours-error" className="text-rose-400 text-xs mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
