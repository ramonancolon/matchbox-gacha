// @vitest-environment happy-dom
import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../../hooks/useTheme';
import { THEME_STORAGE_KEY, type ThemePreference } from '../../lib/theme';

interface FakeMql {
  matches: boolean;
  addEventListener: (type: 'change', listener: (e: { matches: boolean }) => void) => void;
  removeEventListener: (type: 'change', listener: (e: { matches: boolean }) => void) => void;
  dispatchChange: (matches: boolean) => void;
}

function installMatchMedia(initial: boolean): FakeMql {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql: FakeMql = {
    matches: initial,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    dispatchChange: (matches: boolean) => {
      mql.matches = matches;
      listeners.forEach((l) => l({ matches }));
    },
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  // happy-dom assigns matchMedia on window directly
  (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia =
    (() => mql) as unknown as typeof window.matchMedia;
  return mql;
}

function Capture({
  onState,
}: {
  onState: (state: { preference: ThemePreference; effective: 'light' | 'dark'; setPreference: (p: ThemePreference) => void }) => void;
}) {
  const theme = useTheme();
  onState(theme);
  return null;
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to system on first visit and applies the OS theme to <html>', () => {
    installMatchMedia(true);
    let captured: { preference: ThemePreference; effective: 'light' | 'dark' } | null = null;
    render(<Capture onState={(s) => (captured = s)} />);
    expect(captured!.preference).toBe('system');
    expect(captured!.effective).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists the user preference and updates the document class', () => {
    installMatchMedia(false);
    let latest: {
      preference: ThemePreference;
      effective: 'light' | 'dark';
      setPreference: (p: ThemePreference) => void;
    } | null = null;
    render(<Capture onState={(s) => (latest = s)} />);
    expect(latest!.effective).toBe('light');

    act(() => {
      latest!.setPreference('dark');
    });

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(latest!.preference).toBe('dark');
    expect(latest!.effective).toBe('dark');
  });

  it('responds to OS theme changes when preference is system', () => {
    const mql = installMatchMedia(false);
    let latest: { effective: 'light' | 'dark' } | null = null;
    render(<Capture onState={(s) => (latest = s)} />);
    expect(latest!.effective).toBe('light');

    act(() => {
      mql.dispatchChange(true);
    });

    expect(latest!.effective).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores OS changes when preference is explicit', () => {
    const mql = installMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    let latest: { effective: 'light' | 'dark' } | null = null;
    render(<Capture onState={(s) => (latest = s)} />);
    expect(latest!.effective).toBe('light');

    act(() => {
      mql.dispatchChange(true);
    });

    expect(latest!.effective).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
