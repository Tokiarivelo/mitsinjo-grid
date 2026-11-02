'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShapeRequest } from './use-object-shape';
import { shapeKey } from './use-object-shape';
import { prepareVisionImage } from '../utils/prepare-image';
import { SHAPE_OUTLINE_MAX } from '@/lib/object-shape';

export interface FacadeData {
  imageUrl: string;
  fileKey: string;
  prompt: string;
  archetype: string;
  detectionId: string;
  source: 'meta' | 'mock';
}

/** What the 3D call needs from a validated facade: the image and its storage key (unique per generation). */
export interface ValidatedFacade {
  url: string;
  key: string;
}

export const validatedFacade = (f?: FacadeData): ValidatedFacade | undefined =>
  f ? { url: f.imageUrl, key: f.fileKey } : undefined;

export interface FacadeState {
  status: 'idle' | 'generating' | 'ready' | 'deleting' | 'error';
  facade?: FacadeData;
  userPrompt: string;
  isValidated: boolean;
  error?: string;
}

const IDLE_STATE: FacadeState = {
  status: 'idle',
  userPrompt: '',
  isValidated: false,
};

export function useFacade2d(
  imageDataUrl: string | null,
  target: ShapeRequest | null,
  sessionId?: string
) {
  const [state, setState] = useState<FacadeState>(IDLE_STATE);
  /** Facades per object of this photo: switching objects shows that object's own facade. */
  const [cache] = useState(() => new Map<string, FacadeData>());
  const abortRef = useRef<AbortController | null>(null);

  // Another object (or photo) → its own facade, never the previous object's one.
  const objectKey = target ? shapeKey(target) : '';
  const [shownFor, setShownFor] = useState({ photo: imageDataUrl, key: objectKey });
  if (shownFor.photo !== imageDataUrl || shownFor.key !== objectKey) {
    if (shownFor.photo !== imageDataUrl) cache.clear();
    setShownFor({ photo: imageDataUrl, key: objectKey });
    const kept = cache.get(objectKey);
    setState(kept ? { ...IDLE_STATE, status: 'ready', facade: kept } : IDLE_STATE);
  }
  // A facade still being imagined for the previous object is dropped.
  useEffect(() => () => abortRef.current?.abort(), [imageDataUrl, objectKey]);

  const generate = useCallback(
    async (extraPrompt?: string) => {
      if (!imageDataUrl || !target) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((s) => ({
        ...s,
        status: 'generating',
        error: undefined,
        userPrompt: extraPrompt !== undefined ? extraPrompt : s.userPrompt,
      }));

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
            ...(target.outline && target.outline.length <= SHAPE_OUTLINE_MAX
              ? { outline: target.outline }
              : {}),
          })
        );
        const promptToSend = extraPrompt !== undefined ? extraPrompt : state.userPrompt;
        if (promptToSend.trim()) {
          form.append('userPrompt', promptToSend.trim());
        }
        if (sessionId) {
          form.append('sessionId', sessionId);
        }

        const res = await fetch('/api/vision/facade', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          ok: boolean;
          imageUrl: string;
          fileKey: string;
          prompt: string;
          archetype: string;
          detectionId: string;
          source: 'meta' | 'mock';
        };

        if (controller.signal.aborted) return;

        const facadeData: FacadeData = {
          imageUrl: data.imageUrl,
          fileKey: data.fileKey,
          prompt: data.prompt,
          archetype: data.archetype,
          detectionId: data.detectionId,
          source: data.source,
        };

        const key = shapeKey(target);
        cache.set(key, facadeData);

        setState((s) => ({
          ...s,
          status: 'ready',
          facade: facadeData,
          error: undefined,
        }));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[useFacade2d] Generation error:', err);
        setState((s) => ({
          ...s,
          status: 'error',
          error: err instanceof Error ? err.message : 'Generation failed',
        }));
      }
    },
    [imageDataUrl, target, sessionId, state.userPrompt, cache]
  );

  const retry = useCallback(
    (extraPrompt?: string) => {
      void generate(extraPrompt);
    },
    [generate]
  );

  const deleteFacade = useCallback(async () => {
    if (!state.facade?.fileKey) return;

    setState((s) => ({ ...s, status: 'deleting' }));

    try {
      const res = await fetch(
        `/api/vision/facade?key=${encodeURIComponent(state.facade.fileKey)}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to delete facade (HTTP ${res.status})`);
      }

      if (target) {
        const key = shapeKey(target);
        cache.delete(key);
      }

      setState({
        status: 'idle',
        facade: undefined,
        userPrompt: '',
        isValidated: false,
      });
    } catch (err) {
      console.error('[useFacade2d] Deletion error:', err);
      setState((s) => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Deletion failed',
      }));
    }
  }, [state.facade, target, cache]);

  const validate = useCallback(() => {
    setState((s) => ({ ...s, isValidated: true }));
  }, []);

  const setUserPrompt = useCallback((prompt: string) => {
    setState((s) => ({ ...s, userPrompt: prompt }));
  }, []);

  const reset = useCallback(() => {
    setState(IDLE_STATE);
  }, []);

  return {
    ...state,
    generate,
    retry,
    deleteFacade,
    validate,
    setUserPrompt,
    reset,
  };
}
