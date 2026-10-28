'use client';

import { useState } from 'react';
import { AlertTriangle, Play, RotateCcw, Sliders } from 'lucide-react';
import { type InputPatch, type SimulationInput, type StrategyId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { SimControl } from '@/components/ui/sim-control';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useTranslations } from '@/lib/i18n';
import { validatePatch } from '../utils/validate-patch';

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
  const tSectors = useTranslations('sectors');
  const tPriorities = useTranslations('priorities');

  // Derive existing parameters from current input
  const existingSolarDrop = input.events.find((e) => e.type === 'solar_drop');
  const currentDropPct = existingSolarDrop ? Math.round((1 - existingSolarDrop.factor) * 100) : 0;
  const initialDropStart = existingSolarDrop ? existingSolarDrop.startHour : 12;
  const initialDropDuration = existingSolarDrop ? existingSolarDrop.durationH : 3;

  const [draftStart, setDraftStart] = useState<number>(initialDropStart);
  const [draftDuration, setDraftDuration] = useState<number>(initialDropDuration);

  // Validation error dictionary for inline feedback
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track previous input & status to sync draft state during render without cascading effects
  const [prevInput, setPrevInput] = useState(input);
  const [prevStatus, setPrevStatus] = useState(status);
  if (prevInput !== input || prevStatus !== status) {
    setPrevInput(input);
    setPrevStatus(status);
    if (status === 'ready') {
      const drop = input.events.find((e) => e.type === 'solar_drop');
      setDraftStart(drop ? drop.startHour : 12);
      setDraftDuration(drop ? drop.durationH : 3);
      setErrors({});
    } else if (status === 'complete' && existingSolarDrop) {
      setDraftStart(existingSolarDrop.startHour);
      setDraftDuration(existingSolarDrop.durationH);
    }
  }

  const validateAndPatch = (field: keyof InputPatch, candidate: InputPatch) => {
    const error = validatePatch(field, candidate, input);
    const newErrors = { ...errors };
    if (error) {
      newErrors[field] = tSim(`errors.${error.key}`, error.params);
      setErrors(newErrors);
      return;
    }
    delete newErrors[field];
    if (field === 'dropStartHour' || field === 'dropDurationH') {
      delete newErrors.dropStartHour;
      delete newErrors.dropDurationH;
    }
    if (field === 'solarDropPct' && candidate.solarDropPct === 0) {
      delete newErrors.dropStartHour;
      delete newErrors.dropDurationH;
    }
    setErrors(newErrors);
    onPatch(candidate);
  };

  const handleSolarDropChange = (val: number) => {
    validateAndPatch('solarDropPct', {
      solarDropPct: val,
      dropStartHour: draftStart,
      dropDurationH: draftDuration,
    });
  };

  const handleDropStartChange = (val: number) => {
    setDraftStart(val);
    validateAndPatch('dropStartHour', {
      dropStartHour: val,
      dropDurationH: draftDuration,
      solarDropPct: currentDropPct,
    });
  };

  const handleDropDurationChange = (val: number) => {
    setDraftDuration(val);
    validateAndPatch('dropDurationH', {
      dropDurationH: val,
      dropStartHour: draftStart,
      solarDropPct: currentDropPct,
    });
  };

  const handleReset = () => {
    setErrors({});
    const drop = input.events.find((e) => e.type === 'solar_drop');
    setDraftStart(drop ? drop.startHour : 12);
    setDraftDuration(drop ? drop.durationH : 3);
    onReset();
  };

  const handleDemandMultiplierChange = (val: number) => {
    // Round to 1 decimal place to prevent floating point noise
    const rounded = Math.round(val * 10) / 10;
    validateAndPatch('demandMultiplier', { demandMultiplier: rounded });
  };

  const handleBatteryCapacityChange = (val: number) => {
    validateAndPatch('batteryCapacityKwh', { batteryCapacityKwh: val });
  };

  const handleInitialSocChange = (val: number) => {
    validateAndPatch('initialSocPct', { initialSocPct: val });
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
            onClick={handleReset}
            disabled={
              status === 'ready' &&
              !isModified &&
              !hasErrors &&
              draftStart === initialDropStart &&
              draftDuration === initialDropDuration
            }
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
          value={draftStart}
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
          value={draftDuration}
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                <p className="text-[11px] text-text-muted line-clamp-2">{stratRule}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
