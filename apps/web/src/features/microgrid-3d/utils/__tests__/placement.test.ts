import { describe, expect, it } from 'vitest';
import { applianceMarkers } from '../appliance-markers';
import { KEEP_OUT_ZONES } from '../landscape';
import { SECTOR_POSITIONS } from '../to-scene-model';
import {
  clampToTerrain,
  defaultPosition,
  nearestSector,
  PLACEMENT_CLEARANCE,
  PLACEMENT_RADIUS,
  snapAwayFromBuildings,
} from '../placement';

describe('nearestSector (PP-T2)', () => {
  it('at a building → its sector; between two → the nearer', () => {
    expect(nearestSector({ x: 9, z: -1 })).toBe('health');
    expect(nearestSector({ x: -8, z: 2 })).toBe('water');
    // health [9,-1] vs industry [11,-8.5]: (10, -2) is closer to health.
    expect(nearestSector({ x: 10, z: -2 })).toBe('health');
    expect(nearestSector({ x: 10.5, z: -7 })).toBe('industry');
  });

  it('exact tie → first in SECTOR_IDS order', () => {
    // Midpoint of health [9,-1] and industry [11,-8.5]: equidistant.
    expect(nearestSector({ x: 10, z: -4.75 })).toBe('health');
  });
});

describe('clampToTerrain (PP-T2)', () => {
  it('inside the disc → unchanged values', () => {
    expect(clampToTerrain({ x: 10, z: -20 })).toEqual({ x: 10, z: -20 });
    expect(clampToTerrain({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 });
  });

  it('outside → projected onto the disc, direction kept', () => {
    expect(PLACEMENT_RADIUS).toBe(106);
    const out = clampToTerrain({ x: 200, z: 0 });
    expect(out.x).toBeCloseTo(106, 9);
    expect(out.z).toBeCloseTo(0, 9);
    // Engine box corner (110, 110) hangs off-map: pulled onto the disc.
    const corner = clampToTerrain({ x: 110, z: 110 });
    expect(Math.hypot(corner.x, corner.z)).toBeCloseTo(106, 9);
    expect(corner.x).toBeCloseTo(corner.z, 9);
  });
});

describe('snapAwayFromBuildings (PP-T2)', () => {
  it('building centre → pushed to r + clearance', () => {
    const zone = KEEP_OUT_ZONES[0]!;
    const out = snapAwayFromBuildings({ x: zone.x, z: zone.z });
    expect(Math.hypot(out.x - zone.x, out.z - zone.z)).toBeCloseTo(zone.r + PLACEMENT_CLEARANCE, 9);
  });

  it('just inside an edge → pushed out; outside → untouched', () => {
    const zone = KEEP_OUT_ZONES[0]!;
    const inside = { x: zone.x + zone.r - 0.1, z: zone.z };
    const out = snapAwayFromBuildings(inside);
    expect(Math.hypot(out.x - zone.x, out.z - zone.z)).toBeGreaterThanOrEqual(
      zone.r + PLACEMENT_CLEARANCE - 1e-9
    );
    const far = { x: 60, z: 60 };
    expect(snapAwayFromBuildings(far)).toEqual(far);
  });

  it('overlapping clearings → outside every zone', () => {
    // Health [9,-1] r4.6 and industry [11,-8.5] r4.2 clearings overlap; start between them.
    const out = snapAwayFromBuildings({ x: 10, z: -4.75 });
    for (const k of KEEP_OUT_ZONES) {
      expect(Math.hypot(out.x - k.x, out.z - k.z)).toBeGreaterThanOrEqual(
        k.r + PLACEMENT_CLEARANCE - 1e-9
      );
    }
  });
});

describe('defaultPosition (PP-T2)', () => {
  // Out/side components of (p − building): out along the outer axis, side perpendicular.
  const components = (sector: 'health' | 'water', k: number) => {
    const [bx, , bz] = SECTOR_POSITIONS[sector];
    const [x, y, z] = defaultPosition(sector, k);
    const len = Math.hypot(bx, bz);
    const ox = bx / len;
    const oz = bz / len;
    return { y, out: (x - bx) * ox + (z - bz) * oz, side: (x - bx) * -oz + (z - bz) * ox };
  };

  it('k = 0 sits MARKER_RING out on the outer side of the building', () => {
    const c = components('health', 0);
    expect(c.y).toBe(0);
    expect(c.out).toBeCloseTo(3.4, 9);
    expect(c.side).toBeCloseTo(-2 * 0.7, 9);
    const [bx, , bz] = SECTOR_POSITIONS.health;
    const [x, , z] = defaultPosition('health', 0);
    expect(Math.hypot(x, z)).toBeGreaterThan(Math.hypot(bx, bz));
  });

  it('rows of 5: k = 1 same row, k = 5 one row further out', () => {
    const r0 = components('water', 0);
    const r1 = components('water', 1);
    const r5 = components('water', 5);
    expect(r1.out).toBeCloseTo(r0.out, 9);
    expect(r1.side).toBeCloseTo(r0.side + 0.7, 9);
    expect(r5.out).toBeCloseTo(r0.out + 0.75, 9);
    // Same-row neighbours spread sideways (gap 0.7).
    const [x0, , z0] = defaultPosition('water', 0);
    const [x1, , z1] = defaultPosition('water', 1);
    expect(Math.hypot(x1 - x0, z1 - z0)).toBeCloseTo(0.7, 9);
  });

  it('matches the ring applianceMarkers draws today', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({
      id: `a${i}`,
      name: `Fridge ${i}`,
      category: 'fridge' as const,
      sector: 'health' as const,
      watts: 120,
      quantity: 1,
    }));
    const markers = applianceMarkers(seven, SECTOR_POSITIONS, 12);
    expect(markers).toHaveLength(7);
    markers.forEach((m, k) => {
      const [x, y, z] = defaultPosition('health', k);
      expect(m.position[0]).toBeCloseTo(x, 9);
      expect(m.position[1]).toBe(y);
      expect(m.position[2]).toBeCloseTo(z, 9);
    });
  });
});
