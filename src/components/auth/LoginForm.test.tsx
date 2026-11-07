import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/LoginForm';

// Mock the Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
    },
  })),
}));

import { createClient } from '@/lib/supabase/client';

const mockCreateClient = createClient as jest.Mock;

describe('LoginForm', () => {
  const mockOnSuccess = jest.fn();
  const mockOnSwitchToSignUp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      },
    });
  });

  it('should render the login form', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'notanemail');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('should show validation error for short password', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('should call Supabase signInWithPassword on valid submission', async () => {
    const mockSignIn = jest.fn().mockResolvedValue({ error: null });
    mockCreateClient.mockReturnValue({
      auth: { signInWithPassword: mockSignIn },
    });

    const user = userEvent.setup();
    render(<LoginForm onSuccess={mockOnSuccess} />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('should show a generic error for invalid credentials', async () => {
    const mockSignIn = jest.fn().mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    mockCreateClient.mockReturnValue({
      auth: { signInWithPassword: mockSignIn },
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  it('should prompt email confirmation when account is unconfirmed', async () => {
    const mockSignIn = jest.fn().mockResolvedValue({
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    });
    mockCreateClient.mockReturnValue({
      auth: { signInWithPassword: mockSignIn },
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/confirm your email/i)).toBeInTheDocument();
    });
  });

  it('should render switch to sign up link when callback provided', () => {
    render(<LoginForm onSwitchToSignUp={mockOnSwitchToSignUp} />);

    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('should call onSwitchToSignUp when sign up link is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSwitchToSignUp={mockOnSwitchToSignUp} />);

    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(mockOnSwitchToSignUp).toHaveBeenCalled();
  });

  it('should clear field error when user starts typing', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 't');

    await waitFor(() => {
      expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
    });
  });
});
