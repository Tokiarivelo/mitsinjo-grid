import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { ScenarioDraftSchema } from '@/lib/scenario-draft';
import { saveScenarioDraft, listScenarioDrafts, deleteScenarioDraft } from '@/server/db/neon';

const SaveDraftBodySchema = z.object({
  draft: ScenarioDraftSchema,
  title: z.string().optional(),
  summary: z.record(z.unknown()).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function GET() {
  try {
    const drafts = await listScenarioDrafts();
    return json({ drafts });
  } catch (err) {
    console.error('[api:scenarios:drafts] GET failed:', err);
    return json({ error: 'Failed to list drafts' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SaveDraftBodySchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid draft body', issues: parsed.error.issues }, 400);
    }

    const { draft, title, summary } = parsed.data;
    const id = await saveScenarioDraft(draft, title, summary);
    return json({ id });
  } catch (err) {
    console.error('[api:scenarios:drafts] POST failed:', err);
    return json({ error: 'Failed to save draft' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return json({ error: 'Missing id query parameter' }, 400);
    }

    const ok = await deleteScenarioDraft(id);
    return json({ ok });
  } catch (err) {
    console.error('[api:scenarios:drafts] DELETE failed:', err);
    return json({ error: 'Failed to delete draft' }, 500);
  }
}
