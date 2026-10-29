import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fbm2d, mulberry32, smoothstep, valueNoise2d } from '../noise';
import {
  FLAT_RADIUS,
  KEEP_OUT_ZONES,
  LAKE_CENTER,
  LAKE_LEVEL,
  isBlocked,
  pathDistance,
  terrainHeight,
} from '../landscape';
import { scatterVegetation } from '../scatter';
import { ANCHOR_HEIGHT, POLE_HEIGHT, pointAlongCable, routeCable } from '../cable-route';
import { createHipRoofGeometry } from '../hip-roof';
import { skyPalette } from '../sky-palette';
import { GROUND_HEX, terrainColor } from '../terrain-colors';
import { WINDOW_GLOW_BY_STATUS, glowFromIntensity } from '../scene-palette';
import { SECTOR_POSITIONS } from '../to-scene-model';
import { mergeParts } from '../merge-parts';
import { CANOPY_VARIANTS, createCanopyTree } from '../canopy-tree';
import { mergeObjectMeshes, toFloatGeometry } from '../float-geometry';

describe('noise', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('value noise and fbm stay in [0, 1) and are continuous', () => {
    for (let i = 0; i < 100; i++) {
      const x = i * 0.37;
      const v = fbm2d(x, -x * 0.5, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Math.abs(valueNoise2d(x, 1) - valueNoise2d(x + 1e-4, 1))).toBeLessThan(1e-2);
    }
  });

  it('smoothstep clamps', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});

describe('landscape', () => {
  it('keeps the village plateau flat so buildings never float', () => {
    for (const [x, , z] of Object.values(SECTOR_POSITIONS)) {
      expect(terrainHeight(x, z)).toBe(0);
    }
    expect(terrainHeight(0, FLAT_RADIUS - 5)).toBe(0);
  });

  it('rises into hills outside the plateau and dips under the lake', () => {
    expect(terrainHeight(0, -70)).toBeGreaterThan(2);
    expect(terrainHeight(LAKE_CENTER[0], LAKE_CENTER[1])).toBeLessThan(LAKE_LEVEL);
  });

  it('blocks buildings, paths and the lake, allows open ground', () => {
    for (const k of KEEP_OUT_ZONES) expect(isBlocked(k.x, k.z)).toBe(true);
    expect(pathDistance(0, 1)).toBe(0); // bus hub is on every path
    expect(isBlocked(LAKE_CENTER[0], LAKE_CENTER[1])).toBe(true);
    expect(isBlocked(-30, 30)).toBe(false);
  });
});

describe('scatterVegetation', () => {
  it('is deterministic and never places items in blocked areas', () => {
    const a = scatterVegetation({ forestCount: 200, villageCount: 40 });
    const b = scatterVegetation({ forestCount: 200, villageCount: 40 });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(150);
    for (const it of a) expect(isBlocked(it.position[0], it.position[2])).toBe(false);
  });

  it('sits items on the terrain', () => {
    for (const it of scatterVegetation({ forestCount: 50, villageCount: 10 })) {
      expect(it.position[1]).toBeCloseTo(terrainHeight(it.position[0], it.position[2]));
    }
  });
});

describe('routeCable', () => {
  it('puts poles between anchors and starts/ends at anchor height', () => {
    const r = routeCable([0, 0, 0], [18, 0, 0], { spacing: 4.5 });
    expect(r.poles).toHaveLength(3);
    expect(r.points[0]).toEqual([0, ANCHOR_HEIGHT, 0]);
    expect(r.points.at(-1)?.[1]).toBeCloseTo(ANCHOR_HEIGHT);
    // Cable sags below pole tops between supports.
    expect(Math.min(...r.points.map((p) => p[1]))).toBeLessThan(POLE_HEIGHT);
  });

  it('short runs have no intermediate pole', () => {
    expect(routeCable([0, 0, 0], [2, 0, 0]).poles).toHaveLength(0);
  });

  it('picks a point along the cable by fraction, clamped to its ends', () => {
    const { points } = routeCable([0, 0, 0], [18, 0, 0]);
    expect(pointAlongCable(points, 0)).toEqual(points[0]);
    expect(pointAlongCable(points, 2)).toEqual(points.at(-1));
    expect(pointAlongCable(points, 0.5)[0]).toBeCloseTo(9, 0);
    expect(pointAlongCable([], 0.5)).toEqual([0, 0, 0]);
  });
});

describe('createHipRoofGeometry', () => {
  it('spans the footprint, peaks at height and faces outwards', () => {
    const sizes: [number, number][] = [
      [4, 2],
      [2, 4],
      [2, 2],
    ];
    for (const [w, d] of sizes) {
      const g = createHipRoofGeometry(w, d, 1);
      g.computeBoundingBox();
      const bb = g.boundingBox as THREE.Box3;
      expect(bb.max.x - bb.min.x).toBeCloseTo(w);
      expect(bb.max.z - bb.min.z).toBeCloseTo(d);
      expect(bb.max.y).toBeCloseTo(1);
      const normals = g.getAttribute('normal');
      for (let i = 0; i < normals.count; i++) expect(normals.getY(i)).toBeGreaterThan(0);
    }
  });
});

describe('skyPalette', () => {
  it('is golden near the horizon, brighter in the afternoon, dark at night', () => {
    const golden = skyPalette(0.1, true);
    const afternoon = skyPalette(1, true);
    const night = skyPalette(0, false);
    expect(afternoon.keyIntensity).toBeGreaterThan(golden.keyIntensity);
    expect(night.keyIntensity).toBeLessThan(golden.keyIntensity);
    expect(night.lampGlow).toBeGreaterThan(afternoon.lampGlow);
    expect(afternoon.sunAltitudeDeg).toBeGreaterThan(golden.sunAltitudeDeg);
  });

  it('is pure', () => {
    expect(skyPalette(0.4, true)).toEqual(skyPalette(0.4, true));
  });
});

describe('terrainColor', () => {
  it('paints paths laterite and open ground green', () => {
    const c = new THREE.Color();
    const laterite = new THREE.Color(GROUND_HEX.laterite);
    terrainColor(0, 1, c); // bus hub
    expect(c.r).toBeGreaterThan(c.g);
    expect(Math.abs(c.r - laterite.r)).toBeLessThan(0.2);
    terrainColor(-30, 30, c);
    expect(c.g).toBeGreaterThan(c.r);
  });
});

describe('WINDOW_GLOW_BY_STATUS', () => {
  it('lights served buildings and darkens unserved ones', () => {
    expect(WINDOW_GLOW_BY_STATUS.full).toBe(1);
    expect(WINDOW_GLOW_BY_STATUS.unserved).toBe(0);
    expect(WINDOW_GLOW_BY_STATUS.partial).toBeGreaterThan(0);
    expect(WINDOW_GLOW_BY_STATUS.partial).toBeLessThan(1);
  });
});

describe('glowFromIntensity (PL-T9)', () => {
  it('returns 0 for zero or negative intensity (lights out)', () => {
    expect(glowFromIntensity(0)).toBe(0);
    expect(glowFromIntensity(-0.5)).toBe(0);
    expect(glowFromIntensity(Number.NaN)).toBe(0);
  });

  it('produces a faint warm glow at lifeline floor and full radiant light at 1', () => {
    const lifeline = glowFromIntensity(0.15);
    expect(lifeline).toBeGreaterThan(0.2);
    expect(lifeline).toBeLessThan(0.4);
    expect(glowFromIntensity(1)).toBe(1);
    expect(glowFromIntensity(1.5)).toBe(1);
  });

  it('increases monotonically with feeder intensity', () => {
    const g0 = glowFromIntensity(0);
    const gLow = glowFromIntensity(0.1);
    const gMid = glowFromIntensity(0.5);
    const gHigh = glowFromIntensity(0.9);
    const gFull = glowFromIntensity(1);

    expect(g0).toBeLessThan(gLow);
    expect(gLow).toBeLessThan(gMid);
    expect(gMid).toBeLessThan(gHigh);
    expect(gHigh).toBeLessThan(gFull);
  });
});

describe('mergeParts', () => {
  it('bakes every part with its transform into one geometry', () => {
    const g = mergeParts([
      { shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0.5, 0] },
      {
        shape: { kind: 'box', size: [1, 1, 1] },
        position: [5, 0.5, 0],
        rotation: [0, Math.PI / 4, 0],
      },
      { shape: { kind: 'plane', size: [2, 1] }, position: [0, 3, 0] },
    ]);
    g.computeBoundingBox();
    const bb = g.boundingBox as THREE.Box3;
    expect(bb.min.y).toBeCloseTo(0);
    expect(bb.max.y).toBeCloseTo(3.5);
    expect(bb.max.x).toBeGreaterThan(5.5);
    // 2 boxes × 36 + plane 6 non-indexed vertices.
    expect(g.getAttribute('position').count).toBe(78);
  });

  it('returns an empty geometry for no parts', () => {
    expect(mergeParts([]).getAttribute('position')).toBeUndefined();
  });
});

describe('createCanopyTree', () => {
  it('builds a ~0.8–1.2 unit tree standing on y = 0 with a shaded crown', () => {
    for (const v of CANOPY_VARIANTS) {
      const { foliage, trunk } = createCanopyTree(v, 0);
      foliage.computeBoundingBox();
      trunk.computeBoundingBox();
      const fb = foliage.boundingBox as THREE.Box3;
      expect((trunk.boundingBox as THREE.Box3).min.y).toBeCloseTo(0);
      expect(fb.max.y).toBeGreaterThan(0.7);
      expect(fb.max.y).toBeLessThan(1.2);
      const color = foliage.getAttribute('color');
      expect(color.count).toBe(foliage.getAttribute('position').count);
    }
  });

  it('is deterministic per variant', () => {
    const a = createCanopyTree('canopy_round', 0).foliage.getAttribute('position').array;
    const b = createCanopyTree('canopy_round', 0).foliage.getAttribute('position').array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('toFloatGeometry / mergeObjectMeshes', () => {
  it('denormalizes quantized attributes so transforms are not clamped', () => {
    const g = new THREE.BufferGeometry();
    // Normalized int16: 16384 ≈ 0.5
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Int16Array([16384, 0, 0, 0, 16384, 0, 0, 0, 16384]), 3, true)
    );
    const f = toFloatGeometry(g);
    f.scale(10, 10, 10);
    expect(f.getAttribute('position').getX(0)).toBeCloseTo(5, 2);
  });

  it('merges all meshes of an object with their transforms', () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    b.position.set(4, 0, 0);
    root.add(a, b);
    const { geometry, material } = mergeObjectMeshes(root);
    geometry.computeBoundingBox();
    expect(material).toBe(mat);
    expect((geometry.boundingBox as THREE.Box3).max.x).toBeCloseTo(4.5);
  });
});
