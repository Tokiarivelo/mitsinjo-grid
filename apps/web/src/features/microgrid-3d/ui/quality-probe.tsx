'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MIN_PROBE_SAMPLES, shouldAutoDowngrade } from '../hooks/use-scene-quality';

/** Probe window: render continuously this long after mount, then decide once. */
const PROBE_MS = 3500;
/** Ignore the first frames (shader compile, asset upload). */
const WARMUP_FRAMES = 20;

/**
 * Measures real fps right after the high tier mounts (frameloop is "demand", so it
 * forces frames during the window). Calls `onSlow` once if the median is too low.
 */
export function QualityProbe({ onSlow }: { onSlow: () => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const samples = useRef<number[]>([]);
  const frames = useRef(0);
  const start = useRef<number | null>(null);
  const done = useRef(false);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  useFrame((state, delta) => {
    if (done.current) return;
    const now = performance.now();
    start.current ??= now;
    frames.current++;
    if (frames.current > WARMUP_FRAMES && delta > 0) samples.current.push(1 / delta);
    if (now - start.current < PROBE_MS || samples.current.length < MIN_PROBE_SAMPLES) {
      state.invalidate();
      return;
    }
    done.current = true;
    if (shouldAutoDowngrade(samples.current)) onSlow();
  });

  return null;
}
