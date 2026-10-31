'use client';

import { useId, useState } from 'react';
import { Flame, X } from 'lucide-react';
import type { SectorId } from '@mitsinjo/engine';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useSimulationStore } from '@/stores';
import { useActiveFires } from '../hooks/use-fire-alerts';

export interface ReportFireControlProps {
  /** `hud`: compact, for the 3D / 2D / circuit overlays; `panel`: full width in a controls panel. */
  variant?: 'hud' | 'panel';
  /** Side the sector list opens to (HUD only). */
  align?: 'left' | 'right';
  className?: string;
}

/**
 * « Report a fire » (M2-T2): pick the sector, the fire applies at once at the shown hour (safety
 * exception, no approval). Sectors already burning are disabled.
 */
export function ReportFireControl({
  variant = 'hud',
  align = 'right',
  className,
}: ReportFireControlProps) {
  const t = useTranslations('features.fireAlert');
  const tSectors = useTranslations('sectors');
  const sectors = useSimulationStore((s) => s.input.sectors);
  const reportFire = useSimulationStore((s) => s.reportFire);
  const burning = new Set(useActiveFires().map((f) => f.sector));
  const [open, setOpen] = useState(false);
  const listId = useId();

  const report = (sector: SectorId) => {
    reportFire(sector);
    setOpen(false);
  };

  return (
    <div className={cn('relative', variant === 'panel' && 'w-full', className)}>
      <Button
        variant="danger"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        icon={<Flame className="h-3.5 w-3.5" aria-hidden="true" />}
        className={cn('min-h-11', variant === 'panel' ? 'w-full justify-center' : 'h-9 min-h-9')}
      >
        {t('reportButton')}
      </Button>

      {open && (
        <div
          id={listId}
          role="group"
          aria-label={t('reportTitle')}
          className={cn(
            'flex flex-col gap-1 p-2 rounded-card border border-critical-red/40 bg-surface-elevated shadow-lg',
            variant === 'hud'
              ? cn(
                  'absolute top-full mt-2 z-40 w-64 max-w-[calc(100vw-2rem)]',
                  align === 'right' ? 'right-0' : 'left-0'
                )
              : 'mt-2'
          )}
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <span className="text-xs font-semibold text-text-primary">{t('reportTitle')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('reportCancel')}
              className="h-11 w-11 -m-2 inline-flex items-center justify-center rounded-control-sm text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="px-1 text-[11px] text-text-secondary">{t('reportHint')}</p>
          {sectors.map((s) => {
            const onFire = burning.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                disabled={onFire}
                onClick={() => report(s.id)}
                className="min-h-11 px-3 rounded-control-sm text-left text-xs font-medium text-text-primary bg-surface border border-border hover:border-critical-red/50 hover:bg-critical-red/10 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan flex items-center justify-between gap-2"
              >
                <span>{tSectors(s.id)}</span>
                {onFire && (
                  <span className="text-[10px] font-semibold text-critical-red">
                    {t('alreadyBurning')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
