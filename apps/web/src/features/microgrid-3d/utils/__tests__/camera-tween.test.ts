import { describe, expect, it } from 'vitest';
import { CAMERA_TWEEN_MAX_MS, cameraLerpFactor, cameraTweenExpired } from '../camera-tween';

describe('camera tween timing', () => {
  it('caps the per-frame factor', () => {
    expect(cameraLerpFactor(1 / 60)).toBeCloseTo(3.5 / 60);
    expect(cameraLerpFactor(5)).toBeCloseTo(0.35);
    expect(cameraLerpFactor(-1)).toBe(0);
  });

  it('expires after the wall-time cap', () => {
    expect(cameraTweenExpired(0, CAMERA_TWEEN_MAX_MS - 1)).toBe(false);
    expect(cameraTweenExpired(0, CAMERA_TWEEN_MAX_MS)).toBe(true);
  });
});
