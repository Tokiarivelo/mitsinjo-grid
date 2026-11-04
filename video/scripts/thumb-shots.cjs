// Grab the two 3D stills the thumbnail uses (village by day, same village at night) in high resolution:
// node thumb-shots.cjs → images/thumb-day.jpg, images/thumb-night.jpg. Needs the app running (make dev).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');
const req = createRequire(path.resolve(__dirname, '../../apps/web/package.json'));
const { chromium } = req('@playwright/test');

const BASE = process.env.VIDEO_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
const IMG = path.resolve(__dirname, '../images');
const TMP = path.resolve(__dirname, '../frames/thumb');

// Keep the scene and its sector labels; hide app chrome drawn over the canvas.
const HIDE_CSS = `nextjs-portal,[aria-label="Fire notifications"],[role=alert]{display:none!important}
  ::-webkit-scrollbar{display:none}`;

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan',
      '--ignore-gpu-blocklist',
      '--lang=en-US',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    locale: 'en-US',
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'dark');
    } catch {}
  });
  await page.goto(`${BASE}/simulation`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_CSS });
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ timeout: 60_000 });
  const click = (name) =>
    page.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click();
  await click('High').catch(() => {});
  const scrub = page
    .getByRole('slider', { name: /Hour of day scrubber/i })
    .filter({ visible: true })
    .first();
  const full = page.getByRole('button', { name: 'Full screen', exact: true }).first();

  async function still(hour, camera, out) {
    await scrub.fill(String(hour));
    await click(camera);
    if (await full.isVisible().catch(() => false)) {
      await full.click();
      await page.waitForTimeout(1200);
      // Full screen opens the controls and copilot panels over the scene: close both.
      // Full screen opens the controls and copilot panels over the scene: close both.
      for (const name of ['Hide the simulation controls', 'Hide the copilot terminal'])
        await click(name).catch(() => {});
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(6000); // camera flight + shadows settle
    // Full-screen 3D view, cropped to 16:9 below its toolbars and above the sector legend.
    const top = 64;
    const height = 880 - top;
    const width = Math.round((height * 16) / 9);
    const clip = { x: (1920 - width) / 2, y: top, width, height };
    const png = path.join(TMP, `${out}.png`);
    await page.screenshot({ path: png, clip });
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      png,
      '-q:v',
      '2',
      path.join(IMG, `${out}.jpg`),
    ]);
    console.log(out, Math.round(clip.width * 2), '×', Math.round(clip.height * 2));
  }
  await still(11, 'Village', 'thumb-day');
  await still(20, 'Essential', 'thumb-night');
  await page.screenshot({ path: path.join(TMP, 'page.png') });
  await browser.close();
})();
