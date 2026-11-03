import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ObjectRecipe } from '@/lib/object-shape';
import { buildPlacedModelsGeometry, type PlacedModelItem } from '../utils/placed-models-geometry';

const SAMPLE_RECIPE: ObjectRecipe = {
  proportions: { w: 1, h: 0.8, d: 0.6 },
  parts: [
    {
      shape: 'box',
      at: [0, 0, 0],
      size: [1, 1, 1],
      color: '#4080c0',
    },
  ],
};

describe('placed-models-geometry (PI-T2)', () => {
  it('returns null geometry when items array is empty', () => {
    const res = buildPlacedModelsGeometry([]);
    expect(res.modelsGeometry).toBeNull();
    expect(res.plinths).toHaveLength(0);
    expect(res.modelBounds).toEqual({});
  });

  it('merges 30 placed objects into a single BufferGeometry (draw call budget: ≤ +2)', () => {
    const items: PlacedModelItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: `app-${i}`,
      sector: 'households',
      running: true,
      position: [(i % 6) * 3 - 8, 0, Math.floor(i / 6) * 3 - 8] as [number, number, number],
      recipe: SAMPLE_RECIPE,
      scale: 1.0,
      archetype: 'cabinet',
    }));

    const res = buildPlacedModelsGeometry(items);
    expect(res.modelsGeometry).toBeInstanceOf(THREE.BufferGeometry);
    // Crucial budget test: 30 objects yield 1 merged geometry, representing exactly 1 draw call!
    expect(Object.keys(res.modelBounds)).toHaveLength(30);
  });

  it('sits on terrainHeight at the lowest point of the footprint (baseH)', () => {
    const items: PlacedModelItem[] = [
      {
        id: 'app-flat',
        sector: 'water',
        running: true,
        // (0, 0) is on village flat plateau where terrainHeight == 0
        position: [0, 0, 0],
        recipe: SAMPLE_RECIPE,
        scale: 1.0,
      },
    ];

    const res = buildPlacedModelsGeometry(items);
    expect(res.modelsGeometry).toBeDefined();
    res.modelsGeometry!.computeBoundingBox();
    const bb = res.modelsGeometry!.boundingBox!;
    // On flat plateau (y=0), bottom should sit at 0
    expect(bb.min.y).toBeCloseTo(0, 2);
  });

  it('generates a concrete plinth when placed on sloped ground (slope > 0.04)', () => {
    const items: PlacedModelItem[] = [
      {
        id: 'app-hill',
        sector: 'households',
        running: true,
        // r > 20 is on rolling hills where terrainHeight varies with slope
        position: [30, 0, 30],
        recipe: SAMPLE_RECIPE,
        scale: 2.0,
      },
    ];

    const res = buildPlacedModelsGeometry(items);
    expect(res.plinths.length).toBeGreaterThan(0);
    expect(res.plinths[0]!.size[0]).toBeGreaterThan(0);
    expect(res.plinths[0]!.size[1]).toBeGreaterThan(0);
  });

  it('dims vertex colors when sector is unserved or appliance is not running', () => {
    const runningItem: PlacedModelItem = {
      id: 'app-running',
      sector: 'water',
      running: true,
      position: [0, 0, 0],
      recipe: SAMPLE_RECIPE,
    };
    const idleItem: PlacedModelItem = {
      id: 'app-idle',
      sector: 'water',
      running: false,
      position: [0, 0, 0],
      recipe: SAMPLE_RECIPE,
    };

    const resRunning = buildPlacedModelsGeometry([runningItem], { water: { unserved: false } });
    const resIdle = buildPlacedModelsGeometry([idleItem], { water: { unserved: true } });

    const colRunning = resRunning.modelsGeometry!.getAttribute('color');
    const colIdle = resIdle.modelsGeometry!.getAttribute('color');

    // Idle / unserved vertices should be dimmed
    expect(colIdle.getX(0)).toBeLessThan(colRunning.getX(0));
    expect(colIdle.getY(0)).toBeLessThan(colRunning.getY(0));
  });

  it('tints vertex colors with fiery alert red when sector is on fire', () => {
    const item: PlacedModelItem = {
      id: 'app-fire',
      sector: 'school',
      running: true,
      position: [0, 0, 0],
      recipe: SAMPLE_RECIPE,
    };

    const resFire = buildPlacedModelsGeometry([item], { school: { onFire: true } });
    const colFire = resFire.modelsGeometry!.getAttribute('color');

    // Fire alert increases red channel, suppresses green
    expect(colFire.getX(0)).toBeGreaterThan(0.3);
    expect(colFire.getY(0)).toBeLessThan(0.4);
  });

  it('renders a simple LOD box on tier low', () => {
    const item: PlacedModelItem = {
      id: 'app-low',
      sector: 'water',
      running: true,
      position: [0, 0, 0],
      recipe: SAMPLE_RECIPE,
    };

    const resLow = buildPlacedModelsGeometry([item], {}, 'low');
    expect(resLow.modelsGeometry).toBeInstanceOf(THREE.BufferGeometry);
    // Box geometry has 24 vertices (or 36 indices)
    expect(resLow.modelsGeometry!.getAttribute('position').count).toBe(24);
  });
});
