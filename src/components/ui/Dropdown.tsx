'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
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
  align?: 'left' | 'right';
  'aria-label'?: string;
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  icon,
  align = 'right',
  'aria-label': ariaLabel,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"] button');
    items?.[focusedIndex]?.focus();
  }, [open, focusedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = options.findIndex((opt) => opt.value === value);
        setFocusedIndex(idx >= 0 ? idx : 0);
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0) {
        onChange(options[focusedIndex].value);
        setOpen(false);
      }
    }
  };

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref} onKeyDown={handleKeyDown}>
      <button
        onClick={() => {
          setOpen((o) => {
            if (!o) {
              const idx = options.findIndex((opt) => opt.value === value);
              setFocusedIndex(idx >= 0 ? idx : 0);
            }
            return !o;
          });
        }}
        className="flex items-center gap-2 text-zinc-400 text-base hover:text-zinc-200 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        <span>{selected?.label}</span>
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className={`absolute top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-10 min-w-[140px] ${align === 'left' ? 'left-0' : 'right-0'}`}
        >
          {options.map((option, i) => (
            <li key={option.value} role="option" aria-selected={value === option.value}>
              <button
                tabIndex={-1}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(i)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  focusedIndex === i ? 'bg-zinc-800' : ''
                }`}
              >
                <span className={value === option.value ? 'text-zinc-100' : 'text-zinc-400'}>
                  {option.label}
                </span>
                {value === option.value && (
                  <Check className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
