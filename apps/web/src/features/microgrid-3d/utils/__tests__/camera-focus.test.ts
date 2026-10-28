import { describe, expect, it } from 'vitest';
import {
  FOCUS_LOOK_HEIGHT,
  FOCUS_OFFSET,
  FOCUS_ORBIT_RAD_PER_S,
  focusCameraFor,
  focusOrbitAngle,
} from '../camera-focus';
import { SECTOR_POSITIONS } from '../to-scene-model';

describe('camera focus framing', () => {
  it('looks at the building from a fixed offset', () => {
    const { position, target } = focusCameraFor([9, 0, -1]);
    expect(target).toEqual([9, FOCUS_LOOK_HEIGHT, -1]);
    expect(position).toEqual([9 + FOCUS_OFFSET[0], FOCUS_OFFSET[1], -1 + FOCUS_OFFSET[2]]);
  });

  it('stays inside the orbit zoom range (6–70) for every sector', () => {
    for (const pos of Object.values(SECTOR_POSITIONS)) {
      const { position, target } = focusCameraFor(pos);
      const d = Math.hypot(
        position[0] - target[0],
        position[1] - target[1],
        position[2] - target[2]
      );
      expect(d).toBeGreaterThan(6);
      expect(d).toBeLessThan(70);
    }
  });

  it('caps the per-frame orbit angle', () => {
    expect(focusOrbitAngle(0.05)).toBeCloseTo(0.05 * FOCUS_ORBIT_RAD_PER_S);
    expect(focusOrbitAngle(5)).toBeCloseTo(0.1 * FOCUS_ORBIT_RAD_PER_S);
    expect(focusOrbitAngle(-1)).toBe(0);
  });
});
