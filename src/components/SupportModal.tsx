'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { FIELD_LABEL, fieldClass } from '@/components/ui/Input';
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
      try {
        const res = await fetch('/api/support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, message }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? 'Failed to submit');
        } else {
          toast.success('Report sent. Thanks!');
          handleClose();
        }
      } catch {
        toast.error('Failed to submit. Please check your connection and try again.');
      }
    });
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="Report an issue" size="md">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-ink-400">Type</p>
          <div className="flex gap-2">
            {(Object.keys(TYPE_LABELS) as TicketType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  type === t
                    ? 'border-ink-600 bg-ink-800 text-ink-100 font-medium'
                    : 'border-ink-700 text-ink-400 hover:bg-ink-800 hover:text-ink-200'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="support-message" className={FIELD_LABEL}>
            Message
          </label>
          <textarea
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Describe your issue or feedback..."
            className={`${fieldClass(!!error)} block px-3 py-2 text-sm resize-none`}
          />
          {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
          <p className="mt-1 text-xs text-ink-500 text-right">{message.length}/2000</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={handleClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} isLoading={pending} className="cursor-pointer">
            {pending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
