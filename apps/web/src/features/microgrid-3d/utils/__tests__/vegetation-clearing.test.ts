import { describe, expect, it } from 'vitest';
import { applyClearingScales, scatterVegetation, type ScatterItem } from '../scatter';
import type { KeepOutZone } from '../landscape';

describe('tree clearing in siteZones (PI-T4)', () => {
  const items = scatterVegetation({ forestCount: 400, villageCount: 80 });

  it('no clearing zones -> all items preserve original scale', () => {
    const scales = applyClearingScales(items, []);
    expect(scales).toHaveLength(items.length);
    for (let i = 0; i < items.length; i++) {
      expect(scales[i]).toBe(items[i]?.scale);
      expect(scales[i]).toBeGreaterThan(0);
    }
  });

  it('masks items inside clearing zone to scale 0 without modifying the items array', () => {
    // Pick the position of an existing tree
    const targetTree = items[10]!;
    const clearing: KeepOutZone = {
      id: 'placed-obj-1',
      x: targetTree.position[0],
      z: targetTree.position[2],
      r: 4.0,
    };

    const scales = applyClearingScales(items, [clearing]);

    // Target tree is in the clearing -> scale 0
    expect(scales[10]).toBe(0);

    // All items inside the radius have scale 0
    let clearedCount = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const d = Math.hypot(it.position[0] - clearing.x, it.position[2] - clearing.z);
      if (d < clearing.r) {
        expect(scales[i]).toBe(0);
        clearedCount++;
      } else {
        expect(scales[i]).toBe(it.scale);
        expect(scales[i]).toBeGreaterThan(0);
      }
    }
    expect(clearedCount).toBeGreaterThanOrEqual(1);
  });

  it('clearing affects broadleaf trees, palms, bushes, and rocks uniformly', () => {
    const mockItems: ScatterItem[] = [
      {
        model: 'canopy_tall',
        kind: 'broadleaf',
        position: [20, 0, 20],
        rotationY: 0,
        scale: 2.5,
        tint: 0.5,
      },
      {
        model: 'tree_palmTall',
        kind: 'palm',
        position: [21, 0, 20],
        rotationY: 1,
        scale: 1.8,
        tint: 0.3,
      },
      {
        model: 'plant_bushLarge',
        kind: 'bush',
        position: [19, 0, 21],
        rotationY: 2,
        scale: 2.0,
        tint: 0.2,
      },
      {
        model: 'rock_largeA',
        kind: 'rock',
        position: [20.5, 0, 20.5],
        rotationY: 0.5,
        scale: 1.0,
        tint: 0.1,
      },
      {
        model: 'canopy_round',
        kind: 'broadleaf',
        position: [50, 0, 50],
        rotationY: 0,
        scale: 2.4,
        tint: 0.6,
      },
    ];

    const clearing: KeepOutZone = { id: 'test-clearing', x: 20, z: 20, r: 3.0 };
    const scales = applyClearingScales(mockItems, [clearing]);

    expect(scales[0]).toBe(0); // broadleaf
    expect(scales[1]).toBe(0); // palm
    expect(scales[2]).toBe(0); // bush
    expect(scales[3]).toBe(0); // rock
    expect(scales[4]).toBe(2.4); // outside clearing: untouched
  });

  it('removing the object restores all vegetation to their exact previous place', () => {
    const targetTree = items[25]!;
    const clearing: KeepOutZone = {
      id: 'temp-obj',
      x: targetTree.position[0],
      z: targetTree.position[2],
      r: 3.5,
    };

    const scalesBefore = applyClearingScales(items, []);
    const scalesWithClearing = applyClearingScales(items, [clearing]);
    expect(scalesWithClearing[25]).toBe(0);

    // Remove the object:
    const scalesAfterRemoval = applyClearingScales(items, []);
    expect(scalesAfterRemoval).toEqual(scalesBefore);
    expect(scalesAfterRemoval[25]).toBe(targetTree.scale);
  });
});
