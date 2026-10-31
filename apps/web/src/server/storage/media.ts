import 'server-only';

import type { ChatMediaItem, ChatMessageData } from '@/features/copilot/types';
import { isR2Configured, resolveMediaUrl, uploadBufferToR2 } from './r2';

/** Chat media only: raster images and videos. SVG is excluded (it can carry scripts). */
export const MEDIA_CONTENT_TYPE =
  /^(image\/(png|jpe?g|webp|gif|avif)|video\/(mp4|webm|quicktime))$/i;

/** `data:<type>;base64,<payload>` → bytes; null when it is not a base64 data URL. */
export function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/** Storage backend (R2 in the app, a fake in tests). */
export interface MediaStore {
  configured: () => boolean;
  upload: (key: string, buffer: Buffer, contentType: string) => Promise<string>;
  resolve: (key: string) => Promise<string>;
}

export const r2MediaStore: MediaStore = {
  configured: isR2Configured,
  upload: uploadBufferToR2,
  resolve: resolveMediaUrl,
};

const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export interface StoreGeneratedImageOptions {
  sessionId: string;
  caption?: string;
  /** Keep the inline data URL when R2 is off (in-memory sessions only; never base64 in Postgres). */
  keepInline: boolean;
  store?: MediaStore;
  now?: number;
}

/**
 * Saves an AI-generated image so a reopened session can show it again.
 * Data URL + R2 → uploaded under `copilot/generated/<session>/`, saved by key. http(s) URL → kept as is.
 * Returns null when it cannot be kept (bad data, R2 off with a database, upload error); never throws.
 */
export async function storeGeneratedImage(
  imageUrl: string,
  opts: StoreGeneratedImageOptions
): Promise<ChatMediaItem | null> {
  const store = opts.store ?? r2MediaStore;
  const now = opts.now ?? Date.now();
  const base = { id: `gen-${now}`, type: 'image' as const, caption: opts.caption, generated: true };

  if (/^https?:\/\//i.test(imageUrl)) return { ...base, url: imageUrl };

  const parsed = parseDataUrl(imageUrl);
  if (!parsed || !EXTENSION[parsed.contentType.toLowerCase()]) return null;

  if (!store.configured()) {
    if (opts.keepInline) return { ...base, url: imageUrl };
    console.warn('[storage:media] R2 not configured: generated image not saved with the session.');
    return null;
  }

  const safeSession = opts.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const key = `copilot/generated/${safeSession}/${now}.${EXTENSION[parsed.contentType.toLowerCase()]}`;
  try {
    const url = await store.upload(key, parsed.buffer, parsed.contentType);
    return { ...base, url, key, size: parsed.buffer.length };
  } catch (err) {
    console.warn('[storage:media] Generated image upload failed:', err);
    return null;
  }
}

/** What a vision model reads: an http(s) link to the hosted photo, plus the inline data URL as a fallback. */
export interface VisionImage {
  url: string;
  /** Base64 data URL, set when `url` is a link (resent if Meta cannot download the link). */
  inlineUrl?: string;
}

/**
 * Photo for Muse / SAM: uploaded once to R2 under `vision/`, so every call sends a short link instead of
 * the base64 bytes (one Muse call + up to 8 SAM calls per photo). R2 off, not an image, or upload error →
 * the base64 data URL only. Never throws.
 */
export async function hostVisionImage(
  buffer: Buffer,
  contentType: string,
  opts: { store?: MediaStore; now?: number } = {}
): Promise<VisionImage> {
  const inlineUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
  const store = opts.store ?? r2MediaStore;
  const ext = EXTENSION[contentType.toLowerCase()];
  if (!ext || !store.configured()) return { url: inlineUrl };
  const now = opts.now ?? Date.now();
  const key = `vision/${now}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  try {
    const url = await store.upload(key, buffer, contentType);
    // A mock store path (`/mock-storage/…`) is not reachable from Meta.
    return /^https?:\/\//i.test(url) ? { url, inlineUrl } : { url: inlineUrl };
  } catch (err) {
    console.warn('[storage:media] Vision photo upload failed, sending base64:', err);
    return { url: inlineUrl };
  }
}

/**
 * Prepares saved messages for display: stored media get a fresh URL from their key, and the generated
 * image of an assistant message goes back to `imageUrl` / `imageCaption` (the AI image block).
 */
export async function hydrateMessageMedia(
  messages: ChatMessageData[],
  store: MediaStore = r2MediaStore
): Promise<ChatMessageData[]> {
  const canResolve = store.configured();
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg.media || msg.media.length === 0) return msg;
      const media = await Promise.all(
        msg.media.map(async (m) => {
          if (!m.key || !canResolve) return m;
          try {
            return { ...m, url: await store.resolve(m.key) };
          } catch {
            return m;
          }
        })
      );
      const generated = msg.role === 'assistant' ? media.find((m) => m.generated) : undefined;
      if (!generated) return { ...msg, media };
      const rest = media.filter((m) => m !== generated);
      return {
        ...msg,
        imageUrl: msg.imageUrl ?? generated.url,
        imageCaption: msg.imageCaption ?? generated.caption,
        media: rest.length > 0 ? rest : undefined,
      };
    })
  );
}
