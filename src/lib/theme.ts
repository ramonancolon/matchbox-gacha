export type ThemePreference = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'matchbox-gacha:theme';
export const THEME_VALUES: ThemePreference[] = ['light', 'dark', 'system'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getEffectiveTheme(
  preference: ThemePreference,
  isOsDark: boolean
): EffectiveTheme {
  if (preference === 'system') return isOsDark ? 'dark' : 'light';
  return preference;
}

export function readStoredPreference(storage?: Storage | null): ThemePreference {
  try {
    const store = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
    if (!store) return 'system';
    const raw = store.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredPreference(
  preference: ThemePreference,
  storage?: Storage | null
): void {
  try {
    const store = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
    if (!store) return;
    store.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* storage unavailable — silently ignore */
  }
}

export function applyThemeClass(
  effective: EffectiveTheme,
  root?: HTMLElement | null
): void {
  const el = root ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (!el) return;
  if (effective === 'dark') {
    el.classList.add('dark');
  } else {
    el.classList.remove('dark');
  }
  el.dataset.theme = effective;
}

export function isOsDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function nextPreference(current: ThemePreference): ThemePreference {
  const i = THEME_VALUES.indexOf(current);
  return THEME_VALUES[(i + 1) % THEME_VALUES.length];
}
