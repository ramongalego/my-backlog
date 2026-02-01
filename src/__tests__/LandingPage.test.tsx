import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from '@/components/LandingPage';
import type { User } from '@supabase/supabase-js';

// Mock the auth modal since it has its own tests
jest.mock('@/components/auth/AuthModal', () => ({
  AuthModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="auth-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Mock the Header component
jest.mock('@/components/Header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

describe('LandingPage', () => {
  const mockOnConnectSteam = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('content', () => {
    it('should render the headline', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      expect(screen.getByText('Stop scrolling.')).toBeInTheDocument();
      expect(screen.getByText('Start playing.')).toBeInTheDocument();
    });

    it('should render the description', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      expect(
        screen.getByText(/Connect your Steam library and let us pick your next game/)
      ).toBeInTheDocument();
    });

    it('should render the 3-step process', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Connect Steam')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Set your mood')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Play')).toBeInTheDocument();
    });

    it('should render the footer', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      expect(screen.getByText('MyBacklog')).toBeInTheDocument();
    });

    it('should render the header', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      expect(screen.getByTestId('header')).toBeInTheDocument();
    });
  });

  describe('unauthenticated user', () => {
    it('should show "Get Started" button when user is not logged in', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      expect(screen.getByText('Get Started')).toBeInTheDocument();
      expect(screen.queryByText('Connect Your Steam')).not.toBeInTheDocument();
    });

    it('should open auth modal when "Get Started" is clicked', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      const button = screen.getByText('Get Started');
      fireEvent.click(button);

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
    });

    it('should close auth modal when close is triggered', () => {
      render(<LandingPage user={null} onConnectSteam={mockOnConnectSteam} />);

      // Open modal
      fireEvent.click(screen.getByText('Get Started'));
      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByText('Close'));
      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });
  });

  describe('authenticated user without Steam', () => {
    const mockUser = { id: 'user-123' } as User;

    it('should show "Connect Your Steam" button when user is logged in', () => {
      render(<LandingPage user={mockUser} onConnectSteam={mockOnConnectSteam} />);

      expect(screen.getByText('Connect Your Steam')).toBeInTheDocument();
      expect(screen.queryByText('Get Started')).not.toBeInTheDocument();
    });

    it('should call onConnectSteam when "Connect Your Steam" is clicked', () => {
      render(<LandingPage user={mockUser} onConnectSteam={mockOnConnectSteam} />);

      const button = screen.getByText('Connect Your Steam');
      fireEvent.click(button);

      expect(mockOnConnectSteam).toHaveBeenCalledTimes(1);
    });

    it('should not open auth modal when "Connect Your Steam" is clicked', () => {
      render(<LandingPage user={mockUser} onConnectSteam={mockOnConnectSteam} />);

      const button = screen.getByText('Connect Your Steam');
      fireEvent.click(button);

      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });
  });
});
