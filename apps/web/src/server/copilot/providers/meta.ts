import 'server-only';

import { env } from '@/lib/env';
import type { LlmProvider, ChatMessage, ToolDefinition, LlmTurn, ToolCall } from '../provider';

export const DEFAULT_META_MODEL = 'muse-spark-1.3';
export const DEFAULT_META_BASE_URL = 'https://api.meta.ai/v1';

/**
 * Models the copilot may use: Muse Spark standard, Muse Wonder (deep reasoning),
 * and Muse Image (visual generation). Excludes SAM, voice transcribe, and contributor ids.
 */
export function isCopilotModel(id: string): boolean {
  return /^muse-spark-\d+(\.\d+)*$/.test(id) || id === 'muse-wonder-1.0' || id === 'muse-image-1.0';
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
      console.warn(
        `[copilot:meta] listModels: No API key provided, falling back to [${fallbackModel}]`
      );
      return [fallbackModel];
    }

    const url = `${base}/models`;
    console.info(`[copilot:meta] Fetching available models list from: ${url}`);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        signal,
      });

      if (!res.ok) {
        const errorText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
        console.warn(
          `[copilot:meta] Models list HTTP error (${res.status}): ${errorText}. Using fallback: [${fallbackModel}]`
        );
        return [fallbackModel];
      }

      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
        console.warn(
          `[copilot:meta] Models list returned empty array. Using fallback: [${fallbackModel}]`
        );
        return [fallbackModel];
      }

      const allIds = json.data
        .map((m) => m.id)
        .filter((id): id is string => typeof id === 'string');
      const models = allIds.filter((id) => isCopilotModel(id));

      console.info(
        `[copilot:meta] Upstream models found (${allIds.length}): [${allIds.join(', ')}]`
      );
      console.info(
        `[copilot:meta] Copilot-compatible models filtered (${models.length}): [${models.join(', ')}]`
      );

      return models.length > 0 ? models : [fallbackModel];
    } catch (err) {
      console.error(
        `[copilot:meta] Failed to fetch models list from ${url}:`,
        err instanceof Error ? err.message : err
      );
      return [fallbackModel];
    }
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<LlmTurn> {
    if (!this.apiKey) {
      console.error('[copilot:meta] chat() aborted: META_API_KEY is not configured in environment');
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

      if (m.media && m.media.length > 0) {
        const imageItems = m.media.filter((med) => med.type === 'image');
        if (imageItems.length > 0) {
          const parts: Array<
            { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
          > = [{ type: 'text', text: m.content || '' }];

          for (const item of imageItems) {
            parts.push({
              type: 'image_url',
              image_url: { url: item.url },
            });
          }

          return {
            role: m.role,
            content: parts,
          };
        }
      }

      return {
        role: m.role,
        content: m.content || '',
      };
    });

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const queryPreview = lastUserMsg?.content
      ? `"${lastUserMsg.content.slice(0, 50).replace(/\n/g, ' ')}..."`
      : '(no user message)';

    console.info(
      `[copilot:meta] Calling Meta API ${url} (model: "${this.model}", messages: ${formattedMessages.length}, tools: ${formattedTools.length}, query: ${queryPreview})`
    );

    const startTime = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
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
    } catch (networkErr) {
      const elapsedMs = Date.now() - startTime;
      console.error(
        `[copilot:meta] Network error calling ${url} after ${elapsedMs}ms:`,
        networkErr instanceof Error ? networkErr.message : networkErr
      );
      throw networkErr;
    }

    const elapsedMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
      console.error(
        `[copilot:meta] API error ${res.status} ${res.statusText || ''} after ${elapsedMs}ms: ${errorText}`
      );
      throw new Error(`Meta LLM API error (${res.status}): ${errorText}`);
    }

    console.info(`[copilot:meta] Received 200 OK from Meta API in ${elapsedMs}ms`);

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
      console.error('[copilot:meta] Meta LLM returned empty response choices:', data);
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
      console.info(
        `[copilot:meta] Meta response generated ${toolCalls.length} tool call(s): [${toolCalls.map((tc) => tc.name).join(', ')}]`
      );
    } else {
      console.info(
        `[copilot:meta] Meta response generated text answer (${msg.content?.length || 0} chars)`
      );
    }

    return {
      content: msg.content ?? null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async generateImage(
    prompt: string,
    signal?: AbortSignal
  ): Promise<{ imageUrl: string; caption?: string }> {
    if (!this.apiKey) {
      console.error('[copilot:meta] generateImage aborted: META_API_KEY is not configured');
      throw new Error('META_API_KEY is not configured in environment');
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/responses`;
    console.info(
      `[copilot:meta] Requesting image from ${url} with muse-image-1.0 for: "${prompt.slice(0, 60)}..."`
    );

    const startTime = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'muse-image-1.0',
          input: prompt,
        }),
        signal,
      });
    } catch (networkErr) {
      const elapsedMs = Date.now() - startTime;
      console.error(
        `[copilot:meta] Network error calling ${url} after ${elapsedMs}ms:`,
        networkErr
      );
      throw networkErr;
    }

    const elapsedMs = Date.now() - startTime;
    if (!res.ok) {
      const errorText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
      console.error(
        `[copilot:meta] Image API error ${res.status} after ${elapsedMs}ms: ${errorText}`
      );
      throw new Error(`Meta Image API error (${res.status}): ${errorText}`);
    }

    console.info(`[copilot:meta] Image generated successfully by Meta API in ${elapsedMs}ms`);

    interface MetaResponsesPayload {
      output?: Array<{
        type: string;
        result?: string;
        summary?: Array<{ text?: string }>;
      }>;
    }

    const data = (await res.json()) as MetaResponsesPayload;
    let base64Image: string | undefined;
    let caption: string | undefined;

    for (const item of data.output || []) {
      if (item.type === 'image_generation_call' && item.result) {
        base64Image = item.result;
      }
      if (item.type === 'reasoning' && item.summary?.[0]?.text) {
        caption = item.summary[0].text;
      }
    }

    if (!base64Image) {
      console.error('[copilot:meta] Meta API did not return an image result', data);
      throw new Error('Meta Image API did not return image data');
    }

    return {
      imageUrl: `data:image/webp;base64,${base64Image}`,
      caption,
    };
  }
}
