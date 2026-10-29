import { useEffect, useState, type RefObject } from 'react';

/**
 * True while the element is (even partly) on screen. Used to pause the 3D frame loop
 * when the canvas is scrolled away. Without IntersectionObserver it stays true.
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = '64px'): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}
