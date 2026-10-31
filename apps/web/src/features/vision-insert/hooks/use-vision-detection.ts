'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readSseStream } from '@/lib/sse';
import {
  VisionDetectionsEventSchema,
  type ApplianceDetection,
  type VisionDetectionsEvent,
} from '@/lib/vision';
import { prepareVisionImage } from '../utils/prepare-image';

/** `loading` = waiting for boxes · `refining` = boxes shown, SAM outlines coming · `ready` · `error`. */
export type VisionStatus = 'idle' | 'loading' | 'refining' | 'ready' | 'error';

export interface VisionState {
  status: VisionStatus;
  detections: ApplianceDetection[];
  source?: VisionDetectionsEvent['source'];
  fallback?: VisionDetectionsEvent['fallback'];
}

const IDLE: VisionState = { status: 'idle', detections: [] };

/** Sends a photo to `/api/vision` and follows its event stream. A new call cancels the previous one. */
export function useVisionDetection() {
  const [state, setState] = useState<VisionState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const detect = useCallback(async (imageDataUrl: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'loading', detections: [] });

    try {
      const form = new FormData();
      form.append('image', await prepareVisionImage(imageDataUrl), 'photo.jpg');
      const res = await fetch('/api/vision', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      let failed = false;
      await readSseStream(res.body, (event, data) => {
        if (event === 'vision_error') {
          failed = true;
          return;
        }
        if (event !== 'vision_detections') return;
        const parsed = VisionDetectionsEventSchema.safeParse(data);
        if (!parsed.success) return;
        const e = parsed.data;
        const moreComing =
          e.phase === 'boxes' && e.source === 'meta' && !e.fallback && e.detections.length > 0;
        setState({
          status: moreComing ? 'refining' : 'ready',
          detections: e.detections,
          source: e.source,
          ...(e.fallback ? { fallback: e.fallback } : {}),
        });
      });
      if (controller.signal.aborted) return;
      setState((prev) =>
        failed && prev.detections.length === 0
          ? { status: 'error', detections: [] }
          : { ...prev, status: prev.status === 'error' ? 'error' : 'ready' }
      );
    } catch {
      if (controller.signal.aborted) return;
      setState({ status: 'error', detections: [] });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  return { ...state, detect, reset };
}
