/** Mutable counters written by the in-canvas probe (no React state per frame). */
export interface SceneStatsCounters {
  frames: number;
  calls: number;
  triangles: number;
  windowStartMs: number;
}

export interface SceneStatsSample {
  /** Draw calls of the last rendered frame. */
  calls: number;
  triangles: number;
  /** Frames rendered per second over the sample window (0 when the scene is idle: frameloop="demand"). */
  fps: number;
}

export function createSceneStats(nowMs: number): SceneStatsCounters {
  return { frames: 0, calls: 0, triangles: 0, windowStartMs: nowMs };
}

/** Read the window, then start a new one. */
export function sampleSceneStats(stats: SceneStatsCounters, nowMs: number): SceneStatsSample {
  const elapsedMs = nowMs - stats.windowStartMs;
  const fps = elapsedMs > 0 ? Math.round((stats.frames * 1000) / elapsedMs) : 0;
  stats.frames = 0;
  stats.windowStartMs = nowMs;
  return { calls: stats.calls, triangles: stats.triangles, fps };
}

/** Called once per rendered frame by the in-canvas probe. */
export function recordSceneFrame(stats: SceneStatsCounters, calls: number, triangles: number): void {
  stats.frames += 1;
  stats.calls = calls;
  stats.triangles = triangles;
}
