import 'server-only';

import { env } from '@/lib/env';
import type { LlmProvider, ChatMessage, ToolDefinition, LlmTurn, ToolCall } from '../provider';

export const DEFAULT_GLIMMER_MODEL = 'muse-glimmer-30b';
export const DEFAULT_GLIMMER_BASE_URL = 'http://localhost:11434/v1';

/** The local step exists only when the operator points at a server (unset = Meta → mock). */
export function isGlimmerConfigured(): boolean {
  return Boolean(env.GLIMMER_BASE_URL);
}

interface OpenAiChatResponse {
  choices?: {
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: {
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }[];
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Local Glimmer (M11-T1): OpenAI-compatible chat completions (vLLM, Ollama, …) on the
 * operator's machine or the bridge PC. Text only — attached media is dropped, the words stay.
 * Free, so the loop never bills it and the spend cap never gates it.
 */
export class GlimmerLlmProvider implements LlmProvider {
  readonly name = 'glimmer';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private model: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = options?.apiKey ?? env.GLIMMER_API_KEY ?? '';
    this.baseUrl = options?.baseUrl ?? env.GLIMMER_BASE_URL ?? DEFAULT_GLIMMER_BASE_URL;
    this.model = options?.model ?? env.GLIMMER_MODEL ?? DEFAULT_GLIMMER_MODEL;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string) {
    if (model) {
      this.model = model;
    }
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<LlmTurn> {
    const formattedTools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    const formattedMessages = messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content || '' };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        };
      }
      return { role: m.role, content: m.content || '' };
    });

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          tools: formattedTools.length > 0 ? formattedTools : undefined,
          temperature: 0.2,
        }),
        signal,
      });
    } catch (networkErr) {
      console.error(
        '[copilot:glimmer] Network error calling',
        url,
        networkErr instanceof Error ? networkErr.message : networkErr
      );
      throw networkErr;
    }

    if (!res.ok) {
      const errorText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
      console.error(`[copilot:glimmer] API error (${res.status}): ${errorText}`);
      throw new Error(`Glimmer LLM API error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const msg = data.choices?.[0]?.message;
    if (!msg) {
      console.error('[copilot:glimmer] Empty response choices:', data);
      throw new Error('Glimmer LLM returned empty response choices');
    }

    const toolCalls: ToolCall[] = [];
    for (const tc of msg.tool_calls ?? []) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
      } catch {
        console.warn('[copilot:glimmer] Unparseable tool args, using {}:', tc.function.arguments);
      }
      toolCalls.push({ id: tc.id, name: tc.function.name, args });
    }
    return {
      content: msg.content ?? null,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      ...(data.usage
        ? {
            usage: {
              inputTokens: data.usage.prompt_tokens ?? 0,
              outputTokens: data.usage.completion_tokens ?? 0,
            },
          }
        : {}),
    };
  }
}
