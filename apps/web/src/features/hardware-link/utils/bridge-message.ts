import { BridgeMessageSchema, type BridgeMessage, type BridgeState } from '@mitsinjo/engine';

/** Validated bridge message (state or access) from a raw WebSocket payload, or null (malformed, unknown, out of range). */
export function parseBridgeMessage(raw: unknown): BridgeMessage | null {
  if (typeof raw !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = BridgeMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Identity of the engine run a bridge state asks for: same key → no need to re-run. */
export function deviceRunKey(state: BridgeState): string {
  return JSON.stringify([state.scenarioId, state.strategy, state.simHour, state.patch]);
}
