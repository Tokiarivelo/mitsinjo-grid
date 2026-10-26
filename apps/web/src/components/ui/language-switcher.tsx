'use client';

import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppLocale, useTranslations, type Locale } from '@/lib/i18n';

export interface LanguageSwitcherProps {
  size?: 'sm' | 'md';
  variant?: 'compact' | 'tabs';
  className?: string;
}

export function LanguageSwitcher({
  size = 'sm',
  variant = 'compact',
  className,
}: LanguageSwitcherProps) {
  const { locale, setLocale, availableLocales } = useAppLocale();
  const tCommon = useTranslations('common');

  if (variant === 'tabs') {
    return (
      <div
        role="radiogroup"
        aria-label={tCommon('languageSelection')}
        className={cn(
          'inline-flex items-center p-0.5 rounded-control-sm bg-surface-elevated border border-border',
          className
        )}
      >
        {availableLocales.map((loc) => {
          const isActive = locale === loc.code;
          return (
            <button
              key={loc.code}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setLocale(loc.code)}
              className={cn(
                'px-2 py-0.5 text-[11px] font-mono font-medium rounded-xs transition-colors cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
                isActive
                  ? 'bg-surface text-energy-cyan shadow-xs border border-border/80 font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {loc.short}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('relative inline-flex items-center gap-1.5', className)}>
      <Globe className="h-3.5 w-3.5 text-text-muted shrink-0" aria-hidden="true" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={tCommon('selectLanguage')}
        className={cn(
          'appearance-none bg-surface text-text-secondary border border-border rounded-control font-mono cursor-pointer transition-colors',
          'hover:text-text-primary hover:border-border-strong',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
          size === 'sm' ? 'text-[11px] h-7 pl-2 pr-6 py-0.5' : 'text-xs h-8 pl-2.5 pr-7 py-1'
        )}
      >
        {availableLocales.map((loc) => (
          <option key={loc.code} value={loc.code} className="bg-surface text-text-primary">
            {loc.short} — {loc.label}
          </option>
        ))}
      </select>
      <span className="absolute right-2 text-text-muted pointer-events-none text-[9px]">
        ▼
      </span>
    </div>
  );
}
