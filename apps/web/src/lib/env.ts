import { z } from 'zod';

const envSchema = z.object({
  LLM_PROVIDER: z.enum(['meta', 'mock']).default('mock'),
  META_API_KEY: z.string().optional(),
  META_MODEL: z.string().optional(),
  META_BASE_URL: z.string().optional(),
});

export const env = envSchema.parse({
  LLM_PROVIDER: process.env.LLM_PROVIDER || 'mock',
  META_API_KEY: process.env.META_API_KEY,
  META_MODEL: process.env.META_MODEL,
  META_BASE_URL: process.env.META_BASE_URL,
});
