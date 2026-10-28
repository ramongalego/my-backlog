import { FIELD_LABEL, fieldClass } from '@/components/ui/Input';

const NOTES_MAX = 1000;

/** Rating and notes, kept for finished and dropped games. */
export function ReviewFields({
  rating,
  onRatingChange,
  ratingError,
  notes,
  onNotesChange,
}: {
  rating: string;
  onRatingChange: (value: string) => void;
  ratingError: string | null;
  notes: string;
  onNotesChange: (value: string) => void;
}) {
  return (
    <>
      <div>
        <label className={FIELD_LABEL} htmlFor="detail-rating">
          Your rating (0–10)
        </label>
        <input
          id="detail-rating"
          type="number"
          min={0}
          max={10}
          value={rating}
          onChange={(e) => onRatingChange(e.target.value)}
          placeholder="Unrated"
          aria-invalid={ratingError ? true : undefined}
          aria-describedby={ratingError ? 'detail-rating-error' : undefined}
          className={`${fieldClass(!!ratingError)} px-3 py-2 text-sm`}
        />
        {ratingError && (
          <p id="detail-rating-error" className="text-rose-400 text-xs mt-1" role="alert">
            {ratingError}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-ink-300" htmlFor="detail-notes">
            Notes
          </label>
          {notes.length > 0 && (
            <span
              id="detail-notes-count"
              className={`text-xs tabular-nums ${notes.length >= NOTES_MAX ? 'text-rose-400' : 'text-ink-500'}`}
            >
              {notes.length}/{NOTES_MAX}
            </span>
          )}
        </div>
        <textarea
          id="detail-notes"
          aria-describedby={notes.length > 0 ? 'detail-notes-count' : undefined}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any thoughts?"
          rows={4}
          maxLength={NOTES_MAX}
          className={`${fieldClass()} px-3 py-2 text-sm resize-none`}
        />
      </div>
    </>
  );
}
