'use client';

import { useCallback, useState, type SetStateAction } from 'react';
import { create } from 'zustand';

/** Scope of the /village studio: its photo, objects, 2D and 3D outlive a visit to another page. */
export const VILLAGE_SCOPE = 'village';

const keptValues = create<{ values: Record<string, unknown> }>(() => ({ values: {} }));
const keptRefs = new Map<string, { current: unknown }>();
const NONE = Symbol('none');

/**
 * `useState` that, given a `scope`, lives in a module store instead of the component: it survives
 * an unmount (navigating away and back). No scope = plain `useState`. Not saved across reloads.
 */
export function useKeptState<T>(scope: string | undefined, key: string, initial: T | (() => T)) {
  const [start] = useState<T>(initial);
  const [local, setLocal] = useState<T>(start);
  const id = scope ? `${scope}:${key}` : null;
  const kept = keptValues((s) => (id && id in s.values ? s.values[id] : NONE));
  const value = id && kept !== NONE ? (kept as T) : local;

  const set = useCallback(
    (next: SetStateAction<T>) => {
      if (!id) return setLocal(next);
      keptValues.setState((s) => {
        const prev = id in s.values ? (s.values[id] as T) : start;
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        return v === prev ? s : { values: { ...s.values, [id]: v } };
      });
    },
    [id, start]
  );
  return [value, set] as const;
}

/** `useRef` that, given a `scope`, is shared by every mount of that scope (see `useKeptState`). */
export function useKeptRef<T>(scope: string | undefined, key: string, init: () => T) {
  const [ref] = useState(() => {
    if (!scope) return { current: init() };
    const id = `${scope}:${key}`;
    let kept = keptRefs.get(id);
    if (!kept) {
      kept = { current: init() };
      keptRefs.set(id, kept);
    }
    return kept;
  });
  return ref as { current: T };
}

/** Forgets everything kept (tests). */
export function clearKeptState() {
  keptValues.setState({ values: {} });
  keptRefs.clear();
}
