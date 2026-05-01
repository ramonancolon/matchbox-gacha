// @vitest-environment happy-dom
/**
 * Two complementary checks live here:
 *
 *   1. axe-core structural pass against the rendered App in light + dark.
 *      `color-contrast` is disabled — jsdom/happy-dom cannot resolve Tailwind
 *      utilities through CSS custom properties, so axe's contrast verdicts
 *      are unreliable. Contrast is asserted via the second block instead.
 *
 *   2. WCAG AA contrast verification against the dark-mode CSS tokens
 *      declared in `src/index.css`. Pinned by the "ADA Contrast" commit
 *      (cda1ad9): if --color-text-muted is darkened, --color-primary-theme
 *      is dimmed, or the dark:text-slate-950 button override is reverted,
 *      these assertions fail.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, waitFor } from '@testing-library/react';
import axe, { type Result as AxeResult } from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_STORAGE_KEY, type ThemePreference } from '../../lib/theme';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null);
    return () => {};
  }),
}));

vi.mock('../../lib/firebase', () => ({
  auth: {},
  logOut: vi.fn(),
  syncUserProfile: vi.fn(),
  submitScore: vi.fn(),
  updateUserBest: vi.fn(),
  logGameEvent: vi.fn(),
}));

vi.mock('../../hooks/useMatchingGame', () => ({
  useMatchingGame: () => ({
    cards: [],
    flippedIndices: [],
    moves: 0,
    matches: 0,
    status: 'idle',
    time: 0,
    bestScore: null,
    hintIndex: null,
    hintMessage: null,
    isGettingHint: false,
    hintsRemaining: 3,
    initGame: vi.fn(),
    handleCardClick: vi.fn(),
    handleGetHint: vi.fn(),
    setBestScore: vi.fn(),
  }),
}));

vi.mock('../../services/gamePersistenceService', () => ({
  gamePersistenceService: {
    getTutorialSeen: vi.fn(() => true),
    setTutorialSeen: vi.fn(),
    getBestScores: vi.fn(() => ({ 4: null, 6: null })),
    setBestScores: vi.fn(),
  },
}));

vi.mock('../../services/localLlmService', () => ({
  getLocalLlmInstallStatus: vi.fn(() => ({ active: false, progress: 0, text: '' })),
  subscribeLocalLlmInstallStatus: vi.fn(() => () => {}),
  warmLocalLlmEngine: vi.fn(),
}));

vi.mock('../../lib/installedWebApp', () => ({
  isInstalledWebApp: vi.fn(() => false),
}));

vi.mock('../../lib/sounds', () => ({
  soundManager: { prime: vi.fn(), setEnabled: vi.fn(), play: vi.fn() },
}));

vi.mock('../../components/GameBoard', () => ({
  GameBoard: () => <div data-testid="game-board" />,
}));
vi.mock('../../components/Leaderboard', () => ({
  Leaderboard: () => <div data-testid="leaderboard" />,
}));
vi.mock('../../components/LocalLlmInstallModule', () => ({
  LocalLlmInstallModule: () => null,
}));
vi.mock('../../components/SignInModal', () => ({
  SignInModal: () => null,
}));
vi.mock('../../components/TutorialModal', () => ({
  TutorialModal: () => null,
}));
vi.mock('../../components/GameOverModal', () => ({
  GameOverModal: () => null,
}));

import App from '../../App';

function setStoredTheme(pref: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

async function runAxe(container: Element) {
  return axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
}

function formatViolations(violations: AxeResult[]): string {
  return violations
    .map(
      (v) =>
        `  - [${v.id}] ${v.help} (${v.nodes.length} node(s))\n    ${v.helpUrl}`
    )
    .join('\n');
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const lf = relativeLuminance(hexToRgb(fg));
  const lb = relativeLuminance(hexToRgb(bg));
  const [hi, lo] = lf > lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}

function readDarkTokens(): Record<string, string> {
  const css = readFileSync(
    path.resolve(__dirname, '../../index.css'),
    'utf-8'
  );
  const block = /\.dark\s*\{([\s\S]*?)\}/.exec(css);
  if (!block) throw new Error('No .dark block in index.css');
  const tokens: Record<string, string> = {};
  for (const line of block[1].split(/\r?\n/)) {
    const m = /(--color-[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/.exec(line);
    if (m) tokens[m[1]] = m[2];
  }
  return tokens;
}

describe('App shell axe-core smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('has no structural a11y violations in light mode', async () => {
    setStoredTheme('light');
    const { container } = render(<App />);
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    );

    const results = await runAxe(container);
    expect(
      results.violations.length,
      `axe violations:\n${formatViolations(results.violations)}`
    ).toBe(0);
  });

  it('has no structural a11y violations in dark mode', async () => {
    setStoredTheme('dark');
    const { container } = render(<App />);
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    );

    const results = await runAxe(container);
    expect(
      results.violations.length,
      `axe violations:\n${formatViolations(results.violations)}`
    ).toBe(0);
  });
});

describe('dark-mode token contrast (WCAG AA)', () => {
  const tokens = readDarkTokens();
  const AA_NORMAL = 4.5;

  it.each<[string, string, string]>([
    ['text-main on bg-theme', '--color-text-main', '--color-bg-theme'],
    ['text-main on surface', '--color-text-main', '--color-surface'],
    ['text-muted on bg-theme', '--color-text-muted', '--color-bg-theme'],
    ['text-muted on surface', '--color-text-muted', '--color-surface'],
    [
      'text-main on primary-light',
      '--color-text-main',
      '--color-primary-light',
    ],
    [
      'primary-theme accent on primary-light',
      '--color-primary-theme',
      '--color-primary-light',
    ],
  ])('%s meets AA (>= 4.5:1)', (_label, fgVar, bgVar) => {
    const ratio = contrastRatio(tokens[fgVar], tokens[bgVar]);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('button text (slate-950) on primary-theme meets AA — pins the dark:text-slate-950 override', () => {
    // Dark-mode primary buttons use `dark:text-slate-950` (#020617) on
    // --color-primary-theme. Plain white on the brighter indigo only reaches
    // ~2.2:1; the slate override is what gets the buttons over AA.
    const ratio = contrastRatio('#020617', tokens['--color-primary-theme']);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('white on primary-theme would NOT meet AA — documents why the override exists', () => {
    // Negative pin: if someone "simplifies" by removing dark:text-slate-950
    // and reverts to plain text-white, the cycle test above keeps passing
    // but this guard makes the failure mode obvious.
    const ratio = contrastRatio('#FFFFFF', tokens['--color-primary-theme']);
    expect(ratio).toBeLessThan(AA_NORMAL);
  });
});
