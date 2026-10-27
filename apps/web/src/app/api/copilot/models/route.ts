import 'server-only';

import { env } from '@/lib/env';
import { MetaLlmProvider, DEFAULT_META_MODEL } from '@/server/copilot/providers/meta';

export async function GET() {
  if (env.LLM_PROVIDER === 'meta' && env.META_API_KEY) {
    const models = await MetaLlmProvider.listModels();
    const activeModel =
      env.META_MODEL && models.includes(env.META_MODEL)
        ? env.META_MODEL
        : models[0] || DEFAULT_META_MODEL;

    return Response.json({
      provider: 'meta',
      activeModel,
      models,
    });
  }

  return Response.json({
    provider: 'mock',
    activeModel: 'mock-deterministic-v1',
    models: ['mock-deterministic-v1'],
  });
}
