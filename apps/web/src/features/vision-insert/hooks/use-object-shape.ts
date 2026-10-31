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

/** Object to model; `adjusted` = the operator corrected its box, so the box is part of the key. */
export type ShapeRequest = ShapeTarget & { adjusted?: true };

/**
 * Same object again (id, name, category) → same shape: a reselect or a SAM box refinement costs no
 * Spark call. A box corrected by hand (« Adjust the box ») is a new key: the recipe follows the new box.
 */
export const shapeKey = (
  t: Pick<ShapeRequest, 'id' | 'label' | 'category' | 'scenery' | 'adjusted'> & {
    box?: ShapeTarget['box'];
  }
) => {
  const base = `${t.id}|${t.label}|${t.category}|${t.scenery ?? ''}`;
  if (!t.adjusted || !t.box) return base;
  const { x, y, w, h } = t.box;
  return `${base}|${[x, y, w, h].map((v) => v.toFixed(4)).join(',')}`;
};

/**
 * 3D shape of the selected object (PV-T9): asks `/api/vision/shape` for a Spark recipe; any failure ends
 * in `silhouette` mode (never an error state). A new request cancels the previous one. Answers are kept
 * per object until `clear()` (new photo); an offline silhouette is not kept, so a later reselect retries.
 */
export function useObjectShape() {
  const [state, setState] = useState<ObjectShapeState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, ObjectShape>());
  const lastRef = useRef<{ image: string; target: ShapeRequest; sessionId?: string } | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const requestShape = useCallback(
    async (imageDataUrl: string, target: ShapeRequest, sessionId?: string, force = false) => {
      abortRef.current?.abort();
      lastRef.current = { image: imageDataUrl, target, ...(sessionId ? { sessionId } : {}) };
      const key = shapeKey(target);
      const cached = force ? undefined : cacheRef.current.get(key);
      if (cached) {
        setState({ status: 'ready', shape: cached });
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: 'loading' });
      let offline = false;
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
            ...(target.scenery ? { scenery: target.scenery } : {}),
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
        offline = !parsed?.success;
        shape = parsed?.success ? parsed.data : offlineSilhouette(target.id);
      } catch {
        offline = true;
        shape = offlineSilhouette(target.id);
      }
      if (controller.signal.aborted) return;
      if (!offline) cacheRef.current.set(key, shape);
      setState({ status: 'ready', shape });
    },
    []
  );

  /** « Try the AI shape again »: same object, cache skipped (Spark answers vary). */
  const retry = useCallback(() => {
    const last = lastRef.current;
    if (last) void requestShape(last.image, last.target, last.sessionId, true);
  }, [requestShape]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  /** New photo: forget every kept shape (ids repeat across photos). */
  const clear = useCallback(() => {
    cacheRef.current.clear();
    lastRef.current = null;
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  return { ...state, requestShape, retry, reset, clear };
}
