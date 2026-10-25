'use client';

import { useState, useRef, useEffect, useId, ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  /** Which edge the menu lines up with. `responsive`: left on phones, right from `sm` up. */
  align?: 'left' | 'right' | 'responsive';
  /** What the choice is for, e.g. "Sort by". Screen readers hear it with the current value. */
  'aria-label'?: string;
}

const ALIGN_CLASS = {
  left: 'left-0',
  right: 'right-0',
  responsive: 'left-0 sm:left-auto sm:right-0',
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
    <div className="relative" ref={ref}>
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
        className="flex items-center gap-2 h-10 text-sm font-medium text-ink-300 hover:text-ink-50 transition-colors cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        // Keeps the visible value in the name (WCAG 2.5.3, label in name).
        aria-label={ariaLabel ? `${ariaLabel}: ${selected?.label}` : undefined}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        <span>{selected?.label}</span>
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
          className={`absolute top-full mt-1 bg-ink-900 border border-ink-700 rounded-lg shadow-lg z-10 w-max min-w-40 py-1 focus:outline-none ${ALIGN_CLASS[align]}`}
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
                className={`flex items-center justify-between gap-4 whitespace-nowrap px-3 py-2 text-sm cursor-pointer transition-colors ${
                  activeIndex === i ? 'bg-ink-800' : ''
                } ${isSelected ? 'text-ink-100' : 'text-ink-400'}`}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-ink-400" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
