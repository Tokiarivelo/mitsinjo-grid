'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

export interface ObjectDisplayControlsProps {
  scale: number;
  /** Null = measured colours. */
  tint: string | null;
  onScale: (v: number) => void;
  onTint: (v: string | null) => void;
  onReset: () => void;
}

/** Display size multiplier bounds for the 3D preview. */
export const DISPLAY_SCALE_MIN = 0.5;
export const DISPLAY_SCALE_MAX = 2;

/**
 * Viewer display tweaks (PV-T11b, visual only): preview size and a tint over the measured
 * colours. Nothing here touches the recipe, the engine or the stored shape.
 */
export function ObjectDisplayControls({
  scale,
  tint,
  onScale,
  onTint,
  onReset,
}: ObjectDisplayControlsProps) {
  const t = useTranslations('features.visionInsert');
  const custom = scale !== 1 || tint !== null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex min-h-11 flex-1 basis-40 items-center gap-2 text-xs text-text-secondary">
        {t('model3dScale')}
        <input
          type="range"
          min={DISPLAY_SCALE_MIN}
          max={DISPLAY_SCALE_MAX}
          step={0.05}
          value={scale}
          aria-valuetext={`${Math.round(scale * 100)}%`}
          onChange={(e) => onScale(Number(e.target.value))}
          className="min-h-11 flex-1 cursor-pointer accent-energy-cyan"
        />
        <span aria-hidden="true" className="w-10 text-right font-mono text-[11px] text-text-muted">
          {Math.round(scale * 100)}%
        </span>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs text-text-secondary">
        {t('model3dTint')}
        <input
          type="color"
          value={tint ?? '#ffffff'}
          onChange={(e) => onTint(e.target.value)}
          className="h-8 w-11 cursor-pointer rounded-control border border-border bg-surface-elevated p-0.5"
        />
      </label>
      {custom && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-text-primary hover:bg-surface-hover cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('model3dDisplayReset')}
        </button>
      )}
    </div>
  );
}
