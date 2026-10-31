'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { applianceSummary, MAX_APPLIANCES } from '@mitsinjo/engine';
import { PencilLine, Plug, Trash2 } from 'lucide-react';
import { SectorIcon } from '@/components/ui/sector-icon';
import { fmtKwh } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useSimulationAppliances } from '../hooks/use-simulation-appliances';

export interface ApplianceListProps {
  className?: string;
  /** Lines this page can edit (current photo on /village) → « Edit » selects the object. */
  onEdit?: (applianceId: string) => void;
  canEdit?: (applianceId: string) => boolean;
  /** Link to the village editor in the empty state and on rows that cannot be edited here. */
  editorHref?: string;
}

/**
 * « Appliances in the simulation » (PV-T13): every inserted line with `quantity × W`, its sector and its
 * engine energy per day; remove at once, edit in the village editor. Same list on /village and /simulation.
 */
export function ApplianceList({ className, onEdit, canEdit, editorHref }: ApplianceListProps) {
  const t = useTranslations('features.visionInsert');
  const tSectors = useTranslations('sectors');
  const { list, remove } = useSimulationAppliances();
  const daily = useMemo(
    () => new Map(list.map((a) => [a.id, applianceSummary(a).dailyKwh])),
    [list]
  );

  return (
    <section
      aria-labelledby="appliance-list-title"
      className={cn(
        'flex flex-col gap-3 rounded-card border border-border bg-surface p-4',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Plug className="mt-0.5 h-4 w-4 shrink-0 text-energy-cyan" aria-hidden="true" />
        <div className="min-w-0">
          <h3
            id="appliance-list-title"
            className="text-xs font-display font-semibold uppercase tracking-wider text-text-primary"
          >
            {t('listSimTitle', { count: list.length, max: MAX_APPLIANCES })}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted">{t('listSimHint')}</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-text-secondary">
          {t('listSimEmpty')}{' '}
          {editorHref && (
            <Link
              href={editorHref}
              className="font-medium text-energy-cyan underline-offset-2 hover:underline"
            >
              {t('listSimOpenEditor')}
            </Link>
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((a) => {
            const editable = onEdit && (canEdit?.(a.id) ?? true);
            return (
              <li
                key={a.id}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-1.5"
              >
                <SectorIcon sector={a.sector} className="h-4 w-4 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-text-primary">{a.name}</span>
                  <span className="truncate text-xs text-text-secondary">
                    {t('listSimLine', {
                      quantity: a.quantity,
                      watts: a.watts,
                      sector: tSectors(a.sector),
                      daily: fmtKwh(daily.get(a.id), 2),
                    })}
                  </span>
                </span>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => onEdit(a.id)}
                    aria-label={t('listSimEdit', { name: a.name })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary cursor-pointer"
                  >
                    <PencilLine className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  editorHref && (
                    <Link
                      href={editorHref}
                      aria-label={t('listSimEdit', { name: a.name })}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary"
                    >
                      <PencilLine className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )
                )}
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  aria-label={t('listSimRemove', { name: a.name })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-critical-red cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
