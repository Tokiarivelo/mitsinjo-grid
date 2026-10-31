'use client';

import { useCallback, useEffect, useState } from 'react';
import { useVisionDetection } from './use-vision-detection';

/**
 * Detection for one photo: runs when `imageUrl` changes (null = nothing), keeps the selected
 * appliance for that photo only. Shared by the chat dialog and the /village page.
 */
export function useVisionSession(imageUrl: string | null) {
  const vision = useVisionDetection();
  const { detect, reset } = vision;
  const [selection, setSelection] = useState<{ image: string; id: string } | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    void detect(imageUrl);
    return reset;
  }, [imageUrl, detect, reset]);

  const selectedId = imageUrl && selection?.image === imageUrl ? selection.id : null;
  const selected = vision.detections.find((d) => d.id === selectedId) ?? null;

  const select = useCallback(
    (id: string) => {
      if (imageUrl) setSelection({ image: imageUrl, id });
    },
    [imageUrl]
  );
  const retry = useCallback(() => {
    if (imageUrl) void detect(imageUrl);
  }, [imageUrl, detect]);

  return { ...vision, selectedId, selected, select, retry };
}
