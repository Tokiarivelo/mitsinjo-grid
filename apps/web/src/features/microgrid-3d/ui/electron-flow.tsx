'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { LineFlowSceneModel } from '../types';
import { useAmbientFrame } from '../hooks/use-ambient-frame';
import { routeCable } from '../utils/cable-route';
import { NO_LOAD_KW } from '../utils/feeder-tone';
import { flowFactor } from '../utils/scene-palette';
import {
  buildArcPath,
  electronCount,
  electronPeriodS,
  sampleArcPath,
  type ArcPath,
} from '../utils/flow-path';

export interface ElectronFlowProps {
  /** Every cable of the scene; only `active` ones (current flowing) get electrons. */
  lines: LineFlowSceneModel[];
  /** False under reduced motion or a modified scenario: electrons stay frozen in place. */
  animate?: boolean;
}

/** Line `speed` (0.5–2.5) → world units per second. */
const SPEED_SCALE = 2.2;
const RADIUS = 0.085;
/** Slight lift so dots ride on top of the cable instead of z-fighting with it. */
const LIFT = 0.03;

interface Track {
  key: string;
  path: ArcPath;
  count: number;
  period: number;
  reverse: boolean;
  firstInstance: number;
}

/**
 * Glowing dots that travel along powered cables, from the source toward the
 * consumers. One InstancedMesh for the whole grid (1 draw call); cut lines get none.
 */
export function ElectronFlow({ lines, animate = true }: ElectronFlowProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const requestFrame = useAmbientFrame();

  const { tracks, total, colors } = useMemo(() => {
    const list: Track[] = [];
    const cols: THREE.Color[] = [];
    let n = 0;
    for (const line of lines) {
      // Cut or idle cable: no particles (PL-T11)
      if (!line.active || line.direction === 'idle' || line.flowKw <= NO_LOAD_KW) continue;
      const path = buildArcPath(routeCable(line.from, line.to).points);

      // Density ∝ feeder kW: wider spacing (fewer dots) at low power, 2.2 → 1.1 world units
      const kwFactor = flowFactor(line.flowKw);
      const lineSpacing = 2.2 - 1.1 * kwFactor;
      const count = electronCount(path.total, lineSpacing);

      // Speed ∝ feeder kW
      const speed = Math.max(0.4, Math.min(3.0, line.speed * (0.6 + 1.2 * kwFactor)));
      const period = electronPeriodS(path.total, speed * SPEED_SCALE);
      const key = `${line.from.join(',')}-${line.to.join(',')}`;
      list.push({
        key,
        path,
        count,
        period,
        reverse: line.direction === 'backward',
        firstInstance: n,
      });

      // Emissive ∝ kW: faint glow in survival (1.3), full bloom at high power (3.2)
      const c = new THREE.Color(line.color).lerp(new THREE.Color('#ffffff'), 0.35);
      const emissiveMultiplier = 1.3 + 1.9 * kwFactor;
      c.multiplyScalar(emissiveMultiplier);
      for (let i = 0; i < count; i++) cols.push(c);
      n += count;
    }
    return { tracks: list, total: n, colors: cols };
  }, [lines]);

  // Persistent continuous phase per line so dots never jump when speed changes or scrub happens.
  const phasesRef = useRef<Record<string, number>>({});

  // Scratch objects reused every frame (no per-frame allocation).
  const scratch = useMemo(() => ({ obj: new THREE.Object3D(), p: [0, 0, 0] }), []);

  const place = () => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (const tr of tracks) {
      const basePhase = phasesRef.current[tr.key] ?? 0;
      for (let j = 0; j < tr.count; j++) {
        const phase = basePhase + j / tr.count;
        sampleArcPath(tr.path, tr.reverse ? -phase : phase, scratch.p);
        scratch.obj.position.set(scratch.p[0]!, scratch.p[1]! + LIFT, scratch.p[2]!);
        scratch.obj.updateMatrix();
        mesh.setMatrixAt(tr.firstInstance + j, scratch.obj.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    colors.forEach((c, i) => mesh.setColorAt(i, c));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    place();
    invalidate();
    // place() only reads tracks/scratch/phasesRef, both covered by `colors`/`tracks` identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, colors, invalidate]);

  const isFlowing = animate && total > 0;
  useEffect(() => {
    if (isFlowing) invalidate();
  }, [isFlowing, invalidate]);

  useFrame((_, delta) => {
    if (!isFlowing) return;
    const dt = Math.min(delta, 0.1);
    for (const tr of tracks) {
      const current = phasesRef.current[tr.key] ?? 0;
      const advance = tr.period > 0 && isFinite(tr.period) ? dt / tr.period : 0;
      phasesRef.current[tr.key] = (current + advance) % 1;
    }
    place();
    requestFrame();
  });

  if (total === 0) return null;

  return (
    <instancedMesh
      // Remount when the instance count changes (InstancedMesh count is fixed at creation).
      key={total}
      ref={meshRef}
      args={[undefined, undefined, total]}
      name="electron-flow"
      frustumCulled={false}
    >
      <sphereGeometry args={[RADIUS, 8, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
