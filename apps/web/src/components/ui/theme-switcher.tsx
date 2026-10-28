'use client';

import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { useTranslations } from '@/lib/i18n';

export interface ThemeSwitcherProps {
  size?: 'sm' | 'md';
  variant?: 'icon' | 'tabs';
  className?: string;
}

export function ThemeSwitcher({
  size = 'sm',
  variant = 'icon',
  className,
}: ThemeSwitcherProps) {
  const { toggleTheme, setTheme, isDark } = useTheme();
  const tCommon = useTranslations('common');

  if (variant === 'tabs') {
    return (
      <div
        role="radiogroup"
        aria-label={tCommon('theme')}
        className={cn(
          'inline-flex items-center p-0.5 rounded-control-sm bg-surface-elevated border border-border',
          className
        )}
      >
        <button
          type="button"
          role="radio"
          aria-checked={isDark}
          onClick={() => setTheme('dark')}
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium rounded-xs transition-colors cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
            isDark
              ? 'bg-surface text-energy-cyan shadow-xs border border-border/80 font-semibold'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Moon className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{tCommon('darkTheme')}</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={!isDark}
          onClick={() => setTheme('light')}
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium rounded-xs transition-colors cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
            !isDark
              ? 'bg-surface text-solar-amber shadow-xs border border-border/80 font-semibold'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Sun className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{tCommon('lightTheme')}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={tCommon('toggleTheme')}
      title={isDark ? tCommon('lightTheme') : tCommon('darkTheme')}
      className={cn(
        'relative inline-flex items-center justify-center rounded-control transition-colors cursor-pointer border border-border bg-surface hover:bg-surface-hover hover:border-border-strong text-text-secondary hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        className
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-solar-amber transition-transform hover:rotate-45" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 text-energy-cyan transition-transform hover:-rotate-12" aria-hidden="true" />
      )}
    </button>
  );
}
