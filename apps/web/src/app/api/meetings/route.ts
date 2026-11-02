import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { InputPatchSchema } from '@mitsinjo/engine';
import { getPerceptionClient } from '@/server/perception';
import { extractMeetingPriorities } from '@/lib/meeting-priorities';

/** 5 min of 16 kHz mono 16-bit WAV ≈ 9.6 MB; a little headroom for the header. */
export const MAX_MEETING_BYTES = 10_000_000;

const LANGUAGE_NAMES = { en: 'English', fr: 'French', mg: 'Malagasy' } as const;
const MEETING_KEYWORDS = [
  'clinique',
  'clinic',
  'marché',
  'market',
  'école',
  'school',
  'batterie',
  'solaire',
  'priorité',
  'priority',
  'laharana',
];

const FieldsSchema = z.object({
  locale: z.enum(['en', 'fr', 'mg']).default('fr'),
  sessionId: z.string().max(64).optional(),
});

const MeetingResponseSchema = z.object({
  turns: z.array(
    z.object({
      speaker: z.string().optional(),
      text: z.string(),
      startMs: z.number().int().min(0),
      endMs: z.number().int().min(0),
    })
  ),
  priorities: z.array(
    z.object({
      speaker: z.string().nullable(),
      sector: z.string(),
      want: z.enum(['protect', 'mention', 'deprioritize']),
      quote: z.string(),
      timeNote: z.enum(['morning', 'midday', 'evening', 'night']).optional(),
    })
  ),
  patch: InputPatchSchema,
  unmapped: z.array(z.object({ quote: z.string(), reason: z.string() })),
  source: z.enum(['meta', 'mock']),
  fallback: z.enum(['provider_error', 'spend_cap', 'not_configured']).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Village meeting (M10-T4): multipart `audio` (WAV, ≤ MAX_MEETING_BYTES), `locale`,
 * `sessionId`. Transcribes with diarization, extracts social priorities deterministically,
 * and returns the turns + who-wants-what + proposed patch. The audio is not stored.
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
  if (audio.size > MAX_MEETING_BYTES) return json({ error: 'Audio too long (max 5 min)' }, 413);
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
    keywords: MEETING_KEYWORDS,
    diarize: true,
    fileName: 'meeting.wav',
  });
  const turns = transcript.turns.map((t) => ({
    ...(t.speaker ? { speaker: t.speaker } : {}),
    text: t.text,
    startMs: t.startMs,
    endMs: t.endMs,
  }));
  const { priorities, patch, unmapped } = extractMeetingPriorities(turns);
  return json(
    MeetingResponseSchema.parse({
      turns,
      priorities,
      patch,
      unmapped,
      source: transcript.source,
      ...(transcript.fallback && { fallback: transcript.fallback }),
    })
  );
}
