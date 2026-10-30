import { z } from 'zod';

const envSchema = z.object({
  LLM_PROVIDER: z.enum(['meta', 'mock']).default('mock'),
  META_API_KEY: z.string().optional(),
  META_MODEL: z.string().optional(),
  META_BASE_URL: z.string().optional(),
  // Cloudflare R2 Storage
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('mitsinjo-grid-media'),
  R2_PUBLIC_URL: z.string().optional(),
  // Vercel / Neon Database
  DATABASE_URL: z.string().optional(),
});

export const env = envSchema.parse({
  LLM_PROVIDER: process.env.LLM_PROVIDER || 'mock',
  META_API_KEY: process.env.META_API_KEY,
  META_MODEL: process.env.META_MODEL,
  META_BASE_URL: process.env.META_BASE_URL,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'mitsinjo-grid-media',
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
});

/**
 * Browser-visible settings (NEXT_PUBLIC_*, inlined at build). Empty string = unset.
 * NEXT_PUBLIC_BRIDGE_URL: WebSocket of the local scale-model bridge (`make bridge`), e.g. ws://localhost:8787.
 * Unset → the scale-model panel is hidden (production).
 */
export const publicEnv = z
  .object({ NEXT_PUBLIC_BRIDGE_URL: z.string().url().optional() })
  .parse({ NEXT_PUBLIC_BRIDGE_URL: process.env.NEXT_PUBLIC_BRIDGE_URL || undefined });
