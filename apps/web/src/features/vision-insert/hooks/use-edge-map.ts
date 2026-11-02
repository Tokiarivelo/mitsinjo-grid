'use client';

import { useEffect, useState } from 'react';
import { buildEdgeMap, EDGE_MAP_SIDE, type EdgeMap } from '../utils/edge-map';

export type EdgeMapState =
  { status: 'off' | 'loading' | 'unavailable' } | { status: 'ready'; map: EdgeMap };

/**
 * Edges of the photo for the magnetic lasso, computed in the browser on a ≤ 320 px copy when
 * `enabled`. The canvas can be blocked or blanked (privacy settings): then `unavailable` and the
 * lasso draws freely.
 */
export function useEdgeMap(imageUrl: string, enabled: boolean): EdgeMapState {
  const [state, setState] = useState<{ url: string; value: EdgeMapState } | null>(null);

  useEffect(() => {
    if (!enabled || state?.url === imageUrl) return;
    let cancelled = false;
    const done = (value: EdgeMapState) => !cancelled && setState({ url: imageUrl, value });
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, EDGE_MAP_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(3, Math.round(img.naturalWidth * scale));
        const h = Math.max(3, Math.round(img.naturalHeight * scale));
        const ctx = Object.assign(document.createElement('canvas'), {
          width: w,
          height: h,
        }).getContext('2d');
        if (!ctx) return done({ status: 'unavailable' });
        ctx.drawImage(img, 0, 0, w, h);
        const map = buildEdgeMap(ctx.getImageData(0, 0, w, h).data, w, h);
        done(map.max > 0 ? { status: 'ready', map } : { status: 'unavailable' });
      } catch {
        done({ status: 'unavailable' });
      }
    };
    img.onerror = () => done({ status: 'unavailable' });
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [enabled, imageUrl, state?.url]);

  if (!enabled) return { status: 'off' };
  return state?.url === imageUrl ? state.value : { status: 'loading' };
}
