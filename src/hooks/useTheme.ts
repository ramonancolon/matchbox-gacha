import { useCallback, useEffect, useState } from 'react';
import {
  applyThemeClass,
  getEffectiveTheme,
  isOsDark,
  readStoredPreference,
  writeStoredPreference,
  type EffectiveTheme,
  type ThemePreference,
} from '../lib/theme';

interface UseThemeResult {
  preference: ThemePreference;
  effective: EffectiveTheme;
  setPreference: (pref: ThemePreference) => void;
}

export function useTheme(): UseThemeResult {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference()
  );
  const [osDark, setOsDark] = useState<boolean>(() => isOsDark());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const effective = getEffectiveTheme(preference, osDark);

  useEffect(() => {
    applyThemeClass(effective);
  }, [effective]);

  const setPreference = useCallback((pref: ThemePreference) => {
    writeStoredPreference(pref);
    setPreferenceState(pref);
  }, []);

  return { preference, effective, setPreference };
}
