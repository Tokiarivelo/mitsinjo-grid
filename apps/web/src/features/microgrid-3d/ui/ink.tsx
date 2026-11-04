'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useTheme } from '@/lib/theme';
import {
  InkEffect,
  inkColorFromTheme,
  INK_STRENGTH,
  INK_TOKEN,
  NO_FADE,
} from '../utils/ink-effect';

export interface InkProps {
  /** 0 = none, 1 = full ink colour on an edge. */
  strength?: number;
  /** Crease ink weight, 0–1 (silhouettes always ink). */
  crease?: number;
  /** View distance where the ink fades out, [near, far]. */
  fade?: readonly [number, number];
  /** Theme token of the ink colour (CSS custom property). */
  token?: string;
}

/**
 * Ink outline (PT-4) for an `EffectComposer` child list: one effect per mount, its colour read from the
 * theme token and updated on theme change (uniform only, no recompile). Used by the editor and the village.
 */
export function Ink({
  strength = INK_STRENGTH,
  crease = 1,
  fade = NO_FADE,
  token = INK_TOKEN,
}: InkProps) {
  const [near, far] = fade;
  const { theme } = useTheme();
  const invalidate = useThree((s) => s.invalidate);
  const effect = useMemo(() => new InkEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  useEffect(() => {
    // The theme class is already on <html> when the context changes, so the token reads the new colour.
    effect.setInk({
      strength,
      crease,
      fade: [near, far],
      color: inkColorFromTheme(document.documentElement, token) ?? undefined,
    });
    invalidate(); // frameloop="demand"
  }, [effect, strength, crease, near, far, token, theme, invalidate]);
  return <primitive object={effect} dispose={null} />;
}
