'use client';

import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { recordSceneFrame, type SceneStatsCounters } from '../utils/scene-stats';

/**
 * Counts frames and copies renderer info (previous frame) into counters. Never setState.
 * Auto-reset is off so multi-pass frames (shadow map + post-processing) report their
 * full total instead of only the last pass; this probe resets once per frame.
 */
export function SceneStatsProbe({ stats }: { stats: SceneStatsCounters }) {
  const get = useThree((s) => s.get);

  // Restore the renderer default when the probe unmounts.
  useEffect(
    () => () => {
      get().gl.info.autoReset = true;
    },
    [get]
  );

  useFrame((state) => {
    const info = state.gl.info;
    info.autoReset = false;
    recordSceneFrame(stats, info.render.calls, info.render.triangles);
    info.reset();
  });
  return null;
}
