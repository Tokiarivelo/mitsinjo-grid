import { describe, expect, it } from 'vitest';
import { createSceneStats, recordSceneFrame, sampleSceneStats } from '../scene-stats';

describe('sampleSceneStats', () => {
  it('computes fps over the window and resets the frame counter', () => {
    const stats = createSceneStats(1000);
    stats.frames = 30;
    stats.calls = 42;
    stats.triangles = 9000;

    expect(sampleSceneStats(stats, 1500)).toEqual({ calls: 42, triangles: 9000, fps: 60 });
    expect(stats.frames).toBe(0);
    expect(stats.windowStartMs).toBe(1500);
  });

  it('reports 0 fps when no time elapsed or the scene is idle', () => {
    const stats = createSceneStats(1000);
    expect(sampleSceneStats(stats, 1000).fps).toBe(0);
    expect(sampleSceneStats(stats, 2000).fps).toBe(0);
  });

  it('recordSceneFrame counts frames and keeps the latest renderer info', () => {
    const stats = createSceneStats(0);
    recordSceneFrame(stats, 10, 100);
    recordSceneFrame(stats, 12, 120);
    expect(stats).toMatchObject({ frames: 2, calls: 12, triangles: 120 });
  });
});
