import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getPerceptionClient } from '@/server/perception';

/** 60 s of 16 kHz mono 16-bit WAV ≈ 1.9 MB; a little headroom for the header. */
export const MAX_VOICE_BYTES = 2_000_000;

const LANGUAGE_NAMES = { en: 'English', fr: 'French', mg: 'Malagasy' } as const;
/** Words the operator says often: bias recognition toward them. */
const VOICE_KEYWORDS = [
  'clinique',
  'clinic',
  'marché',
  'market',
  'école',
  'school',
  'batterie',
  'solaire',
];

const FieldsSchema = z.object({
  locale: z.enum(['en', 'fr', 'mg']).default('fr'),
  sessionId: z.string().max(64).optional(),
});

const VoiceResponseSchema = z.object({
  text: z.string(),
  durationMs: z.number().int().min(0),
  source: z.enum(['meta', 'mock']),
  fallback: z.enum(['provider_error', 'spend_cap', 'not_configured']).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Speech to text for the chat microphone. Multipart: `audio` (WAV, ≤ MAX_VOICE_BYTES), `locale`,
 * `sessionId`. The audio is not stored. Meta Voice when configured, deterministic mock otherwise.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Expected multipart form data' }, 400);
  }
  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) return json({ error: 'Missing audio' }, 400);
  if (audio.size > MAX_VOICE_BYTES) return json({ error: 'Audio too long (max 60 s)' }, 413);
  if (audio.type && !/^audio\/(wav|x-wav|wave)$/.test(audio.type)) {
    return json({ error: 'Audio must be WAV' }, 415);
  }
  const fields = FieldsSchema.safeParse({
    locale: form.get('locale') ?? undefined,
    sessionId: form.get('sessionId') ?? undefined,
  });
  if (!fields.success) return json({ error: 'Invalid fields' }, 400);

  const transcript = await getPerceptionClient(fields.data.sessionId).transcribe(audio, {
    languages: [LANGUAGE_NAMES[fields.data.locale]],
    keywords: VOICE_KEYWORDS,
    fileName: 'voice.wav',
  });
  return json(
    VoiceResponseSchema.parse({
      text: transcript.text.trim(),
      durationMs: transcript.durationMs,
      source: transcript.source,
      ...(transcript.fallback && { fallback: transcript.fallback }),
    })
  );
}
