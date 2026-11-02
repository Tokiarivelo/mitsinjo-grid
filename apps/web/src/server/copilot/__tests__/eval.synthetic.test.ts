import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { scenarios } from '@mitsinjo/engine';
import { runCopilotLoop, type SseEventName } from '../loop';
import synthetic from './eval.synthetic.json';

const SyntheticEvalSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  expectTool: z.string(),
  expectEvidence: z.boolean(),
});

/**
 * Synthetic evals (M12-T2, D2): generated prompts (Contributor, synthetic only) run through the
 * offline loop. Each must route to its tool and keep the 4-section answer shape. Regenerate with
 * `make gen-evals` (mock) or `make gen-evals-live` (Meta key); the harness stays the gate.
 */
describe('Synthetic copilot evals', () => {
  const items = z.array(SyntheticEvalSchema).parse(synthetic);

  it('has at least one synthetic eval', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  for (const item of items) {
    it(`${item.id}: "${item.prompt}" → ${item.expectTool}`, async () => {
      const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
      const emit = (name: SseEventName, data: Record<string, unknown>) => {
        events.push({ name, data });
      };

      await runCopilotLoop({
        messages: [{ role: 'user', content: item.prompt }],
        input: scenarios.baseline.input,
        emit,
      });

      const tools = events.filter((e) => e.name === 'activity').map((e) => e.data.tool as string);
      expect(tools, `expected tool ${item.expectTool} in [${tools.join(', ')}]`).toContain(
        item.expectTool
      );

      const fullText = events
        .filter((e) => e.name === 'delta')
        .map((e) => e.data.text as string)
        .join('');
      expect(fullText).toContain('### What happened');
      expect(fullText).toContain('### Computed evidence');
      expect(fullText).toContain('### Why it matters');
      expect(fullText).toContain('### Explore next');

      const evidence = events.filter((e) => e.name === 'evidence');
      if (item.expectEvidence) {
        expect(evidence.length).toBeGreaterThan(0);
      }
      expect(events.map((e) => e.name)).toContain('done');
    });
  }
});
