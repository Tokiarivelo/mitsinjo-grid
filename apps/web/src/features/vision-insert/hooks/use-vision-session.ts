'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { readSseStream } from '@/lib/sse';
import {
  MAX_REGIONS,
  VisionRegionsEventSchema,
  type ApplianceDetection,
  type NormBox,
} from '@/lib/vision';
import { prepareVisionImage } from '../utils/prepare-image';
import { shapeToDetection, shapeToRegion, type DrawnShape } from '../utils/shapes';
import { useKeptRef, useKeptState } from './use-kept-state';
import { useVisionDetection } from './use-vision-detection';

/** Max objects the operator can draw on one photo (the engine takes ≤ 30 appliances). */
export const MAX_MANUAL_BOXES = 30;

interface ManualState {
  image: string;
  items: ApplianceDetection[];
  /** Sent shapes the model has not answered for yet. */
  identifying: string[];
  failed: boolean;
}

/**
 * Detection for one photo: runs when `imageUrl` changes (null = nothing), keeps the selected
 * object and the shapes drawn by hand (PV-T8) for that photo only. Shared by the chat dialog
 * and the /village page. With a `scope` (see `useKeptState`) all of it outlives an unmount: coming
 * back to the page shows the same photo session without asking the model again.
 */
export function useVisionSession(imageUrl: string | null, scope?: string) {
  const vision = useVisionDetection(scope);
  const { detect, reset, detectedFor } = vision;
  const [selection, setSelection] = useKeptState<{ image: string; id: string } | null>(
    scope,
    'selection',
    null
  );
  const [manual, setManual] = useKeptState<ManualState | null>(scope, 'manual', null);
  /** Boxes the operator corrected on this photo (AI or drawn objects), by object id. */
  const [adjustedBoxes, setAdjustedBoxes] = useKeptState<{
    image: string;
    boxes: Record<string, NormBox>;
  } | null>(scope, 'adjustedBoxes', null);
  const abortsRef = useKeptRef(scope, 'identifyAborts', () => new Set<AbortController>());
  /** Photo the running identifications belong to (kept sessions only). */
  const abortsForRef = useKeptRef<string | null>(scope, 'identifyFor', () => null);

  useEffect(() => {
    if (!imageUrl) return;
    // A kept session already asked for this photo (its answer may still be on the way).
    if (scope && detectedFor === imageUrl) return;
    void detect(imageUrl);
    return scope ? undefined : reset;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `detectedFor` follows `detect`
  }, [imageUrl, detect, reset, scope]);

  // A new photo (or unmount, unless kept) drops the identifications still running.
  useEffect(() => {
    const running = abortsRef.current;
    const stop = () => {
      running.forEach((c) => c.abort());
      running.clear();
    };
    if (!scope) return stop;
    if (abortsForRef.current !== imageUrl) {
      stop();
      abortsForRef.current = imageUrl;
    }
  }, [imageUrl, scope, abortsRef, abortsForRef]);

  const current = imageUrl && manual?.image === imageUrl ? manual : null;
  const manualItems = useMemo(() => current?.items ?? [], [current]);
  const boxes = imageUrl && adjustedBoxes?.image === imageUrl ? adjustedBoxes.boxes : null;
  // AI objects first, then the ones drawn by hand (in drawing order). A corrected box wins over a
  // later model answer (SAM outlines), and its outline goes: it no longer matches.
  const detections = useMemo(() => {
    const all = manualItems.length ? [...vision.detections, ...manualItems] : vision.detections;
    if (!boxes) return all;
    return all.map((d) => {
      const box = boxes[d.id];
      if (!box) return d;
      const next: ApplianceDetection = { ...d, box, adjusted: true };
      delete next.outline;
      return next;
    });
  }, [vision.detections, manualItems, boxes]);
  const selectedId = imageUrl && selection?.image === imageUrl ? selection.id : null;
  const selected = detections.find((d) => d.id === selectedId) ?? null;

  const select = useCallback(
    (id: string) => {
      if (imageUrl) setSelection({ image: imageUrl, id });
    },
    [imageUrl, setSelection]
  );
  const retry = useCallback(() => {
    if (imageUrl) void detect(imageUrl);
  }, [imageUrl, detect]);

  /** Applies a change to this photo's drawn objects (ignored once the photo changed). */
  const patch = useCallback(
    (image: string, change: (m: ManualState) => ManualState) => {
      setManual((m) => {
        const base = m?.image === image ? m : { image, items: [], identifying: [], failed: false };
        return change(base);
      });
    },
    [setManual]
  );

  /**
   * Sends drawn shapes (PV-T8): they show at once with their outline and the operator's text,
   * then the vision model names them, sorts them (appliance or not) and refines the outline.
   * Returns false when nothing was sent (no photo, empty, or over the per-photo limit).
   */
  const sendShapes = useCallback(
    (shapes: DrawnShape[], fallbackLabel: string): boolean => {
      if (!imageUrl || shapes.length === 0) return false;
      const room = MAX_MANUAL_BOXES - manualItems.length;
      const batch = shapes.slice(0, Math.min(room, MAX_REGIONS));
      if (batch.length === 0) return false;
      const image = imageUrl;
      const ids = batch.map((s) => s.id);
      const drawn = new Map(batch.map((s) => [s.id, shapeToDetection(s, fallbackLabel)]));
      patch(image, (m) => ({
        ...m,
        items: [...m.items, ...drawn.values()],
        identifying: [...m.identifying, ...ids],
        failed: false,
      }));
      setSelection({ image, id: ids[ids.length - 1]! });

      const controller = new AbortController();
      abortsRef.current.add(controller);
      const finish = (failed: boolean) => {
        abortsRef.current.delete(controller);
        if (controller.signal.aborted) return;
        patch(image, (m) => ({
          ...m,
          identifying: m.identifying.filter((id) => !ids.includes(id)),
          failed: m.failed || failed,
        }));
      };

      void (async () => {
        try {
          const form = new FormData();
          form.append('image', await prepareVisionImage(image), 'photo.jpg');
          form.append('regions', JSON.stringify(batch.map(shapeToRegion)));
          const res = await fetch('/api/vision', {
            method: 'POST',
            body: form,
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          let failed = false;
          await readSseStream(res.body, (event, data) => {
            if (event === 'vision_error') failed = true;
            if (event !== 'vision_regions') return;
            const parsed = VisionRegionsEventSchema.safeParse(data);
            if (!parsed.success) return;
            patch(image, (m) => ({
              ...m,
              items: m.items.map((item) => {
                const hit = parsed.data.results.find((r) => r.regionId === item.id)?.detection;
                if (!hit) return item;
                // The model names and sorts it; the drawn outline stays until SAM gives one.
                return {
                  ...hit,
                  id: item.id,
                  manual: true,
                  outline: hit.outline ?? drawn.get(item.id)?.outline,
                };
              }),
            }));
          });
          finish(failed);
        } catch {
          finish(true);
        }
      })();
      return true;
    },
    [imageUrl, manualItems.length, patch, setSelection, abortsRef]
  );

  const removeManual = useCallback(
    (id: string) => {
      if (!imageUrl) return;
      patch(imageUrl, (m) => ({
        ...m,
        items: m.items.filter((d) => d.id !== id),
        identifying: m.identifying.filter((x) => x !== id),
      }));
      setSelection((s) => (s?.id === id ? null : s));
    },
    [imageUrl, patch, setSelection]
  );

  /** The operator corrected an object's box (AI or drawn): kept for this photo only. */
  const adjustBox = useCallback(
    (id: string, box: NormBox) => {
      if (!imageUrl) return;
      setAdjustedBoxes((a) => ({
        image: imageUrl,
        boxes: { ...(a?.image === imageUrl ? a.boxes : {}), [id]: box },
      }));
    },
    [imageUrl, setAdjustedBoxes]
  );

  return {
    ...vision,
    adjustBox,
    detections,
    selectedId,
    selected,
    select,
    retry,
    sendShapes,
    removeManual,
    /** Drawn objects the model is still identifying. */
    identifyingIds: current?.identifying ?? [],
    /** The last identification failed (objects keep the operator's text). */
    identifyFailed: current?.failed ?? false,
    /** How many more objects can be drawn on this photo. */
    manualRoom: MAX_MANUAL_BOXES - manualItems.length,
  };
}
