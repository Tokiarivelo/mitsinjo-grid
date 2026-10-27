'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

export * from './types';
export * from './utils/to-scene-model';
export * from './utils/webgl';
export { useWebGLAvailable } from './hooks/use-webgl-available';
export { useReducedMotion } from './hooks/use-reduced-motion';
export { useFullscreen } from './hooks/use-fullscreen';
export { useSceneQuality, type SceneQuality } from './hooks/use-scene-quality';

export function VillageScenePlaceholder({ className }: { className?: string }) {
  const t = useTranslations('features.simulation');
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center w-full h-full min-h-[360px] bg-canvas-sunken text-text-muted gap-2',
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-energy-cyan" aria-hidden="true" />
      <span className="text-xs font-mono tracking-wider uppercase text-text-secondary">
        {t('loading3d')}
      </span>
    </div>
  );
}

export const LazyVillageCanvas = dynamic(
  () => import('./ui/village-canvas').then((mod) => mod.VillageCanvas),
  {
    ssr: false,
    loading: () => <VillageScenePlaceholder />,
  }
);
