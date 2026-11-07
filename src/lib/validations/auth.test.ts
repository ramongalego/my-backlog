import { loginSchema, signUpSchema } from '@/lib/validations/auth';

describe('loginSchema', () => {
  it('should pass with valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should fail with empty email', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'password123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Email is required');
    }
  });

  it('should fail with invalid email format', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Please enter a valid email address');
    }
  });

  it('should fail with empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password is required');
    }
  });

  it('should fail with password shorter than 8 characters', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must be at least 8 characters');
    }
  });
});

describe('signUpSchema', () => {
  it('should pass with valid data', () => {
    const result = signUpSchema.safeParse({
      email: 'test@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(result.success).toBe(true);
  });

  it('should fail when passwords do not match', () => {
    const result = signUpSchema.safeParse({
      email: 'test@example.com',
      password: 'Password123',
      confirmPassword: 'DifferentPassword123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.issues.find((e) => e.path[0] === 'confirmPassword');
      expect(confirmError?.message).toBe('Passwords do not match');
    }
  });

  it('should fail with password missing uppercase letter', () => {
    const result = signUpSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordError = result.error.issues.find((e) => e.path[0] === 'password');
      expect(passwordError?.message).toContain('uppercase letter');
    }
  });

  it('should fail with password missing lowercase letter', () => {
    const result = signUpSchema.safeParse({
      email: 'test@example.com',
      password: 'PASSWORD123',
      confirmPassword: 'PASSWORD123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordError = result.error.issues.find((e) => e.path[0] === 'password');
      expect(passwordError?.message).toContain('lowercase letter');
    }
  });

  it('should fail with password missing number', () => {
    const result = signUpSchema.safeParse({
      email: 'test@example.com',
      password: 'PasswordABC',
      confirmPassword: 'PasswordABC',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordError = result.error.issues.find((e) => e.path[0] === 'password');
      expect(passwordError?.message).toContain('one number');
    }
  });

  it('should fail with empty confirm password', () => {
    const result = signUpSchema.safeParse({
      email: 'test@example.com',
      password: 'Password123',
      confirmPassword: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.issues.find((e) => e.path[0] === 'confirmPassword');
      expect(confirmError?.message).toBe('Please confirm your password');
    }
  });
});
