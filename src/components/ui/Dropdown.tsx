'use client';

import { useState, useRef, useEffect, useId, ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** Shown after the label in a quieter tone: how many games the choice lists. */
  count?: number;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  /**
   * Which edge the menu lines up with. `responsive`: left on phones, right
   * from `sm` up. `responsive-left` is the other way round, for a control at
   * the end of its row on phones.
   */
  align?: 'left' | 'right' | 'responsive' | 'responsive-left';
  /** What the choice is for, e.g. "Sort by". Screen readers hear it with the current value. */
  'aria-label'?: string;
  /** Inside a sentence: the value reads as underlined text in the sentence's own type. */
  inline?: boolean;
  /** Added to the trigger: its padding and hover fill when it's part of a toolbar control. */
  triggerClassName?: string;
  /**
   * The trigger's text colors, in place of the usual quiet ones: for a
   * control that's lit while its choice narrows the page.
   */
  triggerTone?: string;
  /** Added to the value shown in the trigger, e.g. to cut a long one short. */
  labelClassName?: string;
}

const ALIGN_CLASS = {
  left: 'left-0 origin-top-left',
  right: 'right-0 origin-top-right',
  responsive: 'left-0 sm:left-auto sm:right-0 origin-top-left sm:origin-top-right',
  'responsive-left': 'right-0 sm:right-auto sm:left-0 origin-top-right sm:origin-top-left',
};

/**
 * A select-style menu following the ARIA listbox pattern: the list takes focus
 * and tracks the highlighted option with aria-activedescendant, so the
 * options themselves aren't separate tab stops or nested buttons.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  icon,
  align = 'right',
  'aria-label': ariaLabel,
  inline = false,
  triggerClassName = '',
  triggerTone = 'text-ink-300 hover:text-ink-50',
  labelClassName,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-option-${i}`;

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // A long list scrolls: the highlighted option stays in sight as the arrow
  // keys move through it, and the chosen one is in sight when it opens. Only
  // the list is scrolled (scrollIntoView would move the page under it too).
  useEffect(() => {
    const list = listRef.current;
    const option = list?.children[activeIndex] as HTMLElement | undefined;
    if (!open || !list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [open, activeIndex]);

  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (i: number) => {
    onChange(options[i].value);
    close(true);
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') setActiveIndex((i) => Math.min(i + 1, last));
    else if (e.key === 'ArrowUp') setActiveIndex((i) => Math.max(i - 1, 0));
    else if (e.key === 'Home') setActiveIndex(0);
    else if (e.key === 'End') setActiveIndex(last);
    else if (e.key === 'Enter' || e.key === ' ') choose(activeIndex);
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') return close(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className={inline ? 'relative inline-block' : 'relative'} ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            openList();
          }
        }}
        className={
          inline
            ? 'group cursor-pointer text-left text-ink-100 hover:text-ink-50 transition-colors'
            : `flex items-center gap-2 h-10 text-sm font-medium transition-colors cursor-pointer ${triggerTone} ${triggerClassName}`
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        // Keeps the visible value in the name (WCAG 2.5.3, label in name).
        aria-label={ariaLabel ? `${ariaLabel}: ${selected?.label}` : undefined}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        {/* The underline sits on the label: it doesn't carry into an
            inline-block from the button. */}
        <span
          className={
            inline
              ? 'underline decoration-ink-500 underline-offset-4 group-hover:decoration-ink-300 transition-colors'
              : labelClassName
          }
        >
          {selected?.label}
        </span>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={optionId(activeIndex)}
          onKeyDown={handleListKeyDown}
          onBlur={(e) => {
            if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
          }}
          // As wide as its longest option, up to a width that fits a phone;
          // as tall as the screen has room for, then it scrolls.
          className={`absolute top-full mt-1 bg-ink-900 border border-ink-700 rounded-lg shadow-lg z-10 w-max min-w-40 max-w-64 max-h-[min(30rem,70vh)] overflow-y-auto overscroll-contain py-1 focus:outline-none animate-menu-in motion-reduce:animate-overlay-in ${ALIGN_CLASS[align]}`}
        >
          {options.map((option, i) => {
            const isSelected = value === option.value;
            return (
              <li
                key={option.value}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                // Keep focus on the list so its blur handler doesn't close it mid-click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm cursor-pointer transition-colors ${
                  activeIndex === i ? 'bg-ink-800' : ''
                } ${isSelected ? 'text-ink-100' : 'text-ink-400'}`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {/* A space, so the option reads "Switch 2 19 games", not "Switch 219". */}{' '}
                {option.count !== undefined && (
                  <span className="text-xs tabular-nums text-ink-400">
                    {option.count}
                    <span className="sr-only"> {option.count === 1 ? 'game' : 'games'}</span>
                  </span>
                )}
                {/* The check keeps the right edge, and its room when there's none. */}
                <span className="ml-auto flex w-3.5 shrink-0 pl-2 box-content">
                  {isSelected && <Check className="w-3.5 h-3.5 text-ink-400" aria-hidden="true" />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
