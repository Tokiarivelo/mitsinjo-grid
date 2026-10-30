import 'server-only';

import { z } from 'zod';
import type { UsageSample } from '@/server/spend';
import type { PerceptionClient } from '@/server/perception';
import type { LlmProvider, ToolDefinition } from './provider';
import { IMAGE_MODEL, WONDER_MODEL } from './adaptive-router';

/**
 * Tools that switch model instead of calling the engine. Spark reads the request and decides:
 * a picture to draw → Muse Image, objects to count on the attached photo → SAM, a long plan or
 * deep audit → Wonder for the rest of the turn.
 */

export const GenerateImageSchema = z.object({
  prompt: z.string().trim().min(3).max(600),
  caption: z.string().trim().max(200).optional(),
});

export const SegmentImageSchema = z.object({
  concept: z.string().trim().min(2).max(40),
});

export const EscalateDeepReasoningSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const MODEL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'generate_image',
    description:
      'Draw a picture with the image model, only when the user asks for an image, drawing, illustration or poster. ' +
      'Write the prompt in English, describe the scene; never put numbers or text with numbers in it.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'English scene description, no numbers.' },
        caption: { type: 'string', description: 'Short caption in the user language.' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'segment_image',
    description:
      'Count or locate one kind of object on the photo attached to the latest user message (segmentation model). ' +
      'Use when the user asks how many, to count, detect or outline objects on that photo.',
    parameters: {
      type: 'object',
      properties: {
        concept: {
          type: 'string',
          description: 'One short English noun phrase, e.g. "solar panel", "roof", "smoke".',
        },
      },
      required: ['concept'],
      additionalProperties: false,
    },
  },
  {
    name: 'escalate_deep_reasoning',
    description:
      'Switch to the slower deep-reasoning model for the rest of this answer. Only for multi-day plans, ' +
      'deep audits or complex trade-off analysis. Never in an emergency (fire, smoke): answer fast instead.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Why deep reasoning is needed.' } },
      required: ['reason'],
      additionalProperties: false,
    },
  },
];

export const MODEL_TOOL_NAMES = new Set(MODEL_TOOL_DEFINITIONS.map((t) => t.name));

export interface ModelToolContext {
  provider: LlmProvider;
  perception: Pick<PerceptionClient, 'segmentImage'>;
  /** Image of the latest user message, if any. */
  attachedImage?: string;
  availableModels: string[];
  currentModel: string;
  emit: (event: 'image' | 'perception' | 'model' | 'error', data: Record<string, unknown>) => void;
  signal?: AbortSignal;
  canSpend: () => boolean;
  recordSpend: (model: string, usage: UsageSample) => void;
  /** Switch the chat model for the next rounds; false when the provider cannot. */
  switchModel: (model: string) => boolean;
}

/** Numbers never go into an image prompt: the model could draw them wrong. */
export function stripNumbers(text: string): string {
  return text
    .replace(/\d+([.,]\d+)?\s*(%|kwh|kw|wh|w)?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Runs a model tool. Always returns the JSON sent back to the model (errors included), never throws. */
export async function executeModelTool(
  name: string,
  rawArgs: unknown,
  ctx: ModelToolContext
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'generate_image': {
      const parsed = GenerateImageSchema.safeParse(rawArgs);
      if (!parsed.success)
        return { error: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
      if (typeof ctx.provider.generateImage !== 'function') {
        return { error: 'Image generation is not available.' };
      }
      if (ctx.provider.name !== 'mock' && !ctx.canSpend()) {
        return { error: 'AI budget cap reached: no image generated.' };
      }
      const prompt = stripNumbers(parsed.data.prompt);
      try {
        const img = await ctx.provider.generateImage(prompt, ctx.signal);
        if (ctx.provider.name !== 'mock') ctx.recordSpend(IMAGE_MODEL, { images: 1 });
        const caption = parsed.data.caption || img.caption || prompt;
        ctx.emit('image', { imageUrl: img.imageUrl, caption });
        return {
          ok: true,
          model: ctx.provider.name === 'mock' ? 'mock-image' : IMAGE_MODEL,
          caption,
        };
      } catch (err) {
        console.warn('[copilot:model-tools] generate_image failed:', err);
        return { error: 'Image generation failed. Answer in text instead.' };
      }
    }

    case 'segment_image': {
      const parsed = SegmentImageSchema.safeParse(rawArgs);
      if (!parsed.success)
        return { error: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
      if (!ctx.attachedImage) {
        return { error: 'No photo is attached to the latest message: ask the user to attach one.' };
      }
      const seg = await ctx.perception.segmentImage(
        ctx.attachedImage,
        parsed.data.concept,
        ctx.signal
      );
      if (seg.fallback === 'provider_error' || seg.fallback === 'spend_cap') {
        ctx.emit('error', {
          code: 'PROVIDER_FALLBACK',
          reason: seg.fallback,
          message: 'AI provider unavailable — showing deterministic explanation.',
        });
      }
      ctx.emit('perception', { kind: 'segment', ...seg });
      return {
        concept: seg.concept,
        count: seg.count,
        boxCoverage: round2(seg.boxCoverage),
        model: seg.model,
        source: seg.source,
        note: 'AI perception, to verify. Not an engine value: never present it as computed evidence.',
      };
    }

    case 'escalate_deep_reasoning': {
      const parsed = EscalateDeepReasoningSchema.safeParse(rawArgs);
      if (!parsed.success)
        return { error: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
      if (ctx.currentModel === WONDER_MODEL) return { ok: true, model: WONDER_MODEL };
      if (!ctx.availableModels.includes(WONDER_MODEL) || !ctx.switchModel(WONDER_MODEL)) {
        return { error: 'Deep reasoning model unavailable: continue with the current model.' };
      }
      ctx.emit('model', { model: WONDER_MODEL, modality: 'reasoning', reason: parsed.data.reason });
      return { ok: true, model: WONDER_MODEL };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/** Text answer for a segmentation result (mock provider). Counts are AI perception, not engine numbers. */
export function describeSegment(
  seg: { concept: string; count: number; boxCoverage: number; model: string },
  locale: 'en' | 'fr'
): string {
  const pct = Math.round(seg.boxCoverage * 100);
  if (locale === 'fr') {
    return seg.count === 0
      ? `### Ce qui a été détecté\nAucun objet « ${seg.concept} » trouvé sur la photo.\n\n### Et ensuite\nEssayez une photo plus nette ou un autre objet (toit, maison, fumée).`
      : `### Ce qui a été détecté\n${seg.count} × « ${seg.concept} » sur la photo, environ ${pct} % de l'image (mesuré sur les cadres).\n\n### Perception IA\nEstimation du modèle ${seg.model}, à vérifier : ce n'est pas un calcul du moteur.\n\n### Et ensuite\nVoulez-vous que je propose un changement de scénario à partir de cette observation ?`;
  }
  return seg.count === 0
    ? `### What was detected\nNo "${seg.concept}" found on the photo.\n\n### Explore next\nTry a sharper photo or another object (roof, house, smoke).`
    : `### What was detected\n${seg.count} × "${seg.concept}" on the photo, about ${pct} % of the image (measured on the boxes).\n\n### AI perception\nEstimate from ${seg.model}, to verify: not an engine calculation.\n\n### Explore next\nShould I propose a scenario change from this observation?`;
}
