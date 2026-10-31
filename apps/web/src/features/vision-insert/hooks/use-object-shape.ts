'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ObjectShapeSchema, type ObjectShape, type ShapeTarget } from '@/lib/object-shape';
import { prepareVisionImage } from '../utils/prepare-image';

/** `loading` = Spark is building the recipe · `ready` = recipe or silhouette to show. */
export interface ObjectShapeState {
  status: 'idle' | 'loading' | 'ready';
  shape?: ObjectShape;
}

const IDLE: ObjectShapeState = { status: 'idle' };

/** Shown when the route cannot be reached or answers badly: the silhouette needs no server. */
const offlineSilhouette = (detectionId: string): ObjectShape => ({
  detectionId,
  mode: 'silhouette',
  reason: 'provider_error',
  source: 'mock',
  model: 'none',
});

/**
 * 3D shape of the selected object (PV-T9): asks `/api/vision/shape` for a Spark recipe; any failure ends
 * in `silhouette` mode (never an error state). A new request cancels the previous one.
 */
export function useObjectShape() {
  const [state, setState] = useState<ObjectShapeState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const requestShape = useCallback(
    async (imageDataUrl: string, target: ShapeTarget, sessionId?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: 'loading' });
      let shape: ObjectShape;
      try {
        const form = new FormData();
        form.append('image', await prepareVisionImage(imageDataUrl), 'photo.jpg');
        form.append(
          'target',
          JSON.stringify({
            id: target.id,
            label: target.label,
            category: target.category,
            box: target.box,
          })
        );
        if (sessionId) form.append('sessionId', sessionId);
        const res = await fetch('/api/vision/shape', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
        const parsed = res.ok ? ObjectShapeSchema.safeParse(await res.json()) : null;
        shape = parsed?.success ? parsed.data : offlineSilhouette(target.id);
      } catch {
        shape = offlineSilhouette(target.id);
      }
      if (controller.signal.aborted) return;
      setState({ status: 'ready', shape });
    },
    []
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  return { ...state, requestShape, reset };
}
