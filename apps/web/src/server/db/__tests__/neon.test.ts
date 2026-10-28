import { describe, it, expect } from 'vitest';
import {
  isNeonConfigured,
  createSession,
  listSessions,
  saveMessage,
  getSession,
  deleteSession,
} from '../neon';

describe('Neon DB Chat Session Storage', () => {
  it('detects whether Neon DB is configured', () => {
    expect(typeof isNeonConfigured()).toBe('boolean');
  });

  it('creates, lists, retrieves, and deletes chat sessions', async () => {
    const session = await createSession('Test Microgrid Chat', 'fr');
    expect(session).toHaveProperty('id');
    expect(session.title).toBe('Test Microgrid Chat');
    expect(session.locale).toBe('fr');

    // List sessions
    const sessions = await listSessions();
    expect(sessions.some((s) => s.id === session.id)).toBe(true);

    // Save a message to the session
    await saveMessage(session.id, {
      id: 'msg-1',
      role: 'user',
      content: 'What is the battery SoC at hour 14?',
      timestamp: '14:00:00',
    });

    await saveMessage(session.id, {
      id: 'msg-2',
      role: 'assistant',
      content: 'The battery SoC at hour 14 is 58.4%.',
      detectedModel: 'muse-spark-1.3',
      timestamp: '14:00:02',
    });

    // Retrieve session with messages
    const detail = await getSession(session.id);
    expect(detail).not.toBeNull();
    expect(detail!.messages.length).toBe(2);
    expect(detail!.messages[0]?.content).toBe('What is the battery SoC at hour 14?');
    expect(detail!.messages[1]?.detectedModel).toBe('muse-spark-1.3');

    // Delete session
    const deleted = await deleteSession(session.id);
    expect(deleted).toBe(true);

    const afterDelete = await getSession(session.id);
    expect(afterDelete).toBeNull();
  });
});
