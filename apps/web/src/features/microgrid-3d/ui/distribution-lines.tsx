'use client';

import { useMemo } from 'react';
import { Instance, Instances, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { FeederSceneModel, LineFlowSceneModel } from '../types';
import type { SectorId } from '@mitsinjo/engine';
import { POLE_HEIGHT, mapPolesToSectors, routeCable } from '../utils/cable-route';
import { glowFromIntensity } from '../utils/scene-palette';
import { ElectronFlow } from './electron-flow';

export interface DistributionLinesProps {
  lines: {
    solarToBattery: LineFlowSceneModel;
    batteryToBus: LineFlowSceneModel;
    busToSectors: Record<string, LineFlowSceneModel>;
  };
  /** Sector dispatch feeders to modulate street lamps per sector line (PL-T10). */
  feeders?: Record<SectorId, FeederSceneModel>;
  /** False under reduced motion or a modified scenario: electrons freeze in place. */
  animate?: boolean;
  /** Street-lamp brightness from the sky palette (night → 1). */
  lampGlow?: number;
  /** Wide glow layer under active cables (high tier only: one extra draw per line). */
  halo?: boolean;
}

interface SingleLineProps {
  line: LineFlowSceneModel;
  halo: boolean;
}

/** Static cable: dark conductor, plus a lit core when current flows (motion = ElectronFlow). */
function TransmissionCable({ line, halo }: SingleLineProps) {
  // Cable hops over utility poles with a sag in each span (pure routing util).
  const points = useMemo(
    () => routeCable(line.from, line.to).points.map((p) => new THREE.Vector3(...p)),
    [line.from, line.to]
  );

  // Brighter than 1 + toneMapped off → the bloom pass makes active cables glow.
  const glowColor = useMemo(
    () => new THREE.Color(line.color || '#50d8e8').multiplyScalar(1.6),
    [line.color]
  );

  return (
    <group>
      {/* Physical utility cable, always visible (a cut line stays dark). */}
      <Line points={points} color="#2a2f36" lineWidth={1.4} />

      {line.active && (
        <>
          {/* Wide aura under powered cables, high tier only (one extra draw). */}
          {halo && (
            <Line
              points={points}
              color={glowColor}
              lineWidth={5}
              transparent
              opacity={0.22}
              toneMapped={false}
            />
          )}
          <Line
            points={points}
            color={glowColor}
            lineWidth={1.8}
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </>
      )}
    </group>
  );
}

export function DistributionLines({
  lines,
  feeders,
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

  // Utility poles mapped to the sector feeder that powers them (PL-T10)
  const mappedPoles = useMemo(() => mapPolesToSectors(lines), [lines]);

  // Instanced lamp colors: lights follow feeder intensity (faint glow in survival, 0 when cut)
  const poleLampColors = useMemo(() => {
    return mappedPoles.map((p) => {
      const intensity =
        p.sectorId != null
          ? (feeders?.[p.sectorId]?.intensity ?? (lines.busToSectors[p.sectorId]?.active ? 1 : 0))
          : 0;

      if (intensity <= 0) {
        return new THREE.Color(0, 0, 0);
      }
      const glow = glowFromIntensity(intensity);
      return new THREE.Color('#ffc078').multiplyScalar((0.4 + lampGlow * 2.2) * glow);
    });
  }, [mappedPoles, feeders, lines.busToSectors, lampGlow]);

  return (
    <group name="distribution-lines">
      {allLines.map((line, idx) => (
        <TransmissionCable key={idx} line={line} halo={halo} />
      ))}
      <ElectronFlow lines={allLines} animate={animate} />

      {/* Wooden utility poles, cross-arms, insulators and a street lamp on each */}
      <Instances limit={Math.max(1, mappedPoles.length)} name="pole-shafts" castShadow>
        <cylinderGeometry args={[0.06, 0.09, POLE_HEIGHT + 0.25, 7]} />
        <meshStandardMaterial color="#6b4c34" roughness={0.9} />
        {mappedPoles.map((p, i) => (
          <Instance key={i} position={[p.x, (POLE_HEIGHT + 0.25) / 2, p.z]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, mappedPoles.length)} name="pole-arms" castShadow>
        <boxGeometry args={[0.8, 0.07, 0.07]} />
        <meshStandardMaterial color="#5a3f2b" roughness={0.9} />
        {mappedPoles.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, POLE_HEIGHT + 0.05, p.z]}
            rotation={[0, (i * 1.3) % Math.PI, 0]}
          />
        ))}
      </Instances>
      <Instances limit={Math.max(1, mappedPoles.length)} name="pole-lamps">
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
        {mappedPoles.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, POLE_HEIGHT - 0.35, p.z + 0.12]}
            color={poleLampColors[i]}
          />
        ))}
      </Instances>
    </group>
  );
}
