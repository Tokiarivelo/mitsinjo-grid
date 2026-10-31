'use client';

import { type RefObject } from 'react';
import { Html, Instance, Instances } from '@react-three/drei';
import { MAX_APPLIANCES, type SectorId } from '@mitsinjo/engine';
import type { ApplianceMarkerSceneModel } from '../types';
import { MARKER_PLINTH_HEX, TOKEN_HEX } from '../utils/scene-palette';

/** Tags for every marker up to this count; above, only the selected sector's (scene stays readable). */
export const MARKER_TAGS_ALL_MAX = 6;

const PLINTH: [number, number, number] = [0.46, 0.12, 0.46];
const BODY: [number, number, number] = [0.32, 0.5, 0.32];

export interface ApplianceMarkersProps {
  markers: ApplianceMarkerSceneModel[];
  selectedSector: SectorId | null;
  /** `name · quantity × W` per marker, already translated. */
  tagOf: (m: ApplianceMarkerSceneModel) => string;
  htmlPortal?: RefObject<HTMLElement | null>;
}

/**
 * Inserted appliances (PV-T13): plinth + body next to their sector building, cyan glow while the engine
 * profile draws power and the sector is served, grey otherwise. 3 instanced draw calls for up to 30 lines.
 */
export function ApplianceMarkers({
  markers,
  selectedSector,
  tagOf,
  htmlPortal,
}: ApplianceMarkersProps) {
  if (markers.length === 0) return null;
  const running = markers.filter((m) => m.running);
  const idle = markers.filter((m) => !m.running);
  const tagged =
    markers.length <= MARKER_TAGS_ALL_MAX
      ? markers
      : markers.filter((m) => m.sector === selectedSector);

  return (
    <group name="appliance-markers">
      <Instances limit={MAX_APPLIANCES} name="appliance-plinths" castShadow receiveShadow>
        <boxGeometry args={PLINTH} />
        <meshStandardMaterial color={MARKER_PLINTH_HEX} roughness={0.8} />
        {markers.map((m) => (
          <Instance key={m.id} position={[m.position[0], PLINTH[1] / 2, m.position[2]]} />
        ))}
      </Instances>
      {running.length > 0 && (
        <Instances limit={MAX_APPLIANCES} name="appliance-running" castShadow>
          <boxGeometry args={BODY} />
          <meshStandardMaterial
            color={TOKEN_HEX.energyCyan}
            emissive={TOKEN_HEX.energyCyan}
            emissiveIntensity={1.4}
            roughness={0.4}
            toneMapped={false}
          />
          {running.map((m) => (
            <Instance
              key={m.id}
              position={[m.position[0], PLINTH[1] + BODY[1] / 2, m.position[2]]}
            />
          ))}
        </Instances>
      )}
      {idle.length > 0 && (
        <Instances limit={MAX_APPLIANCES} name="appliance-idle" castShadow>
          <boxGeometry args={BODY} />
          <meshStandardMaterial color={TOKEN_HEX.idle} roughness={0.6} />
          {idle.map((m) => (
            <Instance
              key={m.id}
              position={[m.position[0], PLINTH[1] + BODY[1] / 2, m.position[2]]}
            />
          ))}
        </Instances>
      )}
      {tagged.map((m) => (
        <Html
          key={m.id}
          position={[m.position[0], PLINTH[1] + BODY[1] + 0.35, m.position[2]]}
          center
          distanceFactor={18}
          portal={htmlPortal as RefObject<HTMLElement>}
          zIndexRange={[8, 0]}
          className="pointer-events-none select-none"
        >
          <span
            data-appliance-tag={m.id}
            className="whitespace-nowrap rounded-md border border-border bg-surface/90 px-1.5 py-0.5 text-[10px] font-medium text-text-primary shadow"
          >
            {tagOf(m)}
          </span>
        </Html>
      ))}
    </group>
  );
}
