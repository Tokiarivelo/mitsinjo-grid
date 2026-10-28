import type { SimulationInput, StrategyId } from './schemas';

/**
 * Deterministically serialize a JavaScript value to canonical JSON.
 * Object keys are sorted alphabetically at every nesting level.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries: string[] = [];
  for (const k of keys) {
    const val = (obj as Record<string, unknown>)[k];
    if (val !== undefined) {
      if ((k === 'sectorCaps' || k === 'meterReadings') && Array.isArray(val) && val.length === 0) {
        continue;
      }
      entries.push(JSON.stringify(k) + ':' + canonicalJson(val));
    }
  }

  return '{' + entries.join(',') + '}';
}

const FNV_PRIME_64 = 0x100000001b3n;
const FNV_OFFSET_64 = 0xcbf29ce484222325n;

/**
 * 64-bit FNV-1a hash formatted as 16 lowercase hex characters.
 */
export function fnv1a64(str: string): string {
  let hash = FNV_OFFSET_64;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * FNV_PRIME_64) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Compute deterministic hash of simulation input.
 */
export function computeInputHash(input: SimulationInput): string {
  return fnv1a64(canonicalJson(input));
}

/**
 * Compute stable result ID: 'SIM-' + first 6 hex characters of hash(inputHash + strategy).
 */
export function computeResultId(inputHash: string, strategy: StrategyId): string {
  const composite = fnv1a64(`${inputHash}:${strategy}`);
  return `SIM-${composite.slice(0, 6).toUpperCase()}`;
}
