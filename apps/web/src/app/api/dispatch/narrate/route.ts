import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { DispatchLogEntrySchema, EvidenceSchema, type Narration } from '@mitsinjo/engine';
import { env } from '@/lib/env';
import { entrySavedKwh, formatTemplateNarration, isNarrationFactual } from '@/lib/dispatch-log';
import { MetaLlmProvider } from '@/server/copilot/providers/meta';
import { saveDispatchLogEntries } from '@/server/db/neon';
import { spendGuard, estimateTokens } from '@/server/spend';

const NARRATION_MODEL = 'muse-spark-1.3';
/** Spend-cap key shared by every narration call (the route has no session). */
const NARRATION_BUDGET_KEY = 'dispatch-narrate';

const NarrateBodySchema = z.object({
  entry: DispatchLogEntrySchema,
  locale: z.enum(['fr', 'en', 'mg']).default('fr'),
  evidence: EvidenceSchema.optional(),
});

/** Memory cache for dispatch narrations keyed by hash:locale (PA-T5a). */
const narrationCache = new Map<string, Narration>();

export function clearNarrationCache(): void {
  narrationCache.clear();
}

export async function POST(req: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const parsed = NarrateBodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { entry, locale } = parsed.data;
    const cacheKey = `${entry.hash}:${locale}`;

    // 1. Check in-memory cache
    const cached = narrationCache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ narration: cached, cached: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. If entry already has a valid narration matching source 'llm', cache and return it
    if (entry.narration?.source === 'llm' && isNarrationFactual(entry.narration.text, entry)) {
      narrationCache.set(cacheKey, entry.narration);
      return new Response(JSON.stringify({ narration: entry.narration, cached: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Fallback deterministic template
    const templateText = formatTemplateNarration(entry, locale);
    let finalNarration: Narration = {
      text: templateText,
      source: 'template',
    };

    // 4. If Meta LLM (Muse Spark) is configured, invoke it with grounding prompt
    const isMetaConfigured =
      env.LLM_PROVIDER === 'meta' &&
      Boolean(env.META_API_KEY) &&
      spendGuard.canSpend(NARRATION_BUDGET_KEY);

    if (isMetaConfigured) {
      try {
        const provider = new MetaLlmProvider({ model: NARRATION_MODEL });
        const savedKwh = entrySavedKwh(entry);

        const langName = locale === 'en' ? 'English' : locale === 'mg' ? 'Malagasy' : 'French';
        const systemPrompt = [
          'You are the autonomous dispatch narrator of the Mitsinjo rural microgrid in Madagascar.',
          `Summarize this autonomous dispatch event in 1 to 2 clear sentences in ${langName}.`,
          'CRITICAL GROUNDING RULES:',
          '- You may ONLY cite numbers that appear in the provided event data (such as hour, saved kWh, evidence values, or battery SoC).',
          '- NEVER invent, extrapolate, or hallucinate any numbers or units outside this data.',
          '- Keep the message under 280 characters.',
        ].join('\n');

        const userPrompt = [
          `Hour: ${entry.hour}:00`,
          `Day: ${entry.day}`,
          `Origin: ${entry.origin}`,
          `Incident: ${entry.incident ? JSON.stringify(entry.incident) : 'none'}`,
          `Action: ${entry.action ? JSON.stringify(entry.action) : 'none'}`,
          `Before: ${entry.before ? JSON.stringify(entry.before) : 'none'}`,
          `After: ${entry.after ? JSON.stringify(entry.after) : 'none'}`,
          `Saved kWh: ${savedKwh}`,
          'Summarize in 1-2 sentences:',
        ].join('\n');

        const response = await provider.chat(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          []
        );

        spendGuard.record(NARRATION_BUDGET_KEY, NARRATION_MODEL, {
          inputTokens: estimateTokens(systemPrompt + userPrompt),
          outputTokens: estimateTokens(response.content ?? ''),
        });

        const text = response.content?.trim();
        if (text && text.length > 0 && text.length <= 400 && isNarrationFactual(text, entry)) {
          finalNarration = {
            text,
            source: 'llm',
          };
        } else {
          console.warn(
            '[api:dispatch:narrate] LLM output failed factual validation or was empty. Using template fallback.'
          );
        }
      } catch (err) {
        console.warn(
          '[api:dispatch:narrate] Failed to generate LLM narration, falling back to template:',
          err
        );
      }
    }

    // 5. Cache result in memory
    narrationCache.set(cacheKey, finalNarration);

    // 6. Asynchronously update Neon database if configured
    saveDispatchLogEntries([{ ...entry, narration: finalNarration }]).catch(() => {});

    return new Response(JSON.stringify({ narration: finalNarration, cached: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api:dispatch:narrate] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal narration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
