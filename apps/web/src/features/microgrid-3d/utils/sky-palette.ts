import * as THREE from 'three';

/**
 * Art-directed sky & light palette per sun elevation (0 = horizon, 1 = zenith).
 * Golden-hour look by design (reference: Village at Sunset); night when the sun is down.
 * Pure: same input → same colors. Visual only, never data.
 */
export interface SkyPalette {
  zenith: string;
  horizon: string;
  /** Glow around the sun on the sky dome. */
  sunGlow: string;
  sun: string;
  /** Fog + far mountains blend into this. */
  fog: string;
  hemiSky: string;
  hemiGround: string;
  keyIntensity: number;
  hemiIntensity: number;
  envIntensity: number;
  /** Elevation of the key light above the horizon, in degrees (drives shadows). */
  sunAltitudeDeg: number;
  /** Where the visible sun disc / glow sits: kept low so the sunset stays in frame. */
  sunDisplayAltitudeDeg: number;
  /** Far mountain ridge colors, nearest first. */
  ridges: [string, string, string];
  /** How bright lit windows and street lamps glow (dusk/night → high). */
  lampGlow: number;
}

interface Key {
  zenith: string;
  horizon: string;
  sunGlow: string;
  sun: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  keyIntensity: number;
  hemiIntensity: number;
  envIntensity: number;
  lampGlow: number;
}

const NIGHT: Key = {
  zenith: '#050a1a',
  horizon: '#1b2445',
  sunGlow: '#2a3260',
  sun: '#9db4ff',
  fog: '#141b36',
  hemiSky: '#3b4a8a',
  hemiGround: '#0b1210',
  keyIntensity: 0.35,
  hemiIntensity: 0.35,
  envIntensity: 0.12,
  lampGlow: 1,
};

const GOLDEN: Key = {
  zenith: '#1a2457',
  horizon: '#ff9a4d',
  sunGlow: '#ffc56b',
  sun: '#ffb46b',
  fog: '#8f6d93',
  hemiSky: '#8f88c9',
  hemiGround: '#3a2a18',
  keyIntensity: 3.0,
  hemiIntensity: 0.55,
  envIntensity: 0.55,
  lampGlow: 0.85,
};

const AFTERNOON: Key = {
  zenith: '#2a3f7a',
  horizon: '#f7ae6e',
  sunGlow: '#ffd08a',
  sun: '#ffd6a0',
  fog: '#9f8aa6',
  hemiSky: '#9fb2df',
  hemiGround: '#3f3019',
  keyIntensity: 3.4,
  hemiIntensity: 0.6,
  envIntensity: 0.55,
  lampGlow: 0.3,
};

const c1 = new THREE.Color();
const c2 = new THREE.Color();
function mix(a: string, b: string, t: number): string {
  return `#${c1.set(a).lerp(c2.set(b), t).getHexString()}`;
}
function blend(a: Key, b: Key, t: number): Key {
  return {
    zenith: mix(a.zenith, b.zenith, t),
    horizon: mix(a.horizon, b.horizon, t),
    sunGlow: mix(a.sunGlow, b.sunGlow, t),
    sun: mix(a.sun, b.sun, t),
    fog: mix(a.fog, b.fog, t),
    hemiSky: mix(a.hemiSky, b.hemiSky, t),
    hemiGround: mix(a.hemiGround, b.hemiGround, t),
    keyIntensity: a.keyIntensity + (b.keyIntensity - a.keyIntensity) * t,
    hemiIntensity: a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t,
    envIntensity: a.envIntensity + (b.envIntensity - a.envIntensity) * t,
    lampGlow: a.lampGlow + (b.lampGlow - a.lampGlow) * t,
  };
}

/** Aerial perspective: near ridge dark green-blue, far ridges melt into the haze. */
function ridgeColors(k: Key): [string, string, string] {
  const near = mix('#22302f', k.fog, 0.35);
  const mid = mix(mix('#2c3350', k.fog, 0.55), k.zenith, 0.15);
  const far = mix(k.fog, k.horizon, 0.3);
  return [near, mid, far];
}

export function skyPalette(sunElevation: number, isDaytime: boolean): SkyPalette {
  if (!isDaytime || sunElevation <= 0) {
    return { ...NIGHT, sunAltitudeDeg: 24, sunDisplayAltitudeDeg: 24, ridges: ridgeColors(NIGHT) };
  }
  const e = Math.min(1, Math.max(0, sunElevation));
  // Golden until ~0.35 elevation, then warm afternoon; never a flat noon look.
  const key = blend(GOLDEN, AFTERNOON, Math.min(1, Math.max(0, (e - 0.15) / 0.75)));
  // Capped at ~36°: long, readable shadows even at noon (art direction, not astronomy).
  const sunAltitudeDeg = 6 + e * 30;
  return {
    ...key,
    sunAltitudeDeg,
    sunDisplayAltitudeDeg: Math.max(3, sunAltitudeDeg * 0.4),
    ridges: ridgeColors(key),
  };
}
