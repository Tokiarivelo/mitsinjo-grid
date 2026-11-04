// Shared helpers for the capture run (VIDEO_PLAN.md § 6): browser launch, big cursor, eased moves.
const { createRequire } = require('module');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const req = createRequire(path.join(ROOT, 'apps/web/package.json'));
const { chromium } = req('@playwright/test');

// Page size in CSS px (VIDEO_W, 16:9) and screen pixels per CSS px (VIDEO_SCALE). Default: the app at
// 1920×1080 on the real screen, scale 1, like a desktop browser. Xvfb tops out near 10 fps
// at 1080p (software compositing), so record on the real display.
const VW = Number(process.env.VIDEO_W || 1920);
const VH = Math.round((VW * 9) / 16);
const SCALE = Number(process.env.VIDEO_SCALE || 1);
const BASE = process.env.VIDEO_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

// Big white cursor overlay (plan § 6.5) + hide the Next.js dev badge and scrollbars.
const CURSOR_JS = `
(() => {
  if (window.__vcur) return;
  const add = () => {
    const s = document.createElement('style');
    s.textContent = 'nextjs-portal,[aria-label="Fire notifications"],[role=alert].border-critical-red{display:none!important} ::-webkit-scrollbar{display:none} *{scrollbar-width:none} #__vcur{position:fixed;left:0;top:0;width:44px;height:44px;pointer-events:none;z-index:2147483647;transition:transform 90ms ease-out;transform-origin:4px 3px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.55))}';
    document.head.appendChild(s);
    const m = document.createElement('meta'); m.name = 'google'; m.content = 'notranslate'; document.head.appendChild(m);
    document.documentElement.setAttribute('translate', 'no');
    const c = document.createElement('div'); c.id='__vcur';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="44" height="44"><path d="M4 3l15 8.5-6.6 1.6 3.9 6.9-2.6 1.5-3.9-6.9L5 19.6z" fill="#fff" stroke="#0b1220" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c); window.__vcur = c;
    const st = { x: innerWidth/2, y: innerHeight/2, d: 1 };
    const draw = () => { c.style.left = st.x+'px'; c.style.top = st.y+'px'; c.style.transform = 'scale('+st.d+')'; };
    addEventListener('mousemove', e => { st.x=e.clientX; st.y=e.clientY; draw(); }, true);
    addEventListener('mousedown', () => { st.d=.85; draw(); }, true);
    addEventListener('mouseup', () => { st.d=1; draw(); }, true);
    draw();
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})();`;

async function launch({ headed, fakeAudio }) {
  const args = [
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--disable-infobars',
    '--use-fake-ui-for-media-stream',
    '--disable-features=Translate,TranslateUI',
    '--lang=en-US',
    '--start-fullscreen',
  ];
  if (headed)
    args.push(
      '--use-angle=gl', // NVIDIA GL on the real screen (Vulkan has no WebGL there)
      '--kiosk',
      '--window-position=0,0',
      `--window-size=${Math.round(VW * SCALE)},${Math.round(VH * SCALE)}`,
      `--force-device-scale-factor=${SCALE}`
    );
  else args.push('--use-angle=vulkan', '--enable-features=Vulkan'); // headless GPU: ~60 fps for dry runs
  const browser = await chromium.launch({
    headless: !headed,
    args,
    env: { ...process.env, LANGUAGE: 'en_US', LANG: 'en_US.UTF-8' },
    ignoreDefaultArgs: ['--enable-automation', '--mute-audio'],
  });
  const ctx = await browser.newContext(
    headed
      ? { viewport: null, colorScheme: 'dark', locale: 'en-US', permissions: ['microphone'] }
      : {
          viewport: { width: VW, height: VH },
          deviceScaleFactor: 1,
          colorScheme: 'dark',
          locale: 'en-US',
          permissions: ['microphone'],
        }
  );
  await ctx.addInitScript(CURSOR_JS);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'dark');
    } catch {}
  });
  if (fakeAudio) {
    // Virtual mic: getUserMedia plays the spoken question WAV (served at /__mic.wav), so the real
    // MediaRecorder → /api/voice → Muse Voice path runs exactly as with a person speaking.
    await ctx.route('**/__mic.wav', (r) =>
      r.fulfill({ path: fakeAudio, contentType: 'audio/wav' })
    );
    await ctx.addInitScript(() => {
      const orig = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      if (!orig) return;
      navigator.mediaDevices.getUserMedia = async (c) => {
        if (!c || !c.audio || c.video) return orig(c);
        const ctx = new AudioContext();
        const buf = await (await fetch('/__mic.wav')).arrayBuffer();
        const audio = await ctx.decodeAudioData(buf);
        const src = ctx.createBufferSource();
        src.buffer = audio;
        const dst = ctx.createMediaStreamDestination();
        src.connect(dst);
        src.start();
        return dst.stream;
      };
    });
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(20_000);
  if (headed) {
    // No window manager on Xvfb, so --kiosk is ignored: ask Chromium itself to go fullscreen.
    const cdp = await ctx.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
  }
  return { browser, ctx, page };
}

// Human-like helpers: eased cursor moves (plan § 6.5: steps 30, 400 ms before / 600 ms after a click).
const cur = { x: VW / 2, y: VH / 2 };
function helpers(page) {
  const wait = (ms) => page.waitForTimeout(ms);
  async function moveTo(x, y, steps = 28) {
    const sx = cur.x,
      sy = cur.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps,
        e = 1 - Math.pow(1 - t, 3);
      const arc = Math.sin(Math.PI * t) * 18;
      await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e - arc);
      await wait(12);
    }
    cur.x = x;
    cur.y = y;
  }
  async function moveToEl(loc) {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error('no box for ' + loc);
    await moveTo(b.x + b.width / 2, b.y + b.height / 2);
    return b;
  }
  async function click(loc, { before = 350, after = 550 } = {}) {
    await moveToEl(loc);
    await wait(before);
    // Re-aim if the layout moved during the approach (alert banners, toasts).
    const b = await loc.boundingBox();
    if (
      b &&
      (Math.abs(b.x + b.width / 2 - cur.x) > 3 || Math.abs(b.y + b.height / 2 - cur.y) > 3)
    ) {
      await moveTo(b.x + b.width / 2, b.y + b.height / 2, 10);
    }
    await page.mouse.down();
    await wait(70);
    await page.mouse.up();
    await wait(after);
  }
  async function hover(loc, ms = 500) {
    await moveToEl(loc);
    await wait(ms);
  }
  return { wait, moveTo, moveToEl, click, hover };
}

module.exports = { launch, helpers, BASE, ROOT, SCALE, VW, VH };
