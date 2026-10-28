'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { fbm2d } from '../utils/noise';
import { SUN_AZIMUTH_RAD } from '../utils/landscape';
import type { SkyPalette } from '../utils/sky-palette';

const SKY_RADIUS = 420;

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.55, h), 0.7));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  // Wide warm halo + tight bright core around the sun.
  col += uGlow * (pow(s, 4.0) * 0.7 + pow(s, 40.0) * 1.1) * smoothstep(-0.1, 0.25, h + 0.1);
  // Warm band hugging the horizon.
  col = mix(col, uGlow, (1.0 - smoothstep(0.0, 0.12, abs(h))) * 0.25 * pow(s, 1.5));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface SkyBackdropProps {
  palette: SkyPalette;
  /** Unit vector towards the sun. */
  sunDirection: [number, number, number];
  /** Fewer ridge segments on the low tier. */
  detail?: 'high' | 'low';
}

interface RidgeSpec {
  radius: number;
  base: number;
  amp: number;
  freq: number;
  seed: number;
  /** 0 = nearest (darkest green), 1 = farthest (almost fog). */
  depth: number;
}

const RIDGES: RidgeSpec[] = [
  { radius: 320, base: 16, amp: 52, freq: 3.1, seed: 31, depth: 1 },
  { radius: 230, base: 8, amp: 30, freq: 4.3, seed: 23, depth: 0.62 },
  { radius: 150, base: 3, amp: 16, freq: 6.2, seed: 17, depth: 0.3 },
];

/** Ring angle (x = cos a, z = sin a) that points at the sun azimuth. */
const SUN_RING_ANGLE = Math.atan2(-Math.cos(SUN_AZIMUTH_RAD), Math.sin(SUN_AZIMUTH_RAD));

function ridgeGeometry(spec: RidgeSpec, segments: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a);
    const z = Math.sin(a);
    // Sample noise on a circle so the ridge loops seamlessly.
    const n = fbm2d(x * spec.freq + 50, z * spec.freq + 50, spec.seed, 5);
    // Open a valley where the sun sets so the disc and glow stay visible.
    const toSun = Math.abs(Math.atan2(Math.sin(a - SUN_RING_ANGLE), Math.cos(a - SUN_RING_ANGLE)));
    const valley = 1 - 0.75 * Math.exp(-(toSun * toSun) / (2 * 0.22 * 0.22));
    const peak = (Math.pow(n, 1.6) * spec.amp + spec.base) * valley;
    positions.push(x * spec.radius, -30, z * spec.radius);
    positions.push(x * spec.radius, peak, z * spec.radius);
    if (i < segments) {
      const k = i * 2;
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  return g;
}

export function SkyBackdrop({ palette, sunDirection, detail = 'high' }: SkyBackdropProps) {
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() },
    }),
    []
  );
  uniforms.uZenith.value.set(palette.zenith);
  uniforms.uHorizon.value.set(palette.horizon);
  uniforms.uGlow.value.set(palette.sunGlow);
  uniforms.uSunDir.value.set(...sunDirection);

  const segments = detail === 'high' ? 360 : 140;
  const ridges = useMemo(() => RIDGES.map((r) => ridgeGeometry(r, segments)), [segments]);

  // RIDGES is farthest-first; palette.ridges is nearest-first.
  const ridgeColors = [palette.ridges[2], palette.ridges[1], palette.ridges[0]];

  const sunPos = useMemo(
    () => new THREE.Vector3(...sunDirection).normalize().multiplyScalar(SKY_RADIUS * 0.9),
    [sunDirection]
  );
  // Saturated, moderately bright: the tone curve bleaches very hot values to white.
  const sunCore = useMemo(
    () => new THREE.Color(palette.sunGlow).multiplyScalar(2.2),
    [palette.sunGlow]
  );
  const sunHalo = useMemo(
    () => new THREE.Color(palette.horizon).multiplyScalar(1.4),
    [palette.horizon]
  );

  return (
    <group name="sky-backdrop">
      <mesh renderOrder={-10}>
        <sphereGeometry args={[SKY_RADIUS, 48, 24]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={uniforms}
          vertexShader={SKY_VERTEX}
          fragmentShader={SKY_FRAGMENT}
        />
      </mesh>

      {/* Sun disc + halo (bright → caught by bloom on the high tier). */}
      {sunDirection[1] > -0.02 && (
        <group position={sunPos}>
          <mesh>
            <sphereGeometry args={[9, 24, 12]} />
            <meshBasicMaterial color={sunCore} toneMapped={false} fog={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[22, 24, 12]} />
            <meshBasicMaterial
              color={sunHalo}
              transparent
              opacity={0.3}
              toneMapped={false}
              fog={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {ridges.map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={-5 + i}>
          <meshBasicMaterial color={ridgeColors[i]} fog={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
