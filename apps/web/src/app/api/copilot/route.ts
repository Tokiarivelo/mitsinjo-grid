import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { SimulationInputSchema } from '@mitsinjo/engine';
import { env } from '@/lib/env';
import { runCopilotLoop } from '@/server/copilot/loop';
import { MockLlmProvider, MOCK_MODEL_ID } from '@/server/copilot/providers/mock';
import {
  MetaLlmProvider,
  isCopilotModel,
  DEFAULT_META_MODEL,
} from '@/server/copilot/providers/meta';
import { saveMessage } from '@/server/db/neon';
import type { CopilotEvidence, CopilotProposal, ChatChartData } from '@/features/copilot/types';

// In-memory rate limiter: max 30 requests per minute per client
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 30;

  // Cleanup old entries
  if (rateLimitMap.size > 1000) {
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

const RequestBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000).default(''),
        media: z
          .array(
            z.object({
              type: z.enum(['image', 'video']),
              url: z.string().min(1),
            })
          )
          .optional(),
      })
    )
    .min(1),
  input: SimulationInputSchema,
  strategy: z.enum(['proportional', 'essential_first', 'balanced']).optional(),
  model: z
    .string()
    .max(64)
    .refine((id) => id === 'auto' || id === MOCK_MODEL_ID || isCopilotModel(id))
    .optional(),
  locale: z.enum(['en', 'fr', 'mg']).optional(),
  sessionId: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please wait a moment before trying again.',
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to read request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(bodyText);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = RequestBodySchema.safeParse(rawJson);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body schema',
        details: parsed.error.issues,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Choose provider: Meta if configured, otherwise Mock
  const chosenModel = parsed.data.model || env.META_MODEL;
  const isMetaConfigured = env.LLM_PROVIDER === 'meta' && Boolean(env.META_API_KEY);
  const provider = isMetaConfigured
    ? new MetaLlmProvider({ model: chosenModel })
    : new MockLlmProvider();

  console.info(
    `[copilot:chat] POST /api/copilot — provider: "${provider.name}", model: "${chosenModel || 'default'}", messages: ${parsed.data.messages.length}, strategy: "${parsed.data.strategy || 'proportional'}"`
  );

  if (!isMetaConfigured && env.LLM_PROVIDER === 'meta') {
    console.warn(
      `[copilot:chat] LLM_PROVIDER is "meta" but META_API_KEY is missing. Using MockLlmProvider fallback.`
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let streamedAssistantContent = '';
      let detectedModel: string | undefined;
      let collectedProposal: CopilotProposal | undefined = undefined;
      const collectedEvidence: CopilotEvidence[] = [];
      let collectedChart: ChatChartData | undefined = undefined;

      const emit = (event: string, data: Record<string, unknown>) => {
        if (event === 'delta') {
          streamedAssistantContent += (data.text as string) || '';
        } else if (event === 'model') {
          detectedModel = data.model as string;
        } else if (event === 'evidence') {
          collectedEvidence.push(data as unknown as CopilotEvidence);
        } else if (event === 'proposal') {
          collectedProposal = data as unknown as CopilotProposal;
        } else if (event === 'chart') {
          collectedChart = data as unknown as ChatChartData;
        }

        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        const availableModels = isMetaConfigured
          ? await MetaLlmProvider.listModels().catch(() => [DEFAULT_META_MODEL])
          : [MOCK_MODEL_ID];

        await runCopilotLoop({
          messages: parsed.data.messages,
          input: parsed.data.input,
          strategy: parsed.data.strategy,
          provider,
          emit,
          signal: req.signal,
          locale: parsed.data.locale || 'fr',
          requestedModel: parsed.data.model,
          availableModels,
        });
      } catch (err) {
        emit('error', {
          code: 'UNHANDLED_ERROR',
          message: err instanceof Error ? err.message : 'Internal streaming error',
        });
        emit('done', {});
      } finally {
        if (parsed.data.sessionId) {
          const lastUser = parsed.data.messages[parsed.data.messages.length - 1];
          if (lastUser && lastUser.role === 'user') {
            await saveMessage(parsed.data.sessionId, {
              id: `user-${Date.now()}`,
              role: 'user',
              content: lastUser.content,
              media: lastUser.media?.map((m, idx) => ({
                id: `m-${idx}`,
                url: m.url,
                type: m.type,
              })),
            }).catch(() => {});
          }
          if (streamedAssistantContent.trim()) {
            await saveMessage(parsed.data.sessionId, {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: streamedAssistantContent,
              detectedModel,
              evidence: collectedEvidence.length > 0 ? collectedEvidence : undefined,
              proposal: collectedProposal,
              chart: collectedChart,
            }).catch(() => {});
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
