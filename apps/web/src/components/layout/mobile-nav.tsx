'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { NAV_CONFIG } from './sidebar';

export function MobileNav() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');

  return (
    <nav
      aria-label={tNav('overview')}
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around h-16 bg-surface/95 backdrop-blur-md border-t border-border shadow-lg px-1"
    >
      {NAV_CONFIG.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        const label = tNav(item.key);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-control-sm text-[10px] font-sans transition-colors cursor-pointer min-h-[44px]',
              isActive
                ? 'text-energy-cyan font-semibold'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <div className="relative">
              <Icon
                className={cn(
                  'h-4 w-4 transition-transform',
                  isActive ? 'scale-110 text-energy-cyan' : 'text-text-muted'
                )}
                aria-hidden="true"
              />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-energy-cyan" />
              )}
            </div>
            <span className="mt-1 truncate max-w-[64px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
