'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  BRIDGE_STORAGE_KEY,
  parseStoredTarget,
  resolveBridgeTarget,
  stripBridgeParams,
  type BridgeTarget,
} from '../utils/bridge-target';

/** Fired after the link was stored and removed from the address bar. */
const CHANGE_EVENT = 'mitsinjo:bridge-target';
/** Used when sessionStorage is blocked (private mode): the link still works until reload. */
let memoryRaw: string | null = null;

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(BRIDGE_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function writeStored(target: BridgeTarget | null): void {
  memoryRaw = target ? JSON.stringify(target) : null;
  try {
    if (memoryRaw) window.sessionStorage.setItem(BRIDGE_STORAGE_KEY, memoryRaw);
    else window.sessionStorage.removeItem(BRIDGE_STORAGE_KEY);
  } catch {
    /* storage blocked: memoryRaw keeps it for this page */
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Address-bar query + stored target, as one comparable string. */
const getSnapshot = () => `${window.location.search}\n${readRaw() ?? ''}`;
const getServerSnapshot = () => null;

/**
 * Bridge chosen at runtime: `?bridge=wss://…&bridgeToken=…` link → kept for this tab
 * (sessionStorage), else `envUrl`; `?bridge=off` forgets it. The bridge parameters are then removed
 * from the address bar. Server render → null, so the panel only appears in the browser.
 */
export function useBridgeTarget(envUrl: string | undefined): BridgeTarget | null {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const resolved = useMemo(() => {
    if (snapshot === null) return null;
    const cut = snapshot.indexOf('\n');
    return resolveBridgeTarget(
      snapshot.slice(0, cut),
      parseStoredTarget(snapshot.slice(cut + 1) || null),
      envUrl
    );
  }, [snapshot, envUrl]);

  useEffect(() => {
    if (!resolved) return;
    if (resolved.persist !== undefined) writeStored(resolved.persist);
    const { search, pathname, hash } = window.location;
    const cleaned = stripBridgeParams(search);
    if (cleaned !== null) {
      window.history.replaceState(window.history.state, '', `${pathname}${cleaned}${hash}`);
    }
    if (resolved.persist !== undefined || cleaned !== null) {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  }, [resolved]);

  return resolved?.target ?? null;
}
