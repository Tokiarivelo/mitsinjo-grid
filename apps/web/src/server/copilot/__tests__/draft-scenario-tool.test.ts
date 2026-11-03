import { describe, it, expect } from 'vitest';
import { executeTool } from '../tools';
import { scenarios } from '@mitsinjo/engine';
import { MockLlmProvider } from '../providers/mock';
import { TOOL_DEFINITIONS } from '../tools';

describe('draft_scenario Copilot Tool (PA-T8d)', () => {
  const baseInput = scenarios.baseline.input;

  it('extracts target example and returns incomplete draft with 1 missing slot', () => {
    const result = executeTool(
      'draft_scenario',
      {
        text: 'jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau temps + école en feu',
      },
      { input: baseInput }
    );

    expect(result.toolName).toBe('draft_scenario');
    expect(result.scenarioDraft).toBeDefined();
    expect(result.scenarioDraft?.isComplete).toBe(false);
    expect(result.scenarioDraft?.draft.days).toHaveLength(3);
    expect(result.scenarioDraft?.missingSlots).toHaveLength(1);
    expect(result.scenarioDraft?.missingSlots[0]?.kind).toBe('missing_fire_hour');
    expect(result.evidence?.draftDaysCount).toBe(3);
    expect(result.evidence?.draftMissingSlotsCount).toBe(1);
  });

  it('evaluates complete draft and returns engine preview metrics', () => {
    const result = executeTool(
      'draft_scenario',
      {
        draft: {
          days: [
            { day: 1, weather: 'sunny' },
            { day: 2, weather: 'rainy' },
            {
              day: 3,
              weather: 'sunny',
              events: [
                {
                  type: 'fire',
                  sector: 'school',
                  startHour: 10,
                  durationH: 14,
                },
              ],
            },
          ],
        },
      },
      { input: baseInput }
    );

    expect(result.toolName).toBe('draft_scenario');
    expect(result.scenarioDraft?.isComplete).toBe(true);
    expect(result.scenarioDraft?.missingSlots).toHaveLength(0);
    expect(result.scenarioDraft?.preview).toBeDefined();
    expect(typeof result.scenarioDraft?.preview?.totalDeficitKwh).toBe('number');
    expect(typeof result.scenarioDraft?.preview?.worstDay).toBe('number');
    expect(result.evidence?.draftTotalDeficitKwh).toBeDefined();
  });

  it('mock provider detects multi-day scenario and invokes draft_scenario tool', async () => {
    const provider = new MockLlmProvider({ locale: 'fr' });
    const turn1 = await provider.chat(
      [
        {
          role: 'user',
          content: 'jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau temps + école en feu',
        },
      ],
      TOOL_DEFINITIONS
    );

    expect(turn1.toolCalls).toBeDefined();
    expect(turn1.toolCalls?.[0]?.name).toBe('draft_scenario');

    // Execute tool
    const toolResult = executeTool(turn1.toolCalls![0]!.name, turn1.toolCalls![0]!.args, {
      input: baseInput,
    });

    // Second turn with tool result
    const turn2 = await provider.chat(
      [
        {
          role: 'user',
          content: 'jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau temps + école en feu',
        },
        {
          role: 'assistant',
          content: '',
          toolCalls: turn1.toolCalls,
        },
        {
          role: 'tool',
          name: 'draft_scenario',
          toolCallId: turn1.toolCalls![0]!.id,
          content: JSON.stringify(toolResult.data),
        },
      ],
      TOOL_DEFINITIONS
    );

    expect(turn2.content).toContain('incendie');
    expect(turn2.content).toContain('jour 3');
  });
});
