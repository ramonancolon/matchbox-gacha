import { Sun, Moon, Monitor } from 'lucide-react';
import { nextPreference, type ThemePreference } from '../lib/theme';

interface ThemeToggleProps {
  preference: ThemePreference;
  onChange: (pref: ThemePreference) => void;
  className?: string;
}

const LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function ThemeToggle({ preference, onChange, className }: ThemeToggleProps) {
  const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const next = nextPreference(preference);

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`Theme: ${LABELS[preference]} (click for ${LABELS[next]})`}
      aria-label={`Theme: ${LABELS[preference]}. Activate to switch to ${LABELS[next]}.`}
      data-theme-preference={preference}
      className={
        className ??
        'w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-surface border border-border-theme flex items-center justify-center text-text-muted hover:text-primary-theme hover:border-primary-theme transition-all shadow-sm'
      }
    >
      <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
    </button>
  );
}
