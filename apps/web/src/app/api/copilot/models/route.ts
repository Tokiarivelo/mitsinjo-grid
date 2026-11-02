import 'server-only';

import { env } from '@/lib/env';
import { MetaLlmProvider, DEFAULT_META_MODEL } from '@/server/copilot/providers/meta';
import { DEFAULT_GLIMMER_MODEL } from '@/server/copilot/providers/glimmer';
import { MOCK_MODEL_ID } from '@/server/copilot/providers/mock';

export async function GET() {
  const hasMetaKey = Boolean(env.META_API_KEY);
  console.info(
    `[copilot:models] GET /api/copilot/models — config: LLM_PROVIDER="${env.LLM_PROVIDER}", META_API_KEY=${hasMetaKey ? 'present' : 'missing'}, META_MODEL="${env.META_MODEL || DEFAULT_META_MODEL}"`
  );

  if (env.LLM_PROVIDER === 'meta' && env.META_API_KEY) {
    const rawModels = await MetaLlmProvider.listModels();
    const models = ['auto', ...rawModels.filter((m) => m !== 'auto')];
    // The picker always starts on Auto (adaptive); META_MODEL is the chat model Auto uses.
    const activeModel = 'auto';

    console.info(
      `[copilot:models] Serving provider="meta", activeModel="${activeModel}", models=[${models.join(', ')}]`
    );

    return Response.json({
      provider: 'meta',
      activeModel,
      models,
    });
  }

  if (env.LLM_PROVIDER === 'glimmer' && env.GLIMMER_BASE_URL) {
    const glimmerModel = env.GLIMMER_MODEL || DEFAULT_GLIMMER_MODEL;
    console.info(`[copilot:models] Serving provider="glimmer", models=[auto, ${glimmerModel}]`);
    return Response.json({
      provider: 'glimmer',
      activeModel: 'auto',
      models: ['auto', glimmerModel],
    });
  }

  const reason =
    env.LLM_PROVIDER === 'glimmer'
      ? 'GLIMMER_BASE_URL is not configured'
      : env.LLM_PROVIDER !== 'meta'
        ? `LLM_PROVIDER="${env.LLM_PROVIDER}" (expected "meta")`
        : 'META_API_KEY is not configured';

  console.info(`[copilot:models] Serving provider="mock", activeModel="auto" (reason: ${reason})`);

  return Response.json({
    provider: 'mock',
    activeModel: 'auto',
    models: ['auto', MOCK_MODEL_ID],
  });
}
