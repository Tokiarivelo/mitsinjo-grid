'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { KeepOutZone } from '../utils/landscape';
import { buildPlacedYardsGeometry } from '../utils/placed-yards-geometry';

const YARD_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.96,
  metalness: 0,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});

export interface PlacedYardsProps {
  clearings?: readonly KeepOutZone[];
}

/**
 * Laterite yards under placed objects (PI-T5):
 * Renders an irregular laterite dirt yard matching existing building yards,
 * draped on the relief (+3 cm, no z-fighting).
 * Merged into ONE draw call (≤ +1 draw call budget). Disposes geometry cleanly on changes.
 */
export function PlacedYards({ clearings = [] }: PlacedYardsProps) {
  const yardsKey = useMemo(
    () => clearings.map((k) => `${k.x.toFixed(2)}:${k.z.toFixed(2)}:${k.r.toFixed(2)}`).join('|'),
    [clearings]
  );

  const geometry = useMemo(() => {
    void yardsKey;
    return buildPlacedYardsGeometry(clearings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yardsKey]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  return <mesh geometry={geometry} material={YARD_MATERIAL} receiveShadow name="placed-yards" />;
}
