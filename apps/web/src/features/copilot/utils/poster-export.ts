/**
 * PNG export for the shedding poster (M5-T3): the AI picture with the engine hours drawn over it.
 * No dependency: plain canvas 2D. Never throws — false when the browser cannot draw or download.
 */

const POSTER_WIDTH = 1200;
const LINE_HEIGHT = 64;
const TITLE_SIZE = 52;
const ROW_SIZE = 40;
const PAD = 56;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/** First line = title, the rest = cut rows. True once the download started. */
export async function exportPosterPng(
  imageUrl: string,
  lines: string[],
  filename: string
): Promise<boolean> {
  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement('canvas');
    const height = Math.max(
      600,
      Math.round((POSTER_WIDTH * (img?.height || 800)) / (img?.width || 1200))
    );
    canvas.width = POSTER_WIDTH;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    if (img) {
      const scale = Math.max(POSTER_WIDTH / img.width, height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (POSTER_WIDTH - w) / 2, (height - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#101828';
      ctx.fillRect(0, 0, POSTER_WIDTH, height);
    }

    // Bottom band for the hours: dark veil so the text stays readable on any picture.
    const bandH = PAD * 2 + lines.length * LINE_HEIGHT;
    ctx.fillStyle = 'rgba(8, 12, 24, 0.82)';
    ctx.fillRect(0, height - bandH, POSTER_WIDTH, bandH);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? '700' : '400'} ${i === 0 ? TITLE_SIZE : ROW_SIZE}px system-ui, sans-serif`;
      ctx.fillText(line, PAD, height - bandH + PAD + i * LINE_HEIGHT);
    });

    const url = canvas.toDataURL('image/png');
    if (!url.startsWith('data:image/png')) return false;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    return true;
  } catch {
    return false;
  }
}
