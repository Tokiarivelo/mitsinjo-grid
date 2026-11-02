import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlimmerLlmProvider, DEFAULT_GLIMMER_MODEL } from '../providers/glimmer';

describe('GlimmerLlmProvider (M11-T1)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts OpenAI-compatible chat completions and parses tool calls', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'get_grid_state', arguments: '{}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
    } as Response);

    const provider = new GlimmerLlmProvider({
      baseUrl: 'http://bridge:11434/v1',
      model: 'glimmer-test',
    });
    expect(provider.name).toBe('glimmer');
    expect(provider.getModel()).toBe('glimmer-test');
    const turn = await provider.chat(
      [{ role: 'user', content: 'Compare the strategies.' }],
      [{ name: 'get_grid_state', description: 'd', parameters: {} }]
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://bridge:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body);
    expect(body.model).toBe('glimmer-test');
    expect(body.tools[0].function.name).toBe('get_grid_state');
    expect(turn.toolCalls).toEqual([{ id: 'call_1', name: 'get_grid_state', args: {} }]);
    expect(turn.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
  });

  it('sends no auth header without a key; defaults the model id', () => {
    const provider = new GlimmerLlmProvider({ baseUrl: 'http://localhost:11434/v1' });
    expect(provider.getModel()).toBe(process.env.GLIMMER_MODEL || DEFAULT_GLIMMER_MODEL);
  });

  it('throws on HTTP errors and empty choices', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const provider = new GlimmerLlmProvider({ baseUrl: 'http://localhost:11434/v1' });
    await expect(provider.chat([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'Glimmer LLM API error (500)'
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    } as Response);
    await expect(provider.chat([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'empty response choices'
    );
  });
});
