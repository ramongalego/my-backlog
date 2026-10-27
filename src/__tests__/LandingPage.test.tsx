import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from '@/components/LandingPage';

jest.mock('@/components/auth/AuthModal', () => ({
  AuthModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="auth-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

jest.mock('@/components/Header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

// Signed-in accounts, with or without Steam, go to Home instead.
describe('LandingPage', () => {
  it('shows "Get Started" and not "Connect Steam"', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('button', { name: /get started/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Connect Steam')).not.toBeInTheDocument();
  });

  // The modal is loaded with next/dynamic, so it appears asynchronously.
  it('opens auth modal when "Get Started" is clicked', async () => {
    render(<LandingPage />);

    fireEvent.click(screen.getAllByRole('button', { name: /get started/i })[0]);

    expect(await screen.findByTestId('auth-modal')).toBeInTheDocument();
  });

  it('closes auth modal when close is triggered', async () => {
    render(<LandingPage />);

    fireEvent.click(screen.getAllByRole('button', { name: /get started/i })[0]);
    expect(await screen.findByTestId('auth-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
  });
});
