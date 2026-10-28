import { describe, it, expect, vi } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import { runCopilotLoop, type SseEventName } from '../loop';
import type { LlmProvider } from '../provider';

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

  it('falls back to a text answer when image generation fails', async () => {
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
    });

    const names = events.map((e) => e.name);
    expect(names).not.toContain('image');
    expect(events.find((e) => e.name === 'error')?.data.code).toBe('PROVIDER_FALLBACK');
    expect(names).toContain('delta');
    expect(names[names.length - 1]).toBe('done');
    // The chat fallback must not keep the image model selected.
    expect(chatModels).toEqual(['muse-spark-1.3']);
  });
});
