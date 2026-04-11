export type AuthMode = 'login' | 'signup' | 'forgot-password';

export interface AuthError {
  message: string;
  field?: string;
}
