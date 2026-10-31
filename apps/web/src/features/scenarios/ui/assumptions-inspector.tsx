'use client';

import { useState } from 'react';
import { Lock, RotateCcw, Settings, Sliders } from 'lucide-react';
import { SectorIcon } from '@/components/ui/sector-icon';
import {
  HORIZON_H,
  STEP_H,
  type InputPatch,
  type ScenarioId,
  type SimulationInput,
} from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtKw, fmtPct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import {
  ConditionControlsGrid,
  useConditionControls,
  type ConditionField,
} from '@/features/simulation';

const INSPECTOR_FIELDS: readonly ConditionField[] = [
  'solarDropPct',
  'demandMultiplier',
  'batteryCapacityKwh',
  'initialSocPct',
];

export interface AssumptionsInspectorProps {
  scenarioId: ScenarioId;
  scenarioName: string;
  input: SimulationInput;
  isModified: boolean;
  onPatch: (patch: InputPatch) => void;
  onReset: () => void;
  className?: string;
}

export function AssumptionsInspector({
  scenarioId,
  scenarioName,
  input,
  isModified,
  onPatch,
  onReset,
  className,
}: AssumptionsInspectorProps) {
  const tScenarios = useTranslations('features.scenarios');
  const tSectors = useTranslations('sectors');
  const tPriorities = useTranslations('priorities');

  // Confirmation state for reset
  const [confirmReset, setConfirmReset] = useState(false);
  const { controls } = useConditionControls(input, isModified ? 'modified' : 'ready', onPatch);

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    onReset();
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-4 p-5 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
              {tScenarios('assumptionsTitle')}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-control-sm bg-surface-elevated border border-border text-text-muted">
              {scenarioName} ({scenarioId})
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">{tScenarios('assumptionsSubtitle')}</p>
        </div>

        {/* Reset to Defaults button */}
        <Button
          variant={confirmReset ? 'danger' : 'secondary'}
          size="sm"
          disabled={!isModified && !confirmReset}
          onClick={handleResetClick}
          onMouseLeave={() => setConfirmReset(false)}
          icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
          aria-label={confirmReset ? tScenarios('confirmReset') : tScenarios('resetToDefaults')}
        >
          {confirmReset ? tScenarios('confirmReset') : tScenarios('resetToDefaults')}
        </Button>
      </div>

      {/* Editable Parameters Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Sliders className="h-3.5 w-3.5 text-energy-cyan" aria-hidden="true" />
          <span>{tScenarios('editableOperatingParameters')}</span>
        </div>

        <ConditionControlsGrid
          controls={controls}
          fields={INSPECTOR_FIELDS}
          showDescriptions={false}
          className="@3xl:grid-cols-2"
        />
      </div>

      {/* Read-Only Engine Constraints Section (Precedence 1) */}
      <div className="pt-3 border-t border-border/60 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
            <span>{tScenarios('fixedEngineConstants')}</span>
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {tScenarios('enforcedByModel')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-control bg-surface-elevated/70 border border-border">
            <span className="text-[10px] font-sans text-text-muted block">
              {tScenarios('simulationHorizon')}
            </span>
            <span className="font-semibold text-text-primary">
              {tScenarios('horizonValue', { hours: HORIZON_H, step: STEP_H })}
            </span>
          </div>

          <div className="p-2.5 rounded-control bg-surface-elevated/70 border border-border">
            <span className="text-[10px] font-sans text-text-muted block">
              {tScenarios('chargeDischargeEff')}
            </span>
            <span className="font-semibold text-battery-green">
              {fmtPct(input.battery.chargeEff * 100, 0)} /{' '}
              {fmtPct(input.battery.dischargeEff * 100, 0)}
            </span>
          </div>

          <div className="p-2.5 rounded-control bg-surface-elevated/70 border border-border">
            <span className="text-[10px] font-sans text-text-muted block">
              {tScenarios('minSocReserve')}
            </span>
            <span className="font-semibold text-solar-amber">
              {fmtPct(input.battery.minSocPct)}
            </span>
          </div>

          <div className="p-2.5 rounded-control bg-surface-elevated/70 border border-border">
            <span className="text-[10px] font-sans text-text-muted block">
              {tScenarios('maxChargeDischarge')}
            </span>
            <span className="font-semibold text-energy-cyan">
              {fmtKw(input.battery.maxChargeKw, 0)} / {fmtKw(input.battery.maxDischargeKw, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Village Sector Demands and Resilience Tiers */}
      <div className="pt-3 border-t border-border/60">
        <span className="text-xs font-semibold text-text-primary font-sans block mb-2">
          {tScenarios('sectorPrioritiesAndProfiles')}
        </span>

        <div className="flex flex-col gap-1.5">
          {input.sectors.map((sec) => {
            return (
              <div
                key={sec.id}
                className="flex items-center justify-between p-2.5 rounded-control bg-surface-elevated/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-control-sm bg-surface-elevated border border-border">
                    <SectorIcon sector={sec.id} className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="font-medium text-text-primary block font-sans">
                      {tSectors(sec.id)}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">
                      {tScenarios('criticalShareLabel', {
                        share: Math.round(sec.criticalShare * 100),
                      })}
                      {sec.flexible ? ` · ${tScenarios('flexibleLoad')}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {input.sectorCaps
                    ?.filter((c) => c.sector === sec.id)
                    .map((cap, cIdx) => (
                      <span
                        key={cIdx}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-energy-cyan/15 border border-energy-cyan/30 text-energy-cyan font-medium"
                      >
                        {tScenarios('capBadge', {
                          maxKw: cap.maxKw,
                          from: cap.fromHour,
                          to: cap.toHour,
                        })}
                      </span>
                    ))}
                  <span className="text-[10px] font-mono uppercase text-text-muted">
                    {tPriorities(sec.priority)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
