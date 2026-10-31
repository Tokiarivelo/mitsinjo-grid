'use client';

import { AlertTriangle, RotateCcw, Sliders } from 'lucide-react';
import type { InputPatch, SimulationInput, StrategyId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlaybackActions } from './playback-actions';
import { simStatusBadgeVariant } from '../utils/playback';
import { StatusBadge } from '@/components/ui/status-badge';
import { useTranslations } from '@/lib/i18n';
import { useConditionControls } from '../hooks/use-condition-controls';
import { ConditionControlsGrid } from './condition-controls-grid';

export interface SimControlsPanelProps {
  input: SimulationInput;
  activeStrategy: StrategyId;
  status: 'ready' | 'running' | 'complete' | 'modified' | 'error';
  isPlaying?: boolean;
  hasResults?: boolean;
  onPatch: (patch: InputPatch) => void;
  onStrategyChange: (strategy: StrategyId) => void;
  /** Run (when needed) and play; pause while playing. */
  onRun: () => void;
  onReset: () => void;
  onStop: () => void;
  onRestart: () => void;
  /** Scale model drives the run: playback buttons hidden. */
  followsDevice?: boolean;
  className?: string;
}

export function SimControlsPanel({
  input,
  activeStrategy,
  status,
  isPlaying = false,
  hasResults = false,
  onPatch,
  onStrategyChange,
  onRun,
  onReset,
  onStop,
  onRestart,
  followsDevice = false,
  className,
}: SimControlsPanelProps) {
  const tSim = useTranslations('features.simulation');
  const tStrategies = useTranslations('strategies');
  const tCommon = useTranslations('common');
  const tSectors = useTranslations('sectors');
  const tPriorities = useTranslations('priorities');

  const { controls, hasErrors, draftsDirty, resetControls } = useConditionControls(
    input,
    status,
    onPatch
  );

  const handleReset = () => {
    resetControls();
    onReset();
  };

  const isModified = status === 'modified';

  return (
    <div
      className={cn(
        '@container flex flex-col gap-4 p-5 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      {/* Header: Controls Title, Status Badge, Run & Reset Actions */}
      <div className="flex flex-col @xl:flex-row @xl:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <Sliders className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
          <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
            {tSim('controlsTitle')}
          </h3>
          <StatusBadge variant={simStatusBadgeVariant(status, isPlaying)} size="sm" />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={status === 'ready' && !isModified && !hasErrors && !draftsDirty}
            icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            aria-label={tSim('resetScenario')}
          >
            {tSim('resetScenario')}
          </Button>

          {!followsDevice && (
            <PlaybackActions
              status={status}
              isPlaying={isPlaying}
              hasResults={hasResults}
              disabled={hasErrors}
              onTogglePlay={onRun}
              onStop={onStop}
              onRestart={onRestart}
            />
          )}
        </div>
      </div>

      {/* Modified Banner if scenario changed but not re-simulated */}
      {isModified && (
        <div className="flex items-center gap-2 p-2.5 rounded-control bg-warning-amber/10 border border-warning-amber/30 text-xs text-warning-amber">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{tSim('scenarioModifiedNotice')}</span>
        </div>
      )}

      <ConditionControlsGrid controls={controls} />

      {/* Active Sector Priorities & Caps (PY-T4) */}
      <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
          <span>{tSim('sectorPrioritiesAndCaps')}</span>
          {input.sectorCaps && input.sectorCaps.length > 0 && (
            <span className="text-[10px] font-mono text-energy-cyan bg-energy-cyan/15 px-1.5 py-0.5 rounded border border-energy-cyan/30">
              {tSim('capsActiveCount', { count: input.sectorCaps.length })}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 @md:grid-cols-3 @3xl:grid-cols-5 gap-2">
          {input.sectors.map((sec) => {
            const cap = input.sectorCaps?.find((c) => c.sector === sec.id);
            return (
              <div
                key={sec.id}
                className="p-2 rounded-control bg-surface-elevated/40 border border-border/60 flex flex-col gap-1 text-xs"
              >
                <span className="font-medium text-text-primary truncate">{tSectors(sec.id)}</span>
                <span className="text-[10px] font-mono uppercase text-text-muted">
                  {tPriorities(sec.priority)}
                </span>
                {cap && (
                  <span className="text-[9px] font-mono text-energy-cyan bg-energy-cyan/10 px-1 py-0.5 rounded border border-energy-cyan/20 truncate">
                    {tCommon('capRange', { maxKw: cap.maxKw, from: cap.fromHour, to: cap.toHour })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Strategy Selection Row */}
      <div className="pt-2 border-t border-border/60">
        <label className="text-xs font-semibold text-text-primary font-sans block mb-2">
          {tSim('selectStrategy')}
        </label>
        <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-2">
          {(['proportional', 'essential_first', 'balanced'] as const).map((strat) => {
            const isSelected = activeStrategy === strat;
            const stratName =
              strat === 'proportional'
                ? tStrategies('proportional')
                : strat === 'essential_first'
                  ? tStrategies('essential_first')
                  : tStrategies('balanced');
            const stratRule =
              strat === 'proportional'
                ? tStrategies('proportionalRule')
                : strat === 'essential_first'
                  ? tStrategies('essentialFirstRule')
                  : tStrategies('balancedRule');

            return (
              <button
                key={strat}
                type="button"
                onClick={() => onStrategyChange(strat)}
                aria-pressed={isSelected}
                className={cn(
                  'flex flex-col items-start p-3 rounded-control border text-left transition-all cursor-pointer',
                  isSelected
                    ? 'bg-energy-cyan/15 border-energy-cyan text-text-primary shadow-xs ring-1 ring-energy-cyan/50'
                    : 'bg-surface-elevated/60 border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-sans font-semibold text-xs text-text-primary">
                    {stratName}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-mono text-energy-cyan px-1.5 py-0.2 rounded-control-sm bg-energy-cyan/20">
                      {tCommon('active')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted line-clamp-2">{stratRule}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
