/** One server-sent event: name + JSON data (`{}` when the data is not valid JSON). */
export interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

/** Complete `event:`/`data:` blocks in `buffer`, and the unfinished tail to keep for the next chunk. */
export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: SseEvent[] = [];
  for (const part of parts) {
    let event = '';
    let dataStr = '';
    for (const line of part.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
    }
    if (!event || !dataStr) continue;
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(dataStr);
    } catch {
      data = {};
    }
    events.push({ event, data });
  }
  return { events, rest };
}

/** Reads an SSE response body to the end, calling `onEvent` for each event in order. */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;
    for (const e of events) onEvent(e.event, e.data);
  }
}
