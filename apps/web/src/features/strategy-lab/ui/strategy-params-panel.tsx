'use client';

import { useId, useState } from 'react';
import { ChevronDown, RotateCcw, Sliders } from 'lucide-react';
import type { InputPatch, SimulationInput } from '@mitsinjo/engine';
import type { SimStatus } from '@/stores';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  ConditionControlsGrid,
  simStatusBadgeVariant,
  useConditionControls,
} from '@/features/simulation';
import { withSectorCap } from '../utils/sector-caps';
import { SectorRuleRow } from './sector-rule-row';
import { StrategyRulesSection } from './strategy-rules-section';

export interface StrategyParamsPanelProps {
  input: SimulationInput;
  status: SimStatus;
  isModified: boolean;
  onPatch: (patch: InputPatch) => void;
  onReset: () => void;
  defaultOpen?: boolean;
  className?: string;
}

/** Shared inputs for all strategies: scenario conditions, sector priorities and power caps. */
export function StrategyParamsPanel({
  input,
  status,
  isModified,
  onPatch,
  onReset,
  defaultOpen = true,
  className,
}: StrategyParamsPanelProps) {
  const t = useTranslations('strategies.params');
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const { controls, hasErrors, draftsDirty, resetControls } = useConditionControls(
    input,
    status,
    onPatch
  );

  const handleReset = () => {
    resetControls();
    onReset();
  };

  return (
    <section
      aria-labelledby={`${bodyId}-title`}
      className={cn(
        'flex flex-col rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex items-start gap-2 text-left min-h-11 rounded-control cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Sliders className="h-4 w-4 mt-0.5 text-energy-cyan shrink-0" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="flex items-center gap-2 flex-wrap">
              <span
                id={`${bodyId}-title`}
                className="font-display text-sm font-semibold text-text-primary tracking-tight"
              >
                {t('title')}
              </span>
              <StatusBadge variant={simStatusBadgeVariant(status, false)} size="sm" />
            </span>
            <span className="text-xs text-text-secondary mt-0.5">{t('subtitle')}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 mt-0.5 text-text-muted shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
          <span className="sr-only">{open ? t('hide') : t('show')}</span>
        </button>

        <Button
          variant="secondary"
          size="sm"
          className="min-h-11 shrink-0"
          onClick={handleReset}
          disabled={!isModified && !hasErrors && !draftsDirty && input.scenarioId !== 'custom'}
          icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {t('reset')}
        </Button>
      </div>

      {open && (
        <div
          id={bodyId}
          className="flex flex-col gap-5 px-4 pb-5 sm:px-5 border-t border-border/60"
        >
          <div className="flex flex-col gap-2 pt-4">
            <h4 className="text-xs font-semibold text-text-primary">{t('conditions')}</h4>
            <ConditionControlsGrid controls={controls} showDescriptions={false} />
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <h4 className="text-xs font-semibold text-text-primary">{t('sectorRules')}</h4>
              <p className="text-xs text-text-muted mt-0.5">{t('sectorRulesDesc')}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 items-start">
              {input.sectors.map((sec) => (
                <SectorRuleRow
                  key={sec.id}
                  sector={sec}
                  cap={input.sectorCaps?.find((c) => c.sector === sec.id)}
                  onPriorityChange={(priority) => onPatch({ priorities: { [sec.id]: priority } })}
                  onCapChange={(cap) =>
                    onPatch({ sectorCaps: withSectorCap(input.sectorCaps, sec.id, cap) })
                  }
                />
              ))}
            </div>
          </div>

          <StrategyRulesSection input={input} onPatch={onPatch} />
        </div>
      )}
    </section>
  );
}
