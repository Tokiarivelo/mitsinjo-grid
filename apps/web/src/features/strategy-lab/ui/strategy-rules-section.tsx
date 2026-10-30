'use client';

import { useState } from 'react';
import { HeartPulse, PowerOff } from 'lucide-react';
import {
  connectedSectors,
  DEFAULT_BALANCED_WEIGHTS,
  DEFAULT_LIFELINE_KW,
  PRIORITY_ORDER,
  type InputPatch,
  type Priority,
  type SectorId,
  type SimulationInput,
} from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { SimControl } from '@/components/ui/sim-control';
import { SectorIcon } from '@/components/ui/sector-icon';

/** Upper bound of a survival floor, same as InputPatch.lifeline.kw. */
const LIFELINE_MAX_KW = 2;

export interface StrategyRulesSectionProps {
  input: SimulationInput;
  onPatch: (patch: InputPatch) => void;
  className?: string;
}

/**
 * Strategy rules editor:
 * 1. Priority weights for Pass 2 of Balanced allocation (0-10, at least one > 0).
 * 2. Critical demand share per sector for Pass 1 (0-100%).
 * 3. Survival floors (lifeline): on/off and kW floor per connected sector (0-2 kW).
 */
export function StrategyRulesSection({ input, onPatch, className }: StrategyRulesSectionProps) {
  const t = useTranslations('strategies.params');
  const tPriorities = useTranslations('priorities');
  const tSectors = useTranslations('sectors');

  const currentWeights = input.strategyParams?.balancedWeights ?? DEFAULT_BALANCED_WEIGHTS;
  const [weightsError, setWeightsError] = useState<string | null>(null);

  const handleWeightChange = (priority: Priority, value: number) => {
    const nextWeights = {
      ...currentWeights,
      [priority]: value,
    };
    const allZero = Object.values(nextWeights).every((w) => w === 0);
    if (allZero) {
      setWeightsError(t('errors.allWeightsZero'));
      return;
    }
    setWeightsError(null);
    onPatch({ balancedWeights: { [priority]: value } });
  };

  const handleCriticalShareChange = (sectorId: SectorId, pct: number) => {
    const share = Math.max(0, Math.min(1, pct / 100));
    onPatch({ criticalShares: { [sectorId]: share } });
  };

  const lifelineEnabled = input.strategyParams?.lifeline?.enabled !== false;
  const toggleLifeline = () => onPatch({ lifeline: { enabled: !lifelineEnabled } });
  const handleFloorChange = (sectorId: SectorId, kw: number) => {
    onPatch({ lifeline: { kw: { [sectorId]: Math.max(0, Math.min(LIFELINE_MAX_KW, kw)) } } });
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div>
        <h4 className="text-xs font-semibold text-text-primary">{t('strategyRules')}</h4>
        <p className="text-xs text-text-muted mt-0.5">{t('strategyRulesDesc')}</p>
      </div>

      {/* Balanced Priority Weights (0-10) */}
      <div className="flex flex-col gap-2 p-3 rounded-control bg-surface-elevated/40 border border-border/60">
        <div>
          <h5 className="text-xs font-medium text-text-primary">{t('balancedWeights')}</h5>
          <p className="text-xs text-text-muted mt-0.5">{t('balancedWeightsDesc')}</p>
        </div>
        {weightsError && (
          <p className="text-xs text-critical-red font-medium" role="alert">
            {weightsError}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-1">
          {PRIORITY_ORDER.map((priority) => (
            <SimControl
              key={priority}
              label={tPriorities(priority)}
              value={currentWeights[priority] ?? DEFAULT_BALANCED_WEIGHTS[priority]}
              unit={t('weightUnit')}
              min={0}
              max={10}
              step={1}
              onChange={(val) => handleWeightChange(priority, val)}
              className="bg-surface/80"
            />
          ))}
        </div>
      </div>

      {/* Essential Lifeline Shares per Sector (0-100%) */}
      <div className="flex flex-col gap-2 p-3 rounded-control bg-surface-elevated/40 border border-border/60">
        <div>
          <h5 className="text-xs font-medium text-text-primary">{t('criticalShares')}</h5>
          <p className="text-xs text-text-muted mt-0.5">{t('criticalSharesDesc')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 mt-1">
          {input.sectors.map((sec) => (
            <div key={sec.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 px-1 text-xs text-text-secondary">
                <SectorIcon sector={sec.id} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tSectors(sec.id)}</span>
              </div>
              <SimControl
                label={tSectors(sec.id)}
                value={Math.round(sec.criticalShare * 100)}
                unit="%"
                min={0}
                max={100}
                step={5}
                onChange={(val) => handleCriticalShareChange(sec.id, val)}
                className="bg-surface/80"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Survival floors (lifeline) per connected sector (0-2 kW) */}
      <div
        data-testid="lifeline-floors"
        className="flex flex-col gap-2 p-3 rounded-control bg-surface-elevated/40 border border-border/60"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h5 className="text-xs font-medium text-text-primary">{t('lifelineFloors')}</h5>
            <p className="text-xs text-text-muted mt-0.5">{t('lifelineFloorsDesc')}</p>
          </div>
          <Button
            variant={lifelineEnabled ? 'secondary' : 'ghost'}
            size="sm"
            className="min-h-11 shrink-0"
            aria-pressed={lifelineEnabled}
            icon={
              lifelineEnabled ? (
                <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
              )
            }
            onClick={toggleLifeline}
          >
            {lifelineEnabled ? t('lifelineOn') : t('lifelineOff')}
          </Button>
        </div>
        {lifelineEnabled ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 mt-1">
            {connectedSectors(input).map((sec) => (
              <div key={sec.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 px-1 text-xs text-text-secondary">
                  <SectorIcon sector={sec.id} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{tSectors(sec.id)}</span>
                </div>
                <SimControl
                  label={t('lifelineFloorFor', { sector: tSectors(sec.id) })}
                  value={sec.lifelineKw ?? DEFAULT_LIFELINE_KW[sec.id]}
                  unit="kW"
                  min={0}
                  max={LIFELINE_MAX_KW}
                  step={0.05}
                  onChange={(val) => handleFloorChange(sec.id, val)}
                  className="bg-surface/80"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-warning-amber">{t('lifelineOffNote')}</p>
        )}
      </div>
    </div>
  );
}
