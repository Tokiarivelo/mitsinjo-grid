#!/usr/bin/env -S pnpm --filter web exec jiti
/**
 * Synthetic eval generator (M12-T2, D2): Contributor writes N synthetic copilot eval prompts
 * (tool-routing checks); every item is schema-validated before it is written, and the committed
 * harness (`src/server/copilot/__tests__/eval.synthetic.test.ts`) runs each one through the
 * offline loop, asserting the expected tool + the 4-section answer shape.
 *
 * Usage:
 *   pnpm --filter web exec jiti scripts/gen-evals.ts [--live] [--count N]
 * `--mock` (default) writes the deterministic templates — no key needed. `--live` asks Meta
 * (META_API_KEY, model muse-spark-1.2-contributor: −95 %, synthetic data only — Contributor
 * trains on inputs, so NEVER send real user data). Never writes invalid output.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'server', 'copilot', '__tests__', 'eval.synthetic.json');

const SyntheticEvalSchema = z.object({
  id: z.string().regex(/^syn-\d+$/),
  prompt: z.string().min(10).max(300),
  expectTool: z.enum([
    'get_grid_state',
    'run_scenario',
    'compare_strategies',
    'get_battery_story',
    'simulate_week',
    'get_sector_metrics',
    'get_incidents',
    'propose_change',
  ]),
  /** The answer must carry computed evidence (false for pure proposals/reads with no numbers). */
  expectEvidence: z.boolean(),
});
export type SyntheticEval = z.infer<typeof SyntheticEvalSchema>;

/** Deterministic templates for `--mock` (and the committed samples). Must pass the harness. */
const MOCK_TEMPLATES: SyntheticEval[] = [
  {
    id: 'syn-1',
    prompt: 'What happens if solar drops 40 % for 2 hours?',
    expectTool: 'run_scenario',
    expectEvidence: true,
  },
  {
    id: 'syn-2',
    prompt: 'Compare the strategies.',
    expectTool: 'compare_strategies',
    expectEvidence: true,
  },
  {
    id: 'syn-3',
    prompt: 'Why does the clinic get less energy?',
    expectTool: 'get_sector_metrics',
    expectEvidence: true,
  },
  {
    id: 'syn-4',
    prompt: 'What is the current state of the grid?',
    expectTool: 'get_grid_state',
    expectEvidence: true,
  },
  {
    id: 'syn-5',
    prompt: 'Cut the market tonight from 18:00 to 22:00.',
    expectTool: 'propose_change',
    expectEvidence: true,
  },
  {
    id: 'syn-6',
    prompt: 'What happens if solar drops 50 % for 3 hours this afternoon?',
    expectTool: 'run_scenario',
    expectEvidence: true,
  },
  {
    id: 'syn-7',
    prompt: 'Why does the water pump get less energy in the evening?',
    expectTool: 'get_sector_metrics',
    expectEvidence: true,
  },
  {
    id: 'syn-8',
    prompt: 'Compare the strategies for the clinic.',
    expectTool: 'compare_strategies',
    expectEvidence: true,
  },
  {
    id: 'syn-9',
    prompt: 'Plan the week with rain on Tuesday and market day Thursday.',
    expectTool: 'simulate_week',
    expectEvidence: true,
  },
  {
    id: 'syn-10',
    prompt: 'Why was the battery empty at 3am?',
    expectTool: 'get_battery_story',
    expectEvidence: true,
  },
  {
    id: 'syn-11',
    prompt: 'Was there an incident at the market today?',
    expectTool: 'get_incidents',
    expectEvidence: false,
  },
  {
    id: 'syn-12',
    prompt: 'Limit the factory to 2 kW during the day.',
    expectTool: 'propose_change',
    expectEvidence: true,
  },
];

const SYSTEM = `You write synthetic copilot eval prompts as strict JSON. Reply with ONE JSON array only, no fences.
Each item: {"id": "syn-<n>", "prompt": "<10-300 chars, a villager/operator question>",
"expectTool": one of get_grid_state|run_scenario|compare_strategies|get_battery_story|simulate_week|get_sector_metrics|get_incidents|propose_change,
"expectEvidence": true when the answer must cite computed engine numbers, false for pure reads/proposals}.
Cover every tool at least once. Questions must be answerable from a simulated microgrid (solar, battery, 6 sectors).
SYNTHETIC ONLY: invent generic situations, never personal data.`;

async function generateLive(count: number): Promise<SyntheticEval[]> {
  const apiKey = process.env.META_API_KEY;
  if (!apiKey) throw new Error('META_API_KEY is required for --live');
  const base = (process.env.META_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'muse-spark-1.2-contributor',
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content:
              `Write ${count} synthetic evals.` +
              (lastError ? ` Previous reply was invalid: ${lastError}. Fix it.` : ''),
          },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`Meta API error (${res.status})`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (!match?.[0]) throw new Error('No JSON array in the reply');
      return z.array(SyntheticEvalSchema).min(1).parse(JSON.parse(match[0]));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`Live generation failed twice: ${lastError}`);
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const countIdx = args.indexOf('--count');
  const count = countIdx >= 0 ? Number(args[countIdx + 1] ?? '') : MOCK_TEMPLATES.length;
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new Error('--count must be an integer 1..500');
  }

  const items = live
    ? await generateLive(count)
    : z.array(SyntheticEvalSchema).parse(MOCK_TEMPLATES.slice(0, count));
  writeFileSync(OUT, `${JSON.stringify(items, null, 2)}\n`);
  console.log(`[gen-evals] wrote ${items.length} evals to ${OUT}`);
}

await main();
