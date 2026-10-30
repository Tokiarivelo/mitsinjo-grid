import type { PerceptionBackend, PerceptionCall } from './backend';
import { boxUnionCoverage } from './parse-sam';
import type {
  Observation,
  SegmentResult,
  TranscribeOptions,
  Transcript,
  VisionResult,
} from './schemas';

/** Model id reported by every mock perception result. */
export const MOCK_PERCEPTION_MODEL = 'mock-perception-v1';

/** WAV header size and bytes per ms for mono 16-bit PCM at 16 kHz. */
const WAV_HEADER_BYTES = 44;
const BYTES_PER_MS_16K = 32;

/** Demo phrases, picked by a keyword in the file name (offline demo and tests). */
const MOCK_PHRASES: Array<{ match: RegExp; text: string }> = [
  { match: /fire|feu|afo/i, text: "Au feu à l'école !" },
  { match: /cut|coupe|market|marche/i, text: 'Coupe le marché ce soir.' },
  { match: /cloud|nuage/i, text: 'Un nuage arrive, que se passe-t-il ?' },
];
const DEFAULT_PHRASE = 'Que se passe-t-il si le solaire baisse de 40 % pendant deux heures ?';

const MEETING_TURNS = [
  { speaker: 'A', text: 'La clinique doit garder le courant toute la nuit.' },
  { speaker: 'B', text: "L'école a besoin de lumière le matin." },
  { speaker: 'A', text: 'Le marché peut fermer plus tôt le soir.' },
];

/** Image observations, picked by a keyword in the question. */
const MOCK_OBSERVATIONS: Array<{ match: RegExp; summary: string; observations: Observation[] }> = [
  {
    match: /fire|feu|smoke|fumée|fumee/i,
    summary: 'Mock: smoke visible near a building, to verify.',
    observations: [{ label: 'smoke', value: true, confidence: 0.5 }],
  },
  {
    match: /meter|compteur|onduleur|inverter/i,
    summary: 'Mock: a meter display is readable.',
    observations: [{ label: 'meter_reading', value: 1284, unit: 'kWh', confidence: 0.5 }],
  },
  {
    match: /sky|ciel|cloud|nuage|lanitra/i,
    summary: 'Mock: partly cloudy sky.',
    observations: [{ label: 'cloud_cover', value: 60, unit: '%', confidence: 0.5 }],
  },
  {
    match: /panel|panneau|ombre|shade/i,
    summary: 'Mock: one panel partly covered by leaves.',
    observations: [{ label: 'shaded_panel', value: 10, unit: '%', confidence: 0.5 }],
  },
];

/** Deterministic perception for `LLM_PROVIDER=mock`, tests and every Meta failure. */
export class MockPerceptionBackend implements PerceptionBackend {
  readonly name = 'mock' as const;

  async transcribe(
    audio: Blob,
    options: TranscribeOptions = {}
  ): Promise<PerceptionCall<Transcript>> {
    const durationMs = Math.max(0, Math.round((audio.size - WAV_HEADER_BYTES) / BYTES_PER_MS_16K));
    const hint = options.fileName ?? '';

    if (options.diarize) {
      const step = Math.floor(durationMs / MEETING_TURNS.length);
      const turns = MEETING_TURNS.map((t, i) => ({
        startMs: i * step,
        endMs: (i + 1) * step,
        text: t.text,
        speaker: t.speaker,
      }));
      return {
        model: MOCK_PERCEPTION_MODEL,
        usage: {},
        result: { text: turns.map((t) => t.text).join(' '), durationMs, turns },
      };
    }

    const text = MOCK_PHRASES.find((p) => p.match.test(hint))?.text ?? DEFAULT_PHRASE;
    return { model: MOCK_PERCEPTION_MODEL, usage: {}, result: { text, durationMs, turns: [] } };
  }

  async analyzeImage(_imageUrl: string, question: string): Promise<PerceptionCall<VisionResult>> {
    const hit = MOCK_OBSERVATIONS.find((o) => o.match.test(question));
    return {
      model: MOCK_PERCEPTION_MODEL,
      usage: {},
      result: hit
        ? { summary: hit.summary, observations: hit.observations }
        : { summary: 'Mock: nothing to report on this image.', observations: [] },
    };
  }

  async segmentImage(_imageUrl: string, concept: string): Promise<PerceptionCall<SegmentResult>> {
    const imageWidth = 1920;
    const imageHeight = 1280;
    const instances = [
      { box: { x1: 16, y1: 586, x2: 748, y2: 1094 }, confidence: 0.9 },
      { box: { x1: 1179, y1: 585, x2: 1900, y2: 1071 }, confidence: 0.9 },
    ];
    return {
      model: MOCK_PERCEPTION_MODEL,
      usage: {},
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
