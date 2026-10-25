'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { fieldClass } from '@/components/ui/Input';

export const NOTE_MAX_LENGTH = 1000;

/**
 * Reveals a secondary control on row hover or keyboard focus, and always on
 * touch screens, where there is no hover. Needs a `group/row` ancestor.
 */
export const ROW_REVEAL =
  'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 transition-opacity';

const LINK_BUTTON =
  'cursor-pointer text-xs font-medium text-ink-400 hover:text-ink-100 transition-colors';

/** A diary entry's note, clamped to two lines with a toggle when it runs longer. */
export function DiaryNoteText({
  text,
  gameName,
  onEdit,
}: {
  text: string;
  gameName: string;
  onEdit: () => void;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  // Only offer "Show more" when the clamp actually hides something.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="mt-1.5 max-w-[68ch]">
      <p
        ref={ref}
        className={`text-sm text-ink-300 leading-relaxed whitespace-pre-line break-words ${
          expanded ? '' : 'line-clamp-2'
        }`}
      >
        {text}
      </p>
      <div className="mt-1 flex items-center gap-4">
        {(clamped || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className={LINK_BUTTON}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit note for ${gameName}`}
          className={`${LINK_BUTTON} ${ROW_REVEAL}`}
        >
          Edit note
        </button>
      </div>
    </div>
  );
}

/** Inline editor for a diary note. Empty and save to remove the note. */
export function DiaryNoteEditor({
  initialText,
  gameName,
  onSave,
  onCancel,
}: {
  initialText: string;
  gameName: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const save = () => onSave(text.trim());

  return (
    <div className="mt-2 max-w-[68ch]">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        rows={3}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="What did you think of it?"
        aria-label={`Note for ${gameName}`}
        // Grows with the text (where supported) between about 3 and 12 lines.
        className={`${fieldClass()} px-3 py-2 text-sm leading-relaxed resize-y field-sizing-content min-h-20 max-h-72`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} className="cursor-pointer">
          Save note
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="cursor-pointer">
          Cancel
        </Button>
        <span className="ml-auto text-xs text-ink-500 tabular-nums">
          {text.length}/{NOTE_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
