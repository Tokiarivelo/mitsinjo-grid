/**
 * Pure camera-tween timing. The tween eases per frame, but is capped in wall time so
 * a very slow renderer (weak GPU, software GL) doesn't keep the frame loop busy.
 */

/** Hard stop: snap to the target after this long. */
export const CAMERA_TWEEN_MAX_MS = 2000;

/** Per-frame lerp factor (delta capped so the first demand frame after idle doesn't jump). */
export function cameraLerpFactor(deltaS: number): number {
  return Math.min(1, Math.min(Math.max(deltaS, 0), 0.1) * 3.5);
}

export function cameraTweenExpired(startMs: number, nowMs: number): boolean {
  return nowMs - startMs >= CAMERA_TWEEN_MAX_MS;
}
