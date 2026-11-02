'use client';

import { ScrollText } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { fmtKw } from '@/lib/format';
import { DEFAULT_CONSTITUTION, type ConstitutionRule } from '@/lib/constitution';

function ruleText(
  t: (key: string, params?: Record<string, string | number>) => string,
  tSectors: (key: string) => string,
  rule: ConstitutionRule
): string {
  if (rule.kind === 'never_cut') {
    return t('constitutionNeverCut', { sector: tSectors(rule.sector) });
  }
  if (rule.kind === 'min_floor') {
    return t('constitutionMinFloor', {
      sector: tSectors(rule.sector),
      kw: fmtKw(rule.kw),
    });
  }
  return t('constitutionStrategyOnly', { strategies: rule.strategies.join(', ') });
}

/**
 * Village constitution deck card (M10-T2): the rules in plain words. Same checker the autopilot
 * consults before every suggestion — stored as data, verified by code.
 */
export function ConstitutionCard() {
  const t = useTranslations('features.simulation');
  const tSectors = useTranslations('sectors');

  return (
    <section
      aria-label={t('constitutionTitle')}
      className="rounded-card border border-border/70 bg-surface/60 p-3 flex flex-col gap-2"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
        <ScrollText className="h-4 w-4 text-ai-violet" aria-hidden="true" />
        {t('constitutionTitle')}
      </p>
      <ul className="flex flex-col gap-1">
        {DEFAULT_CONSTITUTION.map((rule) => (
          <li key={rule.id} className="text-xs text-text-secondary">
            {ruleText(t, tSectors, rule)}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-text-muted">{t('constitutionNote')}</p>
    </section>
  );
}
