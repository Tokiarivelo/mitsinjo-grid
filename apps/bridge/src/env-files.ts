import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

/** Repo root, from apps/bridge/src. */
const ROOT_DIR = join(__dirname, '..', '..', '..');

/** Env files read by the bridge, highest priority first (same order as the web app's port.mjs). */
export const ENV_FILES = [join(ROOT_DIR, '.env.local'), join(ROOT_DIR, '.env')];

/**
 * Settings seen by the bridge: the shell wins over the files, then files in order.
 * So `HW_TIME_SCALE=4 make bridge` overrides `HW_TIME_SCALE=60` written in .env.
 */
export function mergeEnv(
  shell: Record<string, string | undefined>,
  files: readonly Record<string, string | undefined>[]
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = {};
  for (const file of [...files].reverse()) Object.assign(merged, file);
  for (const [k, v] of Object.entries(shell)) if (v !== undefined) merged[k] = v;
  return merged;
}

/** Shell env + root .env.local / .env (missing or unreadable files are skipped). */
export function readEnv(): Record<string, string | undefined> {
  const files = ENV_FILES.filter((f) => existsSync(f)).flatMap((f) => {
    try {
      return [parseEnv(readFileSync(f, 'utf8'))];
    } catch {
      return [];
    }
  });
  return mergeEnv(process.env, files);
}
