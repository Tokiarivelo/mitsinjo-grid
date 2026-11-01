// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { deltaE2000, hexToLab } from '../color-measure';
import { sampleObjectPixels } from '../shape-colors';

/** 320 × 240 sky with a dark pole 6 px wide at x 167–173, y 40–200. */
async function pole() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">
    <rect width="320" height="240" fill="#8fb8de"/><rect x="167" y="40" width="6" height="160" fill="#3a3f44"/></svg>`;
  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
  return { buffer, width: 320, height: 240 };
}

describe('sampleObjectPixels (PF-T2, PF-T9)', () => {
  it('regression (golden lamp post): a thin pole keeps its dark colour, no sky halo', async () => {
    // Before: the box was squeezed to a 96 px long side (pole < 4 px) and its edge pixels mixed with
    // the sky: the pole measured pale grey #9b9c9d.
    const box = { x: 150 / 320, y: 40 / 240, w: 40 / 320, h: 160 / 240 };
    const outline = `M${167 / 320} ${40 / 240}L${173 / 320} ${40 / 240}L${173 / 320} ${200 / 240}L${167 / 320} ${200 / 240}Z`;
    const px = await sampleObjectPixels(await pole(), box, outline);
    // 40 × 160 = 6 400 px fits the 96² budget: sampled at full size, inner 4 columns kept.
    expect(px.y.length).toBeGreaterThanOrEqual(64);
    expect(px.y.length).toBeLessThan(6 * 160);
    const pole0 = hexToLab('#3a3f44');
    let worst = 0;
    for (let i = 0; i < px.y.length; i++) {
      const lab = [px.lab[i * 3]!, px.lab[i * 3 + 1]!, px.lab[i * 3 + 2]!] as const;
      worst = Math.max(worst, deltaE2000(lab, pole0));
    }
    expect(worst).toBeLessThan(10);
  });
});
