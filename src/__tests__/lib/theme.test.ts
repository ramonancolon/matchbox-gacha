// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyThemeClass,
  getEffectiveTheme,
  isThemePreference,
  nextPreference,
  readStoredPreference,
  writeStoredPreference,
} from '../../lib/theme';

describe('theme module', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.theme;
  });

  describe('isThemePreference', () => {
    it('accepts the three valid preferences', () => {
      expect(isThemePreference('light')).toBe(true);
      expect(isThemePreference('dark')).toBe(true);
      expect(isThemePreference('system')).toBe(true);
    });

    it('rejects unknown values', () => {
      expect(isThemePreference('auto')).toBe(false);
      expect(isThemePreference(null)).toBe(false);
      expect(isThemePreference(undefined)).toBe(false);
      expect(isThemePreference(42)).toBe(false);
    });
  });

  describe('getEffectiveTheme', () => {
    it('returns the explicit preference when not system', () => {
      expect(getEffectiveTheme('light', true)).toBe('light');
      expect(getEffectiveTheme('light', false)).toBe('light');
      expect(getEffectiveTheme('dark', true)).toBe('dark');
      expect(getEffectiveTheme('dark', false)).toBe('dark');
    });

    it('follows the OS when preference is system', () => {
      expect(getEffectiveTheme('system', true)).toBe('dark');
      expect(getEffectiveTheme('system', false)).toBe('light');
    });
  });

  describe('readStoredPreference', () => {
    it('returns "system" when nothing is stored', () => {
      expect(readStoredPreference()).toBe('system');
    });

    it('returns the stored value when valid', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      expect(readStoredPreference()).toBe('dark');
    });

    it('falls back to "system" for invalid stored values', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'neon');
      expect(readStoredPreference()).toBe('system');
    });
  });

  describe('writeStoredPreference', () => {
    it('persists the preference under the namespaced key', () => {
      writeStoredPreference('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('does not throw when storage is unavailable', () => {
      const broken = {
        setItem: () => {
          throw new Error('quota');
        },
      } as unknown as Storage;
      expect(() => writeStoredPreference('light', broken)).not.toThrow();
    });
  });

  describe('applyThemeClass', () => {
    it('adds the dark class for dark effective theme', () => {
      applyThemeClass('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('removes the dark class for light effective theme', () => {
      document.documentElement.classList.add('dark');
      applyThemeClass('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  describe('nextPreference', () => {
    it('cycles light → dark → system → light', () => {
      expect(nextPreference('light')).toBe('dark');
      expect(nextPreference('dark')).toBe('system');
      expect(nextPreference('system')).toBe('light');
    });
  });
});
