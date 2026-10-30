import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession, saveMessage, deleteSession } from '@/server/db/neon';
import { hydrateMessageMedia } from '@/server/storage/media';

const SaveMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'error', 'decision']),
  content: z.string(),
  sections: z.record(z.string()).optional(),
  evidence: z.array(z.any()).optional(),
  proposal: z.any().optional(),
  /** Operator decision on a proposal (role `decision`). */
  decision: z
    .object({
      proposalId: z.string().max(64),
      status: z.enum(['approved', 'rejected']),
      items: z
        .array(z.object({ label: z.string(), current: z.string(), proposed: z.string() }))
        .max(40),
      patch: z.record(z.unknown()).optional(),
      strategy: z.enum(['proportional', 'essential_first', 'balanced']).optional(),
    })
    .optional(),
  imageUrl: z.string().optional(),
  imageCaption: z.string().optional(),
  videoUrl: z.string().optional(),
  videoCaption: z.string().optional(),
  media: z.array(z.any()).optional(),
  chart: z.any().optional(),
  detectedModel: z.string().optional(),
  timestamp: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession(id);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fresh R2 links + generated images back in their AI block.
    const messages = await hydrateMessageMedia(session.messages);
    return new Response(JSON.stringify({ session: { ...session, messages } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[api:copilot:sessions:${id}] Error getting session:`, err);
    return new Response(JSON.stringify({ error: 'Failed to retrieve session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const json = await req.json();
    const parsed = SaveMessageSchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid message schema', details: parsed.error.issues }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await saveMessage(id, parsed.data);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[api:copilot:sessions:${id}] Error saving message:`, err);
    return new Response(JSON.stringify({ error: 'Failed to save message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deleted = await deleteSession(id);
    return new Response(JSON.stringify({ success: deleted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[api:copilot:sessions:${id}] Error deleting session:`, err);
    return new Response(JSON.stringify({ error: 'Failed to delete session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
