'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApplianceCategory } from '@mitsinjo/engine';
import type { ApplianceDetection, NormBox } from '@/lib/vision';
import { manualDetection } from '../utils/manual-box';
import { useVisionDetection } from './use-vision-detection';

/** Max boxes the operator can add on one photo (the engine takes ≤ 30 appliances). */
export const MAX_MANUAL_BOXES = 30;

/**
 * Detection for one photo: runs when `imageUrl` changes (null = nothing), keeps the selected
 * appliance and the boxes drawn by hand (PV-T8) for that photo only. Shared by the chat dialog
 * and the /village page.
 */
export function useVisionSession(imageUrl: string | null) {
  const vision = useVisionDetection();
  const { detect, reset } = vision;
  const [selection, setSelection] = useState<{ image: string; id: string } | null>(null);
  const [manual, setManual] = useState<{ image: string; items: ApplianceDetection[] } | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (!imageUrl) return;
    void detect(imageUrl);
    return reset;
  }, [imageUrl, detect, reset]);

  const manualItems = useMemo(
    () => (imageUrl && manual?.image === imageUrl ? manual.items : []),
    [imageUrl, manual]
  );
  // AI objects first, then the ones drawn by hand (in drawing order).
  const detections = useMemo(
    () => (manualItems.length ? [...vision.detections, ...manualItems] : vision.detections),
    [vision.detections, manualItems]
  );
  const selectedId = imageUrl && selection?.image === imageUrl ? selection.id : null;
  const selected = detections.find((d) => d.id === selectedId) ?? null;

  const select = useCallback(
    (id: string) => {
      if (imageUrl) setSelection({ image: imageUrl, id });
    },
    [imageUrl]
  );
  const retry = useCallback(() => {
    if (imageUrl) void detect(imageUrl);
  }, [imageUrl, detect]);

  /** Adds a hand-drawn box and selects it. Returns its id, or null (no photo, or list full). */
  const addManual = useCallback(
    (box: NormBox, category: ApplianceCategory, label: string): string | null => {
      if (!imageUrl || manualItems.length >= MAX_MANUAL_BOXES) return null;
      const id = `manual-${nextId.current++}`;
      const item = manualDetection({ id, box, category, label });
      setManual({ image: imageUrl, items: [...manualItems, item] });
      setSelection({ image: imageUrl, id });
      return id;
    },
    [imageUrl, manualItems]
  );

  const removeManual = useCallback(
    (id: string) => {
      if (!imageUrl) return;
      setManual({ image: imageUrl, items: manualItems.filter((d) => d.id !== id) });
      setSelection((s) => (s?.id === id ? null : s));
    },
    [imageUrl, manualItems]
  );

  return {
    ...vision,
    detections,
    selectedId,
    selected,
    select,
    retry,
    addManual,
    removeManual,
    canAddManual: manualItems.length < MAX_MANUAL_BOXES,
  };
}
