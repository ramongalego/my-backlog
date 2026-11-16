'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import type { AuthMode } from '@/types/auth';
import { reloadAtTop } from '@/lib/reload';

interface AuthModalContentProps {
  initialMode: AuthMode;
  onLoginSuccess: () => void;
}

const TITLE_ID = 'auth-modal-title';

const TITLES: Record<AuthMode, string> = {
  login: 'Welcome Back',
  signup: 'Create Account',
  'forgot-password': 'Reset Password',
};

function AuthModalContent({ initialMode, onLoginSuccess }: AuthModalContentProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // The dialog opens with focus on its title, not in a field: nothing is
  // outlined, no keyboard or saved-password list opens over the form before
  // a way to sign in is chosen, and Tab goes on to the first button.
  // Switching form removes the link that was pressed, and focus with it: it
  // moves to the new form's title the same way.
  const title = useRef<HTMLHeadingElement>(null);
  const shown = useRef(mode);
  useEffect(() => {
    if (shown.current === mode) return;
    shown.current = mode;
    title.current?.focus();
  }, [mode]);

  return (
    <>
      <h2
        ref={title}
        id={TITLE_ID}
        tabIndex={-1}
        data-autofocus
        className="text-xl font-semibold tracking-tight text-ink-50 mb-6 outline-none"
      >
        {TITLES[mode]}
      </h2>
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
    <div className="flex flex-col items-center justify-center py-8 gap-3" role="status">
      <Loader2 className="w-8 h-8 text-accent-400 animate-spin" aria-hidden="true" />
      <p className="text-sm text-ink-400">Signing in…</p>
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
    reloadAtTop();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSigningIn ? undefined : onClose}
      labelledBy={isSigningIn ? undefined : TITLE_ID}
      ariaLabel="Signing in"
    >
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
