'use client';

import { useState } from 'react';
import { AlertCircle, Gauge, X } from 'lucide-react';
import { PRIORITY_ORDER, type Priority, type SectorCap, type SectorConfig } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { SectorIcon } from '@/components/ui/sector-icon';
import { DEFAULT_CAP, validateSectorCap, type SectorCapError } from '../utils/sector-caps';

type CapValues = Omit<SectorCap, 'sector'>;

export interface SectorRuleRowProps {
  sector: SectorConfig;
  cap?: SectorCap;
  onPriorityChange: (priority: Priority) => void;
  /** Valid cap, or null to remove the sector limit. */
  onCapChange: (cap: CapValues | null) => void;
}

const FIELD_CLASS =
  'w-full min-h-11 bg-surface-elevated text-text-primary border border-border rounded-control px-3 text-sm font-mono ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

/** One sector: priority tier and optional power cap. Invalid caps stay as a draft with an error. */
export function SectorRuleRow({ sector, cap, onPriorityChange, onCapChange }: SectorRuleRowProps) {
  const t = useTranslations('strategies.params');
  const tSectors = useTranslations('sectors');
  const tPriorities = useTranslations('priorities');

  const committed: CapValues | null = cap
    ? { maxKw: cap.maxKw, fromHour: cap.fromHour, toHour: cap.toHour }
    : null;
  const [draft, setDraft] = useState<CapValues | null>(committed);
  const [error, setError] = useState<SectorCapError | null>(null);

  // Store reset or external change (e.g. copilot proposal): the draft follows the committed cap
  const [prevCap, setPrevCap] = useState(cap);
  if (prevCap !== cap) {
    setPrevCap(cap);
    setDraft(committed);
    setError(null);
  }

  const name = tSectors(sector.id);
  const idBase = `sector-rule-${sector.id}`;

  const updateCap = (field: keyof CapValues, raw: string) => {
    if (!draft) return;
    const value = Number(raw);
    if (raw.trim() === '' || Number.isNaN(value)) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
    const err = validateSectorCap({ sector: sector.id, ...next });
    setError(err);
    if (!err) onCapChange(next);
  };

  const toggleCap = () => {
    if (draft) {
      setDraft(null);
      setError(null);
      onCapChange(null);
      return;
    }
    setDraft(DEFAULT_CAP);
    setError(null);
    onCapChange(DEFAULT_CAP);
  };

  return (
    <div
      data-sector={sector.id}
      className="flex flex-col gap-3 p-3 rounded-control bg-surface-elevated/40 border border-border/60"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1.5 rounded-control-sm bg-surface-elevated border border-border">
            <SectorIcon sector={sector.id} className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-text-primary truncate">{name}</span>
        </div>

        <div className="flex flex-col min-[400px]:flex-row min-[400px]:items-center gap-2">
          <label htmlFor={`${idBase}-priority`} className="sr-only">
            {t('priorityFor', { sector: name })}
          </label>
          <select
            id={`${idBase}-priority`}
            value={sector.priority}
            onChange={(e) => onPriorityChange(e.target.value as Priority)}
            className={cn(FIELD_CLASS, 'font-sans min-[400px]:flex-1 cursor-pointer')}
          >
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {tPriorities(p)}
              </option>
            ))}
          </select>

          <Button
            variant={draft ? 'ghost' : 'secondary'}
            size="sm"
            className="min-h-11 shrink-0"
            aria-pressed={Boolean(draft)}
            icon={
              draft ? (
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              )
            }
            onClick={toggleCap}
            aria-label={
              draft ? t('removeLimitFor', { sector: name }) : t('limitFor', { sector: name })
            }
          >
            {draft ? t('removeLimit') : t('limitPower')}
          </Button>
        </div>
      </div>

      {draft && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { field: 'maxKw', min: 0, max: 500, step: 0.5, unit: 'kW', label: t('maxKw') },
              { field: 'fromHour', min: 0, max: 23, step: 1, unit: 'h', label: t('fromHour') },
              { field: 'toHour', min: 1, max: 24, step: 1, unit: 'h', label: t('toHour') },
            ] as const
          ).map((f) => (
            <div key={f.field} className="flex flex-col gap-1">
              <label
                htmlFor={`${idBase}-${f.field}`}
                className="text-[11px] font-sans text-text-muted"
              >
                {f.label} ({f.unit})
              </label>
              <input
                id={`${idBase}-${f.field}`}
                type="number"
                inputMode="decimal"
                min={f.min}
                max={f.max}
                step={f.step}
                value={draft[f.field]}
                onChange={(e) => updateCap(f.field, e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${idBase}-error` : undefined}
                className={FIELD_CLASS}
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          id={`${idBase}-error`}
          role="alert"
          className="flex items-center gap-1.5 text-xs text-critical-red"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t(`errors.${error}`)}</span>
        </div>
      )}
    </div>
  );
}
