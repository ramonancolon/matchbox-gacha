import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SignInModal } from '../../components/SignInModal';

// ─── module mocks ────────────────────────────────────────────────────────────

const mockSignInWithGoogle = vi.hoisted(() => vi.fn());
const mockSignInWithApple = vi.hoisted(() => vi.fn());
const mockSignInEmail = vi.hoisted(() => vi.fn());
const mockSignUpEmail = vi.hoisted(() => vi.fn());
const mockLogGameEvent = vi.hoisted(() => vi.fn());

vi.mock('../../lib/firebase', () => ({
  signInWithGoogle: mockSignInWithGoogle,
  signInWithApple: mockSignInWithApple,
  signInEmail: mockSignInEmail,
  signUpEmail: mockSignUpEmail,
  logGameEvent: mockLogGameEvent,
}));

vi.mock('motion/react', async () => {
  const React = (await import('react')).default;
  return {
    motion: {
      div: ({ children, initial, animate, exit, transition, ...props }: any) =>
        React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
  };
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const renderModal = (isOpen = true, onClose = vi.fn()) =>
  render(<SignInModal isOpen={isOpen} onClose={onClose} />);

describe('SignInModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── visibility ─────────────────────────────────────────────────────────────

  describe('visibility', () => {
    it('renders nothing when isOpen is false', () => {
      renderModal(false);
      expect(screen.queryByText('Sign In Options')).not.toBeInTheDocument();
    });

    it('renders the modal when isOpen is true', () => {
      renderModal(true);
      expect(screen.getByText('Sign In Options')).toBeInTheDocument();
    });

    it('shows Google and Apple sign-in buttons on the main view', () => {
      renderModal();
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Apple')).toBeInTheDocument();
    });

    it('shows the email sign-in button on the main view', () => {
      renderModal();
      expect(screen.getByText('Sign In with Email')).toBeInTheDocument();
    });

    it('shows a "Create one" link for new users', () => {
      renderModal();
      expect(screen.getByText('Create one')).toBeInTheDocument();
    });
  });

  // ─── close behaviour ────────────────────────────────────────────────────────

  describe('close behaviour', () => {
    it('calls onClose when the X button is clicked', async () => {
      const onClose = vi.fn();
      const { container } = renderModal(true, onClose);
      // The X button has no text/aria-label; select it by its position classes
      const xBtn = container.querySelector('button.absolute') as HTMLElement;
      expect(xBtn).not.toBeNull();
      fireEvent.click(xBtn!);
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when the backdrop is clicked', async () => {
      const onClose = vi.fn();
      const { container } = renderModal(true, onClose);
      // The first div with onClick is the backdrop overlay
      const backdrop = container.querySelector('[class*="absolute inset-0"]') as HTMLElement;
      if (backdrop) fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    });

    it('resets view to main when modal is closed and reopened', () => {
      const { rerender } = render(<SignInModal isOpen={true} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('Sign In with Email'));
      expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();

      rerender(<SignInModal isOpen={false} onClose={vi.fn()} />);
      rerender(<SignInModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.queryByPlaceholderText('name@example.com')).not.toBeInTheDocument();
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    });
  });

  // ─── Google sign-in ──────────────────────────────────────────────────────────

  describe('Google sign-in', () => {
    it('calls signInWithGoogle when the button is clicked', async () => {
      mockSignInWithGoogle.mockResolvedValue({ user: { uid: 'g1' } });
      renderModal();
      await userEvent.click(screen.getByText('Continue with Google'));
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });

    it('calls onClose after successful Google sign-in', async () => {
      const onClose = vi.fn();
      mockSignInWithGoogle.mockResolvedValue({ user: {} });
      renderModal(true, onClose);
      await userEvent.click(screen.getByText('Continue with Google'));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('shows an error message when Google sign-in fails with a general error', async () => {
      mockSignInWithGoogle.mockRejectedValue(new Error('network-request-failed'));
      renderModal();
      await userEvent.click(screen.getByText('Continue with Google'));
      await waitFor(() =>
        expect(screen.getByText('network-request-failed')).toBeInTheDocument()
      );
    });

    it('does NOT show an error when user closes the OAuth popup', async () => {
      mockSignInWithGoogle.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
      renderModal();
      await userEvent.click(screen.getByText('Continue with Google'));
      await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalled());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(/auth\/popup/i)).not.toBeInTheDocument();
    });

    it('logs a login_attempt event when Google sign-in starts', async () => {
      mockSignInWithGoogle.mockResolvedValue({ user: {} });
      renderModal();
      await userEvent.click(screen.getByText('Continue with Google'));
      expect(mockLogGameEvent).toHaveBeenCalledWith('login_attempt', { provider: 'google' });
    });

    it('logs a login_success event after successful Google sign-in', async () => {
      mockSignInWithGoogle.mockResolvedValue({ user: {} });
      renderModal();
      await userEvent.click(screen.getByText('Continue with Google'));
      await waitFor(() =>
        expect(mockLogGameEvent).toHaveBeenCalledWith('login_success', { provider: 'google' })
      );
    });
  });

  // ─── Apple sign-in ───────────────────────────────────────────────────────────

  describe('Apple sign-in', () => {
    it('calls signInWithApple when the button is clicked', async () => {
      mockSignInWithApple.mockResolvedValue({ user: {} });
      renderModal();
      await userEvent.click(screen.getByText('Sign in with Apple'));
      expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
    });

    it('calls onClose after successful Apple sign-in', async () => {
      const onClose = vi.fn();
      mockSignInWithApple.mockResolvedValue({ user: {} });
      renderModal(true, onClose);
      await userEvent.click(screen.getByText('Sign in with Apple'));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('does NOT show an error when the Apple OAuth popup is cancelled', async () => {
      mockSignInWithApple.mockRejectedValue({ code: 'auth/cancelled-popup-request' });
      renderModal();
      await userEvent.click(screen.getByText('Sign in with Apple'));
      await waitFor(() => expect(mockSignInWithApple).toHaveBeenCalled());
      expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument();
    });
  });

  // ─── email sign-in view ──────────────────────────────────────────────────────

  describe('email sign-in view', () => {
    it('navigates to email sign-in form on button click', async () => {
      renderModal();
      await userEvent.click(screen.getByText('Sign In with Email'));
      expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('returns to main view when "Back to choices" is clicked', async () => {
      renderModal();
      await userEvent.click(screen.getByText('Sign In with Email'));
      await userEvent.click(screen.getByText('Back to choices'));
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    });

    it('submits email and password when the sign-in form is submitted', async () => {
      mockSignInEmail.mockResolvedValue({ user: {} });
      renderModal();
      await userEvent.click(screen.getByText('Sign In with Email'));
      await userEvent.type(screen.getByPlaceholderText('name@example.com'), 'user@test.com');
      await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password123');
      await userEvent.click(screen.getByText('Sign In'));
      expect(mockSignInEmail).toHaveBeenCalledWith('user@test.com', 'password123');
    });

    it('calls onClose after successful email sign-in', async () => {
      const onClose = vi.fn();
      mockSignInEmail.mockResolvedValue({ user: {} });
      renderModal(true, onClose);
      await userEvent.click(screen.getByText('Sign In with Email'));
      await userEvent.type(screen.getByPlaceholderText('name@example.com'), 'u@t.com');
      await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass123');
      await userEvent.click(screen.getByText('Sign In'));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('shows an error message when sign-in fails', async () => {
      mockSignInEmail.mockRejectedValue(new Error('wrong-password'));
      renderModal();
      await userEvent.click(screen.getByText('Sign In with Email'));
      await userEvent.type(screen.getByPlaceholderText('name@example.com'), 'u@t.com');
      await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
      await userEvent.click(screen.getByText('Sign In'));
      await waitFor(() =>
        expect(screen.getByText('wrong-password')).toBeInTheDocument()
      );
    });

    it('can navigate to sign-up from the email sign-in view', async () => {
      renderModal();
      await userEvent.click(screen.getByText('Sign In with Email'));
      await userEvent.click(screen.getByText('Create an account'));
      expect(screen.getByPlaceholderText('e.g. MemoryMaster')).toBeInTheDocument();
    });
  });

  // ─── email sign-up view ──────────────────────────────────────────────────────

  describe('email sign-up view', () => {
    it('navigates to sign-up form when "Create one" is clicked', async () => {
      renderModal();
      await userEvent.click(screen.getByText('Create one'));
      expect(screen.getByPlaceholderText('e.g. MemoryMaster')).toBeInTheDocument();
    });

    it('shows name, email, and password fields on sign-up view', async () => {
      renderModal();
      await userEvent.click(screen.getByText('Create one'));
      expect(screen.getByPlaceholderText('e.g. MemoryMaster')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('submits name, email, and password when sign-up form is submitted', async () => {
      mockSignUpEmail.mockResolvedValue({ user: {} });
      renderModal();
      await userEvent.click(screen.getByText('Create one'));
      await userEvent.type(screen.getByPlaceholderText('e.g. MemoryMaster'), 'NewPlayer');
      await userEvent.type(screen.getByPlaceholderText('name@example.com'), 'new@test.com');
      await userEvent.type(screen.getByPlaceholderText('••••••••'), 'securepass');
      await userEvent.click(screen.getByText('Sign Up'));
      expect(mockSignUpEmail).toHaveBeenCalledWith('new@test.com', 'securepass', 'NewPlayer');
    });

    it('calls onClose after successful sign-up', async () => {
      const onClose = vi.fn();
      mockSignUpEmail.mockResolvedValue({ user: {} });
      renderModal(true, onClose);
      await userEvent.click(screen.getByText('Create one'));
      await userEvent.type(screen.getByPlaceholderText('e.g. MemoryMaster'), 'Player');
      await userEvent.type(screen.getByPlaceholderText('name@example.com'), 'p@t.com');
      await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass1234');
      await userEvent.click(screen.getByText('Sign Up'));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('shows an error message when sign-up fails', async () => {
      mockSignUpEmail.mockRejectedValue(new Error('email-already-in-use'));
      renderModal();
      await userEvent.click(screen.getByText('Create one'));
      await userEvent.type(screen.getByPlaceholderText('e.g. MemoryMaster'), 'Player');
      await userEvent.type(screen.getByPlaceholderText('name@example.com'), 'dupe@t.com');
      await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass1234');
      await userEvent.click(screen.getByText('Sign Up'));
      await waitFor(() =>
        expect(screen.getByText('email-already-in-use')).toBeInTheDocument()
      );
    });

    it('logs email_auth_attempt and email_auth_success events on sign-up', async () => {
      mockSignUpEmail.mockResolvedValue({ user: {} });
      renderModal();
      await userEvent.click(screen.getByText('Create one'));
      await userEvent.type(screen.getByPlaceholderText('e.g. MemoryMaster'), 'Player');
      await userEvent.type(screen.getByPlaceholderText('name@example.com'), 'p@t.com');
      await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass1234');
      await userEvent.click(screen.getByText('Sign Up'));
      await waitFor(() =>
        expect(mockLogGameEvent).toHaveBeenCalledWith('email_auth_success', { mode: 'signup' })
      );
    });
  });
});
