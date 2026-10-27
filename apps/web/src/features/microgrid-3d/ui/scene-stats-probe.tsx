'use client';

import { useFrame } from '@react-three/fiber';
import { recordSceneFrame, type SceneStatsCounters } from '../utils/scene-stats';

/** Counts frames and copies renderer info (previous frame) into counters. Never setState. */
export function SceneStatsProbe({ stats }: { stats: SceneStatsCounters }) {
  useFrame((state) => {
    const { calls, triangles } = state.gl.info.render;
    recordSceneFrame(stats, calls, triangles);
  });
  return null;
}
