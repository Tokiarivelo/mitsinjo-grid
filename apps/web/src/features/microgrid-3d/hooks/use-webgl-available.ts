import { useSyncExternalStore } from 'react';
import { isWebGLAvailable } from '../utils/webgl';

function subscribeNoop() {
  return () => {};
}

function getServerSnapshot(): boolean {
  return false;
}

/** SSR-safe WebGL capability check (false on the server, real value on the client). */
export function useWebGLAvailable(): boolean {
  return useSyncExternalStore(subscribeNoop, isWebGLAvailable, getServerSnapshot);
}
