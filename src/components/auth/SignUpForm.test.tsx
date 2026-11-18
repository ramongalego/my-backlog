import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignUpForm } from '@/components/auth/SignUpForm';

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
    },
  })),
}));

import { createClient } from '@/lib/supabase/client';

const mockCreateClient = createClient as jest.Mock;

describe('SignUpForm', () => {
  const mockOnSwitchToLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      auth: {
        signUp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    });
  });

  it('should render the sign up form', () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('should show validation error when passwords do not match', async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPassword123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('should show validation error for weak password', async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password');
    await user.type(screen.getByLabelText(/confirm password/i), 'password');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/uppercase letter.*lowercase letter.*number/i)).toBeInTheDocument();
    });
  });

  it('should call Supabase signUp and show the check-your-email state on valid submission', async () => {
    const mockSignUp = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
    mockCreateClient.mockReturnValue({
      auth: { signUp: mockSignUp },
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'Password123',
        }),
      );
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    });
  });

  it('says the email already has an account, and offers to sign in, instead of promising an email', async () => {
    // Supabase's stand-in user for an existing email: no sign-in methods.
    const mockSignUp = jest.fn().mockResolvedValue({
      data: { session: null, user: { id: 'x', identities: [] } },
      error: null,
    });
    mockCreateClient.mockReturnValue({ auth: { signUp: mockSignUp } });
    const onSwitchToLogin = jest.fn();

    const user = userEvent.setup();
    render(<SignUpForm onSwitchToLogin={onSwitchToLogin} />);
    await user.type(screen.getByLabelText(/^email$/i), 'taken@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email already has an account.',
    );
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign in instead' }));
    expect(onSwitchToLogin).toHaveBeenCalled();
  });

  it('should display server error when sign up fails', async () => {
    const mockSignUp = jest.fn().mockResolvedValue({
      data: { session: null },
      error: { message: 'Email already registered' },
    });
    mockCreateClient.mockReturnValue({
      auth: { signUp: mockSignUp },
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  it('should render switch to login link when callback provided', () => {
    render(<SignUpForm onSwitchToLogin={mockOnSwitchToLogin} />);

    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should call onSwitchToLogin when sign in link is clicked', async () => {
    const user = userEvent.setup();
    render(<SignUpForm onSwitchToLogin={mockOnSwitchToLogin} />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockOnSwitchToLogin).toHaveBeenCalled();
  });
});

it('signs up once, however many times the form is submitted before the button shows it', async () => {
  let answer!: (value: unknown) => void;
  const signUp = jest.fn(() => new Promise((resolve) => (answer = resolve)));
  mockCreateClient.mockReturnValue({ auth: { signUp } });
  render(<SignUpForm />);
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Password123' } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'Password123' },
  });
  const form = screen.getByLabelText(/^email$/i).closest('form')!;

  await act(async () => {
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  await act(async () =>
    answer({ data: { session: null, user: { identities: [{}] } }, error: null }),
  );

  expect(signUp).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
});
