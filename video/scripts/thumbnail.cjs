// Render the YouTube thumbnail: node thumbnail.cjs [out.png] → 1280 × 720 PNG from canvas/thumbnail.html.
const path = require('path');
const { pathToFileURL } = require('url');
const { createRequire } = require('module');
const req = createRequire(path.resolve(__dirname, '../../apps/web/package.json'));
const { chromium } = req('@playwright/test');

(async () => {
  const out = process.argv[2] || path.resolve(__dirname, '../output/thumbnail.png');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(pathToFileURL(path.resolve(__dirname, '../canvas/thumbnail.html')).href);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out });
  await b.close();
  console.log(out);
})();
