'use client';

import { Menu, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/status-badge';
import {
  ScenarioSelector,
  type ScenarioOption,
} from '@/components/ui/scenario-selector';

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

const DEFAULT_SCENARIOS: ScenarioOption[] = [
  { id: 'baseline', name: 'Baseline 24h', description: 'Sunny day nominal profile' },
  { id: 'cloudy_afternoon', name: 'Cloudy Afternoon (-40%)', description: '2h drop 13-15h + 35% init SoC' },
  { id: 'high_demand', name: 'High Evening Demand (+30%)', description: '17-22h demand spike across sectors' },
  { id: 'battery_constraint', name: 'Constrained Battery (60 kWh)', description: 'Half capacity with 30% initial' },
  { id: 'essential_stress', name: 'Essential Stress (-60%)', description: '4h heavy drop 11-15h + 25% init' },
];

export function Header({
  title,
  subtitle,
  status = 'ready',
  modified = false,
  scenarios = DEFAULT_SCENARIOS,
  activeScenarioId = 'baseline',
  onScenarioChange,
  onReset,
  copilotOpen = false,
  onCopilotToggle,
  onMenuToggle,
  className,
}: HeaderProps) {
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
            aria-label="Open navigation menu"
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

      {/* Right zone: Scenario selector, Status badge, Reset, Copilot Toggle */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Scenario selector */}
        {onScenarioChange && (
          <div className="hidden md:block">
            <ScenarioSelector
              scenarios={scenarios}
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
            aria-label="Reset scenario"
            icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            className="hidden sm:inline-flex"
          >
            Reset
          </Button>
        )}

        {/* Copilot toggle button */}
        {onCopilotToggle && (
          <button
            type="button"
            onClick={onCopilotToggle}
            aria-label="Toggle AI copilot"
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
            <span className="hidden md:inline">Copilot</span>
          </button>
        )}
      </div>
    </header>
  );
}
