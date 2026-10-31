import { useCallback, useEffect, useRef, type RefObject } from 'react';

/**
 * Keeps a scroll box on its newest content while the reader is at the bottom (within 80 px);
 * scrolling up to read stops it until they come back down or `stick()` is called (a new question).
 */
export function useStickToBottom(ref: RefObject<HTMLElement | null>, deps: readonly unknown[]) {
  const stuck = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (el) stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, [ref]);

  const stick = useCallback(() => {
    stuck.current = true;
  }, []);

  return { onScroll, stick };
}
