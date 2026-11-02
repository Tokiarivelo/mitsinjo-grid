'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SHAPE_OUTLINE_MAX,
  ImaginedViewsResponseSchema,
  ObjectShapeSchema,
  ShapeStepEventSchema,
  type ImaginedAngleView,
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
  /** 6-angle 2D preview: imagined before the 3D, validated to build it. */
  viewsStatus: 'idle' | 'loading' | 'ready';
  views?: ImaginedAngleView[];
}

const IDLE: ObjectShapeState = { status: 'idle', viewsStatus: 'idle' };

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

/**
 * Key of one « Generate » request: the object's key plus the validated facade, so a new facade
 * asks Spark again instead of returning the model made without it (or with an older one).
 */
export const shapeRequestKey = (t: ShapeRequest) =>
  t.facadeKey ? `${shapeKey(t)}|facade:${t.facadeKey}` : shapeKey(t);

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

/** Multipart body shared by the shape and views routes: photo + target (+ session). */
async function shapeForm(imageDataUrl: string, target: ShapeRequest, sessionId?: string) {
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
      ...(target.outline && target.outline.length <= SHAPE_OUTLINE_MAX
        ? { outline: target.outline }
        : {}),
      ...(target.facadeUrl ? { facadeUrl: target.facadeUrl } : {}),
      ...(target.facadeKey ? { facadeKey: target.facadeKey } : {}),
    })
  );
  if (sessionId) form.append('sessionId', sessionId);
  return form;
}

/**
 * 3D shape of the selected object (PV-T9), on demand (`peek` on select, `requestShape` on « Generate »): asks `/api/vision/shape` (SSE: live `step`, then the shape)
 * for a Spark recipe; any failure ends in `silhouette` mode with its reason (never an error state). A new
 * request cancels the previous one. Lasting answers are kept per object until `clear()` (new photo);
 * transient failures (`keepShape`) are not, so a reselect asks again.
 * `requestViews` previews the 6 imagined 2D angles first (cheap, no Spark call); validating them runs
 * `requestShape`.
 */
export function useObjectShape() {
  const [state, setState] = useState<ObjectShapeState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, ObjectShape>());
  const viewsCacheRef = useRef(new Map<string, ImaginedAngleView[]>());
  /** Validated facade per object: « Regenerate » / « Retry » keep using it. */
  const facadesRef = useRef(new Map<string, Pick<ShapeRequest, 'facadeUrl' | 'facadeKey'>>());
  const lastRef = useRef<{ image: string; target: ShapeRequest; sessionId?: string } | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const requestViews = useCallback(async (imageDataUrl: string, target: ShapeRequest) => {
    abortRef.current?.abort();
    const key = shapeKey(target);
    const cached = viewsCacheRef.current.get(key);
    if (cached) {
      setState((s) => ({ ...s, viewsStatus: 'ready', views: cached }));
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setState((s) => ({ ...s, viewsStatus: 'loading', views: undefined }));
    try {
      const res = await fetch('/api/vision/views', {
        method: 'POST',
        body: await shapeForm(imageDataUrl, target),
        signal: controller.signal,
      });
      if (res.ok) {
        const parsed = ImaginedViewsResponseSchema.safeParse(await res.json());
        if (parsed.success && !controller.signal.aborted) {
          viewsCacheRef.current.set(key, parsed.data.views);
          setState((s) => ({ ...s, viewsStatus: 'ready', views: parsed.data.views }));
          return;
        }
        if (!parsed.success)
          console.warn('[vision] 6-angle views reply not readable:', parsed.error.issues[0]);
      }
    } catch (err) {
      if (!controller.signal.aborted) console.warn('[vision] 6-angle views request failed:', err);
    }
    if (controller.signal.aborted) return;
    // No preview, no drama: the operator can still generate the 3D model directly.
    setState((s) => (s.viewsStatus === 'loading' ? { ...s, viewsStatus: 'idle' } : s));
  }, []);

  const requestShape = useCallback(
    async (imageDataUrl: string, request: ShapeRequest, sessionId?: string, force = false) => {
      abortRef.current?.abort();
      const objectKey = shapeKey(request);
      if (request.facadeUrl && request.facadeKey) {
        facadesRef.current.set(objectKey, {
          facadeUrl: request.facadeUrl,
          facadeKey: request.facadeKey,
        });
      }
      const target = request.facadeUrl
        ? request
        : { ...request, ...facadesRef.current.get(objectKey) };
      lastRef.current = { image: imageDataUrl, target, ...(sessionId ? { sessionId } : {}) };
      const key = shapeRequestKey(target);
      const cached = force ? undefined : cacheRef.current.get(key);
      if (cached) {
        setState((s) => ({ ...s, status: 'ready', shape: cached }));
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setState((s) => ({ ...s, status: 'loading', step: 'crop', startedAt: Date.now() }));
      const got: { shape?: ObjectShape } = {};
      let detail = 'no_result';
      try {
        const form = await shapeForm(imageDataUrl, target, sessionId);
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
      if (keepShape(final)) {
        cacheRef.current.set(key, final);
        // A reselect (`peek`, no facade) shows the latest model, facade-based or not.
        cacheRef.current.set(objectKey, final);
      }
      setState((s) => ({ ...s, status: 'ready', shape: final }));
    },
    []
  );

  /**
   * Object selected: show its kept shape and views, else nothing (idle) — Spark is only asked on
   * « Generate » (`requestShape`), so picking objects to adjust their box costs no call. Cancels a
   * running request.
   */
  const peek = useCallback((target: ShapeRequest) => {
    abortRef.current?.abort();
    const key = shapeKey(target);
    const cached = cacheRef.current.get(key);
    const views = viewsCacheRef.current.get(key);
    setState({
      ...(cached ? { status: 'ready' as const, shape: cached } : { status: 'idle' as const }),
      ...(views ? { viewsStatus: 'ready' as const, views } : { viewsStatus: 'idle' as const }),
    });
  }, []);

  /** « Try the AI shape again »: same object, cache skipped (Spark answers vary). */
  const retry = useCallback(() => {
    const last = lastRef.current;
    if (last) void requestShape(last.image, last.target, last.sessionId, true);
  }, [requestShape]);

  /** « Regenerate the 3D model »: re-request the shape skipping cache (force = true). */
  const regenerate = useCallback(() => {
    const last = lastRef.current;
    if (last) void requestShape(last.image, last.target, last.sessionId, true);
  }, [requestShape]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  /** New photo: forget every kept shape and preview (ids repeat across photos). */
  const clear = useCallback(() => {
    cacheRef.current.clear();
    viewsCacheRef.current.clear();
    facadesRef.current.clear();
    lastRef.current = null;
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  return { ...state, requestShape, requestViews, peek, retry, regenerate, reset, clear };
}
