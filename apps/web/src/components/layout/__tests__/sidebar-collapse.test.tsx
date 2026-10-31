import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import { AppShell } from '../app-shell';
import { Sidebar } from '../sidebar';
import { SIDEBAR_COLLAPSED_KEY, useSidebarCollapsed } from '../use-sidebar-collapsed';

vi.mock('next/navigation', () => ({
  usePathname: () => '/overview',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <I18nProvider>{children}</I18nProvider>
  </ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe('useSidebarCollapsed', () => {
  it('starts expanded, toggles and remembers the choice', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
    const again = renderHook(() => useSidebarCollapsed());
    expect(again.result.current.collapsed).toBe(true);
  });
});

describe('Sidebar folded rail (desktop)', () => {
  it('folded: narrow rail, labels only for screen readers, footer hidden, unfold button', () => {
    const onToggle = vi.fn();
    const { container } = render(<Sidebar collapsed onToggleCollapsed={onToggle} />, { wrapper });
    expect(container.querySelector('aside')!.className).toContain('xl:w-16');
    const overview = screen.getByRole('link', { name: 'Overview' });
    expect(overview.getAttribute('title')).toBe('Overview');
    expect(overview.querySelector('span')!.className).toContain('xl:sr-only');
    const unfold = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(unfold.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(unfold);
    expect(onToggle).toHaveBeenCalled();
  });

  it('AppShell: the fold button switches the sidebar both ways', () => {
    render(
      <AppShell title="T">
        <div />
      </AppShell>,
      { wrapper }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy();
  });
});

// Last: leaves the in-memory fallback on for this module.
describe('useSidebarCollapsed with blocked storage', () => {
  it('blocked storage: still toggles', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    spy.mockRestore();
  });
});
