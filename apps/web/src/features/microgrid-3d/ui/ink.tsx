'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useTheme } from '@/lib/theme';
import { InkEffect, inkColorFromTheme, INK_STRENGTH } from '../utils/ink-effect';

export interface InkProps {
  /** 0 = none, 1 = full ink colour on an edge. */
  strength?: number;
}

/**
 * Ink outline (PT-4) for an `EffectComposer` child list: one effect per mount, its colour read from the
 * theme token and updated on theme change (uniform only, no recompile). Used by the editor and the village.
 */
export function Ink({ strength = INK_STRENGTH }: InkProps) {
  const { theme } = useTheme();
  const invalidate = useThree((s) => s.invalidate);
  const effect = useMemo(() => new InkEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  useEffect(() => {
    // The theme class is already on <html> when the context changes, so the token reads the new colour.
    effect.setInk({ strength, color: inkColorFromTheme() ?? undefined });
    invalidate(); // frameloop="demand"
  }, [effect, strength, theme, invalidate]);
  return <primitive object={effect} dispose={null} />;
}
