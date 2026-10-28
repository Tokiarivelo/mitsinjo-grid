import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ThemeSwitcher } from '../theme-switcher';
import { ThemeProvider } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n';

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </I18nProvider>
  );

  it('renders icon button and toggles theme on click', () => {
    render(<ThemeSwitcher variant="icon" />, { wrapper });

    const btn = screen.getByRole('button', {
      name: /toggle color theme|changer le thème|hanova loko/i,
    });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(document.documentElement.classList.contains('light')).toBe(true);

    fireEvent.click(btn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('renders tabs variant and switches theme when clicking tabs', () => {
    render(<ThemeSwitcher variant="tabs" />, { wrapper });

    const darkTab = screen.getByRole('radio', { name: /dark|sombre|maizina/i });
    const lightTab = screen.getByRole('radio', { name: /light|clair|mazava/i });

    expect(darkTab).toBeInTheDocument();
    expect(lightTab).toBeInTheDocument();
    expect(darkTab).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(lightTab);
    expect(lightTab).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
