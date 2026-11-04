// Render a canvas page frame by frame (VIDEO_PLAN.md § 7): node render-canvas.cjs <page.html[?query]> <out-dir> [--alpha]
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createRequire } = require('module');
const req = createRequire(path.resolve(__dirname, '../../apps/web/package.json'));
const { chromium } = req('@playwright/test');

(async () => {
  const [pageArg, out] = process.argv.slice(2);
  const alpha = process.argv.includes('--alpha');
  const [file, query] = pageArg.split('?');
  const url = pathToFileURL(path.resolve(file)).href + (query ? '?' + query : '');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await p.goto(url);
  await p.waitForFunction(() => window.__ready);
  const dur = await p.evaluate(() => window.__duration);
  const n = Math.round((dur / 1000) * 30);
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => window.__seek(t), (i * 1000) / 30);
    await p.screenshot({
      path: path.join(out, `${String(i).padStart(5, '0')}.png`),
      omitBackground: alpha,
    });
  }
  await b.close();
  console.log(`${out}: ${n} frames`);
})();
