'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';

type TicketType = 'bug' | 'feedback' | 'support';

const TYPE_LABELS: Record<TicketType, string> = {
  bug: 'Bug Report',
  feedback: 'Feedback',
  support: 'Support',
};

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

export function SupportModal({ open, onClose }: SupportModalProps) {
  const [type, setType] = useState<TicketType>('bug');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleClose = () => {
    setType('bug');
    setMessage('');
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (message.trim().length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }
    if (message.trim().length > 2000) {
      setError('Message must be at most 2000 characters');
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to submit');
      } else {
        toast.success('Report sent — thanks!');
        handleClose();
      }
    });
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="Report an issue" size="md">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-400">Type</p>
          <div className="flex gap-2">
            {(Object.keys(TYPE_LABELS) as TicketType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  type === t
                    ? 'border-zinc-600 bg-zinc-800 text-zinc-100 font-medium'
                    : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="support-message" className="text-xs font-medium text-zinc-400">
            Message
          </label>
          <textarea
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Describe your issue or feedback..."
            className={`mt-1.5 block w-full resize-none rounded-lg border bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-colors ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-zinc-700 focus:border-zinc-600 focus:ring-zinc-600'
            }`}
          />
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          <p className="mt-1 text-xs text-zinc-600 text-right">{message.length}/2000</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="cursor-pointer rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-white transition-colors"
          >
            {pending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
