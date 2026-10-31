import { useMediaQuery } from '@/lib/use-media-query';

/** Live `prefers-reduced-motion` flag; updates when the OS setting changes. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
