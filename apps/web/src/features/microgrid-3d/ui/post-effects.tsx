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

/**
 * High-tier look: ambient occlusion grounds buildings and trees, bloom lifts lit windows,
 * active cables and the sun, then a warm filmic grade (ACES, same curve as the low tier) and a soft vignette.
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
      <Vignette offset={0.3} darkness={0.55} />
    </EffectComposer>
  );
}
