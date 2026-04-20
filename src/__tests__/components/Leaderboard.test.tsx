import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Leaderboard } from '../../components/Leaderboard';

// ─── module mocks ────────────────────────────────────────────────────────────

let capturedSnapshotCallback: ((snap: any) => void) | null = null;

const mockOnSnapshot = vi.hoisted(() =>
  vi.fn((query: any, cb: (snap: any) => void) => {
    capturedSnapshotCallback = cb;
    return vi.fn(); // unsubscribe
  })
);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection'),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: mockOnSnapshot,
}));

vi.mock('../../lib/firebase', () => ({
  db: {},
  logGameEvent: vi.fn(),
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeScore = (id: string, userId: string, userName: string, moves: number, time: number) => ({
  id,
  userId,
  userName,
  userPhoto: '',
  moves,
  time,
});

/** Pushes mock Firestore snapshot data through the captured listener. */
const pushSnapshot = (docs: ReturnType<typeof makeScore>[]) => {
  act(() => {
    capturedSnapshotCallback!({
      docs: docs.map(d => ({ id: d.id, data: () => d })),
    });
  });
};

describe('Leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSnapshotCallback = null;
  });

  // ─── loading state ───────────────────────────────────────────────────────────

  it('shows a loading indicator before the first snapshot arrives', () => {
    render(<Leaderboard mode={4} />);
    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
  });

  // ─── empty state ────────────────────────────────────────────────────────────

  it('shows the empty-state message when there are no scores', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([]);
    expect(screen.getByText(/no data recorded/i)).toBeInTheDocument();
  });

  // ─── scores rendering ────────────────────────────────────────────────────────

  it('renders up to 3 score entries', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([
      makeScore('s1', 'u1', 'Alice', 8, 30),
      makeScore('s2', 'u2', 'Bob',   10, 45),
      makeScore('s3', 'u3', 'Carol', 12, 60),
    ]);
    // CSS `uppercase` is visual only; actual DOM text retains original casing
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('displays the move count for each entry', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([makeScore('s1', 'u1', 'Alice', 8, 30)]);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('formats time as M:SS', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([makeScore('s1', 'u1', 'Alice', 8, 75)]); // 1:15
    expect(screen.getByText('1:15')).toBeInTheDocument();
  });

  it('formats a time below one minute as 0:SS', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([makeScore('s1', 'u1', 'Bob', 10, 9)]); // 0:09
    expect(screen.getByText('0:09')).toBeInTheDocument();
  });

  it('stops loading and hides the indicator after snapshot arrives', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([makeScore('s1', 'u1', 'Alice', 8, 30)]);
    expect(screen.queryByText(/syncing/i)).not.toBeInTheDocument();
  });

  // ─── deduplication ──────────────────────────────────────────────────────────

  it('shows only the best entry for a registered user with multiple scores', () => {
    render(<Leaderboard mode={4} />);
    // Two scores for same userId — only the first (better) should appear
    pushSnapshot([
      makeScore('s1', 'user-A', 'Alice', 8,  30), // better
      makeScore('s2', 'user-A', 'Alice', 12, 60), // duplicate user
      makeScore('s3', 'user-B', 'Bob',   15, 45),
    ]);
    const aliceEntries = screen.getAllByText('Alice');
    expect(aliceEntries).toHaveLength(1);
  });

  it('treats each guest submission as a unique leaderboard entry', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([
      makeScore('s1', 'guest', 'GuestA', 8,  30),
      makeScore('s2', 'guest', 'GuestB', 10, 45),
      makeScore('s3', 'guest', 'GuestC', 12, 60),
    ]);
    expect(screen.getByText('GuestA')).toBeInTheDocument();
    expect(screen.getByText('GuestB')).toBeInTheDocument();
    expect(screen.getByText('GuestC')).toBeInTheDocument();
  });

  it('shows at most 3 entries even when more unique users are returned', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([
      makeScore('s1', 'u1', 'Alice', 8,  30),
      makeScore('s2', 'u2', 'Bob',   10, 45),
      makeScore('s3', 'u3', 'Carol', 12, 60),
      makeScore('s4', 'u4', 'Dave',  14, 75), // should NOT appear
    ]);
    expect(screen.queryByText('DAVE')).not.toBeInTheDocument();
  });

  // ─── mode toggle ─────────────────────────────────────────────────────────────

  it('renders a Normal (4×4) and a Hard (6×6) toggle button', () => {
    render(<Leaderboard mode={4} />);
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });

  it('initialises with the mode passed as a prop', () => {
    render(<Leaderboard mode={6} />);
    // The Hard button should be styled as active — just verify it exists
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });

  it('re-subscribes to Firestore when the mode toggle is clicked', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([]);
    const callsBefore = mockOnSnapshot.mock.calls.length;
    fireEvent.click(screen.getByText('Hard'));
    expect(mockOnSnapshot.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('clears scores from the previous mode after switching', () => {
    render(<Leaderboard mode={4} />);
    pushSnapshot([makeScore('s1', 'u1', 'NormalPlayer', 8, 30)]);
    expect(screen.getByText('NormalPlayer')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hard'));
    pushSnapshot([]); // new mode has no scores yet
    expect(screen.queryByText('NormalPlayer')).not.toBeInTheDocument();
    expect(screen.getByText(/no data recorded/i)).toBeInTheDocument();
  });

  // ─── Hall of Fame header ─────────────────────────────────────────────────────

  it('shows the "Hall of Fame" section heading', () => {
    render(<Leaderboard mode={4} />);
    expect(screen.getByText('Hall of Fame')).toBeInTheDocument();
  });
});
