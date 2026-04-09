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
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  icon,
  align = 'right',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-zinc-400 text-base hover:text-zinc-200 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon}
        {selected?.label}
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-10 min-w-[140px] ${align === 'left' ? 'left-0' : 'right-0'}`}
        >
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={value === option.value}>
              <button
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-zinc-800 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <span className={value === option.value ? 'text-zinc-100' : 'text-zinc-400'}>
                  {option.label}
                </span>
                {value === option.value && <Check className="w-3.5 h-3.5 text-zinc-400" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
