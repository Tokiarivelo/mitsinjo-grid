'use client';

import { type ComponentRef, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { LineFlowSceneModel } from '../types';

export interface DistributionLinesProps {
  lines: {
    solarToBattery: LineFlowSceneModel;
    batteryToBus: LineFlowSceneModel;
    busToSectors: Record<string, LineFlowSceneModel>;
  };
  /** False under reduced motion or a modified scenario: lines stay lit but static. */
  animate?: boolean;
}

interface SingleLineProps {
  line: LineFlowSceneModel;
  animate: boolean;
}

/** Cap per-frame delta so the first demand frame after idle doesn't jump. */
const MAX_DELTA_S = 0.1;

function TransmissionCable({ line, animate }: SingleLineProps) {
  const activeLineRef = useRef<ComponentRef<typeof Line>>(null);
  const invalidate = useThree((s) => s.invalidate);
  const isFlowing = animate && line.active;

  // frameloop="demand": kick off the loop when this line starts flowing.
  useEffect(() => {
    if (isFlowing) invalidate();
  }, [isFlowing, invalidate]);

  // Generate catenary curve points between from and to with sag / pole height
  const points = useMemo(() => {
    const [x1, , z1] = line.from;
    const [x2, , z2] = line.to;

    // Line attached to poles at height 2.2m
    const pStart = new THREE.Vector3(x1, 2.2, z1);
    const pEnd = new THREE.Vector3(x2, 2.2, z2);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    // Catenary sag in the middle
    const pMid = new THREE.Vector3(midX, 1.7, midZ);

    const curve = new THREE.QuadraticBezierCurve3(pStart, pMid, pEnd);
    return curve.getPoints(24);
  }, [line.from, line.to]);

  useFrame((state, delta) => {
    if (!isFlowing || !activeLineRef.current) return;
    const mat = activeLineRef.current.material;
    const dir = line.direction === 'backward' ? -1 : 1;
    mat.dashOffset -= dir * line.speed * Math.min(delta, MAX_DELTA_S) * 2;
    state.invalidate();
  });

  return (
    <group>
      {/* Base physical dark utility wire */}
      <Line
        points={points}
        color="#334155"
        lineWidth={1.5}
        transparent
        opacity={0.4}
      />

      {/* Glowing energy flow overlay (dashed when active) */}
      {line.active && (
        <Line
          ref={activeLineRef}
          points={points}
          color={line.color}
          lineWidth={2.5}
          dashed
          dashScale={2}
          dashSize={0.6}
          gapSize={0.4}
          transparent
          opacity={0.9}
        />
      )}
    </group>
  );
}

export function DistributionLines({ lines, animate = true }: DistributionLinesProps) {
  const allLines = useMemo(() => {
    const list: LineFlowSceneModel[] = [
      lines.solarToBattery,
      lines.batteryToBus,
      ...Object.values(lines.busToSectors),
    ];
    return list;
  }, [lines]);

  return (
    <group name="distribution-lines">
      {allLines.map((line, idx) => (
        <TransmissionCable
          key={idx}
          line={line}
          animate={animate}
        />
      ))}
    </group>
  );
}
