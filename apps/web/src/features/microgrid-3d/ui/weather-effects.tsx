'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherId } from '@mitsinjo/engine';
import {
  WEATHER_ATMOSPHERE,
  WEATHER_HEX,
  cloudPuffs,
  lightningFlash,
  rainDropCount,
} from '../utils/weather-atmosphere';
import { mulberry32 } from '../utils/noise';

export interface WeatherEffectsProps {
  weather: WeatherId;
  isDaytime: boolean;
  quality: 'high' | 'low';
  /** False under reduced motion or without a GPU: clouds and rain stay still, no lightning. */
  animate: boolean;
}

/** Clouds, rain and storm lightning for the day's weather. Visual only, never data. */
export function WeatherEffects({ weather, isDaytime, quality, animate }: WeatherEffectsProps) {
  const atmo = WEATHER_ATMOSPHERE[weather];
  return (
    <group name="weather-effects">
      <CloudLayer cover={atmo.cloudCover} darkness={atmo.cloudDarkness} animate={animate} />
      {atmo.rain > 0 && (
        <Rain
          count={rainDropCount(atmo.rain, quality)}
          isDaytime={isDaytime}
          intensity={atmo.rain}
          animate={animate}
        />
      )}
      {atmo.lightning && animate && <Lightning />}
    </group>
  );
}

/* ------------------------------------------------------------------ clouds */

function CloudLayer({
  cover,
  darkness,
  animate,
}: {
  cover: number;
  darkness: number;
  animate: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const puffs = useMemo(() => cloudPuffs(cover), [cover]);
  const color = useMemo(
    () =>
      new THREE.Color(WEATHER_HEX.cloudLight).lerp(
        new THREE.Color(WEATHER_HEX.cloudDark),
        darkness
      ),
    [darkness]
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const obj = new THREE.Object3D();
    puffs.forEach((p, i) => {
      obj.position.set(...p.position);
      obj.scale.set(...p.scale);
      obj.updateMatrix();
      mesh.setMatrixAt(i, obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [puffs, invalidate]);

  useEffect(() => {
    if (animate) invalidate();
  }, [animate, invalidate]);

  useFrame((state, delta) => {
    if (!animate || !groupRef.current) return;
    // Slow drift across the sky.
    groupRef.current.rotation.y += delta * 0.006;
    state.invalidate();
  });

  if (puffs.length === 0) return null;

  return (
    <group ref={groupRef}>
      <instancedMesh
        key={puffs.length}
        ref={meshRef}
        args={[undefined, undefined, puffs.length]}
        frustumCulled={false}
        name="weather-clouds"
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial color={color} flatShading />
      </instancedMesh>
    </group>
  );
}

/* -------------------------------------------------------------------- rain */

/** Rain volume around the village (world units). */
const RAIN_HALF_WIDTH = 42;
const RAIN_HEIGHT = 36;
const RAIN_STREAK = 0.9;
const RAIN_SPEED = 22;

const RAIN_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uHeight;
uniform float uLength;
attribute float aTip;
varying float vFade;
void main() {
  vec3 p = position;
  float y = mod(p.y - uTime * uSpeed, uHeight);
  p.y = y - aTip * uLength;
  p.x += aTip * uLength * 0.18; // light wind slant
  vFade = 1.0 - aTip * 0.75;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const RAIN_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  gl_FragColor = vec4(uColor, uOpacity * vFade);
  #include <colorspace_fragment>
}`;

function setUniform(material: THREE.ShaderMaterial, name: string, value: number) {
  const u = material.uniforms[name];
  if (u) u.value = value;
}

/** GPU-animated rain streaks: one draw call, only a time uniform changes per frame. */
function Rain({
  count,
  isDaytime,
  intensity,
  animate,
}: {
  count: number;
  isDaytime: boolean;
  intensity: number;
  animate: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);

  const geometry = useMemo(() => {
    const rand = mulberry32(42);
    const positions = new Float32Array(count * 6);
    const tips = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = (rand() * 2 - 1) * RAIN_HALF_WIDTH;
      const y = rand() * RAIN_HEIGHT;
      const z = (rand() * 2 - 1) * RAIN_HALF_WIDTH;
      positions.set([x, y, z, x, y, z], i * 6);
      tips[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aTip', new THREE.BufferAttribute(tips, 1));
    return g;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const materialRef = useRef<THREE.ShaderMaterial>(null);
  // Initial values only; updates go through the material ref below.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: RAIN_SPEED },
      uHeight: { value: RAIN_HEIGHT },
      uLength: { value: RAIN_STREAK },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 0.5 },
    }),
    []
  );

  useLayoutEffect(() => {
    const u = materialRef.current?.uniforms;
    if (!u) return;
    u.uColor!.value.set(isDaytime ? WEATHER_HEX.rainDay : WEATHER_HEX.rainNight);
    u.uOpacity!.value = 0.3 + 0.3 * intensity;
    // Longer streaks in a downpour.
    u.uLength!.value = RAIN_STREAK * (0.8 + 0.6 * intensity);
    invalidate();
  }, [animate, isDaytime, intensity, invalidate]);

  useFrame((state) => {
    if (!animate || !materialRef.current) return;
    setUniform(materialRef.current, 'uTime', state.clock.elapsedTime);
    state.invalidate();
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false} name="weather-rain">
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={RAIN_VERTEX}
        fragmentShader={RAIN_FRAGMENT}
      />
    </lineSegments>
  );
}

/* --------------------------------------------------------------- lightning */

const LIGHTNING_PEAK = 7;

/** Storm flashes: one light whose intensity follows a fixed schedule. */
function Lightning() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  useFrame((state) => {
    const light = lightRef.current;
    if (!light) return;
    light.intensity = lightningFlash(state.clock.elapsedTime) * LIGHTNING_PEAK;
    state.invalidate();
  });
  return (
    <directionalLight
      ref={lightRef}
      position={[20, 60, -30]}
      color={WEATHER_HEX.lightning}
      intensity={0}
    />
  );
}
