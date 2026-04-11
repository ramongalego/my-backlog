'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import type { AuthMode } from '@/types/auth';

interface AuthModalContentProps {
  initialMode: AuthMode;
  onLoginSuccess: () => void;
}

const TITLES: Record<AuthMode, string> = {
  login: 'Welcome Back',
  signup: 'Create Account',
  'forgot-password': 'Reset Password',
};

function AuthModalContent({ initialMode, onLoginSuccess }: AuthModalContentProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  return (
    <>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{TITLES[mode]}</h2>
      {mode === 'login' && (
        <LoginForm
          onSuccess={onLoginSuccess}
          onSwitchToSignUp={() => setMode('signup')}
          onSwitchToForgotPassword={() => setMode('forgot-password')}
        />
      )}
      {mode === 'signup' && <SignUpForm onSwitchToLogin={() => setMode('login')} />}
      {mode === 'forgot-password' && (
        <ForgotPasswordForm onSwitchToLogin={() => setMode('login')} />
      )}
    </>
  );
}

function SigningInContent() {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      <p className="text-sm text-zinc-400">Signing in…</p>
    </div>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleLoginSuccess = () => {
    setIsSigningIn(true);
    window.location.reload();
  };

  return (
    <Modal isOpen={isOpen} onClose={isSigningIn ? undefined : onClose}>
      {isOpen &&
        (isSigningIn ? (
          <SigningInContent />
        ) : (
          <AuthModalContent
            key={initialMode}
            initialMode={initialMode}
            onLoginSuccess={handleLoginSuccess}
          />
        ))}
    </Modal>
  );
}
