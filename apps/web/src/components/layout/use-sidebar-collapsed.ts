'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Browser-only preference: the desktop sidebar folded to an icon rail. */
export const SIDEBAR_COLLAPSED_KEY = 'mitsinjo_sidebar_collapsed';
const CHANGE_EVENT = 'mitsinjo-sidebar-collapsed';

/** In-memory copy, used once storage refused a write (private mode, quota). */
let fallback = false;
let storageBlocked = false;

function read(): boolean {
  if (storageBlocked) return fallback;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return fallback;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Desktop sidebar folded or not, remembered in this browser. Server render = expanded; the saved
 * choice applies once hydrated. Storage blocked → still works, just not remembered.
 */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);

  const toggle = useCallback(() => {
    const next = !read();
    fallback = next;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Not remembered, still toggled (in-memory copy).
      storageBlocked = true;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { collapsed, toggle };
}
