import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildPlacedYardsGeometry,
  buildSingleYardGeometry,
  yardColorAt,
} from '../placed-yards-geometry';
import { GROUND_HEX, terrainColor } from '../terrain-colors';
import { terrainHeight, type KeepOutZone } from '../landscape';

describe('laterite yards (PI-T5)', () => {
  const sampleZone: KeepOutZone = {
    id: 'yard-1',
    x: 18,
    z: 14,
    r: 3.2,
  };

  it('yardColorAt matches the ground yard color at the center of the zone', () => {
    const cYard = yardColorAt(sampleZone.x, sampleZone.z, sampleZone);
    const expected = new THREE.Color(GROUND_HEX.yard);

    // In a building yard, terrainColor lerps C.yard with factor 0.8:
    const baseColor = new THREE.Color();
    terrainColor(sampleZone.x, sampleZone.z, baseColor);
    const expectedBlended = baseColor.clone().lerp(expected, 0.8);

    expect(cYard.r).toBeCloseTo(expectedBlended.r, 4);
    expect(cYard.g).toBeCloseTo(expectedBlended.g, 4);
    expect(cYard.b).toBeCloseTo(expectedBlended.b, 4);
  });

  it('buildSingleYardGeometry drapes vertices over terrain relief (+3 cm)', () => {
    const g = buildSingleYardGeometry(sampleZone);
    expect(g).toBeInstanceOf(THREE.BufferGeometry);

    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.count).toBeGreaterThan(30);

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      // Verify draped height is terrainHeight(x, z) + 0.03
      const expectedY = terrainHeight(vx, vz) + 0.03;
      expect(vy).toBeCloseTo(expectedY, 4);

      // Verify vertex stays within the irregular clearing boundary (<= r * 1.15)
      const dist = Math.hypot(vx - sampleZone.x, vz - sampleZone.z);
      expect(dist).toBeLessThanOrEqual(sampleZone.r * 1.15);
    }
  });

  it('buildPlacedYardsGeometry returns null on empty clearings (0 draw calls)', () => {
    expect(buildPlacedYardsGeometry([])).toBeNull();
  });

  it('buildPlacedYardsGeometry merges all yards into exactly 1 BufferGeometry', () => {
    const zones: KeepOutZone[] = [
      { id: 'yard-a', x: 20, z: 20, r: 2.5 },
      { id: 'yard-b', x: -15, z: 25, r: 3.0 },
      { id: 'yard-c', x: 5, z: -22, r: 1.8 },
    ];

    const merged = buildPlacedYardsGeometry(zones);
    expect(merged).not.toBeNull();
    expect(merged).toBeInstanceOf(THREE.BufferGeometry);

    const singleCount = buildSingleYardGeometry(zones[0]!).getAttribute('position').count;
    const mergedCount = merged!.getAttribute('position').count;
    expect(mergedCount).toBe(singleCount * 3);
  });
});
