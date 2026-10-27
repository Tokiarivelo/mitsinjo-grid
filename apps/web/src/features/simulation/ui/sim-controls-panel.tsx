'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import {
  type InputPatch,
  type SimulationInput,
  type StrategyId,
  InputPatchSchema,
} from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { SimControl } from '@/components/ui/sim-control';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useTranslations } from '@/lib/i18n';

export interface SimControlsPanelProps {
  input: SimulationInput;
  activeStrategy: StrategyId;
  status: 'ready' | 'running' | 'complete' | 'modified' | 'error';
  onPatch: (patch: InputPatch) => void;
  onStrategyChange: (strategy: StrategyId) => void;
  onRun: () => void;
  onReset: () => void;
  className?: string;
}

export function SimControlsPanel({
  input,
  activeStrategy,
  status,
  onPatch,
  onStrategyChange,
  onRun,
  onReset,
  className,
}: SimControlsPanelProps) {
  const tSim = useTranslations('features.simulation');
  const tStrategies = useTranslations('strategies');
  const tCommon = useTranslations('common');

  // Derive existing parameters from current input
  const existingSolarDrop = input.events.find((e) => e.type === 'solar_drop');
  const currentDropPct = existingSolarDrop
    ? Math.round((1 - existingSolarDrop.factor) * 100)
    : 0;
  const currentDropStart = existingSolarDrop ? existingSolarDrop.startHour : 12;
  const currentDropDuration = existingSolarDrop ? existingSolarDrop.durationH : 3;

  // Validation error dictionary for inline feedback
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateAndPatch = (field: keyof InputPatch, val: number, fullPatchCandidate: InputPatch) => {
    // Validate with Zod
    const parseResult = InputPatchSchema.safeParse(fullPatchCandidate);
    const newErrors = { ...errors };

    if (!parseResult.success) {
      const fieldIssue = parseResult.error.issues.find((issue) =>
        issue.path.includes(field)
      );
      if (fieldIssue) {
        newErrors[field] = fieldIssue.message;
        setErrors(newErrors);
        return;
      }
    }

    // Cross-field checks
    if (field === 'dropStartHour' || field === 'dropDurationH') {
      const start = fullPatchCandidate.dropStartHour ?? currentDropStart;
      const duration = fullPatchCandidate.dropDurationH ?? currentDropDuration;
      if (start + duration > 24) {
        newErrors[field] = tSim('errors.dropExceedsHorizon');
        setErrors(newErrors);
        return;
      }
    }

    if (field === 'initialSocPct') {
      const minSoc = input.battery.minSocPct;
      if (val <= minSoc) {
        newErrors.initialSocPct = tSim('errors.initialBelowMinSoc', { min: minSoc });
        setErrors(newErrors);
        return;
      }
    }

    // If valid, clear field error and dispatch patch
    delete newErrors[field];
    if (field === 'dropStartHour' || field === 'dropDurationH') {
      delete newErrors.dropStartHour;
      delete newErrors.dropDurationH;
    }
    setErrors(newErrors);
    onPatch(fullPatchCandidate);
  };

  const handleSolarDropChange = (val: number) => {
    validateAndPatch('solarDropPct', val, {
      solarDropPct: val,
      dropStartHour: currentDropStart,
      dropDurationH: currentDropDuration,
    });
  };

  const handleDropStartChange = (val: number) => {
    validateAndPatch('dropStartHour', val, {
      dropStartHour: val,
      dropDurationH: currentDropDuration,
      solarDropPct: currentDropPct,
    });
  };

  const handleDropDurationChange = (val: number) => {
    validateAndPatch('dropDurationH', val, {
      dropDurationH: val,
      dropStartHour: currentDropStart,
      solarDropPct: currentDropPct,
    });
  };

  const handleDemandMultiplierChange = (val: number) => {
    // Round to 1 decimal place to prevent floating point noise
    const rounded = Math.round(val * 10) / 10;
    validateAndPatch('demandMultiplier', rounded, { demandMultiplier: rounded });
  };

  const handleBatteryCapacityChange = (val: number) => {
    validateAndPatch('batteryCapacityKwh', val, { batteryCapacityKwh: val });
  };

  const handleInitialSocChange = (val: number) => {
    validateAndPatch('initialSocPct', val, { initialSocPct: val });
  };

  const hasErrors = Object.keys(errors).length > 0;
  const isModified = status === 'modified';
  const isRunning = status === 'running';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 p-5 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      {/* Header: Controls Title, Status Badge, Run & Reset Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
          <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
            {tSim('controlsTitle')}
          </h3>
          <StatusBadge
            variant={
              status === 'modified'
                ? 'warning'
                : status === 'complete'
                ? 'complete'
                : status === 'running'
                ? 'running'
                : 'ready'
            }
            size="sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onReset}
            disabled={status === 'ready' && !isModified}
            icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            aria-label={tSim('resetScenario')}
          >
            {tSim('resetScenario')}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onRun}
            disabled={hasErrors || isRunning}
            icon={<Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
            aria-label={tSim('runSimulation')}
          >
            {isRunning ? tCommon('loading') : tSim('runSimulation')}
          </Button>
        </div>
      </div>

      {/* Modified Banner if scenario changed but not re-simulated */}
      {isModified && (
        <div className="flex items-center gap-2 p-2.5 rounded-control bg-warning-amber/10 border border-warning-amber/30 text-xs text-warning-amber">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{tSim('scenarioModifiedNotice')}</span>
        </div>
      )}

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. Solar Drop % */}
        <SimControl
          label={tSim('solarDropPct')}
          value={currentDropPct}
          unit="%"
          min={0}
          max={90}
          step={5}
          onChange={handleSolarDropChange}
          error={errors.solarDropPct}
          description={tSim('solarDropDesc')}
        />

        {/* 2. Drop Start Hour */}
        <SimControl
          label={tSim('dropStartHour')}
          value={currentDropStart}
          unit="h"
          min={0}
          max={23}
          step={1}
          onChange={handleDropStartChange}
          error={errors.dropStartHour}
          description={tSim('dropStartDesc')}
        />

        {/* 3. Drop Duration */}
        <SimControl
          label={tSim('dropDuration')}
          value={currentDropDuration}
          unit="h"
          min={1}
          max={24}
          step={1}
          onChange={handleDropDurationChange}
          error={errors.dropDurationH}
          description={tSim('dropDurationDesc')}
        />

        {/* 4. Demand Multiplier */}
        <SimControl
          label={tSim('demandMultiplier')}
          value={input.demandMultiplier}
          unit="×"
          min={0.5}
          max={2.0}
          step={0.1}
          onChange={handleDemandMultiplierChange}
          error={errors.demandMultiplier}
          description={tSim('demandMultiplierDesc')}
        />

        {/* 5. Battery Capacity */}
        <SimControl
          label={tSim('batteryCapacity')}
          value={input.battery.capacityKwh}
          unit="kWh"
          min={1}
          max={2000}
          step={10}
          onChange={handleBatteryCapacityChange}
          error={errors.batteryCapacityKwh}
          description={tSim('batteryCapacityDesc')}
        />

        {/* 6. Initial SoC */}
        <SimControl
          label={tSim('initialSoc')}
          value={input.battery.initialSocPct}
          unit="%"
          min={0}
          max={100}
          step={5}
          onChange={handleInitialSocChange}
          error={errors.initialSocPct}
          description={tSim('initialSocDesc')}
        />
      </div>

      {/* Strategy Selection Row */}
      <div className="pt-2 border-t border-border/60">
        <label className="text-xs font-semibold text-text-primary font-sans block mb-2">
          {tSim('selectStrategy')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                <p className="text-[11px] text-text-muted line-clamp-2">
                  {stratRule}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
