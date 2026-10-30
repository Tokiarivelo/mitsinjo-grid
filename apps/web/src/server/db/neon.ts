import 'server-only';
import https from 'node:https';

import { neon, neonConfig } from '@neondatabase/serverless';
import { env } from '@/lib/env';
import type {
  ChatSessionSummary,
  ChatSessionDetail,
  ChatMessageData,
} from '@/features/copilot/types';

// Configure neonConfig to prioritize IPv4 over HTTPS in environments where IPv6 route may be unreachable
if (typeof https?.request === 'function') {
  neonConfig.fetchFunction = (url: string | URL | Request, options: RequestInit = {}) => {
    return new Promise<Response>((resolve, reject) => {
      const targetUrl =
        typeof url === 'string' ? new URL(url) : url instanceof URL ? url : new URL(url.url);

      const headers: Record<string, string> = {};
      if (options.headers) {
        if (typeof (options.headers as Headers).forEach === 'function') {
          (options.headers as Headers).forEach((val: string, key: string) => {
            headers[key] = val;
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([k, v]: [string, string]) => {
            headers[k] = v;
          });
        } else {
          Object.assign(headers, options.headers);
        }
      }

      const req = https.request(
        targetUrl,
        {
          method: options.method || 'GET',
          headers,
          family: 4, // Force IPv4 family
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve(
              new Response(body, {
                status: res.statusCode || 200,
                statusText: res.statusMessage || 'OK',
                headers: res.headers as HeadersInit,
              })
            );
          });
        }
      );

      req.on('error', reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  };
}

// In-memory fallback stores when DATABASE_URL is not configured
const inMemorySessions = new Map<string, ChatSessionSummary>();
const inMemoryMessages = new Map<string, ChatMessageData[]>();
const inMemorySummaries = new Map<string, SessionSummaryNote>();

/** Conversation summary of a session: text + how many payload messages it covers. */
export interface SessionSummaryNote {
  summary: string;
  summarizedCount: number;
}

let isMigrated = false;

export function isNeonConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

async function ensureNeonTables(sql: ReturnType<typeof neon<false, false>>) {
  if (isMigrated) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS copilot_sessions (
        id VARCHAR(64) PRIMARY KEY,
        title TEXT NOT NULL,
        locale VARCHAR(8) DEFAULT 'en',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS copilot_messages (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) REFERENCES copilot_sessions(id) ON DELETE CASCADE,
        role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        media JSONB,
        chart JSONB,
        sections JSONB,
        evidence JSONB,
        proposal JSONB,
        detected_model VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    // Later columns: operator decisions (M1) and the conversation summary (auto-compaction).
    await sql`ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS decision JSONB;`;
    await sql`ALTER TABLE copilot_sessions ADD COLUMN IF NOT EXISTS summary TEXT;`;
    await sql`ALTER TABLE copilot_sessions ADD COLUMN IF NOT EXISTS summarized_count INT DEFAULT 0;`;
    isMigrated = true;
    console.info('[db:neon] Tables initialized successfully');
  } catch (err) {
    console.error('[db:neon] Failed to initialize tables:', err);
  }
}

export async function listSessions(): Promise<ChatSessionSummary[]> {
  if (!isNeonConfigured()) {
    return Array.from(inMemorySessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  const sql = neon(env.DATABASE_URL!);
  await ensureNeonTables(sql);

  const rows = await sql`
    SELECT 
      s.id, 
      s.title, 
      s.locale, 
      s.created_at as "createdAt", 
      s.updated_at as "updatedAt",
      COUNT(m.id)::int as "messageCount"
    FROM copilot_sessions s
    LEFT JOIN copilot_messages m ON s.id = m.session_id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT 50;
  `;

  return rows as unknown as ChatSessionSummary[];
}

export async function getSession(id: string): Promise<ChatSessionDetail | null> {
  if (!isNeonConfigured()) {
    const summary = inMemorySessions.get(id);
    if (!summary) return null;
    const msgs = inMemoryMessages.get(id) || [];
    return { ...summary, ...inMemorySummaries.get(id), messages: msgs };
  }

  const sql = neon(env.DATABASE_URL!);
  await ensureNeonTables(sql);

  const sessionRows = await sql`
    SELECT id, title, locale, created_at as "createdAt", updated_at as "updatedAt",
      summary, summarized_count as "summarizedCount"
    FROM copilot_sessions
    WHERE id = ${id}
    LIMIT 1;
  `;

  if (sessionRows.length === 0) return null;
  const row = sessionRows[0] as unknown as ChatSessionSummary & {
    summary: string | null;
    summarizedCount: number | null;
  };
  const session = {
    ...row,
    summary: row.summary ?? undefined,
    summarizedCount: row.summarizedCount ?? 0,
  };

  const msgRows = await sql`
    SELECT 
      id,
      role,
      content,
      media,
      chart,
      sections,
      evidence,
      proposal,
      decision,
      detected_model as "detectedModel",
      created_at as "timestamp"
    FROM copilot_messages
    WHERE session_id = ${id}
    ORDER BY created_at ASC;
  `;

  return {
    ...session,
    messages: msgRows as unknown as ChatMessageData[],
  };
}

export async function createSession(
  title?: string,
  locale = 'fr',
  id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
): Promise<ChatSessionSummary> {
  const now = new Date().toISOString();
  const sessionTitle = title || (locale === 'fr' ? 'Session de simulation' : 'Simulation session');

  const session: ChatSessionSummary = {
    id,
    title: sessionTitle,
    locale,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };

  if (!isNeonConfigured()) {
    inMemorySessions.set(id, session);
    inMemoryMessages.set(id, []);
    return session;
  }

  const sql = neon(env.DATABASE_URL!);
  await ensureNeonTables(sql);

  await sql`
    INSERT INTO copilot_sessions (id, title, locale, created_at, updated_at)
    VALUES (${id}, ${sessionTitle}, ${locale}, ${now}, ${now});
  `;

  return session;
}

export async function saveMessage(sessionId: string, message: ChatMessageData): Promise<void> {
  const now = new Date().toISOString();

  if (!isNeonConfigured()) {
    if (!inMemorySessions.has(sessionId)) {
      await createSession(message.content.slice(0, 50) || undefined, 'fr', sessionId);
    }
    const msgs = inMemoryMessages.get(sessionId) || [];
    msgs.push(message);
    inMemoryMessages.set(sessionId, msgs);

    const s = inMemorySessions.get(sessionId);
    if (s) {
      s.updatedAt = now;
      s.messageCount = msgs.length;
    }
    return;
  }

  const sql = neon(env.DATABASE_URL!);
  await ensureNeonTables(sql);

  // Ensure session exists
  await sql`
    INSERT INTO copilot_sessions (id, title, created_at, updated_at)
    VALUES (${sessionId}, ${message.content.slice(0, 50) || 'Simulation session'}, ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET updated_at = ${now};
  `;

  await sql`
    INSERT INTO copilot_messages (
      id,
      session_id,
      role,
      content,
      media,
      chart,
      sections,
      evidence,
      proposal,
      decision,
      detected_model,
      created_at
    ) VALUES (
      ${message.id},
      ${sessionId},
      ${message.role},
      ${message.content || ''},
      ${message.media ? JSON.stringify(message.media) : null},
      ${message.chart ? JSON.stringify(message.chart) : null},
      ${message.sections ? JSON.stringify(message.sections) : null},
      ${message.evidence ? JSON.stringify(message.evidence) : null},
      ${message.proposal ? JSON.stringify(message.proposal) : null},
      ${message.decision ? JSON.stringify(message.decision) : null},
      ${message.detectedModel || null},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      content = ${message.content || ''},
      sections = ${message.sections ? JSON.stringify(message.sections) : null},
      evidence = ${message.evidence ? JSON.stringify(message.evidence) : null},
      proposal = ${message.proposal ? JSON.stringify(message.proposal) : null},
      chart = ${message.chart ? JSON.stringify(message.chart) : null};
  `;
}

/** Stores the session's conversation summary (auto-compaction); the session must exist. */
export async function saveSessionSummary(sessionId: string, note: SessionSummaryNote) {
  if (!isNeonConfigured()) {
    inMemorySummaries.set(sessionId, note);
    return;
  }
  const sql = neon(env.DATABASE_URL!);
  await ensureNeonTables(sql);
  await sql`
    INSERT INTO copilot_sessions (id, title, summary, summarized_count)
    VALUES (${sessionId}, 'Simulation session', ${note.summary}, ${note.summarizedCount})
    ON CONFLICT (id) DO UPDATE SET summary = ${note.summary}, summarized_count = ${note.summarizedCount};
  `;
}

export async function deleteSession(id: string): Promise<boolean> {
  if (!isNeonConfigured()) {
    inMemoryMessages.delete(id);
    inMemorySummaries.delete(id);
    return inMemorySessions.delete(id);
  }

  const sql = neon(env.DATABASE_URL!);
  await ensureNeonTables(sql);

  await sql`
    DELETE FROM copilot_sessions WHERE id = ${id};
  `;
  return true;
}
