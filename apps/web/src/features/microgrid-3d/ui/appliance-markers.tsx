'use client';

import { useMemo, type RefObject } from 'react';
import { Html, Instance, Instances, Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
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
  /** Click-selected marker: ring + tag highlight (PP-T5). */
  selectedId?: string | null;
  /** Marker being dragged: its instance hides while the ghost shows (PP-T5). */
  dragId?: string | null;
  /** Drag handlers per marker id; empty = markers stay inert. */
  bindMarker?: (id: string) => {
    onClick?: (e: ThreeEvent<MouseEvent>) => void;
    onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  };
}

/**
 * Inserted appliances (PV-T13): plinth + body next to their sector building, cyan glow while the engine
 * profile draws power and the sector is served, grey otherwise. 3 instanced draw calls for up to 30
 * lines, plus one batched segment list for the feeder links (PP-T3 budget: 3–4 draw calls).
 */
export function ApplianceMarkers({
  markers,
  selectedSector,
  tagOf,
  htmlPortal,
  selectedId = null,
  dragId = null,
  bindMarker,
}: ApplianceMarkersProps) {
  const shown = dragId ? markers.filter((m) => m.id !== dragId) : markers;
  // One LineSegments2 for every marker→building link: a single draw call (PP-T3 budget).
  const feederLinks = useMemo(
    () =>
      shown.flatMap((m) => [
        new THREE.Vector3(m.position[0], m.position[1] + PLINTH[1] + BODY[1], m.position[2]),
        new THREE.Vector3(m.feeder[0], m.feeder[1], m.feeder[2]),
      ]),
    [shown]
  );
  if (markers.length === 0) return null;
  const running = shown.filter((m) => m.running);
  const idle = shown.filter((m) => !m.running);
  const tagged =
    shown.length <= MARKER_TAGS_ALL_MAX ? shown : shown.filter((m) => m.sector === selectedSector);
  const selected = selectedId ? shown.find((m) => m.id === selectedId) : undefined;

  return (
    <group name="appliance-markers">
      <Line
        segments
        points={feederLinks}
        color={TOKEN_HEX.idle}
        lineWidth={1}
        transparent
        opacity={0.55}
      />
      <Instances limit={MAX_APPLIANCES} name="appliance-plinths" castShadow receiveShadow>
        <boxGeometry args={PLINTH} />
        <meshStandardMaterial color={MARKER_PLINTH_HEX} roughness={0.8} />
        {shown.map((m) => (
          <Instance
            key={m.id}
            position={[m.position[0], m.position[1] + PLINTH[1] / 2, m.position[2]]}
            {...bindMarker?.(m.id)}
          />
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
              position={[m.position[0], m.position[1] + PLINTH[1] + BODY[1] / 2, m.position[2]]}
              {...bindMarker?.(m.id)}
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
              position={[m.position[0], m.position[1] + PLINTH[1] + BODY[1] / 2, m.position[2]]}
              {...bindMarker?.(m.id)}
            />
          ))}
        </Instances>
      )}
      {tagged.map((m) => (
        <Html
          key={m.id}
          position={[m.position[0], m.position[1] + PLINTH[1] + BODY[1] + 0.35, m.position[2]]}
          center
          distanceFactor={18}
          portal={htmlPortal as RefObject<HTMLElement>}
          zIndexRange={[8, 0]}
          className="pointer-events-none select-none"
        >
          <span
            data-appliance-tag={m.id}
            className={`whitespace-nowrap rounded-md border bg-surface/90 px-1.5 py-0.5 text-[10px] font-medium text-text-primary shadow ${
              m.id === selectedId ? 'border-energy-cyan' : 'border-border'
            }`}
          >
            {tagOf(m)}
          </span>
        </Html>
      ))}
      {selected && (
        <mesh
          name="appliance-selection-ring"
          rotation-x={-Math.PI / 2}
          position={[selected.position[0], selected.position[1] + 0.03, selected.position[2]]}
        >
          <ringGeometry args={[0.34, 0.46, 40]} />
          <meshBasicMaterial
            color={TOKEN_HEX.energyCyan}
            toneMapped={false}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * Drag preview (PP-T5): a translucent plinth + body at the pointer's ground point. The hook moves
 * `ghostRef` imperatively (no setState per frame); `visible` flips only when the drag starts/ends.
 */
export function MarkerDragGhost({
  ghostRef,
  visible,
}: {
  ghostRef: RefObject<THREE.Group | null>;
  visible: boolean;
}) {
  return (
    <group name="appliance-drag-ghost" ref={ghostRef} visible={visible}>
      <mesh position={[0, PLINTH[1] / 2, 0]}>
        <boxGeometry args={PLINTH} />
        <meshBasicMaterial
          color={TOKEN_HEX.energyCyan}
          toneMapped={false}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, PLINTH[1] + BODY[1] / 2, 0]}>
        <boxGeometry args={BODY} />
        <meshBasicMaterial
          color={TOKEN_HEX.energyCyan}
          toneMapped={false}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
