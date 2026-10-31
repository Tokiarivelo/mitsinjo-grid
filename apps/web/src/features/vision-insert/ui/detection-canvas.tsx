'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, ScanSearch, Sparkles } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { boxPath, type ApplianceDetection } from '@/lib/vision';
import type { VisionStatus } from '../hooks/use-vision-detection';
import { categoryHint } from '../utils/labels';

export interface DetectionCanvasProps {
  imageUrl: string;
  status: VisionStatus;
  detections: ApplianceDetection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry?: () => void;
  /** The mock answered instead of the vision model (offline or fallback). */
  isDemo?: boolean;
}

/**
 * Photo with one outline per detected appliance (PV-T7). Pointer: hover highlights, click selects.
 * Keyboard and screen readers use the list under the photo (same highlight on focus).
 */
export function DetectionCanvas({
  imageUrl,
  status,
  detections,
  selectedId,
  onSelect,
  onRetry,
  isDemo,
}: DetectionCanvasProps) {
  const t = useTranslations('features.visionInsert');
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = detections.find((d) => d.id === activeId) ?? null;
  const busy = status === 'loading';
  const showList = status === 'refining' || status === 'ready';
  const hint = (d: ApplianceDetection) => categoryHint(d.label, t(`categories.${d.category}`));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-md border border-ai-violet/40 bg-ai-violet/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-ai-violet">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {t('aiLabel')}
        </span>
        {isDemo && <span className="text-text-muted">{t('demoNote')}</span>}
        {status === 'refining' && (
          <span role="status" className="inline-flex items-center gap-1 text-text-secondary">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t('refining')}
          </span>
        )}
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-canvas-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={t('imageAlt')}
          className={cn('block h-auto max-h-[60vh] w-full object-contain', busy && 'opacity-60')}
        />
        {showList && detections.length > 0 && (
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {detections.map((d) => {
              const selected = d.id === selectedId;
              const hot = d.id === activeId;
              return (
                <path
                  key={d.id}
                  data-detection={d.id}
                  d={d.outline ?? boxPath(d.box)}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={selected || hot ? 3 : 2}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selected
                      ? 'fill-solar-amber/25 stroke-solar-amber'
                      : hot
                        ? 'fill-energy-cyan/30 stroke-energy-cyan'
                        : 'fill-energy-cyan/10 stroke-energy-cyan'
                  )}
                  onPointerEnter={() => setActiveId(d.id)}
                  onPointerLeave={() => setActiveId((id) => (id === d.id ? null : id))}
                  onClick={() => onSelect(d.id)}
                />
              );
            })}
          </svg>
        )}
        {showList && active && (
          <span
            className="pointer-events-none absolute max-w-[60%] truncate rounded-md bg-surface-elevated/95 px-2 py-0.5 text-[11px] font-medium text-text-primary shadow border border-border"
            style={{
              left: `${Math.min(active.box.x, 0.98) * 100}%`,
              top: `${active.box.y * 100}%`,
              transform: active.box.y > 0.08 ? 'translateY(-110%)' : 'translateY(4px)',
            }}
          >
            {hint(active) ? `${active.label} · ${hint(active)}` : active.label}
          </span>
        )}
        {busy && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-text-primary"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('loading')}
          </div>
        )}
      </div>

      {status === 'error' && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-critical-red/40 bg-critical-red/10 p-3 text-sm text-text-primary"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-critical-red" aria-hidden="true" />
            {t('error')}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t('retry')}
            </button>
          )}
        </div>
      )}

      {showList && detections.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
          <ScanSearch className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
          <div>
            <p className="font-medium text-text-primary">{t('empty')}</p>
            <p className="text-text-secondary">{t('emptyHint')}</p>
          </div>
        </div>
      )}

      {showList && detections.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-text-secondary">
            {t('listTitle', { count: detections.length })}
          </h4>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {detections.map((d) => {
              const selected = d.id === selectedId;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(d.id)}
                    onMouseEnter={() => setActiveId(d.id)}
                    onMouseLeave={() => setActiveId((id) => (id === d.id ? null : id))}
                    onFocus={() => setActiveId(d.id)}
                    onBlur={() => setActiveId((id) => (id === d.id ? null : id))}
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan',
                      selected
                        ? 'border-solar-amber/60 bg-solar-amber/10 text-text-primary'
                        : 'border-border bg-surface text-text-primary hover:bg-surface-hover'
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">{d.label}</span>
                    {hint(d) && (
                      <span className="shrink-0 text-xs text-text-secondary">{hint(d)}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
