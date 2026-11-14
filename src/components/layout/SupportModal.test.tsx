import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { SupportModal } from '@/components/layout/SupportModal';
import { sendSupportTicket } from '@/lib/client/support';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/client/support', () => ({ sendSupportTicket: jest.fn() }));

const onClose = jest.fn();
const message = () => screen.getByLabelText('Message');
const send = () => screen.getByRole('button', { name: /send/i });
const type = (text: string) => fireEvent.change(message(), { target: { value: text } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(sendSupportTicket).mockResolvedValue(undefined);
});

it('sends one report, however many times Send is pressed', async () => {
  let sent!: () => void;
  jest.mocked(sendSupportTicket).mockReturnValue(new Promise<void>((resolve) => (sent = resolve)));
  render(<SupportModal open onClose={onClose} />);
  type('The queue page shows the wrong game first.');

  await act(async () => {
    fireEvent.click(send());
    fireEvent.click(send());
    fireEvent.click(send());
  });
  await act(async () => sent());

  expect(sendSupportTicket).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('can be sent again after a send that failed, with what was typed still there', async () => {
  jest.mocked(sendSupportTicket).mockRejectedValueOnce(new Error('Failed to submit'));
  render(<SupportModal open onClose={onClose} />);
  type('The queue page shows the wrong game first.');

  await act(async () => {
    fireEvent.click(send());
  });
  expect(toast.error).toHaveBeenCalledWith('Failed to submit');
  expect(message()).toHaveValue('The queue page shows the wrong game first.');

  await act(async () => {
    fireEvent.click(send());
  });
  expect(sendSupportTicket).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("says a message is too short without sending it, until it's changed", () => {
  render(<SupportModal open onClose={onClose} />);
  type('short');

  fireEvent.click(send());
  expect(screen.getByRole('alert')).toHaveTextContent('Message must be at least 10 characters');
  expect(sendSupportTicket).not.toHaveBeenCalled();

  type('short, but now longer');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('says a message is too long without sending it', () => {
  render(<SupportModal open onClose={onClose} />);
  type('x'.repeat(2001));

  fireEvent.click(send());

  expect(screen.getByRole('alert')).toHaveTextContent('Message must be at most 2000 characters');
  expect(sendSupportTicket).not.toHaveBeenCalled();
});

it('says which type is picked', () => {
  render(<SupportModal open onClose={onClose} />);
  expect(screen.getByRole('button', { name: 'Bug Report' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));

  expect(screen.getByRole('button', { name: 'Feedback' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Bug Report' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
