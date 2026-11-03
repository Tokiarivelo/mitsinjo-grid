'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ScrollText } from 'lucide-react';
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

export interface ConstitutionCardProps {
  defaultOpen?: boolean;
}

/**
 * Village constitution deck card (M10-T2): the rules in plain words. Same checker the autopilot
 * consults before every suggestion — stored as data, verified by code.
 */
export function ConstitutionCard({ defaultOpen = true }: ConstitutionCardProps = {}) {
  const t = useTranslations('features.simulation');
  const tSectors = useTranslations('sectors');
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      aria-label={t('constitutionTitle')}
      className="rounded-card border border-border/70 bg-surface/60 p-2.5 sm:p-3 flex flex-col gap-2 transition-all"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex items-center justify-between gap-1.5 text-xs font-semibold text-text-primary cursor-pointer hover:text-energy-cyan transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4 text-ai-violet" aria-hidden="true" />
          {t('constitutionTitle')}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-text-muted">
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>
      </button>
      {open && (
        <>
          <ul className="flex flex-col gap-1 pt-1 border-t border-border/40">
            {DEFAULT_CONSTITUTION.map((rule) => (
              <li key={rule.id} className="text-xs text-text-secondary">
                {ruleText(t, tSectors, rule)}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-text-muted">{t('constitutionNote')}</p>
        </>
      )}
    </section>
  );
}
