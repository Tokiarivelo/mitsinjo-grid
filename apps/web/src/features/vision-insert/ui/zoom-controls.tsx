'use client';

import { Hand, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { usePhotoZoom } from '../hooks/use-photo-zoom';

export interface ZoomControlsProps {
  zoom: Omit<
    ReturnType<typeof usePhotoZoom>,
    'viewportRef' | 'contentStyle' | 'onImageLoad' | 'centreOn'
  >;
  /** Shown while drawing or adjusting on a zoomed photo: the photo moves instead of the shapes. */
  pan?: { on: boolean; toggle: () => void };
}

const button =
  'flex h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface-elevated px-2 text-text-primary hover:bg-surface-hover cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan';

/** − / level (back to 100 %) / + for the detection photo, and the « move the photo » toggle. */
export function ZoomControls({ zoom, pan }: ZoomControlsProps) {
  const t = useTranslations('features.visionInsert');
  const percent = Math.round(zoom.zoom * 100);
  return (
    <div role="group" aria-label={t('zoomGroup')} className="flex items-center gap-1">
      <button
        type="button"
        onClick={zoom.zoomOut}
        disabled={!zoom.canZoomOut}
        aria-label={t('zoomOut')}
        className={button}
      >
        <ZoomOut className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={zoom.reset}
        disabled={!zoom.canZoomOut}
        aria-label={t('zoomReset', { percent })}
        className={cn(button, 'w-16 font-mono text-xs tabular-nums')}
      >
        {t('zoomLevel', { percent })}
      </button>
      <button
        type="button"
        onClick={zoom.zoomIn}
        disabled={!zoom.canZoomIn}
        aria-label={t('zoomIn')}
        className={button}
      >
        <ZoomIn className="h-4 w-4" aria-hidden="true" />
      </button>
      {pan && (
        <button
          type="button"
          onClick={pan.toggle}
          aria-pressed={pan.on}
          aria-label={t('panPhoto')}
          title={t('panPhoto')}
          className={cn(
            button,
            pan.on && 'border-energy-cyan/60 bg-energy-cyan/15 text-energy-cyan'
          )}
        >
          <Hand className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
