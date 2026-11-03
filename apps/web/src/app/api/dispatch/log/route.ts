import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { DispatchLogEntrySchema } from '@mitsinjo/engine';
import {
  listDispatchLog,
  saveDispatchLogEntry,
  saveDispatchLogEntries,
  clearDispatchLog,
  isNeonConfigured,
} from '@/server/db/neon';

const PostBodySchema = z.union([DispatchLogEntrySchema, z.array(DispatchLogEntrySchema)]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;
    const entries = await listDispatchLog(limit);
    return new Response(
      JSON.stringify({
        entries,
        dbConfigured: isNeonConfigured(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[api:dispatch:log] Failed to list dispatch log:', err);
    return new Response(JSON.stringify({ error: 'Failed to list dispatch log' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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

    const parsed = PostBodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (Array.isArray(parsed.data)) {
      await saveDispatchLogEntries(parsed.data);
    } else {
      await saveDispatchLogEntry(parsed.data);
    }

    return new Response(JSON.stringify({ ok: true, dbConfigured: isNeonConfigured() }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api:dispatch:log] Failed to save dispatch log:', err);
    return new Response(JSON.stringify({ error: 'Failed to save dispatch log' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE() {
  try {
    await clearDispatchLog();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api:dispatch:log] Failed to clear dispatch log:', err);
    return new Response(JSON.stringify({ error: 'Failed to clear dispatch log' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
