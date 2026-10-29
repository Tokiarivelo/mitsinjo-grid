'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SweepParam } from '@mitsinjo/engine';
import { InsightCard } from '@/components/ui/insight-card';
import { useTranslations } from '@/lib/i18n';
import { fmtNum } from '@/lib/format';
import { DIVERGENCE_THRESHOLD_KWH } from '../utils/divergence';
import type { DivergenceInfo } from '../utils/divergence';
import { fmtSweepValue } from '../utils/sweep-value';

export interface DivergenceCalloutProps {
  divergence: DivergenceInfo;
  param: SweepParam;
  className?: string;
}

export function DivergenceCallout({ divergence, param, className }: DivergenceCalloutProps) {
  const tStrategies = useTranslations('strategies');

  const paramLabel = tStrategies(`sensitivity.params.${param}`);

  if (divergence.found && divergence.bestStrategy && divergence.worstStrategy) {
    return (
      <InsightCard
        title={tStrategies('sensitivity.divergenceTitle')}
        text={tStrategies('sensitivity.divergenceDesc', {
          param: paramLabel,
          value: fmtSweepValue(param, divergence.value ?? 0),
          diff: fmtNum(divergence.diff, 2),
          best: tStrategies(divergence.bestStrategy),
          bestVal: fmtNum(divergence.bestVal, 2),
          worst: tStrategies(divergence.worstStrategy),
          worstVal: fmtNum(divergence.worstVal, 2),
        })}
        evidenceRef={`metrics.criticalUnservedKwh diff > ${DIVERGENCE_THRESHOLD_KWH} kWh @ ${param}=${divergence.value}`}
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
      evidenceRef={`max(criticalUnservedKwh) - min(criticalUnservedKwh) <= ${DIVERGENCE_THRESHOLD_KWH} kWh`}
      origin="computed"
      icon={<CheckCircle2 className="h-5 w-5 text-battery-green" />}
      className={className}
    />
  );
}
