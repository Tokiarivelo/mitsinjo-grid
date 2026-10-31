'use client';

import dynamic from 'next/dynamic';
import { Box, Loader2, Move3d, Sparkles } from 'lucide-react';
import { useWebGLAvailable } from '@/features/microgrid-3d';
import { useTranslations } from '@/lib/i18n';
import type { ApplianceDetection } from '@/lib/vision';
import type { ObjectShapeState } from '../hooks/use-object-shape';

/** Placeholder while the viewer chunk loads or Spark builds the recipe. */
function ViewerSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-control bg-surface-hover/60" />;
}

export const LazyObjectEditor3d = dynamic(
  () => import('./object-editor-3d').then((m) => m.ObjectEditor3d),
  { ssr: false, loading: () => <ViewerSkeleton /> }
);

export interface ObjectShapePanelProps extends ObjectShapeState {
  detection: ApplianceDetection;
  /** Name shown to the operator (page language). */
  label: string;
  imageUrl: string;
}

/**
 * « 3D model » block of the selected appliance (PV-T10): Spark recipe (« AI shape », violet = AI output)
 * or outline fallback (« Outline shape » + note). No WebGL → a note, the photo stays the reference.
 */
export function ObjectShapePanel({
  status,
  shape,
  detection,
  label,
  imageUrl,
}: ObjectShapePanelProps) {
  const t = useTranslations('features.visionInsert');
  const webgl = useWebGLAvailable();
  const ready = status === 'ready' && shape?.detectionId === detection.id;

  return (
    <section className="flex flex-col gap-2" aria-labelledby="object-3d-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="object-3d-title" className="text-xs font-semibold text-text-secondary">
          {t('model3dTitle')}
        </h4>
        <div aria-live="polite">
          {!ready ? (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <Loader2
                className="h-3 w-3 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t('model3dLoading')}
            </span>
          ) : shape.mode === 'recipe' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-ai-violet/40 bg-ai-violet/10 px-2 py-0.5 text-xs text-ai-violet">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t('model3dAi')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
              <Box className="h-3 w-3" aria-hidden="true" />
              {t('model3dOutline')}
            </span>
          )}
        </div>
      </div>

      {!webgl ? (
        <p className="rounded-control border border-border bg-canvas-sunken p-3 text-xs text-text-muted">
          {t('model3dNoWebgl')}
        </p>
      ) : (
        <div
          role="img"
          aria-label={t('model3dCanvas', { label })}
          className="h-60 w-full overflow-hidden rounded-control border border-border bg-canvas-sunken sm:h-72"
        >
          {ready ? (
            <LazyObjectEditor3d shape={shape} detection={detection} imageUrl={imageUrl} />
          ) : (
            <ViewerSkeleton />
          )}
        </div>
      )}

      {ready && shape.mode === 'silhouette' && (
        <p className="text-xs text-text-muted">{t('model3dOutlineNote')}</p>
      )}
      {ready && webgl && (
        <p className="flex items-center gap-1.5 text-xs text-text-muted">
          <Move3d className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t('model3dHint')}
        </p>
      )}
    </section>
  );
}
