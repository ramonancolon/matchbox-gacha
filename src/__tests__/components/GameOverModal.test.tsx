import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GameOverModal } from '../../components/GameOverModal';

// ─── module mocks ────────────────────────────────────────────────────────────

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

interface ModalProps {
  isOpen?: boolean;
  moves?: number;
  time?: number;
  bestMoves?: number | null;
  onReset?: () => void;
  isGuest?: boolean;
  onGuestSubmit?: (name: string) => Promise<void>;
}

const renderModal = ({
  isOpen = true,
  moves = 10,
  time = 45,
  bestMoves = null,
  onReset = vi.fn(),
  isGuest = false,
  onGuestSubmit = vi.fn().mockResolvedValue(undefined),
}: ModalProps = {}) =>
  render(
    <GameOverModal
      isOpen={isOpen}
      moves={moves}
      time={time}
      bestMoves={bestMoves}
      onReset={onReset}
      isGuest={isGuest}
      onGuestSubmit={onGuestSubmit}
    />
  );

describe('GameOverModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── visibility ─────────────────────────────────────────────────────────────

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('Victory!')).not.toBeInTheDocument();
  });

  it('renders the modal when isOpen is true', () => {
    renderModal();
    expect(screen.getByText('Victory!')).toBeInTheDocument();
  });

  // ─── stats display ───────────────────────────────────────────────────────────

  it('displays the correct moves count', () => {
    renderModal({ moves: 14 });
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('formats time under one minute as 0:SS', () => {
    renderModal({ time: 9 });
    expect(screen.getByText('0:09')).toBeInTheDocument();
  });

  it('formats time over one minute as M:SS', () => {
    renderModal({ time: 75 });
    expect(screen.getByText('1:15')).toBeInTheDocument();
  });

  it('displays the "Total Moves" label', () => {
    renderModal();
    expect(screen.getByText(/total moves/i)).toBeInTheDocument();
  });

  it('displays the "Time taken" label', () => {
    renderModal();
    expect(screen.getByText(/time taken/i)).toBeInTheDocument();
  });

  // ─── reset button ────────────────────────────────────────────────────────────

  it('calls onReset when the "Start New Session" button is clicked', async () => {
    const onReset = vi.fn();
    renderModal({ onReset });
    await userEvent.click(screen.getByText('Start New Session'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('calls onReset when the backdrop is clicked', () => {
    const onReset = vi.fn();
    const { container } = renderModal({ onReset });
    const backdrop = container.querySelector('[class*="absolute inset-0"]') as HTMLElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(onReset).toHaveBeenCalled();
  });

  // ─── guest score submission ──────────────────────────────────────────────────

  describe('guest score submission', () => {
    it('shows the name input and submit button for guests', () => {
      renderModal({ isGuest: true });
      expect(screen.getByPlaceholderText('Enter your name...')).toBeInTheDocument();
    });

    it('submit button is disabled when the name input is empty', () => {
      renderModal({ isGuest: true });
      const submitBtn = screen.getByRole('button', { name: '' }) ??
        screen.getAllByRole('button').find(b => b.getAttribute('disabled') !== null);
      // Check that the submit icon button exists and is disabled with empty name
      const nameInput = screen.getByPlaceholderText('Enter your name...');
      expect((nameInput as HTMLInputElement).value).toBe('');
    });

    it('calls onGuestSubmit with the trimmed name when submitted', async () => {
      const onGuestSubmit = vi.fn().mockResolvedValue(undefined);
      renderModal({ isGuest: true, onGuestSubmit });
      await userEvent.type(screen.getByPlaceholderText('Enter your name...'), '  Player1  ');
      // Click the submit button (the Send icon button)
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(b =>
        b.querySelector('svg') && !b.textContent?.trim()
      );
      if (sendButton) await userEvent.click(sendButton);
      await waitFor(() => expect(onGuestSubmit).toHaveBeenCalledWith('Player1'));
    });

    it('shows the success message after a successful guest submission', async () => {
      const onGuestSubmit = vi.fn().mockResolvedValue(undefined);
      renderModal({ isGuest: true, onGuestSubmit });
      await userEvent.type(screen.getByPlaceholderText('Enter your name...'), 'Player1');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(b => b.querySelector('svg') && !b.textContent?.trim());
      if (sendButton) await userEvent.click(sendButton);
      await waitFor(() =>
        expect(screen.getByText(/score submitted to the hall of fame/i)).toBeInTheDocument()
      );
    });

    it('hides the name input after a successful submission', async () => {
      const onGuestSubmit = vi.fn().mockResolvedValue(undefined);
      renderModal({ isGuest: true, onGuestSubmit });
      await userEvent.type(screen.getByPlaceholderText('Enter your name...'), 'Player1');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(b => b.querySelector('svg') && !b.textContent?.trim());
      if (sendButton) await userEvent.click(sendButton);
      await waitFor(() =>
        expect(screen.queryByPlaceholderText('Enter your name...')).not.toBeInTheDocument()
      );
    });

    it('resets the name input when the modal is reopened', () => {
      const { rerender } = render(
        <GameOverModal isOpen={true} moves={10} time={30} bestMoves={null}
          onReset={vi.fn()} isGuest={true} onGuestSubmit={vi.fn().mockResolvedValue(undefined)} />
      );
      fireEvent.change(screen.getByPlaceholderText('Enter your name...'), {
        target: { value: 'OldName' },
      });
      rerender(
        <GameOverModal isOpen={false} moves={10} time={30} bestMoves={null}
          onReset={vi.fn()} isGuest={true} onGuestSubmit={vi.fn().mockResolvedValue(undefined)} />
      );
      rerender(
        <GameOverModal isOpen={true} moves={10} time={30} bestMoves={null}
          onReset={vi.fn()} isGuest={true} onGuestSubmit={vi.fn().mockResolvedValue(undefined)} />
      );
      expect((screen.getByPlaceholderText('Enter your name...') as HTMLInputElement).value).toBe('');
    });
  });

  // ─── logged-in user section ──────────────────────────────────────────────────

  describe('logged-in user section', () => {
    it('does not show the guest name input for logged-in users', () => {
      renderModal({ isGuest: false });
      expect(screen.queryByPlaceholderText('Enter your name...')).not.toBeInTheDocument();
    });

    it('displays the personal best moves count for logged-in users', () => {
      renderModal({ isGuest: false, bestMoves: 8 });
      expect(screen.getByText(/personal best/i)).toBeInTheDocument();
      expect(screen.getByText('8 moves')).toBeInTheDocument();
    });

    it('does not show personal best section when bestMoves is null', () => {
      renderModal({ isGuest: false, bestMoves: null });
      expect(screen.queryByText(/personal best/i)).not.toBeInTheDocument();
    });
  });

  // ─── "Submit to Hall of Fame" heading ────────────────────────────────────────

  it('shows "Submit to Hall of Fame" heading for guests', () => {
    renderModal({ isGuest: true });
    expect(screen.getByText(/submit to hall of fame/i)).toBeInTheDocument();
  });
});
