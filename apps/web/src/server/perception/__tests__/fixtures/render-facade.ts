import { DEFAULT_FOCAL } from '../../perspective';
import type { GrayGrid } from '../../repetition';

/** Test fixture (PF-T5): pinhole renders of striped facades with a known yaw and focal. */
export const W = 256;
export const H = 192;

/**
 * Pinhole render (focal `f` px, centre of the image) of facades seen from the origin, camera looking +z,
 * y down. Each facade: a plane through `at` spanned by `a` (its horizontal direction) and y. Painted with
 * dark floor lines every 0.5 m and window columns every 0.7 m; the sky is plain.
 */
export function render(
  facades: Array<{ at: [number, number, number]; a: [number, number, number]; half: number }>,
  f = DEFAULT_FOCAL * W
): GrayGrid {
  const gray = new Float32Array(W * H).fill(0.9);
  const depth = new Float32Array(W * H).fill(Infinity);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const d = [(px + 0.5 - W / 2) / f, (py + 0.5 - H / 2) / f, 1] as const;
      for (const { at, a, half } of facades) {
        // Normal of the facade = a × (0, 1, 0).
        const n = [-a[2], 0, a[0]] as const;
        const den = n[0] * d[0] + n[2] * d[2];
        if (Math.abs(den) < 1e-9) continue;
        const t = (n[0] * at[0] + n[2] * at[2]) / den;
        if (t <= 0 || t >= depth[py * W + px]!) continue;
        const P = [t * d[0], t * d[1], t * d[2]];
        const u = (P[0]! - at[0]) * a[0] + (P[2]! - at[2]) * a[2];
        const v = P[1]! - at[1];
        if (Math.abs(u) > half || Math.abs(v) > 1.2) continue;
        depth[py * W + px] = t;
        const floor = (v + 10) % 0.5 < 0.07;
        const column = (u + 10) % 0.7 < 0.12;
        gray[py * W + px] = floor ? 0.15 : column ? 0.35 : 0.7;
      }
    }
  }
  return { width: W, height: H, gray, mask: new Uint8Array(W * H).fill(1) };
}

export const turned = (yawDeg: number) => {
  const y = (yawDeg * Math.PI) / 180;
  // Right end farther when yaw > 0: a = (cos, 0, sin) in camera axes (z forward).
  return render([{ at: [0, 0, 5], a: [Math.cos(y), 0, Math.sin(y)], half: 3 }]);
};
