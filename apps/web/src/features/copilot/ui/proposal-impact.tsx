'use client';

import { Cpu } from 'lucide-react';
import type { ChangeImpact, SectorId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { fmtDeltaKwh, fmtKwh, fmtPct, EMPTY_PLACEHOLDER } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ProposalImpactProps {
  impact: ChangeImpact;
}

/** Mobile: 3 value columns (label spans them); sm+: label + 3 values on one line. */
const ROW_GRID =
  'grid grid-cols-3 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem] gap-x-2 gap-y-1 px-3 py-2 items-center';

interface ImpactRow {
  key: string;
  label: string;
  before: string;
  after: string;
  change: string;
  changeTone?: 'up' | 'down';
}

/** "Engine calculation" block of the approval dialog: engine values only, formatted, no math. */
export function ProposalImpact({ impact }: ProposalImpactProps) {
  const t = useTranslations('features.copilot');
  const tSectors = useTranslations('sectors');
  const hours = (count: number) => t('impactHours', { count });

  const rows: ImpactRow[] = [];
  for (const [id, s] of Object.entries(impact.sectors)) {
    if (!s) continue;
    const sector = tSectors(id as SectorId);
    rows.push({
      key: `${id}-served`,
      label: t('impactServed', { sector }),
      before: fmtKwh(s.servedKwhBefore),
      after: fmtKwh(s.servedKwhAfter),
      change: fmtDeltaKwh(s.servedKwhDelta),
      changeTone: s.servedKwhDelta < 0 ? 'down' : s.servedKwhDelta > 0 ? 'up' : undefined,
    });
    if (s.offHoursAfter !== s.offHoursBefore) {
      rows.push({
        key: `${id}-off`,
        label: t('impactOffHours', { sector }),
        before: hours(s.offHoursBefore),
        after: hours(s.offHoursAfter),
        change: EMPTY_PLACEHOLDER,
      });
    }
  }
  const hasSectorChange = rows.length > 0;
  rows.push(
    {
      key: 'soc-min',
      label: t('impactSocMin'),
      before: fmtPct(impact.socMinPctBefore),
      after: fmtPct(impact.socMinPctAfter),
      change: EMPTY_PLACEHOLDER,
    },
    {
      key: 'unserved',
      label: t('impactUnserved'),
      before: fmtKwh(impact.unservedKwhBefore),
      after: fmtKwh(impact.unservedKwhAfter),
      change: EMPTY_PLACEHOLDER,
    }
  );

  return (
    <section
      aria-labelledby="proposal-impact-title"
      className="rounded-lg border border-energy-cyan/40 bg-surface"
    >
      <div className="px-3 pt-2.5 pb-2 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-energy-cyan uppercase font-semibold tracking-wider">
          <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
          <span id="proposal-impact-title">{t('impactTitle')}</span>
        </div>
        <span className="text-[10px] font-mono text-text-muted">{impact.afterResultId}</span>
      </div>
      <p className="px-3 pb-2 text-[11px] text-text-secondary">{t('impactSubtitle')}</p>
      {!hasSectorChange && (
        <p className="px-3 pb-2 text-[11px] text-text-secondary" role="status">
          {t('impactNoChange')}
        </p>
      )}
      {/* Grid table: on phones the label takes its own line above the three values. */}
      <div role="table" aria-labelledby="proposal-impact-title" className="font-mono text-[11px]">
        <div
          role="row"
          className={cn(
            ROW_GRID,
            'border-y border-border/40 bg-surface-elevated text-text-muted text-[10px] font-semibold'
          )}
        >
          <span role="columnheader" className="hidden sm:block">
            <span className="sr-only">{t('impactTitle')}</span>
          </span>
          <span role="columnheader">{t('impactColBefore')}</span>
          <span role="columnheader">{t('impactColAfter')}</span>
          <span role="columnheader">{t('impactColChange')}</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.key}
            role="row"
            className={cn(ROW_GRID, 'border-b border-border/30 last:border-b-0')}
          >
            <span
              role="rowheader"
              className="col-span-3 sm:col-span-1 font-sans font-medium text-xs text-text-primary"
            >
              {r.label}
            </span>
            <span role="cell" className="text-text-secondary whitespace-nowrap">
              {r.before}
            </span>
            <span role="cell" className="font-semibold text-energy-cyan whitespace-nowrap">
              {r.after}
            </span>
            <span
              role="cell"
              className={cn(
                'whitespace-nowrap',
                r.changeTone === 'down' && 'text-critical-red font-semibold',
                r.changeTone === 'up' && 'text-battery-green font-semibold',
                !r.changeTone && 'text-text-muted'
              )}
            >
              {r.change}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
