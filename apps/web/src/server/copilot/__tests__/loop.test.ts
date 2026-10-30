import { describe, it, expect, vi } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import { runCopilotLoop, type SseEventName } from '../loop';
import type { ChatMessage, LlmProvider } from '../provider';
import { SpendGuard } from '@/server/spend';
import { MockPerceptionBackend, PerceptionClient } from '@/server/perception';

describe('Copilot Loop (P6-T3)', () => {
  const baseInput = scenarios.baseline.input;

  it('runs complete loop with mock provider, emitting activity, evidence, delta, and done', async () => {
    const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
    const emit = (name: SseEventName, data: Record<string, unknown>) => {
      events.push({ name, data });
    };

    await runCopilotLoop({
      messages: [{ role: 'user', content: 'What happens if solar drops 40 % for 2 hours?' }],
      input: baseInput,
      emit,
    });

    const eventNames = events.map((e) => e.name);
    expect(eventNames).toContain('activity');
    expect(eventNames).toContain('evidence');
    expect(eventNames).toContain('delta');
    expect(eventNames).toContain('done');

    // Verify activity label
    const activity = events.find((e) => e.name === 'activity');
    expect(activity?.data.label).toBeDefined();
    // UI translates from `tool`, never shows the English label.
    expect(
      events.filter((e) => e.name === 'activity').every((e) => typeof e.data.tool === 'string')
    ).toBe(true);

    // Verify evidence has resultId and numeric fields
    const evidence = events.find((e) => e.name === 'evidence');
    expect(evidence?.data.resultId).toMatch(/^SIM-/);
    expect(evidence?.data.fields).toBeDefined();

    // Verify delta contains markdown sections
    const deltas = events
      .filter((e) => e.name === 'delta')
      .map((e) => e.data.text)
      .join('');
    expect(deltas).toContain('### What happened');
    expect(deltas).toContain('### Computed evidence');
    expect(deltas).toContain('### Why it matters');
    expect(deltas).toContain('### Explore next');
  });

  it('falls back to mock provider if primary provider throws', async () => {
    const failingProvider: LlmProvider = {
      name: 'failing-meta',
      chat: vi.fn().mockRejectedValue(new Error('Meta API rate limit exceeded')),
    };

    const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
    const emit = (name: SseEventName, data: Record<string, unknown>) => {
      events.push({ name, data });
    };

    await runCopilotLoop({
      messages: [{ role: 'user', content: 'Compare the strategies.' }],
      input: baseInput,
      provider: failingProvider,
      emit,
    });

    const errorEvent = events.find((e) => e.name === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.data.code).toBe('PROVIDER_FALLBACK');

    // Should still succeed with mock fallback
    const eventNames = events.map((e) => e.name);
    expect(eventNames).toContain('evidence');
    expect(eventNames).toContain('done');
  });

  it('stops if maximum tool rounds exceeded', async () => {
    let callCount = 0;
    const infiniteToolProvider: LlmProvider = {
      name: 'infinite-loop',
      chat: vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          toolCalls: [{ id: `call_${callCount}`, name: 'get_grid_state', args: {} }],
        };
      }),
    };

    const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
    const emit = (name: SseEventName, data: Record<string, unknown>) => {
      events.push({ name, data });
    };

    await runCopilotLoop({
      messages: [{ role: 'user', content: 'Test infinite loop' }],
      input: baseInput,
      provider: infiniteToolProvider,
      emit,
    });

    // Max rounds is 4
    expect(callCount).toBeLessThanOrEqual(4);
    expect(events.map((e) => e.name)).toContain('done');
  });

  it('falls back to a text answer when the explicitly chosen image model fails', async () => {
    const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
    const chatModels: string[] = [];
    const provider: LlmProvider & { setModel: (m: string) => void } = {
      name: 'fake',
      setModel: (m) => chatModels.push(m),
      chat: async () => ({ content: 'Text answer instead of an image.' }),
      generateImage: async () => {
        throw new Error('image model down');
      },
    };

    await runCopilotLoop({
      messages: [{ role: 'user', content: 'Generate an image of the solar array' }],
      input: baseInput,
      provider,
      emit: (name, data) => events.push({ name, data }),
      availableModels: ['muse-spark-1.3', 'muse-image-1.0'],
      requestedModel: 'muse-image-1.0',
    });

    const names = events.map((e) => e.name);
    expect(names).not.toContain('image');
    expect(events.find((e) => e.name === 'error')?.data.code).toBe('PROVIDER_FALLBACK');
    expect(names).toContain('delta');
    expect(names[names.length - 1]).toBe('done');
    // The chat fallback must not keep the image model selected.
    expect(chatModels).toEqual(['muse-spark-1.3']);
  });

  describe('spend cap and automatic model switch (PM-M0)', () => {
    const collect = () => {
      const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
      return {
        events,
        emit: (name: SseEventName, data: Record<string, unknown>) => events.push({ name, data }),
      };
    };
    const paidProvider = (): LlmProvider => ({
      name: 'meta',
      chat: vi.fn().mockResolvedValue({
        content: 'ok',
        usage: { inputTokens: 1000, outputTokens: 100 },
      }),
    });

    it('records the chat cost of a paid provider per session', async () => {
      const guard = new SpendGuard(1);
      const { emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: 'Explain the grid' }],
        input: baseInput,
        provider: paidProvider(),
        emit,
        budgetKey: 's1',
        spendGuard: guard,
      });
      // 1000 × 1.25 $/M + 100 × 4.25 $/M
      expect(guard.spentUsd('s1')).toBeCloseTo(0.001675, 6);
    });

    it('switches to the deterministic mock once the cap is reached', async () => {
      const provider = paidProvider();
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: 'What happens if solar drops 40 % for 2 hours?' }],
        input: baseInput,
        provider,
        emit,
        budgetKey: 's1',
        spendGuard: new SpendGuard(0),
      });
      expect(provider.chat).not.toHaveBeenCalled();
      expect(events.find((e) => e.name === 'error')?.data).toMatchObject({
        code: 'PROVIDER_FALLBACK',
        reason: 'spend_cap',
      });
      expect(events.at(-1)?.name).toBe('done');
    });

    it('lets Spark switch to SAM through the segment_image tool call', async () => {
      const perception = new PerceptionClient(
        null,
        new MockPerceptionBackend(),
        new SpendGuard(1),
        's1'
      );
      const provider: LlmProvider = {
        name: 'meta',
        chat: vi
          .fn()
          .mockResolvedValueOnce({
            toolCalls: [{ id: 't1', name: 'segment_image', args: { concept: 'solar panel' } }],
          })
          .mockResolvedValueOnce({ content: 'Deux panneaux détectés (perception IA).' }),
      };
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [
          {
            role: 'user',
            content: 'Il y a combien de modules PV là-dessus ?',
            media: [{ type: 'image', url: 'data:image/png;base64,AA' }],
          },
        ],
        input: baseInput,
        provider,
        emit,
        locale: 'fr',
        availableModels: ['muse-spark-1.3', 'sam-3.1'],
        spendGuard: new SpendGuard(1),
        perception,
      });
      expect(events.find((e) => e.name === 'model')?.data.modality).toBe('vision');
      expect(events.some((e) => e.name === 'activity' && e.data.tool === 'segment_image')).toBe(
        true
      );
      expect(events.find((e) => e.name === 'perception')?.data).toMatchObject({
        kind: 'segment',
        concept: 'solar panel',
        count: 2,
      });
      // The segmentation result goes back to Spark, which writes the answer.
      const history = (provider.chat as ReturnType<typeof vi.fn>).mock.calls[1]![0];
      expect(history).toContainEqual(
        expect.objectContaining({ role: 'tool', name: 'segment_image' })
      );
      expect(events.at(-1)?.name).toBe('done');
    });

    it('switches the rest of the turn to Wonder through escalate_deep_reasoning', async () => {
      const setModel = vi.fn();
      const provider = {
        name: 'meta',
        setModel,
        chat: vi
          .fn()
          .mockResolvedValueOnce({
            toolCalls: [
              { id: 't1', name: 'escalate_deep_reasoning', args: { reason: 'week plan' } },
            ],
          })
          .mockResolvedValueOnce({ content: 'Plan.' }),
      };
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: 'Prépare la semaine' }],
        input: baseInput,
        provider,
        emit,
        availableModels: ['muse-spark-1.3', 'muse-wonder-1.0'],
        spendGuard: new SpendGuard(1),
      });
      expect(setModel).toHaveBeenLastCalledWith('muse-wonder-1.0');
      const models = events.filter((e) => e.name === 'model').map((e) => e.data.model);
      expect(models).toEqual(['muse-spark-1.3', 'muse-wonder-1.0']);
    });

    it('offline mock: photo + count words → segment_image → AI perception answer', async () => {
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [
          {
            role: 'user',
            content: 'Combien de maisons sur cette photo ?',
            media: [{ type: 'image', url: 'data:image/png;base64,AA' }],
          },
        ],
        input: baseInput,
        emit,
        locale: 'fr',
        perception: new PerceptionClient(null, new MockPerceptionBackend(), new SpendGuard(1), 's'),
      });
      const text = events
        .filter((e) => e.name === 'delta')
        .map((e) => e.data.text)
        .join('');
      expect(text).toContain('2 × « house »');
      expect(text).toContain('Perception IA');
    });

    it('offline mock: image request → generate_image → image event', async () => {
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: 'Génère une image du village le soir' }],
        input: baseInput,
        emit,
        locale: 'fr',
      });
      expect(events.find((e) => e.name === 'image')?.data.imageUrl).toMatch(/^data:image\/svg/);
    });

    it('answers about an attached photo with the vision chat model', async () => {
      const provider = { ...paidProvider(), setModel: vi.fn() };
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [
          {
            role: 'user',
            content: 'Analyse cette photo',
            media: [{ type: 'image', url: 'data:image/png;base64,AA' }],
          },
        ],
        input: baseInput,
        provider,
        emit,
        availableModels: ['muse-spark-1.3', 'muse-image-1.0'],
        spendGuard: new SpendGuard(1),
      });
      expect(events.find((e) => e.name === 'model')?.data.modality).toBe('vision');
      expect(provider.setModel).toHaveBeenCalledWith('muse-spark-1.3');
      expect(provider.chat).toHaveBeenCalled();
    });

    it('does not count a slow image tool against the chat budget, and draws the shown hour', async () => {
      const provider: LlmProvider = {
        name: 'meta',
        chat: vi
          .fn()
          .mockResolvedValueOnce({
            toolCalls: [{ id: 't1', name: 'generate_image', args: { scene: 'current_village' } }],
          })
          .mockResolvedValueOnce({ content: 'Voici le village.' }),
        generateImage: vi.fn(
          (prompt: string) =>
            new Promise<{ imageUrl: string }>((resolve) =>
              setTimeout(
                () => resolve({ imageUrl: `data:image/webp;base64,${prompt.length}` }),
                120
              )
            )
        ),
      };
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: 'Montre-moi le village maintenant' }],
        input: baseInput,
        provider,
        emit,
        locale: 'fr',
        hour: 2,
        chatBudgetMs: 60,
        spendGuard: new SpendGuard(1),
      });
      expect(events.some((e) => e.name === 'image')).toBe(true);
      expect(events.find((e) => e.name === 'error')).toBeUndefined();
      expect(String(events.find((e) => e.name === 'image')?.data.caption)).toContain('à 2 h');
      const prompt = (provider.generateImage as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(prompt).toContain('starry sky');
      expect(events.at(-1)?.name).toBe('done');
    });

    it('offline mock: "montre-moi le village" → picture of the current state', async () => {
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: "Montre-moi l'état du village" }],
        input: baseInput,
        emit,
        locale: 'fr',
        hour: 20,
      });
      expect(String(events.find((e) => e.name === 'image')?.data.caption)).toContain('à 20 h');
    });
  });

  describe('fallback reasons, retry and auto-compaction', () => {
    const collect = () => {
      const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
      return {
        events,
        emit: (name: SseEventName, data: Record<string, unknown>) => events.push({ name, data }),
      };
    };

    it('retries once on a transient error (5xx) without falling back', async () => {
      const chat = vi
        .fn()
        .mockRejectedValueOnce(new Error('Meta LLM API error (503): busy'))
        .mockResolvedValueOnce({ content: 'Answer from Meta.' });
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: 'Hello' }],
        input: baseInput,
        provider: { name: 'meta', chat },
        emit,
        spendGuard: new SpendGuard(100),
      });
      expect(chat).toHaveBeenCalledTimes(2);
      expect(events.some((e) => e.name === 'error')).toBe(false);
      expect(events.find((e) => e.name === 'delta')?.data.text).toBe('Answer from Meta.');
    });

    it('a provider error falls back with reason provider_error (no retry on 4xx)', async () => {
      const chat = vi.fn().mockRejectedValue(new Error('Meta LLM API error (400): bad'));
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: 'Compare the strategies.' }],
        input: baseInput,
        provider: { name: 'meta', chat },
        emit,
        spendGuard: new SpendGuard(100),
      });
      expect(chat).toHaveBeenCalledTimes(1);
      expect(events.find((e) => e.name === 'error')?.data).toMatchObject({
        code: 'PROVIDER_FALLBACK',
        reason: 'provider_error',
      });
      expect(events.at(-1)?.name).toBe('done');
    });

    it('a slow model past the chat budget falls back with reason timeout and still answers', async () => {
      const chat = vi.fn(
        (_m: unknown, _t: unknown, signal?: AbortSignal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('aborted')));
          })
      );
      const { events, emit } = collect();
      await runCopilotLoop({
        messages: [{ role: 'user', content: 'Compare the strategies.' }],
        input: baseInput,
        provider: { name: 'meta', chat } as LlmProvider,
        emit,
        chatBudgetMs: 30,
        spendGuard: new SpendGuard(100),
      });
      expect(events.find((e) => e.name === 'error')?.data.reason).toBe('timeout');
      expect(events.some((e) => e.name === 'delta')).toBe(true);
      expect(events.some((e) => e.data.code === 'LOOP_ERROR')).toBe(false);
    });

    it('folds a long history into a summary and sends it as a system note', async () => {
      // Long operator messages (answers are already cut to 600 chars) → over the token limit.
      const messages = Array.from({ length: 12 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: i % 2 === 0 ? `question ${i} ${'x'.repeat(4500)}` : 'short answer',
      }));
      messages.push({ role: 'user', content: 'Compare the strategies.' });
      const { events, emit } = collect();
      await runCopilotLoop({ messages, input: baseInput, emit, summarizedCount: 3 });
      const summary = events.find((e) => e.name === 'summary')?.data;
      expect(summary?.summarizedCount).toBe(3 + messages.length - 6);
      expect(String(summary?.text)).toContain('- Operator: question 0');
      expect(events.some((e) => e.name === 'activity' && e.data.tool === 'compact_history')).toBe(
        true
      );
    });

    it('a failed summary keeps the hard cut and still answers', async () => {
      const messages = Array.from({ length: 13 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: i % 2 === 0 ? `Compare the strategies. ${'x'.repeat(3900)}` : 'short answer',
      }));
      const chat = vi
        .fn()
        .mockRejectedValueOnce(new Error('Meta LLM API error (400): summary failed'))
        .mockImplementation((history: { role: string }[]) => {
          // Hard cut: system prompt + last 8 messages, no summary note.
          expect(history.filter((m) => m.role === 'system')).toHaveLength(1);
          expect(history).toHaveLength(1 + 8);
          return Promise.resolve({ content: 'ok' });
        });
      const { events, emit } = collect();
      await runCopilotLoop({
        messages,
        input: baseInput,
        provider: { name: 'meta', chat },
        emit,
        spendGuard: new SpendGuard(100),
      });
      expect(events.some((e) => e.name === 'summary')).toBe(false);
      expect(events.find((e) => e.name === 'delta')?.data.text).toBe('ok');
    });
  });

  it('sends the app hour as a system note only when the client gives it (M1-T3, K2)', async () => {
    const seen: string[][] = [];
    const provider: LlmProvider = {
      name: 'fake',
      chat: vi.fn(async (msgs: ChatMessage[]) => {
        seen.push(msgs.filter((m) => m.role === 'system').map((m) => m.content ?? ''));
        return { content: 'ok' };
      }),
    };
    const emit = () => {};
    const messages = [{ role: 'user' as const, content: 'Coupe le marché maintenant' }];
    await runCopilotLoop({ messages, input: baseInput, provider, emit, hour: 9 });
    await runCopilotLoop({ messages, input: baseInput, provider, emit });
    expect(seen[0]?.some((c) => c.includes('fromHour=9'))).toBe(true);
    expect(seen[1]?.some((c) => c.includes('fromHour='))).toBe(false);
  });
});
