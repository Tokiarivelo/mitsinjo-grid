// Single source for the web app port.
// Order: shell `PORT` → apps/web/.env.local → apps/web/.env → root .env.local → root .env → 3000.
// Usage:
//   node scripts/port.mjs            # prints the port (used by the Makefile)
//   node scripts/port.mjs dev|start  # runs `next dev|start -p <port>` (used by package.json)
//   import { resolvePort } from './port.mjs'  # other ESM scripts (scene-audit.mjs)
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_DIR = join(WEB_DIR, '..', '..');
const ENV_FILES = [
  join(WEB_DIR, '.env.local'),
  join(WEB_DIR, '.env'),
  join(ROOT_DIR, '.env.local'),
  join(ROOT_DIR, '.env'),
];
export const DEFAULT_PORT = 3000;

/** @returns {number} */
export function resolvePort() {
  const candidates = [process.env.PORT];
  for (const file of ENV_FILES) {
    if (existsSync(file)) candidates.push(parseEnv(readFileSync(file, 'utf8')).PORT);
  }
  for (const value of candidates) {
    const port = Number(value);
    if (value && Number.isInteger(port) && port > 0 && port < 65536) return port;
  }
  return DEFAULT_PORT;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const [command, ...rest] = process.argv.slice(2);
  const port = resolvePort();
  if (!command) {
    process.stdout.write(`${port}\n`); // plain text: console.log colors numbers under FORCE_COLOR
  } else {
    const child = spawn('next', [command, '-p', String(port), ...rest], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code, signal) =>
      signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)
    );
  }
}
