'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  GitCompare,
  LayoutDashboard,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/status-badge';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslations } from '@/lib/i18n';

export interface NavConfig {
  key: 'overview' | 'simulation' | 'strategies' | 'scenarios' | 'copilot';
  href: string;
  icon: typeof LayoutDashboard;
}

export const NAV_CONFIG: NavConfig[] = [
  { key: 'overview', href: '/overview', icon: LayoutDashboard },
  { key: 'simulation', href: '/simulation', icon: Activity },
  { key: 'strategies', href: '/strategies', icon: GitCompare },
  { key: 'scenarios', href: '/scenarios', icon: Sliders },
  { key: 'copilot', href: '/copilot', icon: Sparkles },
];

export interface SidebarProps {
  status?: StatusBadgeVariant;
  open?: boolean;
  onClose?: () => void;
  className?: string;
}

export function Sidebar({ status = 'ready', open = false, onClose, className }: SidebarProps) {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-canvas/80 backdrop-blur-xs xl:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-surface border-r border-border transition-transform duration-panel ease-in-out',
          'xl:static xl:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        {/* Brand Header */}
        <div className="flex h-17 items-center justify-between px-5 border-b border-border">
          <Link
            href="/overview"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan rounded-control-sm"
          >
            {/* Futuristic Solar Microgrid Mark */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-control-sm bg-surface-elevated border border-border group-hover:border-solar-amber/50 transition-colors p-1 overflow-hidden">
              <Image
                src="/icon.png"
                alt={tCommon('appName')}
                width={28}
                height={28}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold text-text-primary tracking-tight">
                {tCommon('appName')}
              </span>
              <span className="font-mono text-[10px] text-text-muted tracking-wider uppercase">
                {tCommon('simulationLab')}
              </span>
            </div>
          </Link>

          {/* Close button on mobile/tablet */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={tCommon('close')}
              className="xl:hidden p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_CONFIG.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const label = tNav(item.key);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-control text-xs font-sans font-medium transition-colors duration-fast relative group',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
                  isActive
                    ? 'bg-surface-hover text-text-primary border-l-2 border-energy-cyan font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover/60'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive
                      ? 'text-energy-cyan'
                      : 'text-text-muted group-hover:text-text-secondary'
                  )}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Area: Language Toggle, Simulation Status & Data Label */}
        <div className="p-4 border-t border-border flex flex-col gap-3 bg-surface-elevated/30">
          {/* Language Switcher */}
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
              {tCommon('language')}
            </span>
            <LanguageSwitcher variant="tabs" />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
              {tCommon('engineStatus')}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge variant={status} size="sm" />
              <StatusBadge variant="simulated" size="sm" />
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-text-muted">
            <Link
              href="/design"
              className="hover:text-text-primary transition-colors flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-energy-cyan rounded-xs"
            >
              <BarChart3 className="h-3 w-3" aria-hidden="true" />
              {tCommon('uiKit')}
            </Link>
            <span className="text-text-muted/40">•</span>
            <span className="font-mono text-[10px]">{tCommon('version')}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
