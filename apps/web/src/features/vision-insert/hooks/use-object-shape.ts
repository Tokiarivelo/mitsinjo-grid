'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ObjectShapeSchema,
  ShapeStepEventSchema,
  type ObjectShape,
  type ShapeStep,
  type ShapeTarget,
} from '@/lib/object-shape';
import { readSseStream } from '@/lib/sse';
import { prepareVisionImage } from '../utils/prepare-image';

/** `loading` = Spark is building the recipe · `ready` = recipe or silhouette to show. */
export interface ObjectShapeState {
  status: 'idle' | 'loading' | 'ready';
  shape?: ObjectShape;
  /** Server step while loading (`crop` until the first event). */
  step?: ShapeStep;
  /** `Date.now()` when the request started (elapsed-time display). */
  startedAt?: number;
}

const IDLE: ObjectShapeState = { status: 'idle' };

/**
 * Shown when the app server cannot be reached or answers badly (`network`, not « Meta did not answer »):
 * the silhouette needs no server. `detail` = `http_<status>`, `no_result` or `offline`.
 */
const offlineSilhouette = (detectionId: string, detail: string): ObjectShape => ({
  detectionId,
  mode: 'silhouette',
  reason: 'network',
  detail,
  source: 'mock',
  model: 'none',
});

/** Only lasting answers are kept: a timeout, Meta error, spend cap or lost connection is asked again. */
const TRANSIENT = new Set<ObjectShape['reason']>([
  'provider_error',
  'spend_cap',
  'timeout',
  'network',
]);
export const keepShape = (shape: ObjectShape) =>
  shape.mode === 'recipe' || !TRANSIENT.has(shape.reason);

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
 * 3D shape of the selected object (PV-T9), on demand (`peek` on select, `requestShape` on « Generate »): asks `/api/vision/shape` (SSE: live `step`, then the shape)
 * for a Spark recipe; any failure ends in `silhouette` mode with its reason (never an error state). A new
 * request cancels the previous one. Lasting answers are kept per object until `clear()` (new photo);
 * transient failures (`keepShape`) are not, so a reselect asks again.
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
      setState({ status: 'loading', step: 'crop', startedAt: Date.now() });
      const got: { shape?: ObjectShape } = {};
      let detail = 'no_result';
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
        if (!res.ok || !res.body) {
          detail = `http_${res.status}`;
        } else {
          await readSseStream(res.body, (event, data) => {
            if (controller.signal.aborted) return;
            if (event === 'shape_step') {
              const step = ShapeStepEventSchema.safeParse(data);
              if (step.success) setState((s) => ({ ...s, step: step.data.step }));
            } else if (event === 'shape_result') {
              const parsed = ObjectShapeSchema.safeParse(data.shape);
              if (parsed.success) got.shape = parsed.data;
              else console.warn('[vision] 3D shape reply not readable:', parsed.error.issues[0]);
            }
          });
        }
      } catch (err) {
        detail = 'offline';
        if (!controller.signal.aborted) console.warn('[vision] 3D shape request failed:', err);
      }
      if (controller.signal.aborted) return;
      const final = got.shape ?? offlineSilhouette(target.id, detail);
      if (keepShape(final)) cacheRef.current.set(key, final);
      setState({ status: 'ready', shape: final });
    },
    []
  );

  /**
   * Object selected: show its kept shape, else nothing (idle) — Spark is only asked on « Generate »
   * (`requestShape`), so picking objects to adjust their box costs no call. Cancels a running request.
   */
  const peek = useCallback((target: ShapeRequest) => {
    abortRef.current?.abort();
    const cached = cacheRef.current.get(shapeKey(target));
    setState(cached ? { status: 'ready', shape: cached } : IDLE);
  }, []);

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

  return { ...state, requestShape, peek, retry, reset, clear };
}
