import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { listSessions, createSession, isNeonConfigured } from '@/server/db/neon';

const CreateSessionSchema = z.object({
  title: z.string().max(100).optional(),
  locale: z.enum(['en', 'fr', 'mg']).optional(),
});

export async function GET() {
  try {
    const sessions = await listSessions();
    return new Response(
      JSON.stringify({
        sessions,
        dbConfigured: isNeonConfigured(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[api:copilot:sessions] Failed to list sessions:', err);
    return new Response(JSON.stringify({ error: 'Failed to list chat sessions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    let json: unknown = {};
    try {
      json = await req.json();
    } catch {
      json = {};
    }

    const parsed = CreateSessionSchema.safeParse(json);
    const title = parsed.success ? parsed.data.title : undefined;
    const locale = parsed.success ? parsed.data.locale : undefined;

    const session = await createSession(title, locale);
    return new Response(JSON.stringify({ session, dbConfigured: isNeonConfigured() }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api:copilot:sessions] Failed to create session:', err);
    return new Response(JSON.stringify({ error: 'Failed to create chat session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
