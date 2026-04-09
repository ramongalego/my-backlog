'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import type { AuthMode } from '@/types/auth';

interface AuthModalContentProps {
  initialMode: AuthMode;
  onSuccess: () => void;
}

function AuthModalContent({ initialMode, onSuccess }: AuthModalContentProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const title = mode === 'login' ? 'Welcome Back' : 'Create Account';

  return (
    <>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{title}</h2>
      {mode === 'login' ? (
        <LoginForm onSuccess={onSuccess} onSwitchToSignUp={() => setMode('signup')} />
      ) : (
        <SignUpForm onSuccess={onSuccess} onSwitchToLogin={() => setMode('login')} />
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

  const handleSuccess = () => {
    setIsSigningIn(true);
    window.location.reload();
  };

  return (
    <Modal isOpen={isOpen} onClose={isSigningIn ? undefined : onClose}>
      {isOpen && (
        isSigningIn ? (
          <SigningInContent />
        ) : (
          <AuthModalContent key={initialMode} initialMode={initialMode} onSuccess={handleSuccess} />
        )
      )}
    </Modal>
  );
}
