/** Where the web app finds the scale-model bridge, and the token that lets it send commands. */
export interface BridgeTarget {
  url: string;
  token?: string;
}

/** Session key: the target chosen by a `?bridge=` link survives navigation in this tab only. */
export const BRIDGE_STORAGE_KEY = 'mitsinjo_bridge';
/** Query parameters read once, then removed from the address bar (the token must not linger). */
export const BRIDGE_PARAM = 'bridge';
export const BRIDGE_TOKEN_PARAM = 'bridgeToken';
/** `?bridge=off` forgets the stored target. */
export const BRIDGE_OFF = 'off';

/** Only WebSocket URLs are accepted (a link cannot point the app at http or javascript URLs). */
export function parseBridgeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'ws:' || u.protocol === 'wss:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Reads a stored target; anything malformed counts as none. */
export function parseStoredTarget(raw: string | null): BridgeTarget | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<BridgeTarget>;
    const url = parseBridgeUrl(data.url);
    if (!url) return null;
    return typeof data.token === 'string' && data.token ? { url, token: data.token } : { url };
  } catch {
    return null;
  }
}

export interface ResolvedTarget {
  target: BridgeTarget | null;
  /** New value to store (`null` = clear), or undefined to leave storage as it is. */
  persist?: BridgeTarget | null;
}

/**
 * Picks the bridge for this tab: a `?bridge=` link wins (and is stored), then the stored one,
 * then `NEXT_PUBLIC_BRIDGE_URL`. No target → the scale-model panel stays hidden.
 */
export function resolveBridgeTarget(
  search: string,
  stored: BridgeTarget | null,
  envUrl: string | undefined
): ResolvedTarget {
  const params = new URLSearchParams(search);
  const fallback = envUrl ? { url: envUrl } : null;
  const param = params.get(BRIDGE_PARAM);
  if (param === BRIDGE_OFF) return { target: fallback, persist: null };
  const url = parseBridgeUrl(param);
  if (url) {
    const token = params.get(BRIDGE_TOKEN_PARAM) || undefined;
    const target = token ? { url, token } : { url };
    return { target, persist: target };
  }
  return { target: stored ?? fallback };
}

/** Query string without the bridge parameters (for `history.replaceState`), or null if unchanged. */
export function stripBridgeParams(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has(BRIDGE_PARAM) && !params.has(BRIDGE_TOKEN_PARAM)) return null;
  params.delete(BRIDGE_PARAM);
  params.delete(BRIDGE_TOKEN_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/** WebSocket URL to open: the token travels as `?token=` (browsers cannot set WebSocket headers). */
export function bridgeSocketUrl(target: BridgeTarget): string {
  if (!target.token) return target.url;
  const u = new URL(target.url);
  u.searchParams.set('token', target.token);
  return u.toString();
}
