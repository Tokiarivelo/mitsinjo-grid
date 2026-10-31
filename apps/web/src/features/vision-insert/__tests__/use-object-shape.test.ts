import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ObjectShape, ShapeTarget } from '@/lib/object-shape';
vi.mock('../utils/prepare-image', () => ({
  prepareVisionImage: vi.fn(async () => new Blob([new Uint8Array(4)], { type: 'image/jpeg' })),
}));

import { useObjectShape } from '../index';

const target: ShapeTarget = {
  id: 'det-1',
  label: 'Fridge',
  category: 'fridge',
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.6 },
};
const recipeShape: ObjectShape = {
  detectionId: 'det-1',
  mode: 'recipe',
  recipe: {
    proportions: { w: 0.5, h: 1, d: 0.5 },
    parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#eeeeee', front: true }],
  },
  source: 'meta',
  model: 'muse-spark-1.3',
};

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('useObjectShape (PV-T9)', () => {
  it('posts the photo and target, then holds the recipe', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(recipeShape)));
    const { result } = renderHook(() => useObjectShape());
    expect(result.current.status).toBe('idle');
    act(() => {
      void result.current.requestShape('data:image/png;base64,AA', target, 's1');
    });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.shape).toEqual(recipeShape);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/vision/shape');
    const body = init.body as FormData;
    expect(JSON.parse(body.get('target') as string)).toEqual(target);
    expect(body.get('sessionId')).toBe('s1');
  });

  it('falls back to the silhouette on a network error, an HTTP error or a bad reply', async () => {
    for (const answer of [
      () => fetchMock.mockRejectedValueOnce(new Error('offline')),
      () => fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 })),
      () => fetchMock.mockResolvedValueOnce(new Response('{"mode":"cube"}')),
    ]) {
      answer();
      const { result } = renderHook(() => useObjectShape());
      await act(() => result.current.requestShape('data:image/png;base64,AA', target));
      expect(result.current).toMatchObject({
        status: 'ready',
        shape: { detectionId: 'det-1', mode: 'silhouette', reason: 'provider_error' },
      });
    }
  });

  it('reset goes back to idle', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(recipeShape)));
    const { result } = renderHook(() => useObjectShape());
    await act(() => result.current.requestShape('data:image/png;base64,AA', target));
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
  });
});
