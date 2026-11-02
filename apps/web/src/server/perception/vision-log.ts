/**
 * What a logged vision call is: `kind` selects the `[vision] 3D …` lines, `params` are the
 * structured call arguments (target label, category, aspect…) logged verbatim except images.
 */
export interface VisionCallLog {
  kind: string;
  params?: Record<string, unknown>;
}

/**
 * JSON replacer: data URLs (base64 pixels, tens of KB) log as a short placeholder with their
 * length; everything else — short http(s) links included — logs verbatim. Also usable standalone
 * (`redactDataUrls('image', url)`) for a single value.
 */
export function redactDataUrls(_key: string, value: unknown): unknown {
  return typeof value === 'string' && value.startsWith('data:') && value.includes(',')
    ? `[image data-url, ${value.length} chars]`
    : value;
}

/** Raw model text with any embedded data URL replaced by the same short placeholder. */
export function redactDataUrlsInText(text: string): string {
  return text.replace(/data:[^\s"'`]+/g, (m) => `[image data-url, ${m.length} chars]`);
}
