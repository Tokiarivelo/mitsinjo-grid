import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * May a WebSocket client send commands (cloud, speed)? No bridge token configured → everyone
 * (local use). Otherwise the connection URL must carry `?token=<BRIDGE_TOKEN>`; without it the
 * client still receives the state (read-only viewer).
 */
export function canControl(requestUrl: string | undefined, token: string | undefined): boolean {
  if (!token) return true;
  const given = new URL(requestUrl ?? '/', 'ws://bridge').searchParams.get('token');
  return given !== null && safeEqual(given, token);
}

/** MQTT login check for the embedded broker: open when no credentials are configured. */
export function mqttLoginOk(
  expected: { username?: string; password?: string },
  username: string | undefined,
  password: Buffer | string | undefined
): boolean {
  if (!expected.username) return true;
  return (
    username !== undefined &&
    password !== undefined &&
    safeEqual(username, expected.username) &&
    safeEqual(password.toString(), expected.password ?? '')
  );
}
