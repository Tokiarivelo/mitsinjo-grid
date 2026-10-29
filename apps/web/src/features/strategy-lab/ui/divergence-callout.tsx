'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SweepParam } from '@mitsinjo/engine';
import { InsightCard } from '@/components/ui/insight-card';
import { useTranslations } from '@/lib/i18n';
import type { DivergenceInfo } from '../utils/divergence';

export interface DivergenceCalloutProps {
  divergence: DivergenceInfo;
  param: SweepParam;
  className?: string;
}

export function DivergenceCallout({ divergence, param, className }: DivergenceCalloutProps) {
  const tStrategies = useTranslations('strategies');

  const paramLabel = tStrategies(`sensitivity.params.${param}`);
  const formattedVal =
    param === 'demandMultiplier' ? `${divergence.value}×` : `${divergence.value}%`;

  if (divergence.found && divergence.bestStrategy && divergence.worstStrategy) {
    return (
      <InsightCard
        title={tStrategies('sensitivity.divergenceTitle')}
        text={tStrategies('sensitivity.divergenceDesc', {
          param: paramLabel,
          value: formattedVal,
          diff: divergence.diff ?? 0,
          best: tStrategies(divergence.bestStrategy),
          bestVal: divergence.bestVal ?? 0,
          worst: tStrategies(divergence.worstStrategy),
          worstVal: divergence.worstVal ?? 0,
        })}
        evidenceRef={`metrics.criticalUnservedKwh diff > 0.1 kWh @ ${param}=${divergence.value}`}
        origin="computed"
        icon={<AlertTriangle className="h-5 w-5 text-solar-amber" />}
        className={className}
      />
    );
  }

  return (
    <InsightCard
      title={tStrategies('sensitivity.noDivergenceTitle')}
      text={tStrategies('sensitivity.noDivergenceDesc', {
        param: paramLabel,
      })}
      evidenceRef="max(criticalUnservedKwh) - min(criticalUnservedKwh) <= 0.1 kWh"
      origin="computed"
      icon={<CheckCircle2 className="h-5 w-5 text-battery-green" />}
      className={className}
    />
  );
}
