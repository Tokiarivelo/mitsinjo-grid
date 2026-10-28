// 3D scene audit: screenshots the WebGL scene per quality tier and reads draw calls /
// triangles / fps from ?perf=1. Each tier has its own budget (docs/performance.md).
// Usage: node scripts/scene-audit.mjs <baseUrl> <outDir>   (dev or prod server must run)
// Env: SCENE_AUDIT_GL=gpu  → use the real GPU (needed for a meaningful `high` fps;
//      the default SwiftShader software GL gives exact draw calls but CPU-bound fps).
//      SCENE_AUDIT_TIERS=low,high (default both; `high` is slow on software GL).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [baseUrl = 'http://localhost:3000', outDir = 'design/shots'] = process.argv.slice(2);

/** Per-frame totals, including the shadow-map pass and post-processing on `high`. */
const BUDGETS = {
  low: { calls: 150, triangles: 150_000 },
  high: { calls: 400, triangles: 800_000 },
};
const TIERS = (process.env.SCENE_AUDIT_TIERS ?? 'low,high').split(',').map((t) => t.trim());
const ROUTES = [
  { route: 'simulation', file: (tier) => `simulation-3d${tier === 'high' ? '' : `-${tier}`}.png` },
  { route: 'overview', file: (tier) => `overview-3d${tier === 'high' ? '' : `-${tier}`}.png` },
];
const GL_ARGS =
  process.env.SCENE_AUDIT_GL === 'gpu'
    ? ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: GL_ARGS });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let failed = false;

for (const tier of TIERS) {
  const budget = BUDGETS[tier];
  if (!budget) throw new Error(`Unknown tier "${tier}" (use low or high)`);
  for (const { route, file } of ROUTES) {
    // ?quality forces the tier (no auto-downgrade, not persisted).
    await page.goto(`${baseUrl}/${route}?perf=1&quality=${tier}`, { waitUntil: 'networkidle' });
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
    // Let assets load and the camera settle, then sample while flows animate.
    await page.waitForTimeout(6000);
    const samples = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await page.evaluate(() => window.__mitsinjoScene ?? null));
      await page.waitForTimeout(500);
    }
    const valid = samples.filter(Boolean);
    const calls = Math.max(0, ...valid.map((s) => s.calls));
    const triangles = Math.max(0, ...valid.map((s) => s.triangles));
    const fps = valid.length ? Math.round(valid.reduce((a, s) => a + s.fps, 0) / valid.length) : 0;
    const out = join(outDir, file(tier));
    await page.screenshot({ path: out, timeout: 120_000 });
    const ok = valid.length > 0 && calls < budget.calls && triangles <= budget.triangles;
    failed ||= !ok;
    console.log(
      `${ok ? '✓' : '✗'} [${tier}] /${route}: ${calls} draw calls (<${budget.calls}), ${triangles} triangles (≤${budget.triangles}), ~${fps} fps (${process.env.SCENE_AUDIT_GL === 'gpu' ? 'GPU' : 'software GL'}) → ${out}`
    );
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
