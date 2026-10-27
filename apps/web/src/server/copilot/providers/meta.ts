import 'server-only';

import { env } from '@/lib/env';
import type { LlmProvider, ChatMessage, ToolDefinition, LlmTurn, ToolCall } from '../provider';

export const DEFAULT_META_MODEL = 'muse-spark-1.3';
export const DEFAULT_META_BASE_URL = 'https://api.meta.ai/v1';

/**
 * Chat + tool-calling models the copilot may use: Muse Spark, standard mode only.
 * Excludes image/voice/SAM models (no chat tools) and `-contributor` ids (inputs may train Meta models).
 */
export function isCopilotModel(id: string): boolean {
  return /^muse-spark-\d+(\.\d+)*$/.test(id);
}

export class MetaLlmProvider implements LlmProvider {
  readonly name = 'meta';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private model: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = options?.apiKey || env.META_API_KEY || '';
    this.baseUrl = options?.baseUrl || env.META_BASE_URL || DEFAULT_META_BASE_URL;
    this.model = options?.model || env.META_MODEL || DEFAULT_META_MODEL;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string) {
    if (model) {
      this.model = model;
    }
  }

  /**
   * Fetches available models from Meta Developer API per
   * https://dev.meta.ai/docs/api-reference/models/list-models
   * Fallback to env.META_MODEL if not available or on error.
   */
  static async listModels(
    apiKey?: string,
    baseUrl?: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    const key = apiKey || env.META_API_KEY || '';
    const base = (baseUrl || env.META_BASE_URL || DEFAULT_META_BASE_URL).replace(/\/$/, '');
    const fallbackModel = env.META_MODEL || DEFAULT_META_MODEL;

    if (!key) {
      return [fallbackModel];
    }

    try {
      const res = await fetch(`${base}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        signal,
      });

      if (!res.ok) {
        return [fallbackModel];
      }

      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
        return [fallbackModel];
      }

      const models = json.data
        .map((m) => m.id)
        .filter((id): id is string => typeof id === 'string' && isCopilotModel(id));

      return models.length > 0 ? models : [fallbackModel];
    } catch {
      return [fallbackModel];
    }
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<LlmTurn> {
    if (!this.apiKey) {
      throw new Error('META_API_KEY is not configured in environment');
    }

    // Format tools for OpenAI-compatible endpoint
    const formattedTools = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    // Format messages for OpenAI-compatible endpoint
    const formattedMessages = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content || '',
        };
      }

      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          })),
        };
      }

      return {
        role: m.role,
        content: m.content || '',
      };
    });

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: formattedMessages,
        tools: formattedTools.length > 0 ? formattedTools : undefined,
        temperature: 0.2,
      }),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Meta LLM API error (${res.status}): ${errorText}`);
    }

    interface OpenAiResponse {
      choices: {
        message: {
          role: string;
          content?: string | null;
          tool_calls?: {
            id: string;
            type: string;
            function: {
              name: string;
              arguments: string;
            };
          }[];
        };
      }[];
    }

    const data = (await res.json()) as OpenAiResponse;
    const choice = data.choices?.[0];
    if (!choice || !choice.message) {
      throw new Error('Meta LLM returned empty response choices');
    }

    const msg = choice.message;
    const toolCalls: ToolCall[] = [];

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          args = {};
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          args,
        });
      }
    }

    return {
      content: msg.content ?? null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
