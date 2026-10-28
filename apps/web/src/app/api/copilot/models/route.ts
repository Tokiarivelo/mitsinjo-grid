import 'server-only';

import { env } from '@/lib/env';
import { MetaLlmProvider, DEFAULT_META_MODEL } from '@/server/copilot/providers/meta';
import { MOCK_MODEL_ID } from '@/server/copilot/providers/mock';

export async function GET() {
  const hasMetaKey = Boolean(env.META_API_KEY);
  console.info(
    `[copilot:models] GET /api/copilot/models — config: LLM_PROVIDER="${env.LLM_PROVIDER}", META_API_KEY=${hasMetaKey ? 'present' : 'missing'}, META_MODEL="${env.META_MODEL || DEFAULT_META_MODEL}"`
  );

  if (env.LLM_PROVIDER === 'meta' && env.META_API_KEY) {
    const rawModels = await MetaLlmProvider.listModels();
    const models = ['auto', ...rawModels.filter((m) => m !== 'auto')];
    const activeModel = env.META_MODEL && models.includes(env.META_MODEL) ? env.META_MODEL : 'auto';

    console.info(
      `[copilot:models] Serving provider="meta", activeModel="${activeModel}", models=[${models.join(', ')}]`
    );

    return Response.json({
      provider: 'meta',
      activeModel,
      models,
    });
  }

  const reason =
    env.LLM_PROVIDER !== 'meta'
      ? `LLM_PROVIDER="${env.LLM_PROVIDER}" (expected "meta")`
      : 'META_API_KEY is not configured';

  console.info(`[copilot:models] Serving provider="mock", activeModel="auto" (reason: ${reason})`);

  return Response.json({
    provider: 'mock',
    activeModel: 'auto',
    models: ['auto', MOCK_MODEL_ID],
  });
}
