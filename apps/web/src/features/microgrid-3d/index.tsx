'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

export * from './types';
export * from './utils/to-scene-model';
export * from './utils/webgl';

export function VillageScenePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center w-full h-full min-h-[360px] bg-canvas-sunken text-text-muted gap-2 ${className || ''}`}
    >
      <Loader2 className="h-6 w-6 animate-spin text-energy-cyan" aria-hidden="true" />
      <span className="text-xs font-mono tracking-wider uppercase text-text-secondary">
        Initializing 3D Digital Twin...
      </span>
    </div>
  );
}

export const LazyVillageCanvas = dynamic(
  () => import('./components/village-canvas').then((mod) => mod.VillageCanvas),
  {
    ssr: false,
    loading: () => <VillageScenePlaceholder />,
  }
);
