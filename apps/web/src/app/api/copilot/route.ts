import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { SimulationInputSchema } from '@mitsinjo/engine';
import { env } from '@/lib/env';
import { runCopilotLoop } from '@/server/copilot/loop';
import { MockLlmProvider } from '@/server/copilot/providers/mock';
import { MetaLlmProvider, isCopilotModel } from '@/server/copilot/providers/meta';

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
        content: z.string().min(1).max(2000),
      })
    )
    .min(1),
  input: SimulationInputSchema,
  strategy: z.enum(['proportional', 'essential_first', 'balanced']).optional(),
  model: z.string().max(64).refine(isCopilotModel).optional(),
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
  const provider =
    env.LLM_PROVIDER === 'meta' && env.META_API_KEY
      ? new MetaLlmProvider({ model: chosenModel })
      : new MockLlmProvider();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: Record<string, unknown>) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        await runCopilotLoop({
          messages: parsed.data.messages,
          input: parsed.data.input,
          strategy: parsed.data.strategy,
          provider,
          emit,
          signal: req.signal,
        });
      } catch (err) {
        emit('error', {
          code: 'UNHANDLED_ERROR',
          message: err instanceof Error ? err.message : 'Internal streaming error',
        });
        emit('done', {});
      } finally {
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
