'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BridgeClientMessage, BridgeState } from '@mitsinjo/engine';
import { useSimulationStore } from '@/stores';
import { deviceRunKey, parseBridgeMessage } from '../utils/bridge-message';

export type LinkStatus = 'connecting' | 'connected' | 'disconnected';

/** Delay before trying the bridge again after the socket closes. */
export const RECONNECT_MS = 3000;

export interface HardwareLink {
  status: LinkStatus;
  /** Last valid state from the bridge (kept while reconnecting). */
  bridge: BridgeState | null;
  /** The bridge accepts our commands (cloud, speed); false = read-only, token missing or wrong. */
  control: boolean;
  /** The store input follows the scale model (store `source === 'device'`). */
  following: boolean;
  toggleFollow: () => void;
  cloud: boolean;
  toggleCloud: () => void;
  /** Asks the bridge for a new speed (seconds per simulated hour); the next state confirms it. */
  setSpeed: (timeScale: number) => void;
}

/**
 * Connects to the local scale-model bridge over WebSocket (auto-reconnect). While following,
 * every new run asked by the bridge (scenario, measured patch, strategy, hour) is applied to the
 * store, which re-runs the engine: the numbers on screen stay engine output.
 */
/** `url` is the full socket URL (token included, see `bridgeSocketUrl`). */
export function useHardwareLink(url: string | undefined): HardwareLink {
  const [status, setStatus] = useState<LinkStatus>(url ? 'connecting' : 'disconnected');
  const [bridge, setBridge] = useState<BridgeState | null>(null);
  const [cloud, setCloud] = useState(false);
  const [control, setControl] = useState(true);
  const socket = useRef<WebSocket | null>(null);
  const lastRun = useRef('');

  const following = useSimulationStore((s) => s.source === 'device');
  const applyDeviceRun = useSimulationStore((s) => s.applyDeviceRun);
  const releaseDevice = useSimulationStore((s) => s.releaseDevice);

  useEffect(() => {
    if (!url) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      setStatus('connecting');
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => setStatus('connected');
      ws.onmessage = (event: MessageEvent) => {
        const msg = parseBridgeMessage(event.data);
        if (msg?.type === 'state') setBridge(msg.state);
        else if (msg?.type === 'access') setControl(msg.control);
      };
      ws.onclose = () => {
        // A socket closed late (React dev remount, reconnect) must not drop the live one.
        if (socket.current === ws) socket.current = null;
        if (disposed) return;
        setStatus('disconnected');
        retry = setTimeout(connect, RECONNECT_MS);
      };
    };
    connect();

    return () => {
      disposed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [url]);

  useEffect(() => {
    if (!following) {
      lastRun.current = '';
      return;
    }
    if (!bridge) return;
    const key = deviceRunKey(bridge);
    if (key === lastRun.current) return;
    lastRun.current = key;
    applyDeviceRun(bridge);
  }, [following, bridge, applyDeviceRun]);

  const toggleFollow = useCallback(() => {
    if (following) releaseDevice();
    else if (bridge) applyDeviceRun(bridge);
  }, [following, bridge, applyDeviceRun, releaseDevice]);

  const send = useCallback(
    (msg: BridgeClientMessage): boolean => {
      const ws = socket.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !control) return false;
      ws.send(JSON.stringify(msg));
      return true;
    },
    [control]
  );

  const toggleCloud = useCallback(() => {
    const next = !cloud;
    if (send({ type: 'cloud', on: next })) setCloud(next);
  }, [cloud, send]);

  const setSpeed = useCallback(
    (timeScale: number) => void send({ type: 'speed', timeScale }),
    [send]
  );

  return { status, bridge, control, following, toggleFollow, cloud, toggleCloud, setSpeed };
}
