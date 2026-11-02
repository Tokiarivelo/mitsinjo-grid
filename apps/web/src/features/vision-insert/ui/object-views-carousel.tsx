'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Check, Compass, Eye, Sparkles } from 'lucide-react';
import type { CanonicalAngle, ImaginedAngleView } from '@/lib/object-shape';
import { cn } from '@/lib/utils';

export interface ObjectViewsCarouselProps {
  views: ImaginedAngleView[];
  onValidate?: () => void;
  isValidating?: boolean;
}

/**
 * 6-Angle 2D Imagination Viewer.
 * Displays the object imagined across all 6 canonical angles (front, back, left, right, top, 3/4)
 * with anatomical callout details, allowing the user to inspect and validate before generating 3D.
 */
export function ObjectViewsCarousel({
  views,
  onValidate,
  isValidating = false,
}: ObjectViewsCarouselProps) {
  const t = useTranslations('features.visionInsert');
  const [selectedAngle, setSelectedAngle] = useState<CanonicalAngle>(views[0]?.angle ?? 'front');

  if (!views || views.length === 0) return null;

  const currentView = views.find((v) => v.angle === selectedAngle) ?? views[0]!;

  return (
    <div className="flex flex-col gap-3 rounded-control border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Eye className="h-4 w-4 text-ai-violet" aria-hidden="true" />
          <span>{t('model3dViewsTab')}</span>
        </div>
        <span className="rounded-full bg-ai-violet/10 px-2 py-0.5 text-[11px] font-medium text-ai-violet">
          6 angles
        </span>
      </div>

      <p className="text-xs text-text-muted">{t('viewsIntro')}</p>

      {/* 6 Thumbnails grid */}
      <div className="grid grid-cols-6 gap-1.5" role="tablist" aria-label={t('model3dViewsTab')}>
        {views.map((v) => {
          const isActive = v.angle === selectedAngle;
          return (
            <button
              key={v.angle}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedAngle(v.angle)}
              className={cn(
                'group flex flex-col items-center gap-1 rounded-md border p-1 text-center transition-all cursor-pointer min-h-11',
                isActive
                  ? 'border-ai-violet bg-ai-violet/10 shadow-sm'
                  : 'border-border bg-surface-elevated hover:border-border-hover hover:bg-surface-hover'
              )}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded bg-black/40">
                <Image
                  src={v.imageUrl}
                  alt={t(v.labelKey)}
                  fill
                  sizes="64px"
                  className="object-contain"
                  unoptimized
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium truncate w-full',
                  isActive ? 'text-ai-violet font-semibold' : 'text-text-secondary'
                )}
              >
                {t(v.labelKey)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Angle Hero View */}
      <div className="relative aspect-video w-full overflow-hidden rounded-control border border-border bg-canvas-sunken">
        <Image
          src={currentView.imageUrl}
          alt={t(currentView.labelKey)}
          fill
          sizes="(max-width: 768px) 100vw, 400px"
          className="object-contain p-2"
          unoptimized
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold text-text-primary backdrop-blur-sm border border-border shadow-xs">
          <Compass className="h-3.5 w-3.5 text-ai-violet" aria-hidden="true" />
          <span>{t(currentView.labelKey)}</span>
          {currentView.angleDeg !== undefined && (
            <span className="text-[10px] text-text-muted">({currentView.angleDeg}°)</span>
          )}
        </div>
      </div>

      {/* Description & Features */}
      <div className="flex flex-col gap-2 rounded-md border border-border/80 bg-surface-elevated p-2.5 text-xs">
        <p className="text-text-secondary leading-relaxed">{currentView.description}</p>

        {currentView.features && currentView.features.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40">
            <span className="text-[11px] font-medium text-text-muted">{t('featuresTitle')}</span>
            <div className="flex flex-wrap gap-1.5">
              {currentView.features.map((feat) => (
                <span
                  key={feat}
                  className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-[11px] text-text-primary border border-border/60"
                >
                  <Check className="h-3 w-3 text-battery-green shrink-0" aria-hidden="true" />
                  {feat}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Validation / 3D Generation Action */}
      {onValidate && (
        <button
          type="button"
          onClick={onValidate}
          disabled={isValidating}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-ai-violet px-4 text-xs font-semibold text-surface shadow-xs hover:bg-ai-violet/90 active:scale-[0.99] disabled:opacity-50 cursor-pointer transition-all"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>{t('validateAndGenerate3d')}</span>
        </button>
      )}
    </div>
  );
}
