/**
 * Cloud track → measured solar profile (M8-T4): per-frame cloud fractions become the 24
 * `solarProfile` values a patch carries. Pure code, no LLM — the frame analysis (video pipeline
 * + maquette camera feed, S4) does not exist yet; this is the deterministic half it will feed.
 */

export interface CloudFrame {
  /** Hour of day the frame was taken (0–24, clamped). */
  t: number;
  /** Cloud fraction on the frame (0 = clear, 1 = overcast, clamped). */
  cloud01: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Each hour averages its frames' cloud; hours without frames carry the last known cloud forward
 * (clear before the first frame). `profile[h] = base[h] × (1 − cloud)`, rounded to 3 decimals.
 */
export function cloudTrackToProfile(
  frames: readonly CloudFrame[],
  baseProfile: readonly number[]
): number[] {
  const buckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const f of frames) {
    const h = Math.min(23, Math.max(0, Math.floor(f.t)));
    buckets[h]!.push(clamp01(f.cloud01));
  }
  let carried = 0;
  return Array.from({ length: 24 }, (_, h) => {
    const bucket = buckets[h]!;
    const cloud = bucket.length > 0 ? bucket.reduce((n, c) => n + c, 0) / bucket.length : carried;
    carried = cloud;
    return round3(clamp01(baseProfile[h] ?? 0) * (1 - cloud));
  });
}
