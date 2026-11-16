import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

export const signUpSchema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * A new password, by the same rules as signing up, and no longer than Supabase
 * Auth takes (72 characters, its hashing limit).
 */
const newPassword = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  );

/** Changing the password from the profile: the current one, then the new one twice. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => !data.currentPassword || data.password !== data.currentPassword, {
    message: "That's your current password. Pick a new one",
    path: ['password'],
  });

/** What the browser sends to change the password (the confirmation stays in the form). */
export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword,
});

/** What the browser sends to change the email: the new one, and the password to confirm it. */
export const changeEmailBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(254)
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(200),
});

/** Changing the email from the profile. */
export const changeEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(254)
    .email('Please enter a valid email address'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type ChangeEmailFormData = z.infer<typeof changeEmailSchema>;
