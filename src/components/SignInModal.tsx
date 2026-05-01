import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Github, Apple, Loader2, X, ArrowLeft, LogIn, UserPlus } from 'lucide-react';
import { signInWithGoogle, signInWithApple, signInEmail, signUpEmail, sendPasswordReset, logGameEvent } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useModalA11y } from '../hooks/useModalA11y';
import googleLogo from '../assets/ui/google.svg';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthView = 'main' | 'email-signin' | 'email-signup';

const getFirebaseErrorCode = (error: unknown): string | null => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const value = (error as { code?: unknown }).code;
    return typeof value === 'string' ? value : null;
  }
  return null;
};

const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  'auth/user-not-found':          'No account found with that email address.',
  'auth/invalid-credential':      'Incorrect email or password. Please try again.',
  'auth/wrong-password':          'Incorrect password. Please try again.',
  'auth/invalid-email':           'That email address doesn\'t look right.',
  'auth/email-already-in-use':    'An account with this email already exists. Try signing in instead.',
  'auth/weak-password':           'Password must be at least 6 characters.',
  'auth/too-many-requests':       'Too many failed attempts. Please wait a moment before trying again.',
  'auth/network-request-failed':  'Network error. Please check your connection and try again.',
  'auth/user-disabled':           'This account has been disabled. Please contact support.',
  'auth/missing-email':           'Please enter your email address first.',
};

const getErrorMessage = (error: unknown): string => {
  const code = getFirebaseErrorCode(error);
  if (code && FIREBASE_AUTH_MESSAGES[code]) return FIREBASE_AUTH_MESSAGES[code];
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
};

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [view, setView] = useState<AuthView>('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleClose = () => {
    setLoading(false);
    setError(null);
    setInfo(null);
    setView('main');
    onClose();
  };

  // Reset transient state whenever the modal is hidden so a subsequent open
  // starts clean. Focus + Escape handling live in useModalA11y.
  useEffect(() => {
    if (isOpen) return;
    setLoading(false);
    setError(null);
    setInfo(null);
    setView('main');
  }, [isOpen]);

  const { initialFocusRef: closeButtonRef, dialogRef } = useModalA11y<HTMLButtonElement>({
    isOpen,
    onClose: handleClose,
  });

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError('Enter your email above, then tap "Forgot password?" again.');
      return;
    }
    setLoading(true);
    logGameEvent('password_reset_attempt');
    try {
      await sendPasswordReset(email);
      logGameEvent('password_reset_sent');
      setInfo(`Password reset email sent to ${email}. Check your inbox.`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSignIn = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError(null);
    logGameEvent('login_attempt', { provider });
    try {
      if (provider === 'google') await signInWithGoogle();
      else if (provider === 'apple') await signInWithApple();
      logGameEvent('login_success', { provider });
      onClose();
    } catch (err: unknown) {
      const code = getFirebaseErrorCode(err);
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // Treat early popup close/cancel as a non-fatal interruption.
        setError(null);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const mode = view === 'email-signin' ? 'signin' : 'signup';
    logGameEvent('email_auth_attempt', { mode });
    try {
      if (view === 'email-signin') {
        await signInEmail(email, password);
      } else {
        await signUpEmail(email, password, name);
      }
      logGameEvent('email_auth_success', { mode });
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            aria-describedby="signin-desc"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-surface rounded-[24px] shadow-2xl p-8 max-w-sm w-full border border-border-theme overflow-hidden"
          >
            <button 
              ref={closeButtonRef}
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-main hover:bg-bg-theme rounded-full transition-colors"
              aria-label="Close sign in dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-8">
              <h2 id="signin-title" className="text-2xl font-bold text-text-main">Sign In Options</h2>
              <p id="signin-desc" className="text-text-muted text-sm mt-1">Authenticate to save your progress</p>
            </div>

            {error && (
              <div role="alert" className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-medium text-center">
                {error}
              </div>
            )}

            {info && (
              <div role="status" aria-live="polite" className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs font-medium text-center">
                {info}
              </div>
            )}

            {view === 'main' ? (
              <div className="space-y-3">
                <button
                  onClick={() => handleProviderSignIn('google')}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-white hover:bg-gray-50 text-gray-900 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-sm border border-gray-200"
                  aria-label="Continue with Google"
                >
                  <img src={googleLogo} className="w-5 h-5" alt="Google" />
                  Continue with Google
                </button>

                <button
                  onClick={() => handleProviderSignIn('apple')}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-black hover:bg-zinc-900 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-sm"
                  aria-label="Sign in with Apple"
                >
                  <svg viewBox="0 0 384 512" className="w-5 h-5 fill-current">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                  </svg>
                  Sign in with Apple
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border-theme"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                    <span className="bg-surface px-4 text-text-muted">Or Email</span>
                  </div>
                </div>

                <button
                  onClick={() => setView('email-signin')}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-bg-theme hover:bg-surface text-text-main border border-border-theme rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3"
                  aria-label="Sign in with email"
                >
                  <Mail className="w-5 h-5" />
                  Sign In with Email
                </button>
                
                <p className="text-center text-[10px] text-text-muted mt-4">
                  Don't have an account?{' '}
                  <button 
                    onClick={() => setView('email-signup')}
                    className="text-primary-theme hover:underline font-bold"
                  >
                    Create one
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <button 
                  type="button"
                  onClick={() => setView('main')}
                  className="flex items-center gap-2 text-text-muted hover:text-text-main text-xs font-bold mb-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to choices
                </button>

                {view === 'email-signup' && (
                  <div>
                    <label htmlFor="display-name" className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5 ml-1">Display Name</label>
                    <input
                      id="display-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-bg-theme border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-main focus:ring-1 focus:ring-primary-theme outline-none transition-all placeholder:text-text-muted/30"
                      placeholder="e.g. MemoryMaster"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email-address" className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5 ml-1">Email Address</label>
                  <input
                    id="email-address"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg-theme border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-main focus:ring-1 focus:ring-primary-theme outline-none transition-all placeholder:text-text-muted/30"
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 ml-1">
                    <label htmlFor="password" className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Password</label>
                    {view === 'email-signin' && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading}
                        className="text-[10px] font-bold text-primary-theme hover:underline uppercase tracking-wider disabled:opacity-50"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-bg-theme border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-main focus:ring-1 focus:ring-primary-theme outline-none transition-all placeholder:text-text-muted/30"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary-theme hover:bg-primary-theme/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-theme/20 transition-all flex items-center justify-center gap-2 mt-6"
                  aria-label={view === 'email-signin' ? 'Submit email sign in form' : 'Submit email sign up form'}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : view === 'email-signin' ? (
                    <>
                      <LogIn className="w-5 h-5" /> Sign In
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" /> Sign Up
                    </>
                  )}
                </button>

                {view === 'email-signin' ? (
                  <p className="text-center text-[10px] text-text-muted mt-4">
                    New here?{' '}
                    <button 
                      type="button"
                      onClick={() => setView('email-signup')}
                      className="text-primary-theme hover:underline font-bold"
                    >
                      Create an account
                    </button>
                  </p>
                ) : (
                  <p className="text-center text-[10px] text-text-muted mt-4">
                    Already have an account?{' '}
                    <button 
                      type="button"
                      onClick={() => setView('email-signin')}
                      className="text-primary-theme hover:underline font-bold"
                    >
                      Sign in here
                    </button>
                  </p>
                )}
              </form>
            )}
            
            {loading && (
              <div className="absolute inset-0 bg-surface/50 backdrop-blur-[2px] flex items-center justify-center z-10 transition-all">
                <Loader2 className="w-8 h-8 text-primary-theme animate-spin" />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
