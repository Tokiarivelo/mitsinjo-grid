import { describe, expect, it } from 'vitest';
import { cloudTrackToProfile } from '../cloud-track-to-profile';

const FLAT = new Array(24).fill(0.5);

describe('cloudTrackToProfile (M8-T4, pure code)', () => {
  it('no frames → base profile unchanged', () => {
    expect(cloudTrackToProfile([], FLAT)).toEqual(FLAT);
  });

  it('maps frame cloud fractions onto their hours', () => {
    const profile = cloudTrackToProfile(
      [
        { t: 10.2, cloud01: 0 },
        { t: 10.7, cloud01: 1 },
        { t: 12, cloud01: 0.5 },
      ],
      FLAT
    );
    expect(profile).toHaveLength(24);
    // Hour 10 averages its two frames: (0 + 1) / 2 = 0.5 cloud → half of base.
    expect(profile[10]).toBeCloseTo(0.25, 5);
    // Hour 12: half cloud → half of base.
    expect(profile[12]).toBeCloseTo(0.25, 5);
    // Before the first frame the sky counts as clear …
    expect(profile[0]).toBe(0.5);
    // … and later empty hours carry the last known cloud (0.5 from hour 10/12).
    expect(profile[11]).toBeCloseTo(0.25, 5);
    expect(profile[23]).toBeCloseTo(0.25, 5);
  });

  it('empty hours carry the last known cloud forward (clear before the first frame)', () => {
    const profile = cloudTrackToProfile([{ t: 6, cloud01: 1 }], FLAT);
    expect(profile[5]).toBe(0.5);
    expect(profile[6]).toBe(0);
    expect(profile[7]).toBe(0);
    expect(profile[23]).toBe(0);
  });

  it('clamps and rounds to a valid solarProfile', () => {
    const profile = cloudTrackToProfile(
      [
        { t: 0, cloud01: 2 },
        { t: 23, cloud01: -1 },
      ],
      FLAT
    );
    expect(profile[0]).toBe(0);
    expect(profile[23]).toBe(0.5);
    expect(profile.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(profile.every((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9)).toBe(true);
  });
});
