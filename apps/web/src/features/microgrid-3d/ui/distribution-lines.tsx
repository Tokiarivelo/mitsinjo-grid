'use client';

import { type ComponentRef, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Instance, Instances, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { LineFlowSceneModel } from '../types';
import { POLE_HEIGHT, routeCable } from '../utils/cable-route';

export interface DistributionLinesProps {
  lines: {
    solarToBattery: LineFlowSceneModel;
    batteryToBus: LineFlowSceneModel;
    busToSectors: Record<string, LineFlowSceneModel>;
  };
  /** False under reduced motion or a modified scenario: lines stay lit but static. */
  animate?: boolean;
  /** Street-lamp brightness from the sky palette (night → 1). */
  lampGlow?: number;
  /** Wide glow layer under active cables (high tier only: one extra draw per line). */
  halo?: boolean;
}

interface SingleLineProps {
  line: LineFlowSceneModel;
  animate: boolean;
  halo: boolean;
}

/** Cap per-frame delta so the first demand frame after idle doesn't jump. */
const MAX_DELTA_S = 0.1;

function TransmissionCable({ line, animate, halo }: SingleLineProps) {
  const activeLineRef = useRef<ComponentRef<typeof Line>>(null);
  const glowLineRef = useRef<ComponentRef<typeof Line>>(null);
  const invalidate = useThree((s) => s.invalidate);
  const isFlowing = animate && line.active;

  // frameloop="demand": kick off the loop when this line starts flowing.
  useEffect(() => {
    if (isFlowing) invalidate();
  }, [isFlowing, invalidate]);

  // Cable hops over utility poles with a sag in each span (pure routing util).
  const points = useMemo(
    () => routeCable(line.from, line.to).points.map((p) => new THREE.Vector3(...p)),
    [line.from, line.to]
  );

  useFrame((state, delta) => {
    if (!isFlowing) return;
    const dir = line.direction === 'backward' ? -1 : 1;
    const move = dir * line.speed * Math.min(delta, MAX_DELTA_S) * 2.4;

    if (activeLineRef.current) {
      activeLineRef.current.material.dashOffset -= move;
    }
    if (glowLineRef.current) {
      glowLineRef.current.material.dashOffset -= move;
    }
    state.invalidate();
  });

  // Brighter than 1 + toneMapped off → the bloom pass makes active cables glow.
  const glowColor = useMemo(
    () => new THREE.Color(line.color || '#50d8e8').multiplyScalar(2.4),
    [line.color]
  );
  const coreColor = useMemo(() => new THREE.Color('#e8fdff').multiplyScalar(2.6), []);

  return (
    <group>
      {/* 1. Base Physical Utility Cable */}
      <Line points={points} color="#2a2f36" lineWidth={1.4} />

      {/* 2. Enhanced Surbrillance / Glowing Energy Flow (when active) */}
      {line.active && (
        <>
          {/* Layer A: Broad Outer Glowing Aura (Neon Halo Bloom), high tier only */}
          {halo && (
            <Line
              ref={glowLineRef}
              points={points}
              color={glowColor}
              lineWidth={5}
              dashed
              dashScale={2.2}
              dashSize={0.8}
              gapSize={0.4}
              transparent
              opacity={0.5}
              toneMapped={false}
            />
          )}

          {/* Layer B: Intense Electric Core (High-energy highlight) */}
          <Line
            ref={activeLineRef}
            points={points}
            // Without the halo the core carries the status color itself.
            color={halo ? coreColor : glowColor}
            lineWidth={2.4}
            dashed
            dashScale={2.2}
            dashSize={0.7}
            gapSize={0.5}
            transparent
            opacity={0.95}
            toneMapped={false}
          />
        </>
      )}
    </group>
  );
}

export function DistributionLines({
  lines,
  animate = true,
  lampGlow = 0.5,
  halo = true,
}: DistributionLinesProps) {
  const allLines = useMemo(() => {
    const list: LineFlowSceneModel[] = [
      lines.solarToBattery,
      lines.batteryToBus,
      ...Object.values(lines.busToSectors),
    ];
    return list;
  }, [lines]);

  const poles = useMemo(() => allLines.flatMap((l) => routeCable(l.from, l.to).poles), [allLines]);
  const lampColor = useMemo(
    () => new THREE.Color('#ffc078').multiplyScalar(0.6 + lampGlow * 2.4),
    [lampGlow]
  );

  return (
    <group name="distribution-lines">
      {allLines.map((line, idx) => (
        <TransmissionCable key={idx} line={line} animate={animate} halo={halo} />
      ))}

      {/* Wooden utility poles, cross-arms, insulators and a street lamp on each */}
      <Instances limit={Math.max(1, poles.length)} name="pole-shafts" castShadow>
        <cylinderGeometry args={[0.06, 0.09, POLE_HEIGHT + 0.25, 7]} />
        <meshStandardMaterial color="#6b4c34" roughness={0.9} />
        {poles.map(([x, z], i) => (
          <Instance key={i} position={[x, (POLE_HEIGHT + 0.25) / 2, z]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, poles.length)} name="pole-arms" castShadow>
        <boxGeometry args={[0.8, 0.07, 0.07]} />
        <meshStandardMaterial color="#5a3f2b" roughness={0.9} />
        {poles.map(([x, z], i) => (
          <Instance
            key={i}
            position={[x, POLE_HEIGHT + 0.05, z]}
            rotation={[0, (i * 1.3) % Math.PI, 0]}
          />
        ))}
      </Instances>
      <Instances limit={Math.max(1, poles.length)} name="pole-lamps">
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshBasicMaterial color={lampColor} toneMapped={false} />
        {poles.map(([x, z], i) => (
          <Instance key={i} position={[x, POLE_HEIGHT - 0.35, z + 0.12]} />
        ))}
      </Instances>
    </group>
  );
}
