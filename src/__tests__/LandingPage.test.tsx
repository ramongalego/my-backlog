import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from '@/components/LandingPage';
import type { User } from '@supabase/supabase-js';

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

describe('LandingPage', () => {
  const mockOnConnectSteam = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unauthenticated user', () => {
    it('shows "Get Started" and not "Connect Your Steam"', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      expect(screen.getAllByRole('button', { name: /get started/i }).length).toBeGreaterThan(0);
      expect(screen.queryByText('Connect Your Steam')).not.toBeInTheDocument();
    });

    it('opens auth modal when "Get Started" is clicked', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      fireEvent.click(screen.getAllByRole('button', { name: /get started/i })[0]);

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
    });

    it('closes auth modal when close is triggered', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      fireEvent.click(screen.getAllByRole('button', { name: /get started/i })[0]);
      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Close'));
      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });
  });

  describe('authenticated user without Steam', () => {
    const mockUser = { id: 'user-123' } as User;

    it('shows "Connect Your Steam" and not "Get Started"', () => {
      render(<LandingPage user={mockUser} onConnectSteam={mockOnConnectSteam} />);

      expect(screen.getAllByText('Connect Your Steam').length).toBeGreaterThan(0);
      expect(screen.queryAllByRole('button', { name: /get started/i })).toHaveLength(0);
    });

    it('calls onConnectSteam when "Connect Your Steam" is clicked', () => {
      render(<LandingPage user={mockUser} onConnectSteam={mockOnConnectSteam} />);

      fireEvent.click(screen.getAllByText('Connect Your Steam')[0]);

      expect(mockOnConnectSteam).toHaveBeenCalledTimes(1);
    });

    it('does not open auth modal when "Connect Your Steam" is clicked', () => {
      render(<LandingPage user={mockUser} onConnectSteam={mockOnConnectSteam} />);

      fireEvent.click(screen.getAllByText('Connect Your Steam')[0]);

      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });
  });
});
