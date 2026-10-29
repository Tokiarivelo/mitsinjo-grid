'use client';

import dynamic from 'next/dynamic';
import { VillageScenePlaceholder } from './ui/scene-placeholder';

export * from './types';
export * from './utils/to-scene-model';
export * from './utils/webgl';
export { useWebGLAvailable } from './hooks/use-webgl-available';
export { useReducedMotion } from './hooks/use-reduced-motion';
export { useFullscreen } from './hooks/use-fullscreen';
export { useSceneQuality, type SceneQuality } from './hooks/use-scene-quality';
export { VillageScenePlaceholder };
export { GridDiagram, type GridDiagramProps } from './ui/grid-diagram';
export type { DiagramVariant } from './utils/diagram-layout';

export const LazyVillageCanvas = dynamic(
  () => import('./ui/village-canvas').then((mod) => mod.VillageCanvas),
  {
    ssr: false,
    loading: () => <VillageScenePlaceholder />,
  }
);
