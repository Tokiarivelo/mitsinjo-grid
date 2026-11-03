import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  YARD_TINT,
  buildAccessPathGeometry,
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

  it('yardColorAt paints the centre red laterite, like the village paths', () => {
    const cYard = yardColorAt(sampleZone.x, sampleZone.z, sampleZone);
    const expected = new THREE.Color(GROUND_HEX.laterite);

    const baseColor = new THREE.Color();
    terrainColor(sampleZone.x, sampleZone.z, baseColor);
    const expectedBlended = baseColor.clone().lerp(expected, YARD_TINT);
    // Red dominates: it reads as bare earth, not grass.
    expect(cYard.r).toBeGreaterThan(cYard.g);

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

  it('access track ribbon is draped (+4 cm) and merged in the same geometry', () => {
    const path = { from: [18, 14] as [number, number], to: [10, 10] as [number, number] };
    const ribbon = buildAccessPathGeometry(path);
    const pos = ribbon.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.count).toBeGreaterThan(10);
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBeCloseTo(terrainHeight(pos.getX(i), pos.getZ(i)) + 0.04, 4);
    }
    const merged = buildPlacedYardsGeometry([sampleZone], [path])!;
    const yardCount = buildSingleYardGeometry(sampleZone).getAttribute('position').count;
    expect(merged.getAttribute('position').count).toBe(yardCount + pos.count);
    expect(buildPlacedYardsGeometry([], [path])).not.toBeNull();
  });

  it('yards and tracks face up, so they show from the sky camera (regression)', () => {
    const geometries = [
      buildSingleYardGeometry(sampleZone),
      buildAccessPathGeometry({ from: [18, 14], to: [10, 10] }),
    ];
    for (const g of geometries) {
      const normal = g.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < normal.count; i++) expect(normal.getY(i)).toBeGreaterThan(0.5);
      // Every triangle is counter-clockwise seen from above (front face up).
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const idx = g.getIndex()!;
      for (let t = 0; t < idx.count; t += 3) {
        const [a, b, c] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
        const ux = pos.getX(b) - pos.getX(a);
        const uz = pos.getZ(b) - pos.getZ(a);
        const vx = pos.getX(c) - pos.getX(a);
        const vz = pos.getZ(c) - pos.getZ(a);
        expect(uz * vx - ux * vz).toBeGreaterThan(0);
      }
    }
  });
});
