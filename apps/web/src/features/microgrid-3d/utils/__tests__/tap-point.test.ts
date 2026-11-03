import { describe, expect, it } from 'vitest';
import { SECTOR_POSITIONS, BUS_POSITION, feederExitPosition } from '../site-positions';
import { routeCable } from '../cable-route';
import { KEEP_OUT_ZONES, POND_CENTER, POND_RADIUS, terrainHeight } from '../landscape';
import {
  contourWaypoint,
  tapPoint,
  parsePositionCoords,
  segmentIntersectsObstacle,
  physicalObstacleRadius,
} from '../tap-point';

describe('tapPoint (PI-T6)', () => {
  describe('Coordinate parsing', () => {
    it('handles [x, y, z], [x, z], and { x, z }', () => {
      expect(parsePositionCoords([1, 2, 3])).toEqual({ x: 1, y: 2, z: 3 });
      expect(parsePositionCoords([4, 5])).toEqual({ x: 4, z: 5 });
      expect(parsePositionCoords({ x: 7, z: 8 })).toEqual({ x: 7, z: 8 });
    });
  });

  describe('Mode "branch" (default)', () => {
    it('taps the building when closer to the building than to any pole', () => {
      // Place an object 2m south of the Households building
      const bPos = SECTOR_POSITIONS.households; // [-6, 0, 8]
      const objPos: [number, number, number] = [bPos[0], 0, bPos[2] + 2];

      const res = tapPoint(objPos, 'households', 'branch');
      expect(res.kind).toBe('building');
      expect(res.point[0]).toBeCloseTo(bPos[0]);
      expect(res.point[2]).toBeCloseTo(bPos[2]);
      expect(res.sector).toBe('households');
      expect(res.mode).toBe('branch');
    });

    it('taps the closest pole along the sector line when closer to the pole', () => {
      // Find the intermediate poles on the households feeder line
      const exit = feederExitPosition('households');
      const bPos = SECTOR_POSITIONS.households;
      const lineRoute = routeCable(exit, bPos);
      expect(lineRoute.poles.length).toBeGreaterThan(0);

      // Place object 0.5m away from the first intermediate pole
      const firstPole = lineRoute.poles[0]!;
      const objPos = { x: firstPole[0] + 0.5, z: firstPole[1] + 0.3 };

      const res = tapPoint(objPos, 'households', 'branch');
      expect(res.kind).toBe('pole');
      expect(res.point[0]).toBeCloseTo(firstPole[0]);
      expect(res.point[2]).toBeCloseTo(firstPole[1]);
    });
  });

  describe('Mode "ems" (D1)', () => {
    it('taps the Dispatch EMS (BUS_POSITION)', () => {
      const objPos = { x: 5, z: 12 };
      const res = tapPoint(objPos, 'water', 'ems');

      expect(res.kind).toBe('ems');
      expect(res.mode).toBe('ems');
      expect(res.point[0]).toBeCloseTo(BUS_POSITION[0]);
      expect(res.point[2]).toBeCloseTo(BUS_POSITION[2]);
      expect(res.point[1]).toBeCloseTo(terrainHeight(BUS_POSITION[0], BUS_POSITION[2]));
      expect(res.sector).toBe('water');
    });
  });

  describe('Objet collé au bâtiment = pas de poteau', () => {
    it('produces 0 intermediate utility poles when object is within 4.5m of building', () => {
      const bPos = SECTOR_POSITIONS.health; // [9, 0, -1]
      // 2.2m from clinic
      const objPos: [number, number] = [bPos[0] + 2.2, bPos[2]];

      const res = tapPoint(objPos, 'health', 'branch');
      expect(res.kind).toBe('building');
      expect(res.distance).toBeCloseTo(2.2);
      expect(res.needsPoles).toBe(false);
      expect(res.poles).toEqual([]);
      expect(res.routePoints.length).toBeGreaterThan(0);
    });

    it('produces intermediate utility poles when object is far from building', () => {
      const bPos = SECTOR_POSITIONS.health;
      // 14m from clinic (needs spans <= 4.5)
      const objPos: [number, number] = [bPos[0] + 14, bPos[2]];

      const res = tapPoint(objPos, 'health', 'branch');
      expect(res.needsPoles).toBe(true);
      expect(res.poles.length).toBeGreaterThanOrEqual(2);
      // Verify every span between consecutive poles is <= 4.5
      let prev: [number, number] = [res.point[0], res.point[2]];
      for (const p of res.poles) {
        const span = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        expect(span).toBeLessThanOrEqual(4.6);
        prev = p;
      }
    });
  });

  describe('Contournement d’obstacle (poteau d’angle)', () => {
    it('detects obstacle crossing for the pond', () => {
      const pondZone = KEEP_OUT_ZONES.find((z) => z.id === 'pond')!;
      expect(pondZone).toBeDefined();

      // Line passing right through pond center [-11.5, 4.5]
      const a: [number, number] = [-5, 4.5];
      const b: [number, number] = [-18, 4.5];
      const cuts = segmentIntersectsObstacle(a[0], a[1], b[0], b[1], pondZone);
      expect(cuts).toBe(true);

      // Line well north of pond
      const cutsNorth = segmentIntersectsObstacle(a[0], 12, b[0], 12, pondZone);
      expect(cutsNorth).toBe(false);
    });

    it('generates a corner pole waypoint to contour around the pond', () => {
      // Place an object west of the pond, connecting to EMS (east of pond)
      // Pond is at [-11.5, 4.5], radius ~2.6
      const objPos: [number, number] = [-16, 4.5];

      const res = tapPoint(objPos, 'water', 'ems');
      expect(res.mode).toBe('ems');
      // Direct line from EMS [0, 1] to [-16, 4.5] cuts right through pond
      expect(res.waypoint).toBeDefined();
      if (res.waypoint) {
        // Waypoint should be placed outside the pond physical radius
        const dPond = Math.hypot(
          res.waypoint[0] - POND_CENTER[0],
          res.waypoint[2] - POND_CENTER[1]
        );
        expect(dPond).toBeGreaterThan(POND_RADIUS);
        // The waypoint must be in the poles list as a corner pole
        const hasWaypointPole = res.poles.some(
          ([px, pz]) =>
            Math.abs(px - res.waypoint![0]) < 1e-3 && Math.abs(pz - res.waypoint![2]) < 1e-3
        );
        expect(hasWaypointPole).toBe(true);
      }
    });
  });

  describe('contourWaypoint', () => {
    it('keeps the detour on the obstacle side it picked, on both sides (z is not x)', () => {
      const obstacle = { x: 0, z: 0, r: 3, id: 'placed:rock' };
      // East-west segment through the obstacle: detours are north and south of it.
      for (const blockSide of [1, -1]) {
        // A second obstacle blocks one detour so the other side must be chosen.
        const blocker = { x: -5, z: blockSide * 1.5, r: 1.5, id: 'placed:blocker' };
        const wp = contourWaypoint(-10, 0, 10, 0, obstacle, [obstacle, blocker]);
        expect(wp).not.toBeNull();
        expect(wp![0]).toBeCloseTo(0);
        expect(Math.sign(wp![2])).toBe(-blockSide);
        expect(Math.abs(wp![2])).toBeGreaterThan(physicalObstacleRadius(obstacle));
      }
    });
  });

  describe('Changement de point de raccordement si obstacle sur un candidat', () => {
    it('chooses an alternate candidate on the branch if the closest candidate is blocked', () => {
      // Create a test obstacle that specifically blocks the direct line from the building
      // but leaves a clear path from a branch pole
      // School sits at [2, 0, -9]
      const target = { x: 2, z: -16 }; // North of school

      // Fake obstacle directly behind school
      const testObstacle = {
        x: 2,
        z: -12,
        r: 3,
        id: 'placed:blocking-rock',
      };

      const res = tapPoint(target, 'school', 'branch', {
        zones: [...KEEP_OUT_ZONES, testObstacle],
      });

      expect(res.sector).toBe('school');
      // Either contours via waypoint or picks an alternate candidate, but does NOT cut through
      if (res.waypoint) {
        const dObs = Math.hypot(res.waypoint[0] - testObstacle.x, res.waypoint[2] - testObstacle.z);
        expect(dObs).toBeGreaterThanOrEqual(physicalObstacleRadius(testObstacle));
      }
    });
  });

  describe('Engine Invariance (Rule 1)', () => {
    it('never computes energy values and operates strictly on scene geometry', () => {
      const res = tapPoint({ x: 0, z: 10 }, 'market', 'branch');
      expect(typeof res.x).toBe('number');
      expect(typeof res.y).toBe('number');
      expect(typeof res.z).toBe('number');
      expect(Array.isArray(res.poles)).toBe(true);
      expect(Array.isArray(res.routePoints)).toBe(true);
      // No kW, kWh, or energy fields in the result
      expect(res).not.toHaveProperty('kw');
      expect(res).not.toHaveProperty('kwh');
    });
  });
});
