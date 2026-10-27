import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}

function getSnapshot(): boolean {
  return new URLSearchParams(window.location.search).get('perf') === '1';
}

function getServerSnapshot(): boolean {
  return false;
}

/** True when the URL has `?perf=1`: shows the 3D draw-call / fps readout. */
export function usePerfFlag(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
