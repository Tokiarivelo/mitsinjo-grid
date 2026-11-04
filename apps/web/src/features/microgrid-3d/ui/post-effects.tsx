'use client';

import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Ink } from './ink';
import { SCENE_INK_TOKEN } from '../utils/ink-effect';

/** Ink strength in the village (PT-6): lighter than the editor, many objects at once. */
export const VILLAGE_INK = 0.35;
/** Village ink fades out with distance (world units): near buildings inked, far forest clean. */
export const VILLAGE_INK_FADE = [22, 45] as const;

/**
 * High-tier look: ambient occlusion grounds buildings and trees, bloom lifts lit windows,
 * active cables and the sun, then a warm filmic grade (ACES, same curve as the low tier), a light ink outline
 * (PT-6, merged into the vignette's pass: no extra render) and a soft vignette.
 * Only data-driven or light-source materials exceed the bloom threshold.
 */
export function PostEffects() {
  return (
    <EffectComposer multisampling={2} enableNormalPass={false}>
      <N8AO
        halfRes
        aoRadius={2.2}
        intensity={2.4}
        distanceFalloff={0.8}
        quality="performance"
        color="#1a1020"
      />
      <Bloom
        mipmapBlur
        luminanceThreshold={1}
        luminanceSmoothing={0.2}
        intensity={0.9}
        radius={0.72}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* Grade after tone mapping: on HDR input (> 1) these go negative → black pixels. */}
      <HueSaturation saturation={0.12} />
      <BrightnessContrast contrast={0.06} />
      {/* Silhouettes only (no creases: terrain and tree facets would turn to noise), dark ink. */}
      <Ink strength={VILLAGE_INK} crease={0} fade={VILLAGE_INK_FADE} token={SCENE_INK_TOKEN} />
      <Vignette offset={0.3} darkness={0.55} />
    </EffectComposer>
  );
}
