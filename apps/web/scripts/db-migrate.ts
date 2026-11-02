#!/usr/bin/env -S pnpm --filter web exec jiti
/**
 * Applies pending Neon migrations now (`make db-migrate`). The app also applies them by itself
 * on its first database call; this runs them before a deploy or after adding one.
 * Reads DATABASE_URL_UNPOOLED, else DATABASE_URL, else NEON_DATABASE_URL (shell, then root
 * `.env.local` / `.env`). No URL → nothing to migrate (the app uses its in-memory store), exit 0.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { runMigrations } from '../src/server/db/migrations';
import { preferIpv4Fetch } from '../src/server/db/ipv4-fetch';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const file of ['.env.local', '.env']) {
  const path = join(ROOT, file);
  // Shell values win: loadEnvFile never overwrites a variable already set.
  if (existsSync(path)) process.loadEnvFile(path);
}

const url =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!url) {
  console.info('[db:migrate] No DATABASE_URL: nothing to migrate.');
} else {
  preferIpv4Fetch();
  const sql = neon(url);
  const applied = await runMigrations((text, params) => sql.query(text, params ?? []));
  console.info(
    applied.length > 0 ? `[db:migrate] Applied: ${applied.join(', ')}` : '[db:migrate] Up to date.'
  );
}
