'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { LineFlowSceneModel } from '../types';
import { routeCable } from '../utils/cable-route';
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

/** One electron every ~1.1 world units of cable. */
const SPACING = 1.1;
/** Line `speed` (0.5–2.5) → world units per second. */
const SPEED_SCALE = 2.2;
const RADIUS = 0.085;
/** Slight lift so dots ride on top of the cable instead of z-fighting with it. */
const LIFT = 0.03;

interface Track {
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

  const { tracks, total, colors } = useMemo(() => {
    const list: Track[] = [];
    const cols: THREE.Color[] = [];
    let n = 0;
    for (const line of lines) {
      if (!line.active || line.direction === 'idle') continue;
      const path = buildArcPath(routeCable(line.from, line.to).points);
      const count = electronCount(path.total, SPACING);
      const period = electronPeriodS(path.total, line.speed * SPEED_SCALE);
      list.push({ path, count, period, reverse: line.direction === 'backward', firstInstance: n });
      // Whitened status color, pushed > 1 so the bloom pass makes it glow.
      const c = new THREE.Color(line.color).lerp(new THREE.Color('#ffffff'), 0.35);
      c.multiplyScalar(3);
      for (let i = 0; i < count; i++) cols.push(c);
      n += count;
    }
    return { tracks: list, total: n, colors: cols };
  }, [lines]);

  // Scratch objects reused every frame (no per-frame allocation).
  const scratch = useMemo(() => ({ obj: new THREE.Object3D(), p: [0, 0, 0] }), []);

  const place = (elapsed: number) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (const tr of tracks) {
      for (let j = 0; j < tr.count; j++) {
        const phase = elapsed / tr.period + j / tr.count;
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
    place(0);
    invalidate();
    // place() only reads tracks/scratch, both covered by `colors`/`tracks` identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, colors, invalidate]);

  const isFlowing = animate && total > 0;
  useEffect(() => {
    if (isFlowing) invalidate();
  }, [isFlowing, invalidate]);

  useFrame((state) => {
    if (!isFlowing) return;
    place(state.clock.elapsedTime);
    state.invalidate();
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
