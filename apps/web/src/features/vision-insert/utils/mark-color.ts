import type { CSSProperties } from 'react';

/** Hue step between two objects: the golden angle spreads any count of hues evenly. */
export const GOLDEN_ANGLE = 137.508;
/** Lightness steps (percent points on the theme's mark lightness); hues that land close differ in tier. */
export const MARK_TIERS = [0, -12, 10] as const;

/** Hue (0–360) and lightness step of the n-th object on the photo. */
export function markTone(index: number): { hue: number; tier: number } {
  const i = Math.max(0, Math.floor(index));
  return {
    hue: Math.round(((i * GOLDEN_ANGLE) % 360) * 10) / 10,
    tier: MARK_TIERS[i % MARK_TIERS.length]!,
  };
}

/**
 * CSS variables for one object's colour, shared by its photo box and its list row. The colour itself is
 * `--mark` (globals.css, `[data-mark]`): saturation and lightness come from the theme, so it reads in
 * dark and light. Use with `stroke-(--mark)`, `fill-(--mark)/10`, `border-(--mark)`.
 */
export function markStyle(index: number): CSSProperties {
  const { hue, tier } = markTone(index);
  return { '--mark-h': String(hue), '--mark-dl': `${tier}%` } as CSSProperties;
}
