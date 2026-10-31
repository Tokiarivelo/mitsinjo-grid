import { describe, it, expect, vi } from 'vitest';
import {
  hostVisionImage,
  hydrateMessageMedia,
  parseDataUrl,
  storeGeneratedImage,
  type MediaStore,
} from '../media';
import type { ChatMessageData } from '@/features/copilot/types';

const PNG = `data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`;

function fakeStore(configured = true): MediaStore & { upload: ReturnType<typeof vi.fn> } {
  return {
    configured: () => configured,
    upload: vi.fn(async (key: string) => `https://signed.example/${key}?v=1`),
    resolve: vi.fn(async (key: string) => `https://signed.example/${key}?v=2`),
  };
}

describe('parseDataUrl', () => {
  it('decodes base64 data URLs and rejects others', () => {
    const p = parseDataUrl(PNG);
    expect(p?.contentType).toBe('image/png');
    expect(p?.buffer.toString()).toBe('png-bytes');
    expect(parseDataUrl('https://x/y.png')).toBeNull();
  });
});

describe('storeGeneratedImage', () => {
  it('uploads a generated data URL to R2 under the session folder and keeps its key', async () => {
    const store = fakeStore();
    const item = await storeGeneratedImage(PNG, {
      sessionId: 'session-1',
      caption: 'Village at 20:00',
      keepInline: false,
      store,
      now: 42,
    });
    expect(store.upload).toHaveBeenCalledWith(
      'copilot/generated/session-1/42.png',
      expect.any(Buffer),
      'image/png'
    );
    expect(item).toMatchObject({
      key: 'copilot/generated/session-1/42.png',
      generated: true,
      type: 'image',
      caption: 'Village at 20:00',
    });
    expect(item?.url.startsWith('data:')).toBe(false);
  });

  it('never stores base64 in a database: R2 off + database → null; in-memory → inline kept', async () => {
    expect(
      await storeGeneratedImage(PNG, { sessionId: 's', keepInline: false, store: fakeStore(false) })
    ).toBeNull();
    const inline = await storeGeneratedImage(PNG, {
      sessionId: 's',
      keepInline: true,
      store: fakeStore(false),
    });
    expect(inline?.url).toBe(PNG);
  });

  it('upload error → null, never throws; remote URL kept as is', async () => {
    const store = fakeStore();
    store.upload.mockRejectedValueOnce(new Error('R2 down'));
    expect(await storeGeneratedImage(PNG, { sessionId: 's', keepInline: false, store })).toBeNull();
    const remote = await storeGeneratedImage('https://cdn.example/img.webp', {
      sessionId: 's',
      keepInline: false,
      store,
    });
    expect(remote?.url).toBe('https://cdn.example/img.webp');
  });

  it('rejects non-image data URLs (e.g. SVG)', async () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`;
    expect(
      await storeGeneratedImage(svg, { sessionId: 's', keepInline: true, store: fakeStore() })
    ).toBeNull();
  });
});

describe('hydrateMessageMedia (reopened session)', () => {
  it('re-signs stored media and puts the generated image back in the AI image block', async () => {
    const messages: ChatMessageData[] = [
      {
        id: 'u1',
        role: 'user',
        content: 'Look at this sky',
        media: [{ id: 'm', type: 'image', url: 'https://expired', key: 'copilot/1-sky.png' }],
      },
      {
        id: 'a1',
        role: 'assistant',
        content: 'Here is the village.',
        media: [
          {
            id: 'g',
            type: 'image',
            url: 'https://expired',
            key: 'copilot/generated/s/1.webp',
            caption: 'Village at 20:00',
            generated: true,
          },
        ],
      },
    ];
    const [user, assistant] = await hydrateMessageMedia(messages, fakeStore());
    expect(user?.media?.[0]?.url).toBe('https://signed.example/copilot/1-sky.png?v=2');
    expect(assistant?.imageUrl).toBe('https://signed.example/copilot/generated/s/1.webp?v=2');
    expect(assistant?.imageCaption).toBe('Village at 20:00');
    expect(assistant?.media).toBeUndefined();
  });

  it('keeps URLs untouched when R2 is off', async () => {
    const msgs: ChatMessageData[] = [
      {
        id: 'a',
        role: 'assistant',
        content: 'x',
        media: [{ id: 'g', type: 'image', url: 'data:image/png;base64,AA', generated: true }],
      },
    ];
    const [a] = await hydrateMessageMedia(msgs, fakeStore(false));
    expect(a?.imageUrl).toBe('data:image/png;base64,AA');
  });
});

describe('hostVisionImage (PV)', () => {
  const bytes = Buffer.from('jpeg-bytes');
  const inline = `data:image/jpeg;base64,${bytes.toString('base64')}`;

  it('R2 on: uploads once under vision/ and returns the link plus the inline fallback', async () => {
    const store = fakeStore();
    const out = await hostVisionImage(bytes, 'image/jpeg', { store, now: 42 });
    expect(store.upload).toHaveBeenCalledTimes(1);
    expect(store.upload.mock.calls[0]![0]).toMatch(/^vision\/42-[a-z0-9]+\.jpg$/);
    expect(out.url).toMatch(/^https:\/\/signed\.example\/vision\//);
    expect(out.inlineUrl).toBe(inline);
  });

  it('R2 off, upload error or a non-http link → base64 only', async () => {
    expect(await hostVisionImage(bytes, 'image/jpeg', { store: fakeStore(false) })).toEqual({
      url: inline,
    });
    const failing = fakeStore();
    failing.upload.mockRejectedValueOnce(new Error('down'));
    expect(await hostVisionImage(bytes, 'image/jpeg', { store: failing })).toEqual({ url: inline });
    const local = fakeStore();
    local.upload.mockResolvedValueOnce('/mock-storage/vision/x.jpg');
    expect(await hostVisionImage(bytes, 'image/jpeg', { store: local })).toEqual({ url: inline });
  });
});
