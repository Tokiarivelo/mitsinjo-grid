import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppShell } from '../app-shell';
import { MobileNav } from '../mobile-nav';
import { Header } from '../header';
import { Sidebar } from '../sidebar';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';

vi.mock('next/navigation', () => ({
  usePathname: () => '/overview',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('Layout Components (Mobile & Theme Responsive)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );

  it('renders AppShell with children, Header, and MobileNav', () => {
    render(
      <AppShell title="Test Title" subtitle="Test Subtitle">
        <div data-testid="test-content">Workspace Content</div>
      </AppShell>,
      { wrapper }
    );

    expect(screen.getByTestId('test-content')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /test title/i })).toBeInTheDocument();
    // Mobile bottom navigation is in the DOM
    const mobileNav = screen.getByRole('navigation', { name: /overview|vue d'ensemble/i });
    expect(mobileNav).toBeInTheDocument();
  });

  it('renders MobileNav with all 5 destination links', () => {
    render(<MobileNav />, { wrapper });

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(5);

    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(['/overview', '/simulation', '/strategies', '/scenarios', '/copilot']);
  });

  it('Header includes ThemeSwitcher button and triggers theme toggle', () => {
    render(<Header title="Page Title" onMenuToggle={vi.fn()} />, { wrapper });

    const themeBtn = screen.getByRole('button', {
      name: /toggle color theme|changer le thème|hanova loko/i,
    });
    expect(themeBtn).toBeInTheDocument();

    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('Sidebar includes ThemeSwitcher tabs and LanguageSwitcher tabs', () => {
    render(<Sidebar open={true} onClose={vi.fn()} />, { wrapper });

    const themeRadios = screen.getAllByRole('radiogroup');
    expect(themeRadios.length).toBeGreaterThanOrEqual(2); // Theme radiogroup and Language radiogroup
  });
});
