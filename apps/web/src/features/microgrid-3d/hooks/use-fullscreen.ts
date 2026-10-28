import { type RefObject, useCallback, useEffect, useState } from 'react';

/** Fullscreen toggle for one element (the 3D viewport card). */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const supported =
    typeof document !== 'undefined' &&
    typeof document.documentElement?.requestFullscreen === 'function';

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === ref.current && ref.current !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void el.requestFullscreen?.().catch(() => {
        // Denied (iframe policy, user gesture): stay in the card.
      });
    }
  }, [ref]);

  return { isFullscreen, toggle, supported };
}
