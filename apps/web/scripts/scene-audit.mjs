// 3D scene audit: screenshots the WebGL scene and reads draw calls / fps from ?perf=1.
// Usage: node scripts/scene-audit.mjs <baseUrl> <outDir>   (dev or prod server must run)
// Headless Chromium uses SwiftShader (software WebGL): draw calls are exact,
// fps is a CPU-bound lower bound, not an integrated-GPU number.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [baseUrl = 'http://localhost:3000', outDir = 'design/shots'] = process.argv.slice(2);
const DRAW_CALL_BUDGET = 150;
const TRIANGLE_BUDGET = 150_000;
const ROUTES = [
  { route: 'simulation', file: 'simulation-3d.png' },
  { route: 'overview', file: 'overview-3d.png' },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let failed = false;

for (const { route, file } of ROUTES) {
  await page.goto(`${baseUrl}/${route}?perf=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 30_000 });
  // Show computed values, not the empty pre-run state.
  const run = page.getByRole('button', { name: /run simulation/i }).first();
  if (await run.isVisible().catch(() => false)) await run.click();
  // The app scrolls an inner container, not the window: reset every scrolled element.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollTop > 0) el.scrollTop = 0;
    });
  });
  // Let the camera settle and collect a few 500 ms samples while flows animate.
  await page.waitForTimeout(4000);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    samples.push(await page.evaluate(() => window.__mitsinjoScene ?? null));
    await page.waitForTimeout(500);
  }
  const valid = samples.filter(Boolean);
  const calls = Math.max(0, ...valid.map((s) => s.calls));
  const triangles = Math.max(0, ...valid.map((s) => s.triangles));
  const fps = valid.length ? Math.round(valid.reduce((a, s) => a + s.fps, 0) / valid.length) : 0;
  await page.screenshot({ path: join(outDir, file) });
  const ok = valid.length > 0 && calls < DRAW_CALL_BUDGET && triangles <= TRIANGLE_BUDGET;
  failed ||= !ok;
  console.log(
    `${ok ? '✓' : '✗'} /${route}: ${calls} draw calls (<${DRAW_CALL_BUDGET}), ${triangles} triangles (≤${TRIANGLE_BUDGET}), ~${fps} fps (software GL) → ${join(outDir, file)}`
  );
}

await browser.close();
process.exit(failed ? 1 : 0);
