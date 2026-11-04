'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { AppliancePosition } from '@mitsinjo/engine';
import { terrainHeight } from '../utils/landscape';
import { pointerToGround } from '../utils/placement';

export interface MarkerDragHandlers {
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}

export interface UseMarkerDrag {
  /** Click-selected marker (ring + tag highlight), null when none. */
  selectedId: string | null;
  /** Marker being dragged (its instance hides, the ghost shows). Null otherwise. */
  dragId: string | null;
  /** Ghost group, moved imperatively — no setState per frame. */
  ghostRef: React.RefObject<THREE.Group | null>;
  /** Wire onto a marker instance; empty when dragging is off (no `onCommit`). */
  bindMarker: (id: string) => MarkerDragHandlers | Record<string, never>;
  /** Toggle a marker's selection from outside the 3D pick (its badge, PT-11e). */
  toggleSelect: (id: string) => void;
}

/** Pointer travel (client px) before a press becomes a drag. */
export const DRAG_THRESHOLD_PX = 4;

interface PendingPress {
  id: string;
  x0: number;
  y0: number;
}

/**
 * Marker select + drag (PP-T5). Click toggles selection; press + move past the threshold drags on
 * the ground plane (ghost preview, orbit disabled meanwhile), pointer-up commits. Settles only on
 * press/up (never per frame); pointer-cancel aborts without committing.
 */
export function useMarkerDrag({
  onCommit,
  onActiveChange,
}: {
  onCommit?: (id: string, pos: AppliancePosition) => void;
  onActiveChange?: (active: boolean) => void;
}): UseMarkerDrag {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => (s.controls as unknown as { enabled: boolean } | null) ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const ghostRef = useRef<THREE.Group | null>(null);
  const pending = useRef<PendingPress | null>(null);
  const dragging = useRef(false);
  const lastPos = useRef<AppliancePosition | null>(null);
  const commitRef = useRef(onCommit);
  const activeRef = useRef(onActiveChange);
  // Latest callbacks without re-subscribing the window listeners.
  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);
  useEffect(() => {
    activeRef.current = onActiveChange;
  }, [onActiveChange]);
  // OrbitControls via a ref: flipping `enabled` mid-drag must not re-render or re-subscribe.
  const controlsRef = useRef<{ enabled: boolean } | null>(null);
  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  const stop = useCallback(() => {
    pending.current = null;
    dragging.current = false;
    lastPos.current = null;
    setDragId(null);
    if (controlsRef.current) controlsRef.current.enabled = true;
    activeRef.current?.(false);
    invalidate();
  }, [invalidate]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const press = pending.current;
      if (!press) return;
      if (!dragging.current) {
        if (Math.hypot(e.clientX - press.x0, e.clientY - press.y0) < DRAG_THRESHOLD_PX) return;
        dragging.current = true;
        setDragId(press.id);
        if (controlsRef.current) controlsRef.current.enabled = false;
        activeRef.current?.(true);
        invalidate();
      }
      const pos = pointerToGround(
        e.clientX,
        e.clientY,
        gl.domElement.getBoundingClientRect(),
        camera
      );
      if (!pos) return;
      lastPos.current = pos;
      ghostRef.current?.position.set(pos.x, terrainHeight(pos.x, pos.z), pos.z);
      invalidate();
    };
    const onUp = () => {
      const press = pending.current;
      if (!press) return;
      const wasDragging = dragging.current;
      const at = lastPos.current;
      const id = press.id;
      stop();
      if (wasDragging) {
        if (at) commitRef.current?.(id, at);
      } else {
        setSelectedId((prev) => (prev === id ? null : id));
        invalidate();
      }
    };
    const onCancel = () => {
      if (pending.current) stop();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [camera, gl, invalidate, stop]);

  const bindMarker = useCallback(
    (id: string): MarkerDragHandlers | Record<string, never> => {
      if (!onCommit) return {};
      return {
        onClick: (e) => e.stopPropagation(),
        onPointerDown: (e) => {
          e.stopPropagation();
          pending.current = { id, x0: e.clientX, y0: e.clientY };
        },
      };
    },
    [onCommit]
  );

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedId((prev) => (prev === id ? null : id));
      invalidate();
    },
    [invalidate]
  );

  return { selectedId, dragId, ghostRef, bindMarker, toggleSelect };
}
