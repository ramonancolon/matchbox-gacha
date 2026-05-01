// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '../../components/ThemeToggle';
import type { ThemePreference } from '../../lib/theme';

describe('ThemeToggle', () => {
  describe('cycle', () => {
    it.each<[ThemePreference, ThemePreference]>([
      ['light', 'dark'],
      ['dark', 'system'],
      ['system', 'light'],
    ])('cycles %s → %s when clicked', async (current, next) => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<ThemeToggle preference={current} onChange={onChange} />);
      await user.click(screen.getByRole('button', { name: /theme:/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(next);
    });
  });

  describe('accessible label and title', () => {
    it.each<[ThemePreference, string, string]>([
      ['light', 'Light', 'Dark'],
      ['dark', 'Dark', 'System'],
      ['system', 'System', 'Light'],
    ])('reflects %s preference', (pref, label, nextLabel) => {
      render(<ThemeToggle preference={pref} onChange={vi.fn()} />);
      const btn = screen.getByRole('button', {
        name: `Theme: ${label}. Activate to switch to ${nextLabel}.`,
      });
      expect(btn).toHaveAttribute(
        'title',
        `Theme: ${label} (click for ${nextLabel})`
      );
    });
  });

  describe('icon', () => {
    it.each<[ThemePreference, string]>([
      ['light', 'lucide-sun'],
      ['dark', 'lucide-moon'],
      ['system', 'lucide-monitor'],
    ])('renders the %s icon', (pref, iconClass) => {
      const { container } = render(
        <ThemeToggle preference={pref} onChange={vi.fn()} />
      );
      expect(container.querySelector(`svg.${iconClass}`)).not.toBeNull();
    });

    it('hides the decorative icon from assistive tech', () => {
      const { container } = render(
        <ThemeToggle preference="light" onChange={vi.fn()} />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('exposes the preference via data-theme-preference', () => {
    const { rerender } = render(
      <ThemeToggle preference="light" onChange={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-theme-preference',
      'light'
    );

    rerender(<ThemeToggle preference="dark" onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-theme-preference',
      'dark'
    );
  });

  it('renders as type="button" so it never submits a parent form', () => {
    render(<ThemeToggle preference="light" onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  describe('className', () => {
    it('applies the default className when none is provided', () => {
      render(<ThemeToggle preference="light" onChange={vi.fn()} />);
      expect(screen.getByRole('button').className).toContain('rounded-full');
    });

    it('replaces the default className when a custom one is provided', () => {
      render(
        <ThemeToggle
          preference="light"
          onChange={vi.fn()}
          className="custom-cls"
        />
      );
      expect(screen.getByRole('button')).toHaveAttribute('class', 'custom-cls');
    });
  });

  it('does not advance two steps when clicked twice without a prop update', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<ThemeToggle preference="light" onChange={onChange} />);
    const btn = screen.getByRole('button');
    await user.click(btn);
    await user.click(btn);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'dark');
    expect(onChange).toHaveBeenNthCalledWith(2, 'dark');
  });
});
