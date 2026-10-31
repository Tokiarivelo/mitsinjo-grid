import { describe, expect, it } from 'vitest';
import { parseSseChunk, readSseStream } from '../sse';

describe('parseSseChunk', () => {
  it('returns complete events and keeps the unfinished tail', () => {
    const { events, rest } = parseSseChunk(
      'event: a\ndata: {"x":1}\n\nevent: b\ndata: not json\n\nevent: c\ndata: {"y"'
    );
    expect(events).toEqual([
      { event: 'a', data: { x: 1 } },
      { event: 'b', data: {} },
    ]);
    expect(rest).toBe('event: c\ndata: {"y"');
  });

  it('skips blocks without an event name or data', () => {
    expect(parseSseChunk('data: {}\n\nevent: x\n\n').events).toEqual([]);
  });
});

describe('readSseStream', () => {
  it('reads events split across chunks, in order', async () => {
    const chunks = ['event: a\ndata: {"n"', ':1}\n\nevent: b\ndata: {"n":2}\n\n'];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
        c.close();
      },
    });
    const seen: [string, unknown][] = [];
    await readSseStream(body, (e, d) => seen.push([e, d]));
    expect(seen).toEqual([
      ['a', { n: 1 }],
      ['b', { n: 2 }],
    ]);
  });
});
