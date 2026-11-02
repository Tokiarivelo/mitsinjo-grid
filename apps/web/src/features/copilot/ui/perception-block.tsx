'use client';

import { useState } from 'react';
import { SECTOR_IDS, type InputPatch, type SectorId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { observationToPatch } from '@/lib/observation-to-patch';
import type { Observation } from '@/server/perception/schemas';
import type { ActiveMedia } from './media-lightbox-modal';
import type { CopilotPerception } from '../types';

export interface PerceptionBlockProps {
  perception: CopilotPerception;
  onPropose: (patch: InputPatch, reason: string) => void;
  onMediaClick?: (media: ActiveMedia) => void;
  /** Smoke/fire seen: opens the report dialog (the operator picks the sector, M8-T3). */
  onReportFire?: () => void;
}

/**
 * One vision result (M4-T4): AI observations in their own violet style, values editable,
 * then proposed to the engine. Never engine evidence — always a proposal the operator approves.
 */
export function PerceptionBlock({
  perception,
  onPropose,
  onMediaClick,
  onReportFire,
}: PerceptionBlockProps) {
  const t = useTranslations('features.copilot.perception');
  const tSectors = useTranslations('sectors');
  const observations = perception.observations ?? [];
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sector, setSector] = useState<SectorId | ''>('');
  const needsSector = observations.some(
    (o) => o.label === 'meter_reading' && typeof o.value === 'number'
  );

  const edited: { obs: Observation; raw: string; valid: boolean }[] = observations.map((obs) => {
    if (typeof obs.value !== 'number') return { obs, raw: String(obs.value), valid: true };
    const raw = edits[obs.label] ?? String(obs.value);
    return { obs, raw, valid: raw.trim() !== '' && !Number.isNaN(Number(raw)) };
  });
  const convertible: Observation[] = edited.flatMap(({ obs, raw, valid }) =>
    typeof obs.value === 'number' && valid ? [{ ...obs, value: Number(raw) }] : []
  );
  const { patch, unmapped } = observationToPatch(convertible, sector ? { sector } : undefined);
  const skipped = [
    ...new Set([
      ...unmapped.map((u) => u.label),
      ...observations.filter((o) => typeof o.value !== 'number').map((o) => o.label),
    ]),
  ];
  const canPropose = Object.keys(patch).length > 0;
  const mappedLabels = convertible
    .map((o) => o.label)
    .filter((l) => !unmapped.some((u) => u.label === l));

  return (
    <div className="rounded-lg border border-ai-violet/40 bg-ai-violet/10 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-ai-violet">
          {t('title')}
        </p>
        <p className="text-[10px] font-mono text-text-muted">{perception.model}</p>
      </div>
      {perception.summary && (
        <p className="mt-1 text-xs text-text-secondary">{perception.summary}</p>
      )}
      {perception.kind === 'segment' && perception.concept && (
        <p className="mt-1 text-xs font-semibold text-text-primary">
          {perception.count ?? 0} × {perception.concept}
        </p>
      )}
      {perception.kind === 'segment' &&
        perception.imageUrl &&
        (perception.instances?.length ?? 0) > 0 &&
        perception.imageWidth &&
        perception.imageHeight && (
          <button
            type="button"
            onClick={() =>
              onMediaClick?.({
                url: perception.imageUrl!,
                type: 'image',
                title: perception.concept,
                masks: (perception.instances ?? []).map((inst) => ({
                  ...(inst.outline ? { outline: inst.outline } : {}),
                  box: inst.box,
                  imageWidth: perception.imageWidth!,
                  imageHeight: perception.imageHeight!,
                })),
              })
            }
            className="mt-2 min-h-9 rounded-control border border-energy-cyan/60 bg-energy-cyan/15 px-3 text-xs font-semibold text-text-primary hover:bg-energy-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
          >
            {t('viewOnPhoto')}
          </button>
        )}
      <ul className="mt-2 space-y-1.5">
        {edited.map(({ obs, raw, valid }) =>
          typeof obs.value === 'number' ? (
            <li key={obs.label} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-mono text-text-primary">{obs.label}</span>
              <input
                type="number"
                aria-label={obs.label}
                aria-invalid={!valid}
                value={raw}
                onChange={(e) => setEdits((prev) => ({ ...prev, [obs.label]: e.target.value }))}
                className={cn(
                  'w-24 rounded-control-sm border border-border bg-surface px-2 py-1 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-violet',
                  !valid && 'border-critical-red ring-1 ring-critical-red/50'
                )}
              />
              {obs.unit && <span className="text-text-muted">{obs.unit}</span>}
              <span className="text-[10px] text-text-muted">
                {t('confidence')} {obs.confidence}
              </span>
              {!valid && (
                <span className="text-[10px] font-medium text-critical-red">
                  {t('invalidNumber')}
                </span>
              )}
            </li>
          ) : (
            <li key={obs.label} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-mono text-text-primary">{obs.label}</span>
              <span className="font-mono text-text-secondary">{String(obs.value)}</span>
              {obs.unit && <span className="text-text-muted">{obs.unit}</span>}
              <span className="text-[10px] text-text-muted">
                {t('confidence')} {obs.confidence}
              </span>
            </li>
          )
        )}
      </ul>
      {needsSector && (
        <label className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
          {t('meterSector')}
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as SectorId | '')}
            className="rounded-control-sm border border-border bg-surface px-2 py-1 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-violet"
          >
            <option value="">—</option>
            {SECTOR_IDS.map((id) => (
              <option key={id} value={id}>
                {tSectors(id)}
              </option>
            ))}
          </select>
        </label>
      )}
      {skipped.length > 0 && (
        <p className="mt-2 text-[11px] text-text-muted">
          {t('notConvertible')}: {skipped.join(', ')}
        </p>
      )}
      {perception.kind !== 'segment' && (
        <button
          type="button"
          disabled={!canPropose}
          onClick={() => onPropose(patch, t('reasonFrom', { labels: mappedLabels.join(', ') }))}
          className="mt-2 min-h-9 rounded-control border border-ai-violet/60 bg-ai-violet/15 px-3 text-xs font-semibold text-text-primary hover:bg-ai-violet/25 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-violet"
        >
          {t('propose')}
        </button>
      )}
      {perception.kind === 'analyze' &&
        onReportFire &&
        edited.some(
          (o) =>
            /smoke|fire|flame/i.test(o.obs.label) &&
            (o.obs.value === true || (typeof o.obs.value === 'number' && o.obs.value > 0))
        ) && (
          <button
            type="button"
            onClick={onReportFire}
            className="mt-2 min-h-9 rounded-control border border-critical-red/60 bg-critical-red/15 px-3 text-xs font-semibold text-text-primary hover:bg-critical-red/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical-red"
          >
            {t('reportFire')}
          </button>
        )}
    </div>
  );
}
