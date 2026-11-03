import { describe, expect, it } from 'vitest';
import { SECTOR_IDS } from '@mitsinjo/engine';
import {
  KEEP_OUT_ZONES,
  POND_CENTER,
  POND_RADIUS,
  SECTOR_KEEP_OUT_R,
  isBlocked,
  pathDistance,
} from '../landscape';
import { SECTOR_POSITIONS } from '../site-positions';
import { PLACEMENT_CLEARANCE, snapAwayFromBuildings } from '../placement';
import {
  applianceZoneItems,
  dynamicPlacedZones,
  placedItemZone,
  siteZones,
  type PlacedZoneItem,
} from '../site-zones';
import type { ObjectRecipe } from '@/lib/object-shape';

describe('siteZones (PI-T3)', () => {
  it('empty or undefined input returns KEEP_OUT_ZONES', () => {
    const empty = siteZones([]);
    expect(empty).toHaveLength(KEEP_OUT_ZONES.length);
    for (let i = 0; i < KEEP_OUT_ZONES.length; i++) {
      expect(empty[i]?.x).toBe(KEEP_OUT_ZONES[i]?.x);
      expect(empty[i]?.z).toBe(KEEP_OUT_ZONES[i]?.z);
      expect(empty[i]?.r).toBe(KEEP_OUT_ZONES[i]?.r);
    }
  });

  it('positions and radii of the 6 sector buildings never move', () => {
    const placed: PlacedZoneItem[] = [
      { id: 'custom-1', position: { x: 25, z: 25 }, archetype: 'house' },
      { id: 'custom-2', position: { x: -30, z: -30 }, archetype: 'vehicle' },
    ];
    const zones = siteZones(placed);

    for (const id of SECTOR_IDS) {
      const [expectedX, , expectedZ] = SECTOR_POSITIONS[id];
      const expectedR = SECTOR_KEEP_OUT_R[id];
      const found = zones.find((z) => z.id === `sector:${id}`);
      expect(found).toBeDefined();
      expect(found?.x).toBe(expectedX);
      expect(found?.z).toBe(expectedZ);
      expect(found?.r).toBe(expectedR);
    }
  });

  it('computes dynamic zone radius as footprint emprise + archetype margin', () => {
    const dummyRecipe: ObjectRecipe = {
      proportions: { w: 1, h: 1.5, d: 0.8 },
      parts: [
        {
          shape: 'box',
          at: [0, 0, 0],
          size: [1, 1, 1],
          color: '#888888',
        },
      ],
    };

    const item: PlacedZoneItem = {
      id: 'fridge-1',
      position: { x: 12, z: 14 },
      recipe: dummyRecipe,
      scale: 1.0,
      archetype: 'cabinet',
    };

    const zone = placedItemZone(item);
    expect(zone).toBeDefined();
    expect(zone?.x).toBe(12);
    expect(zone?.z).toBe(14);
    expect(zone?.id).toBe('fridge-1');

    // Footprint radius for a 1 x 0.8 box is hypot(0.5, 0.4) = ~0.6403
    // Margin for cabinet is 0.5
    expect(zone?.r).toBeGreaterThan(1.1);
    expect(zone?.r).toBeLessThan(1.2);
  });

  it('supports explicit radius override', () => {
    const item: PlacedZoneItem = {
      id: 'override-1',
      position: { x: 5, z: 5 },
      radius: 3.5,
    };
    const zone = placedItemZone(item);
    expect(zone?.r).toBe(3.5);
  });

  it('filters out invalid or missing coordinates', () => {
    const invalid: PlacedZoneItem[] = [
      { id: 'bad-1', position: null },
      { id: 'bad-2', x: NaN, z: 10 },
    ];
    const zones = siteZones(invalid);
    expect(zones).toHaveLength(KEEP_OUT_ZONES.length);
  });
});

describe('collision tests (PI-T3)', () => {
  it('collision with building (bâtiment): point inside is pushed outside r + clearance', () => {
    // Water building at [-8, 2], keep-out radius 3.4
    const [bx, , bz] = SECTOR_POSITIONS.water;
    const inside = { x: bx, z: bz };

    const snapped = snapAwayFromBuildings(inside);
    const distToBuilding = Math.hypot(snapped.x - bx, snapped.z - bz);
    expect(distToBuilding).toBeGreaterThanOrEqual(
      SECTOR_KEEP_OUT_R.water + PLACEMENT_CLEARANCE - 1e-9
    );
    expect(isBlocked(snapped.x, snapped.z)).toBe(false);
  });

  it('collision with path (chemin): point on path is pushed outside path corridor', () => {
    // Point on main road: market is at [4, 7], road goes to [9, 12]
    // Point [6.5, 9.5] lies on this road segment
    const onPath = { x: 6.5, z: 9.5 };
    expect(pathDistance(onPath.x, onPath.z)).toBeLessThan(1.0);
    expect(isBlocked(onPath.x, onPath.z)).toBe(true);

    const snapped = snapAwayFromBuildings(onPath);
    expect(pathDistance(snapped.x, snapped.z)).toBeGreaterThanOrEqual(
      0.8 + PLACEMENT_CLEARANCE - 1e-9
    );
    expect(isBlocked(snapped.x, snapped.z)).toBe(false);
  });

  it('collision with pond (mare): point in pond is pushed outside pond radius', () => {
    const inPond = { x: POND_CENTER[0], z: POND_CENTER[1] };
    expect(isBlocked(inPond.x, inPond.z)).toBe(true);

    const snapped = snapAwayFromBuildings(inPond);
    const distToPond = Math.hypot(snapped.x - POND_CENTER[0], snapped.z - POND_CENTER[1]);
    expect(distToPond).toBeGreaterThanOrEqual(POND_RADIUS + 0.8 + PLACEMENT_CLEARANCE - 1e-9);
    expect(isBlocked(snapped.x, snapped.z)).toBe(false);
  });

  it('collision with two placed objects (deux objets): object B pushes away from object A', () => {
    const objA: PlacedZoneItem = {
      id: 'appliance-a',
      position: { x: 22, z: 18 },
      radius: 1.8,
    };
    const zones = siteZones([objA]);

    // Try placing object B at the exact same spot as object A
    const spotB = { x: 22, z: 18 };
    expect(isBlocked(spotB.x, spotB.z, 0, zones, 'appliance-b')).toBe(true);

    const snappedB = snapAwayFromBuildings(spotB, PLACEMENT_CLEARANCE, {
      zones,
      excludeId: 'appliance-b',
    });

    const distAtoB = Math.hypot(snappedB.x - 22, snappedB.z - 18);
    expect(distAtoB).toBeGreaterThanOrEqual(1.8 + PLACEMENT_CLEARANCE - 1e-9);
    expect(isBlocked(snappedB.x, snappedB.z, 0, zones, 'appliance-b')).toBe(false);
  });
});

describe('applianceZoneItems (PI-T3)', () => {
  const line = {
    id: 'a1',
    name: 'Pump',
    category: 'water_pump' as const,
    sector: 'water' as const,
    watts: 750,
    quantity: 1,
  };

  it('keeps positioned lines only, with their 3D model when there is one', () => {
    const recipe: ObjectRecipe = {
      proportions: { w: 1, h: 1, d: 1 },
      parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#888888' }],
    };
    const items = applianceZoneItems(
      [
        { ...line, position: { x: 20, z: 20 } },
        { ...line, id: 'a2' },
      ],
      { a1: { applianceId: 'a1', recipe, scale: 2, archetype: 'machine' } }
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'a1', recipe, scale: 2, archetype: 'machine' });
    expect(applianceZoneItems(undefined)).toEqual([]);
  });

  it('scene markers ([x, y, z]) give a zone at their rendered spot', () => {
    const [zone] = dynamicPlacedZones(
      applianceZoneItems([{ id: 'm1', category: 'fridge', position: [12, 0.4, -9] }])
    );
    expect(zone).toMatchObject({ id: 'm1', x: 12, z: -9 });
  });
});
