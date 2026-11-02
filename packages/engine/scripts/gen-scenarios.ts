#!/usr/bin/env -S pnpm --filter @mitsinjo/engine exec jiti
/**
 * Scenario generator (M12-T2, D1): Spark 1.2 writes new engine scenarios as JSON overlays on
 * baseline; every output is Zod-validated before it is written, and the committed harness
 * (`src/__tests__/generated.test.ts`) simulates each one on all strategies.
 *
 * Usage:
 *   pnpm --filter @mitsinjo/engine exec jiti scripts/gen-scenarios.ts [--live] [--only <id>]
 * `--mock` (default) writes the deterministic templates — no key needed. `--live` asks Meta
 * (META_API_KEY, model muse-spark-1.2) and retries once per brief on invalid JSON.
 * Never writes invalid output: a failed brief aborts with a non-zero exit, files untouched.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GeneratedScenarioSchema, type GeneratedScenario } from '../src/scenarios/generated-schema';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'scenarios', 'generated');

interface Brief {
  id: string;
  brief: string;
}

const BRIEFS: Brief[] = [
  {
    id: 'rainy_season',
    brief:
      'Rainy season day: thick clouds most of the day (strong solar drop 9:00–15:00), ' +
      'battery starting at 40 %. The village should suffer unserved energy under proportional.',
  },
  {
    id: 'cyclone',
    brief:
      'Cyclone day: near-dark sky 8:00–17:00 (solar factor 0.15) while every sector spikes ' +
      'demand 17:00–22:00 (factor 1.2, everyone home). Battery starts at 50 %. ' +
      'Heavy unserved energy (> 50 kWh under proportional); without a lifeline floor even ' +
      'essential-first sheds critical load (critical unserved > 0).',
  },
  {
    id: 'village_festival',
    brief:
      'Village festival: normal sun, but a big evening demand spike on all sectors 18:00–24:00 ' +
      '(factor 1.8, lights and music). Battery starts at 60 %. ' +
      'The grid holds (unserved 0 under proportional) but the battery drains (socMin below 40).',
  },
];

/** Deterministic templates for `--mock` (and the committed samples). Must satisfy the schema. */
const MOCK_TEMPLATES: GeneratedScenario[] = [
  {
    id: 'rainy_season',
    title: 'Rainy season day',
    description: 'Thick clouds 9:00–15:00 (solar ×0.3), battery starting at 40 %.',
    base: 'baseline',
    events: [{ type: 'solar_drop', startHour: 9, durationH: 6, factor: 0.3 }],
    battery: { initialSocPct: 40 },
    assertions: [
      { strategy: 'proportional', metric: 'unservedKwh', op: 'gt', value: 0 },
      { strategy: 'balanced', metric: 'criticalUnservedKwh', op: 'lt', value: 8 },
    ],
  },
  {
    id: 'cyclone',
    title: 'Cyclone day',
    description:
      'Near-dark sky 8:00–17:00 (solar ×0.15), all-sector demand spike 17:00–22:00 (×1.2).',
    base: 'baseline',
    events: [
      { type: 'solar_drop', startHour: 8, durationH: 9, factor: 0.15 },
      { type: 'demand_spike', sector: 'all', startHour: 17, durationH: 5, factor: 1.2 },
    ],
    battery: { initialSocPct: 50 },
    assertions: [
      { strategy: 'proportional', metric: 'unservedKwh', op: 'gt', value: 50 },
      { strategy: 'essential_first', metric: 'criticalUnservedKwh', op: 'gt', value: 0 },
    ],
  },
  {
    id: 'village_festival',
    title: 'Village festival',
    description: 'Normal sun, big evening spike on all sectors 18:00–24:00 (×1.8).',
    base: 'baseline',
    events: [{ type: 'demand_spike', sector: 'all', startHour: 18, durationH: 6, factor: 1.8 }],
    battery: { initialSocPct: 60 },
    assertions: [
      { strategy: 'proportional', metric: 'unservedKwh', op: 'eq', value: 0 },
      { strategy: 'proportional', metric: 'socMinPct', op: 'lt', value: 40 },
    ],
  },
];

const SYSTEM = `You write microgrid test scenarios as strict JSON. Reply with ONE JSON object only, no fences:
{"id": "<brief id>", "title": "<80 chars", "description": "<500 chars", "base": "baseline",
 "events": [{"type": "solar_drop"|"demand_spike"|"fire", ...}], "battery": {"initialSocPct": n, ...},
 "assertions": [{"strategy": "proportional"|"essential_first"|"balanced",
   "metric": "violations"|"demandKwh"|"servedKwh"|"unservedKwh"|"criticalUnservedKwh"|"socMinPct",
   "op": "eq"|"gt"|"gte"|"lt"|"lte", "value": n}]}
Event fields: solar_drop {startHour 0-23, durationH 1-24, factor 0-3 (1 = normal sun)};
demand_spike {sector "all"|"health"|"water"|"school"|"households"|"market"|"industry",
startHour, durationH, factor 0-3}; fire {sector, startHour, durationH}.
startHour + durationH <= 24 always. Assertions must be robust inequalities (gt/eq on 0), never exact floats.`;

function extractJson(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match?.[0]) throw new Error('No JSON object in the reply');
  return JSON.parse(match[0]) as unknown;
}

async function generateLive(brief: Brief): Promise<GeneratedScenario> {
  const apiKey = process.env.META_API_KEY;
  if (!apiKey) throw new Error('META_API_KEY is required for --live');
  const base = (process.env.META_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'muse-spark-1.2',
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `Brief (id "${brief.id}"): ${brief.brief}${lastError ? `\nPrevious reply was invalid: ${lastError}. Fix it.` : ''}`,
          },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`Meta API error (${res.status})`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    try {
      const parsed = GeneratedScenarioSchema.parse(extractJson(content));
      if (parsed.id !== brief.id) throw new Error(`wrong id "${parsed.id}"`);
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`Brief "${brief.id}" failed twice: ${lastError}`);
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? (args[onlyIdx + 1] ?? '') : undefined;
  const briefs = only ? BRIEFS.filter((b) => b.id === only) : BRIEFS;
  if (only && briefs.length === 0) throw new Error(`Unknown brief "${only}"`);

  const outputs: GeneratedScenario[] = [];
  for (const brief of briefs) {
    if (live) {
      console.log(`[gen-scenarios] live: ${brief.id} ...`);
      outputs.push(await generateLive(brief));
    } else {
      const template = MOCK_TEMPLATES.find((t) => t.id === brief.id);
      if (!template) throw new Error(`No mock template for "${brief.id}"`);
      outputs.push(GeneratedScenarioSchema.parse(template));
    }
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const out of outputs) {
    const path = join(OUT_DIR, `${out.id}.json`);
    writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`[gen-scenarios] wrote ${path}`);
  }
  // Index of every JSON in the folder: the engine builds as CommonJS (no `import.meta.glob`).
  const ids = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
  const name = (id: string) => id.replace(/\W+(\w)/g, (_, c: string) => c.toUpperCase());
  writeFileSync(
    join(OUT_DIR, 'index.ts'),
    [
      '// Generated by scripts/gen-scenarios.ts — do not edit.',
      ...ids.map((id) => `import ${name(id)} from './${id}.json';`),
      '',
      `export const GENERATED_FILES: Record<string, unknown> = { ${ids.map((id) => `'${id}.json': ${name(id)}`).join(', ')} };`,
      '',
    ].join('\n')
  );
}

await main();
