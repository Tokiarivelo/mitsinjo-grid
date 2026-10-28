'use client';

import { Menu, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/status-badge';
import { ScenarioSelector, type ScenarioOption } from '@/components/ui/scenario-selector';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { useTranslations } from '@/lib/i18n';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  status?: StatusBadgeVariant;
  modified?: boolean;
  scenarios?: ScenarioOption[];
  activeScenarioId?: string;
  onScenarioChange?: (id: string) => void;
  onReset?: () => void;
  copilotOpen?: boolean;
  onCopilotToggle?: () => void;
  onMenuToggle?: () => void;
  className?: string;
}

export function Header({
  title,
  subtitle,
  status = 'ready',
  modified = false,
  scenarios,
  activeScenarioId = 'baseline',
  onScenarioChange,
  onReset,
  copilotOpen = false,
  onCopilotToggle,
  onMenuToggle,
  className,
}: HeaderProps) {
  const tHeader = useTranslations('header');
  const tScenarios = useTranslations('scenarios');

  const defaultScenarios: ScenarioOption[] = [
    {
      id: 'baseline',
      name: tScenarios('baseline.name'),
      description: tScenarios('baseline.description'),
    },
    {
      id: 'cloudy_afternoon',
      name: tScenarios('cloudy_afternoon.name'),
      description: tScenarios('cloudy_afternoon.description'),
    },
    {
      id: 'high_demand',
      name: tScenarios('high_demand.name'),
      description: tScenarios('high_demand.description'),
    },
    {
      id: 'battery_constraint',
      name: tScenarios('battery_constraint.name'),
      description: tScenarios('battery_constraint.description'),
    },
    {
      id: 'essential_stress',
      name: tScenarios('essential_stress.name'),
      description: tScenarios('essential_stress.description'),
    },
    {
      id: 'meter_anomaly',
      name: tScenarios('meter_anomaly.name'),
      description: tScenarios('meter_anomaly.description'),
    },
  ];

  const resolvedScenarios = scenarios || defaultScenarios;
  const isResetDisabled = status === 'ready' && !modified;

  return (
    <header
      className={cn(
        'h-17 px-4 sm:px-6 flex items-center justify-between bg-canvas-raised border-b border-border z-30 shrink-0 gap-4',
        className
      )}
    >
      {/* Left zone: Mobile toggle + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label={tHeader('openMenu')}
            className="xl:hidden p-2 rounded-control text-text-muted hover:text-text-primary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan cursor-pointer"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <h1 className="font-display text-base sm:text-lg font-semibold text-text-primary tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-text-secondary font-sans truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right zone: Theme Switcher, Language Switcher, Scenario selector, Status badge, Reset, Copilot Toggle */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Theme switcher */}
        <ThemeSwitcher variant="icon" size="sm" />

        {/* Language switcher */}
        <div className="hidden lg:block">
          <LanguageSwitcher variant="compact" size="sm" />
        </div>

        {/* Scenario selector */}
        {onScenarioChange && (
          <div className="hidden md:block">
            <ScenarioSelector
              scenarios={resolvedScenarios}
              value={activeScenarioId}
              modified={modified}
              onChange={onScenarioChange}
            />
          </div>
        )}

        {/* Status badge */}
        <div className="hidden sm:block">
          <StatusBadge variant={status} size="sm" />
        </div>

        {/* Reset button */}
        {onReset && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onReset}
            disabled={isResetDisabled}
            aria-label={tHeader('reset')}
            icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            className="hidden sm:inline-flex"
          >
            {tHeader('reset')}
          </Button>
        )}

        {/* Copilot toggle button */}
        {onCopilotToggle && (
          <button
            type="button"
            onClick={onCopilotToggle}
            aria-label={tHeader('toggleCopilot')}
            aria-expanded={copilotOpen}
            className={cn(
              'flex items-center gap-1.5 h-8 px-2.5 rounded-control text-xs font-sans font-medium transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
              copilotOpen
                ? 'bg-ai-violet/20 text-ai-violet border border-ai-violet/40 shadow-xs'
                : 'bg-surface text-text-secondary border border-border hover:bg-surface-hover hover:text-text-primary'
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-ai-violet" aria-hidden="true" />
            <span className="hidden md:inline">{tHeader('copilot')}</span>
          </button>
        )}
      </div>
    </header>
  );
}
