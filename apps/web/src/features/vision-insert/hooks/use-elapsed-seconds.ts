'use client';

import { useEffect, useState } from 'react';

/** Whole seconds since `startedAt` (`Date.now()` value), ticking once a second while `active`. */
export function useElapsedSeconds(startedAt: number | undefined, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || startedAt === undefined) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);
  return active && startedAt !== undefined ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}
