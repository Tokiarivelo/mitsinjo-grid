import 'server-only';

import { z } from 'zod';
import type { UsageSample } from '@/server/spend';
import { ObservationSchema, type Observation, type PerceptionClient } from '@/server/perception';
import type { ChatMessage, LlmProvider, ToolDefinition } from './provider';
import { IMAGE_MODEL, WONDER_MODEL } from './adaptive-router';
import { villageSceneCaption, type VillageScene } from './village-scene';
import { getResultEntry } from './result-cache';
import { buildVisualPrompt } from '@/server/media/generate-image';
import { runCouncil } from '@/server/council/deliberate';
import type { SimulationInput, StrategyId } from '@mitsinjo/engine';

/**
 * Tools that switch model instead of calling the engine. Spark reads the request and decides:
 * a picture to draw → Muse Image, objects to count on the attached photo → SAM, a long plan or
 * deep audit → Wonder for the rest of the turn.
 */

export const GenerateImageSchema = z
  .object({
    /** `current_village`: the server writes the prompt from the engine state at the shown hour. */
    scene: z.enum(['current_village', 'custom']).default('custom'),
    prompt: z.string().trim().min(3).max(600).optional(),
    caption: z.string().trim().max(200).optional(),
  })
  .refine((a) => a.scene === 'current_village' || Boolean(a.prompt), {
    message: 'prompt is required for a custom scene',
    path: ['prompt'],
  });

export const SegmentImageSchema = z.object({
  concept: z.string().trim().min(2).max(40),
});

export const AnalyzeImageSchema = z.object({
  question: z.string().trim().min(3).max(300),
});

export const EscalateDeepReasoningSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const GenerateVisualSchema = z.object({
  kind: z.enum(['village_tonight', 'shedding_poster', 'day_comic']),
  /** Engine result to illustrate, from a previous tool answer in this conversation. */
  resultId: z.string().trim().min(1).max(40),
});

export const ConveneCouncilSchema = z.object({
  question: z.string().trim().min(10).max(300),
  maxRounds: z.number().int().min(1).max(3).optional(),
});

export const MODEL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'generate_image',
    description:
      'Draw a picture with the image model, only when the user asks for an image, drawing, illustration or poster. ' +
      'To show the village as it is now in the simulation, use scene "current_village" (the server describes ' +
      'the real state: hour, sky, each sector powered or cut, battery). Otherwise scene "custom" with an English ' +
      'prompt; never put numbers in it.',
    parameters: {
      type: 'object',
      properties: {
        scene: {
          type: 'string',
          enum: ['current_village', 'custom'],
          description: 'current_village = current simulated state; custom = your own prompt.',
        },
        prompt: {
          type: 'string',
          description: 'English scene description (custom only), no numbers.',
        },
        caption: {
          type: 'string',
          description: 'Short caption in the user language (custom only).',
        },
      },
      required: ['scene'],
      additionalProperties: false,
    },
  },
  {
    name: 'generate_visual',
    description:
      'Draw a visual from an engine result (image model): `village_tonight` shows the village in the ' +
      'evening, `shedding_poster` a load-shedding poster background, `day_comic` a four-panel comic ' +
      'strip of the simulated day. The server writes the prompt from that result — states and time ' +
      'ranges as words, never numbers — and returns the exact hours as an overlay for the app. Use ' +
      'resultId from a previous tool answer; run a scenario first when there is none.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: '`village_tonight`, `shedding_poster` or `day_comic`.',
        },
        resultId: {
          type: 'string',
          description: 'Engine result to illustrate, e.g. "SIM-A1B2".',
        },
      },
      required: ['kind', 'resultId'],
      additionalProperties: false,
    },
  },
  {
    name: 'convene_council',
    description:
      'Convene the sector council: one agent per connected sector defends its load with a patch, ' +
      'every patch is engine-simulated, and a mediator recommends one. Use for contested trade-offs ' +
      '(who sheds load tonight). Each voice bills one chat call; capped seats degrade to mock personas.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The trade-off to deliberate, e.g. "Who should shed load tonight?".',
        },
        maxRounds: {
          type: 'number',
          description: 'Deliberation rounds, 1–3 (default 1). Later rounds see earlier impacts.',
        },
      },
      required: ['question'],
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
    name: 'analyze_image',
    description:
      'Read the photo attached to the latest user message (vision model) and answer the question as structured observations (label, value, unit, confidence). ' +
      'Use for sky and cloud cover, meter or inverter readings, panel state, smoke — anything to observe on that photo rather than count.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'What to observe on the photo, e.g. "How cloudy is the sky?".',
        },
      },
      required: ['question'],
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
  perception: Pick<PerceptionClient, 'segmentImage' | 'analyzeImage'>;
  /** Image of the latest user message, if any. */
  attachedImage?: string;
  /** Engine state of the village at the hour shown in the app (for `scene: current_village`). */
  villageScene?: () => VillageScene;
  /** Live scenario for the sector council (each voice is simulated from it). */
  councilState?: () => { input: SimulationInput; strategy: StrategyId };
  locale?: 'en' | 'fr' | 'mg';
  availableModels: string[];
  currentModel: string;
  emit: (
    event: 'image' | 'media' | 'perception' | 'model' | 'error' | 'council',
    data: Record<string, unknown>
  ) => void;
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
      const scene =
        parsed.data.scene === 'current_village' && ctx.villageScene ? ctx.villageScene() : null;
      if (parsed.data.scene === 'current_village' && !scene) {
        return { error: 'The current village state is not available.' };
      }
      // The scene prompt holds engine states in words; a custom prompt loses its numbers.
      const prompt = scene ? scene.prompt : stripNumbers(parsed.data.prompt ?? '');
      try {
        const img = await ctx.provider.generateImage(prompt, ctx.signal);
        if (ctx.provider.name !== 'mock') ctx.recordSpend(IMAGE_MODEL, { images: 1 });
        const caption = scene
          ? villageSceneCaption(scene, ctx.locale ?? 'en')
          : parsed.data.caption || img.caption || prompt;
        ctx.emit('image', { imageUrl: img.imageUrl, caption });
        return {
          ok: true,
          model: ctx.provider.name === 'mock' ? 'mock-image' : IMAGE_MODEL,
          caption,
          ...(scene
            ? {
                shownState: {
                  hour: scene.hour,
                  sky: scene.sky,
                  battery: scene.battery,
                  sectors: scene.sectors,
                },
              }
            : {}),
        };
      } catch (err) {
        console.warn('[copilot:model-tools] generate_image failed:', err);
        return { error: 'Image generation failed. Answer in text instead.' };
      }
    }

    case 'generate_visual': {
      const parsed = GenerateVisualSchema.safeParse(rawArgs);
      if (!parsed.success)
        return { error: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
      if (typeof ctx.provider.generateImage !== 'function') {
        return { error: 'Image generation is not available.' };
      }
      if (ctx.provider.name !== 'mock' && !ctx.canSpend()) {
        return { error: 'AI budget cap reached: no image generated.' };
      }
      const entry = getResultEntry(parsed.data.resultId);
      if (!entry) {
        return {
          error: `Unknown resultId "${parsed.data.resultId}": run a scenario first, then illustrate its resultId.`,
        };
      }
      const visual = buildVisualPrompt(
        parsed.data.kind,
        entry.input,
        entry.result,
        ctx.locale ?? 'en'
      );
      try {
        const img = await ctx.provider.generateImage(visual.prompt, ctx.signal);
        if (ctx.provider.name !== 'mock') ctx.recordSpend(IMAGE_MODEL, { images: 1 });
        ctx.emit('media', {
          kind: visual.kind,
          imageUrl: img.imageUrl,
          caption: visual.caption,
          overlay: visual.overlay,
          resultId: parsed.data.resultId,
        });
        return {
          ok: true,
          model: ctx.provider.name === 'mock' ? 'mock-image' : IMAGE_MODEL,
          kind: visual.kind,
          resultId: parsed.data.resultId,
          caption: visual.caption,
          overlay: visual.overlay,
        };
      } catch (err) {
        console.warn('[copilot:model-tools] generate_visual failed:', err);
        ctx.emit('error', {
          code: 'PROVIDER_FALLBACK',
          reason: 'provider_error',
          message: 'AI provider unavailable — showing deterministic explanation.',
        });
        return { error: 'Image generation failed. Answer in text instead.' };
      }
    }

    case 'convene_council': {
      const parsed = ConveneCouncilSchema.safeParse(rawArgs);
      if (!parsed.success)
        return { error: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
      if (!ctx.councilState) {
        return { error: 'The current scenario state is not available.' };
      }
      const { input, strategy } = ctx.councilState();
      const provider = ctx.provider;
      const seatChat = async (system: string, user: string) => {
        const messages: ChatMessage[] = [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ];
        const turn = await provider.chat(messages, [], ctx.signal);
        return { text: turn.content ?? '', usage: turn.usage };
      };
      // The mediator reasons on Wonder when available, restored afterwards (W2).
      const switchable = provider as LlmProvider & { setModel?: (m: string) => void };
      const canWonder =
        provider.name !== 'mock' &&
        ctx.availableModels.includes(WONDER_MODEL) &&
        typeof switchable.setModel === 'function';
      const mediatorChat = canWonder
        ? async (system: string, user: string) => {
            switchable.setModel!(WONDER_MODEL);
            try {
              return await seatChat(system, user);
            } finally {
              switchable.setModel!(ctx.currentModel);
            }
          }
        : undefined;
      const run = await runCouncil({
        input,
        strategy,
        question: parsed.data.question,
        maxRounds: parsed.data.maxRounds,
        chat: seatChat,
        mediatorChat,
        isMock: provider.name === 'mock',
        model: ctx.currentModel,
        mediatorModel: canWonder ? WONDER_MODEL : ctx.currentModel,
        canSpend: ctx.canSpend,
        recordSpend: ctx.recordSpend,
        emitFallback: () =>
          ctx.emit('error', {
            code: 'PROVIDER_FALLBACK',
            reason: 'spend_cap',
            message: 'AI provider unavailable — showing deterministic explanation.',
          }),
        locale: ctx.locale ?? 'en',
      });
      ctx.emit('council', {
        question: run.question,
        rounds: run.rounds,
        agents: run.agents,
        verdict: run.verdict,
      });
      return {
        ok: true,
        rounds: run.rounds,
        agents: run.agents.map((a) => ({
          sector: a.sector,
          reason: a.reason,
          unservedKwhAfter: a.impact.unservedKwhAfter,
          ownServedKwhDelta: a.impact.sectors[a.sector]?.servedKwhDelta ?? 0,
          mock: a.mock,
        })),
        pick: run.verdict.pick,
        synthesis: run.verdict.synthesis,
        note: 'Each voice was simulated by the engine; cite these numbers, never invent others.',
      };
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
      ctx.emit('perception', { kind: 'segment', imageUrl: ctx.attachedImage, ...seg });
      return {
        concept: seg.concept,
        count: seg.count,
        boxCoverage: round2(seg.boxCoverage),
        model: seg.model,
        source: seg.source,
        note: 'AI perception, to verify. Not an engine value: never present it as computed evidence.',
      };
    }

    case 'analyze_image': {
      const parsed = AnalyzeImageSchema.safeParse(rawArgs);
      if (!parsed.success)
        return { error: `Invalid arguments: ${parsed.error.issues[0]?.message}` };
      if (!ctx.attachedImage) {
        return { error: 'No photo is attached to the latest message: ask the user to attach one.' };
      }
      const seen = await ctx.perception.analyzeImage(
        ctx.attachedImage,
        parsed.data.question,
        ctx.signal
      );
      const parsedObs = z.array(ObservationSchema).safeParse(seen.observations);
      if (!parsedObs.success) {
        return { error: 'The vision model returned invalid observations: ask again.' };
      }
      const observations: Observation[] = parsedObs.data;
      if (seen.fallback === 'provider_error' || seen.fallback === 'spend_cap') {
        ctx.emit('error', {
          code: 'PROVIDER_FALLBACK',
          reason: seen.fallback,
          message: 'AI provider unavailable — showing deterministic explanation.',
        });
      }
      ctx.emit('perception', {
        kind: 'analyze',
        summary: seen.summary,
        observations,
        model: seen.model,
        source: seen.source,
      });
      return {
        question: parsed.data.question,
        summary: seen.summary,
        observations,
        model: seen.model,
        source: seen.source,
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

/** Text answer for an image analysis (mock provider). Observations are AI perception, not engine numbers. */
export function describeAnalyze(
  seen: { summary: string; observations: Observation[]; model: string },
  locale: 'en' | 'fr'
): string {
  const lines = seen.observations.map(
    (o) => `- ${o.label}: ${o.value}${o.unit ? ` ${o.unit}` : ''} (confidence ${o.confidence})`
  );
  if (locale === 'fr') {
    return seen.observations.length === 0
      ? `### Ce qui a été observé\n${seen.summary}\n\n### Et ensuite\nPosez une question précise sur la photo (ciel, compteur, panneau, fumée).`
      : `### Ce qui a été observé\n${seen.summary}\n${lines.join('\n')}\n\n### Perception IA\nEstimation du modèle ${seen.model}, à vérifier : ce n'est pas un calcul du moteur.\n\n### Et ensuite\nVoulez-vous que je propose un changement de scénario à partir de cette observation ?`;
  }
  return seen.observations.length === 0
    ? `### What was observed\n${seen.summary}\n\n### Explore next\nAsk a precise question about the photo (sky, meter, panel, smoke).`
    : `### What was observed\n${seen.summary}\n${lines.join('\n')}\n\n### AI perception\nEstimate from ${seen.model}, to verify: not an engine calculation.\n\n### Explore next\nShould I propose a scenario change from this observation?`;
}
