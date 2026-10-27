'use client';

import { useMemo } from 'react';
import { BATTERY_POSITION } from '../utils/to-scene-model';
import type { BatterySceneModel } from '../types';
import { BATTERY_STATUS_HEX, TOKEN_HEX } from '../utils/scene-palette';

export interface BatteryUnitProps {
  model: BatterySceneModel;
}

export function BatteryUnit({ model }: BatteryUnitProps) {
  const { socPct, isCharging, isDischarging, statusColor } = model;

  const statusHexColor = BATTERY_STATUS_HEX[statusColor];
  const flowHex = isCharging
    ? TOKEN_HEX.batteryGreen
    : isDischarging
    ? TOKEN_HEX.solarAmber
    : TOKEN_HEX.idle;

  // 5 LED gauge levels (0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
  const ledLevels = useMemo(() => {
    return [0, 1, 2, 3, 4].map((i) => {
      const threshold = i * 20;
      const isLit = socPct > threshold;
      return {
        y: 0.5 + i * 0.22,
        isLit,
      };
    });
  }, [socPct]);

  return (
    <group position={BATTERY_POSITION} name="battery-bess">
      {/* Concrete Foundation Pad */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[4.2, 0.1, 2.6]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* Main Container Enclosure (White/Silver Weatherproof ISO Container) */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[3.8, 2.0, 2.2]} />
        <meshStandardMaterial
          color="#e2e8f0"
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>

      {/* Container Roof Trim */}
      <mesh position={[0, 2.15, 0]}>
        <boxGeometry args={[3.9, 0.1, 2.3]} />
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </mesh>

      {/* Dual Rooftop HVAC Chillers */}
      <mesh position={[-1.0, 2.35, 0]}>
        <boxGeometry args={[0.9, 0.3, 1.2]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[1.0, 2.35, 0]}>
        <boxGeometry args={[0.9, 0.3, 1.2]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Front Access Doors */}
      <mesh position={[0, 1.05, 1.11]}>
        <planeGeometry args={[1.6, 1.7]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* SoC LED Charge Level Gauge on Front Panel */}
      <group position={[1.3, 0.2, 1.12]}>
        {/* Gauge background bezel */}
        <mesh position={[0, 0.9, 0]}>
          <planeGeometry args={[0.35, 1.4]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>

        {/* 5 Stacked LED bars */}
        {ledLevels.map((led, idx) => (
          <mesh key={idx} position={[0, led.y, 0.01]}>
            <planeGeometry args={[0.22, 0.14]} />
            <meshBasicMaterial
              color={led.isLit ? statusHexColor : '#334155'}
            />
          </mesh>
        ))}
      </group>

      {/* Charging / Discharging Status Light */}
      <mesh position={[-1.3, 1.5, 1.12]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color={flowHex} />
      </mesh>

      {/* Active Power Glow */}
      {(isCharging || isDischarging) && (
        <pointLight
          position={[0, 1.5, 1.5]}
          color={flowHex}
          intensity={0.8}
          distance={5}
        />
      )}
    </group>
  );
}
