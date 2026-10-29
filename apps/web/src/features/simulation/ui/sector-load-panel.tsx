'use client';

import { Gauge, Plug, PlugZap } from 'lucide-react';
import { SimControl } from '@/components/ui/sim-control';
import { Button } from '@/components/ui/button';
import { SectorIcon } from '@/components/ui/sector-icon';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  SECTOR_LOAD_MAX,
  SECTOR_LOAD_MIN,
  SECTOR_LOAD_STEP,
  useSectorLoads,
} from '../hooks/use-sector-loads';

/** One live load slider per sector (× 0–3) + connect / disconnect. Re-runs on every change. */
export function SectorLoadPanel({ className }: { className?: string }) {
  const t = useTranslations('features.simulation.sectorLoad');
  const tSectors = useTranslations('sectors');
  const { rows, setLoad } = useSectorLoads();

  return (
    <section
      aria-labelledby="sector-load-title"
      className={cn(
        'flex flex-col gap-3 p-4 rounded-card bg-surface border border-border',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Gauge className="h-4 w-4 mt-0.5 text-energy-cyan shrink-0" aria-hidden="true" />
        <div>
          <h3
            id="sector-load-title"
            className="text-xs font-display font-semibold uppercase tracking-wider text-text-primary"
          >
            {t('title')}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{t('description')}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-1.5">
            <SimControl
              label={tSectors(row.id)}
              value={Math.round(row.load * 10) / 10}
              unit={t('unit')}
              min={SECTOR_LOAD_MIN}
              max={SECTOR_LOAD_MAX}
              step={SECTOR_LOAD_STEP}
              description={row.connected ? undefined : t('notConnected')}
              onChange={(v) => setLoad(row.id, v)}
            />
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                <SectorIcon sector={row.id} className="h-3.5 w-3.5" />
                {row.connected ? t('connected') : t('disconnected')}
              </span>
              <Button
                variant={row.connected ? 'secondary' : 'primary'}
                size="sm"
                className="min-h-11"
                onClick={() => setLoad(row.id, row.connected ? 0 : 1)}
                aria-label={
                  row.connected
                    ? t('disconnectAria', { sector: tSectors(row.id) })
                    : t('connectAria', { sector: tSectors(row.id) })
                }
              >
                {row.connected ? (
                  <Plug className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <PlugZap className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {row.connected ? t('disconnect') : t('connect')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
