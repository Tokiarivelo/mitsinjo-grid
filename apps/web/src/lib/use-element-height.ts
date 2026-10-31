import { useEffect, useState } from 'react';

/**
 * Live border-box height (px) of an element; 0 while it is not mounted.
 * Pass `ref` as the element's callback ref.
 */
export function useElementHeight(): { ref: (node: HTMLElement | null) => void; height: number } {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!node) return;
    const measure = () => setHeight(node.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      setHeight(0);
    };
  }, [node]);
  return { ref: setNode, height };
}
