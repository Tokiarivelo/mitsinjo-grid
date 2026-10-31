import 'server-only';

import { z } from 'zod';
import { env } from '@/lib/env';
import { DEFAULT_META_BASE_URL } from '@/server/copilot/providers/meta';
import { fetchPreferringContributor } from '@/server/copilot/providers/contributor';
import type { UsageSample } from '@/server/spend';
import type { PerceptionBackend, PerceptionCall } from './backend';
import { DETECT_JSON_SCHEMA, DETECT_SYSTEM_PROMPT, parseDetections } from './detect';
import { maskToOutline } from './mask-outline';
import { boxUnionCoverage, parseSamOutput } from './parse-sam';
import {
  ObservationSchema,
  type DetectionResult,
  type SegmentResult,
  type TranscribeOptions,
  type Transcript,
  type VisionResult,
} from './schemas';

const VISION_SYSTEM_PROMPT = [
  'You look at photos for the operator of a SIMULATED rural solar microgrid.',
  'Report only what is visible. Use snake_case labels such as cloud_cover (%), shaded_panel (%),',
  'meter_reading (copy the printed number and unit), smoke (true/false), fire (true/false).',
  'Never compute or guess energy values (kW, kWh): only copy numbers printed in the image.',
  'confidence is your own 0-1 confidence. If the image is unreadable, return no observations and say so.',
].join(' ');

const VISION_JSON_SCHEMA = {
  name: 'Perception',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      observations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: ['number', 'string', 'boolean'] },
            unit: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['label', 'value', 'confidence'],
        },
      },
    },
    required: ['summary', 'observations'],
  },
};

const VisionPayloadSchema = z.object({
  summary: z.string(),
  observations: z.array(z.unknown()),
});

const TranscribePayloadSchema = z.object({
  transcript: z.string(),
  audioDurationMs: z.number(),
  turns: z
    .array(
      z.object({
        startMs: z.number(),
        endMs: z.number(),
        transcript: z.string(),
        speaker: z.string().optional(),
      })
    )
    .default([]),
});

interface ResponsesPayload {
  output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
}

/** Perception through the Meta Model API (same key and base URL as the chat). */
export class MetaPerceptionBackend implements PerceptionBackend {
  readonly name = 'meta' as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly preferContributor: boolean;

  constructor(options?: { apiKey?: string; baseUrl?: string; preferContributor?: boolean }) {
    this.preferContributor = options?.preferContributor ?? env.META_PREFER_CONTRIBUTOR;
    this.apiKey = options?.apiKey || env.META_API_KEY || '';
    this.baseUrl = (options?.baseUrl || env.META_BASE_URL || DEFAULT_META_BASE_URL).replace(
      /\/$/,
      ''
    );
  }

  private async post(path: string, body: BodyInit, init: HeadersInit, signal?: AbortSignal) {
    return (await this.postWithModel(path, () => body, '', init, signal)).data;
  }

  /** POST whose body depends on the model id, so a contributor refusal can be resent on `baseModel`. */
  private async postWithModel(
    path: string,
    makeBody: (model: string) => BodyInit,
    baseModel: string,
    init: HeadersInit,
    signal?: AbortSignal
  ): Promise<{ data: unknown; model: string }> {
    if (!this.apiKey) throw new Error('META_API_KEY is not configured in environment');
    const { res, model } = await fetchPreferringContributor(
      baseModel,
      Boolean(baseModel) && this.preferContributor,
      (m) =>
        fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, ...init },
          body: makeBody(m),
          signal,
        })
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Meta perception API error (${res.status}) on ${path}: ${text.slice(0, 300)}`
      );
    }
    return { data: (await res.json()) as unknown, model };
  }

  async transcribe(
    audio: Blob,
    options: TranscribeOptions = {},
    signal?: AbortSignal
  ): Promise<PerceptionCall<Transcript>> {
    const model = env.META_VOICE_MODEL;
    const form = new FormData();
    const request = {
      model,
      audioEncoding: 'WAV',
      mode: options.diarize ? 'DIARIZATION' : 'PUSH_TO_TALK',
      ...(options.languages?.length ? { languageBias: options.languages } : {}),
      ...(options.keywords?.length ? { keywords: options.keywords } : {}),
    };
    form.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    form.append('audio', audio, options.fileName || 'audio.wav');

    const data = TranscribePayloadSchema.parse(
      await this.post('/asr/transcribe', form, { Accept: 'application/json' }, signal)
    );
    return {
      model,
      usage: { audioMs: data.audioDurationMs },
      result: {
        text: data.transcript,
        durationMs: Math.round(data.audioDurationMs),
        turns: data.turns.map((t) => ({
          startMs: Math.round(t.startMs),
          endMs: Math.round(t.endMs),
          text: t.transcript,
          ...(t.speaker ? { speaker: t.speaker } : {}),
        })),
      },
    };
  }

  /** Spark `chat/completions` with a JSON-schema answer: shared by every vision call. */
  private async visionJson(
    system: string,
    question: string,
    imageUrl: string,
    jsonSchema: object,
    signal?: AbortSignal
  ): Promise<{ content: string; model: string; usage: UsageSample }> {
    const body = (model: string) => ({
      model,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: jsonSchema },
    });
    const sent = await this.postWithModel(
      '/chat/completions',
      (m) => JSON.stringify(body(m)),
      env.META_VISION_MODEL,
      { 'Content-Type': 'application/json' },
      signal
    );
    const data = sent.data as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: sent.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  async analyzeImage(
    imageUrl: string,
    question: string,
    signal?: AbortSignal
  ): Promise<PerceptionCall<VisionResult>> {
    const { content, model, usage } = await this.visionJson(
      VISION_SYSTEM_PROMPT,
      question,
      imageUrl,
      VISION_JSON_SCHEMA,
      signal
    );
    const parsed = VisionPayloadSchema.parse(JSON.parse(content));
    // Keep only well-formed observations; clamp confidence the model may print as 0-100.
    const observations = parsed.observations.flatMap((raw) => {
      const obs = raw as Record<string, unknown>;
      const confidence =
        typeof obs.confidence === 'number' && obs.confidence > 1
          ? obs.confidence / 100
          : obs.confidence;
      const ok = ObservationSchema.safeParse({ ...obs, confidence });
      return ok.success ? [ok.data] : [];
    });

    return { model, usage, result: { summary: parsed.summary, observations } };
  }

  async detectAppliances(
    imageUrl: string,
    signal?: AbortSignal
  ): Promise<PerceptionCall<DetectionResult>> {
    const { content, model, usage } = await this.visionJson(
      DETECT_SYSTEM_PROMPT,
      'List the electrical appliances on this photo.',
      imageUrl,
      DETECT_JSON_SCHEMA,
      signal
    );
    return { model, usage, result: { detections: parseDetections(content) } };
  }

  async segmentImage(
    imageUrl: string,
    concept: string,
    signal?: AbortSignal
  ): Promise<PerceptionCall<SegmentResult>> {
    const model = env.META_SEGMENT_MODEL;
    const body = {
      model,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: concept },
            { type: 'input_image', image_url: imageUrl },
          ],
        },
      ],
      metadata: { include_confidence: 'true', mask_encoding: 'one_bit' },
    };
    const data = (await this.post(
      '/responses',
      JSON.stringify(body),
      { 'Content-Type': 'application/json' },
      signal
    )) as ResponsesPayload;

    const text = (data.output ?? [])
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join('');
    const parsed = parseSamOutput(text);
    const { imageWidth, imageHeight } = parsed;
    const instances = parsed.instances.map((inst, i) => {
      const mask = parsed.masks[i];
      const outline = mask ? maskToOutline(mask, inst.box, imageWidth, imageHeight) : null;
      return outline ? { ...inst, outline } : inst;
    });

    return {
      model,
      usage: { images: 1 },
      result: {
        concept,
        imageWidth,
        imageHeight,
        instances,
        count: instances.length,
        boxCoverage: boxUnionCoverage(
          instances.map((i) => i.box),
          imageWidth,
          imageHeight
        ),
      },
    };
  }
}
