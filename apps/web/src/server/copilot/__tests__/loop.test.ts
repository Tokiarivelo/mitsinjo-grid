import { describe, it, expect, vi } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import { runCopilotLoop, type SseEventName } from '../loop';
import type { LlmProvider } from '../provider';
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
  });
});
