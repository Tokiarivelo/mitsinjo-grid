/**
 * Pure camera framing for a selected building: where to look, where to stand,
 * and how fast to orbit around it once the camera arrives.
 */

export type Vec3 = [number, number, number];

/** Look slightly above the ground so the building body sits mid-frame. */
export const FOCUS_LOOK_HEIGHT = 1.5;
/** Camera offset from the building: front three-quarter, like the village view. */
export const FOCUS_OFFSET: Vec3 = [5, 6.5, 10];
/** Orbit speed around the focused building (rad/s): one full turn ≈ 42 s. */
export const FOCUS_ORBIT_RAD_PER_S = 0.15;

export function focusCameraFor(buildingPosition: Vec3): { position: Vec3; target: Vec3 } {
  const [x, y, z] = buildingPosition;
  return {
    position: [x + FOCUS_OFFSET[0], y + FOCUS_OFFSET[1], z + FOCUS_OFFSET[2]],
    target: [x, y + FOCUS_LOOK_HEIGHT, z],
  };
}

/** Per-frame orbit angle (delta capped so the first demand frame after idle doesn't jump). */
export function focusOrbitAngle(deltaS: number): number {
  return Math.min(Math.max(deltaS, 0), 0.1) * FOCUS_ORBIT_RAD_PER_S;
}
