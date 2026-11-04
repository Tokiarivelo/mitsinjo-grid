// Capture run (VIDEO_PLAN.md § 6). One browser session drives the live app; each shot is its own clip.
//   node capture.cjs [--dry] [--only A1,A2] [--part a|b]
// --dry: headless, screenshots instead of video (frames/dry/). Otherwise: headed fullscreen 1920×1080 on
// $DISPLAY (the real screen: capture.sh keeps it from locking) and ffmpeg x11grab per shot
// → captures/raw/<shot>.mkv (+ markers-<part>.json with durations).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { launch, helpers, BASE, SCALE, VW, VH } = require('./lib.cjs');

const VIDEO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const ONLY = (argv[argv.indexOf('--only') + 1] || '')
  .split(',')
  .filter((s) => argv.includes('--only') && s);
const PART = argv.includes('--part') ? argv[argv.indexOf('--part') + 1] : 'a';
const RAW = path.join(VIDEO, 'captures/raw');
const DRYDIR = path.join(VIDEO, PART === 'b' ? 'frames/dry-b' : 'frames/dry');
fs.mkdirSync(DRY ? DRYDIR : RAW, { recursive: true });
const markersPath = path.join(RAW, `markers-${PART}.json`); // one file per part: parts can record in parallel
const markers = fs.existsSync(markersPath) ? JSON.parse(fs.readFileSync(markersPath, 'utf8')) : {};

function startRec(id) {
  const out = path.join(RAW, `${id}.mkv`);
  const ff = spawn(
    'ffmpeg',
    [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'x11grab',
      '-draw_mouse',
      '0',
      '-framerate',
      '30',
      '-video_size',
      `${Math.round(VW * SCALE)}x${Math.round(VH * SCALE)}`,
      '-i',
      `${process.env.DISPLAY || ':0'}+0,0`,
      '-c:v',
      'h264_nvenc',
      '-preset',
      'p5',
      '-cq',
      '18',
      '-pix_fmt',
      'yuv420p',
      out,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
  return { ff, t0: Date.now() };
}
async function stopRec(rec) {
  rec.ff.stdin.write('q');
  await new Promise((r) => rec.ff.on('close', r));
  return Date.now() - rec.t0;
}

(async () => {
  const fakeAudio = path.join(VIDEO, 'audio/voice/mic-question-48k.wav');
  // Listen as long as the spoken question (WAV: 44-byte header, 48 kHz stereo 16-bit).
  const MIC_MS = Math.round(((fs.statSync(fakeAudio).size - 44) / (48000 * 4)) * 1000);
  const { browser, page } = await launch({ headed: !DRY, fakeAudio });
  const h = helpers(page);
  let n = 0;
  const snap = async (name) =>
    DRY && page.screenshot({ path: `${DRYDIR}/${String(n++).padStart(2, '0')}-${name}.png` });
  const nav = (label) =>
    h.click(page.getByRole('link', { name: label, exact: true }).first(), { after: 1500 });
  const btn = (name, o = {}) => page.getByRole('button', { name, exact: true, ...o }).first();
  const tab = (name) => page.getByRole('tab', { name, exact: true });

  let cur = null;
  const mark = (name) => cur && (cur.events[name] = Date.now() - cur.t0);
  async function shot(id, fn) {
    if (ONLY.length && !ONLY.includes(id)) return fn.setup ? fn.setup() : undefined;
    console.log('▶', id);
    const rec = DRY ? null : startRec(id);
    cur = { t0: rec ? rec.t0 : Date.now(), events: {} };
    if (rec) await h.wait(700);
    try {
      await fn();
    } catch (e) {
      console.error('✗', id, e.message.split('\n')[0]);
      // Debug aid: what the fire / report buttons look like when a shot fails.
      const dbg = await page
        .locator('button')
        .evaluateAll((bs) =>
          bs
            .filter((b) =>
              /fire|report|control/i.test(b.textContent + (b.getAttribute('aria-label') || ''))
            )
            .map(
              (b) =>
                `${JSON.stringify(b.textContent.trim().slice(0, 30))} aria=${b.getAttribute('aria-label')} dis=${b.disabled} vis=${!!b.offsetParent}`
            )
        )
        .catch(() => []);
      console.error('  buttons:', dbg.join(' ; '));
      await snap(id + '-FAIL');
    }
    await snap(id);
    if (rec) {
      await h.wait(500);
      markers[id] = { ms: await stopRec(rec), at: new Date().toISOString(), events: cur.events };
      fs.writeFileSync(markersPath, JSON.stringify(markers, null, 2));
    }
  }

  // Slow orbit of the 3D canvas by dragging (no hand tool).
  async function orbit(ms, dx = 260) {
    const c = page.locator('canvas').first();
    const b = await c.boundingBox();
    const x = b.x + b.width * 0.55,
      y = b.y + b.height * 0.55;
    await h.moveTo(x, y);
    await page.mouse.down();
    const steps = Math.round(ms / 33);
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x + (dx * i) / steps, y - (12 * i) / steps);
      await h.wait(25);
    }
    await page.mouse.up();
  }

  // 3D camera preset buttons (Village, Solar, Battery, Controller, Essential): a clean, close framing.
  const cam = (name) =>
    h.click(page.getByRole('button', { name, exact: true }).filter({ visible: true }).first(), {
      after: 2500,
    });

  await page.goto(BASE + '/overview');
  await h.wait(4000);
  const reset = btn('Reset');
  if (await reset.isEnabled().catch(() => false)) {
    await reset.click();
    await h.wait(800);
  }

  if (PART === 'a') {
    await shot('H1', async () => {
      await h.wait(1500);
      await h.moveTo(700, 300);
      await h.wait(1200);
      await nav('Live Simulation');
      await h.wait(2500);
      await orbit(6000, 140);
    });

    await shot('A2', async () => {
      await h.click(tab('Controls'));
      await h.click(btn('Chaos mode'), { after: 1500 });
    });

    await shot('A1', async () => {
      const add = btn('Add day');
      while (await add.isEnabled()) await h.click(add, { before: 120, after: 250 });
      const W = ['Sunny', 'Sunny', 'Partly cloudy', 'Storm', 'Rainy', 'Cloudy', 'Sunny'];
      for (let i = 0; i < 7; i++) {
        const g = page.getByRole('radiogroup', { name: `Weather for Day ${i + 1}` });
        await h.click(g.getByRole('radio', { name: W[i], exact: true }), {
          before: 150,
          after: 250,
        });
      }
      await h.wait(600);
    });

    await shot('A3', async () => {
      await h.hover(page.getByRole('button', { name: /^Proportional Allocation/ }), 500);
      await h.hover(page.getByRole('button', { name: /^Balanced Distribution/ }), 500);
      await h.click(page.getByRole('button', { name: /^Essential-First Priority/ }), {
        after: 900,
      });
    });

    await shot('V1', async () => {
      await h.click(btn('Run simulation'), { after: 300 });
      await page.mouse.wheel(0, -2000);
      await h.wait(1500);
      // Close view on the clinic, battery and market (the far orbit showed floating trees).
      await cam('Essential');
      await orbit(8000, 90);
      await h.wait(24_000); // days 1–3
    });

    await shot('V2', async () => {
      await h.click(btn('Topology'), { after: 300 });
      await h.wait(14_000); // day 4 storm
    });

    await shot('V3', async () => {
      await h.click(btn('Circuit'), { after: 300 });
      await h.wait(6000);
      const breaker = page.getByText('Battery hub').first();
      if (await breaker.isVisible().catch(() => false)) await h.hover(breaker, 1500);
      await h.wait(4000);
      await h.click(btn('3D Scene'), { after: 300 });
    });

    // Drag a Strategy Lab slider (found by its label) to a value, then fix any rounding with arrow keys.
    async function dragRange(label, value) {
      const card = page
        .locator('div')
        .filter({ has: page.getByText(label, { exact: true }) })
        .filter({ has: page.locator('input[type=range]') })
        .last();
      const range = card.locator('input[type=range]').first();
      await range.scrollIntoViewIfNeeded();
      const [min, max, from, step] = await range.evaluate((e) => [
        +e.min,
        +e.max,
        +e.value,
        +e.step || 1,
      ]);
      const rb = await range.boundingBox();
      const xAt = (v) => rb.x + 8 + ((rb.width - 16) * (v - min)) / (max - min);
      const y = rb.y + rb.height / 2;
      await h.moveTo(xAt(from), y);
      await h.wait(300);
      await page.mouse.down();
      for (let i = 1; i <= 24; i++) {
        const e = 1 - Math.pow(1 - i / 24, 3);
        await page.mouse.move(xAt(from) + (xAt(value) - xAt(from)) * e, y);
        await h.wait(30);
      }
      await page.mouse.up();
      let v = +(await range.inputValue());
      for (let g = 0; g < 40 && Math.abs(v - value) >= step / 2; g++) {
        await range.press(v < value ? 'ArrowRight' : 'ArrowLeft');
        v = +(await range.inputValue());
      }
      console.log(label, v);
      await h.wait(500);
    }

    // Values found with a probe: they make a shortage where the strategies differ on the clinic.
    await shot('A4', async () => {
      await nav('Strategy Lab');
      await dragRange('Solar Drop', 70);
      await dragRange('Drop Duration', 10);
      await dragRange('Demand Multiplier', 1.3);
      await dragRange('Initial Charge (SoC)', 25);
      await h.wait(900);
      await page.mouse.wheel(0, 420);
      await h.wait(900);
      await h.hover(page.getByRole('button', { name: 'Limit power for Health Clinic' }), 700);
      await page.mouse.wheel(0, 700);
      await h.wait(1200);
    });

    await shot('A6', async () => {
      await page.mouse.wheel(0, -3000);
      await h.wait(500);
      await h.click(btn('Compare Strategies'), { after: 2000 });
      // Health Clinic rows: proportional (1st card) vs essential-first (2nd card).
      const rows = page.getByText('Essential service shortfall');
      await rows.first().scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, -230); // keep the clinic rows below the sticky alert banner
      await h.wait(1500);
      await h.hover(rows.nth(0), 2200);
      await h.hover(rows.nth(1), 2600);
      await h.wait(1500);
    });

    await shot('A7', async () => {
      await nav('AI Copilot');
      const pick = page.locator('select:has(option[value="muse-spark-1.3"])').first();
      await h.hover(pick, 400);
      await pick
        .selectOption('muse-spark-1.3', { timeout: 5000 })
        .catch((e) => console.error('model pick', e.message));
      await h.wait(900);
      await h.click(btn('Voice input'), { after: MIC_MS + 700 });
      await h.click(page.getByRole('button', { name: /stop|Voice input/i }).first(), {
        after: 300,
      });
      await page.waitForFunction(
        () => (document.querySelector('textarea')?.value || '').length > 5,
        null,
        { timeout: 30_000 }
      );
      await h.wait(900);
      await h.click(btn('Send'), { after: 500 });
      await page
        .getByText(/Computed evidence/i)
        .first()
        .waitFor({ timeout: 120_000 });
      mark('evidence');
      await page
        .getByText(/Explore next/i)
        .first()
        .waitFor({ timeout: 150_000 });
      mark('answered');
      await h.wait(2500);
      await page
        .getByText(/What happened/i)
        .first()
        .scrollIntoViewIfNeeded();
      await h.hover(page.getByText(/What happened/i).first(), 2500);
      await h.hover(page.getByText(/Computed evidence/i).first(), 2500);
      await h.hover(page.getByText(/Why it matters/i).first(), 3000);
      await h.wait(1500);
    });

    await shot('A8', async () => {
      await nav('Live Simulation');
      await page.mouse.wheel(0, -2000);
      await h.click(page.getByRole('radio', { name: 'Autonomous AI' }).last(), { after: 800 });
      // On a wide screen, picking Autonomous AI already starts it; launch only if the button is there.
      const launchBtn = page
        .getByRole('button', { name: /^(Launch|Resume) AI simulation$/ })
        .filter({ visible: true });
      if (await launchBtn.count()) await h.click(launchBtn.first(), { after: 2500 });
      else await h.wait(2500);
    });

    await shot('A9', async () => {
      await h.click(tab('Event Log'), { after: 6000 });
      // Hover (not click) the first decision: a click flies the camera to its building.
      const entry = page.locator('[data-testid^="dispatch-entry-"]').first();
      await entry.waitFor({ timeout: 30_000 });
      await h.hover(entry, 3500);
      await h.click(
        page
          .getByRole('button', { name: 'Report a fire', exact: true })
          .filter({ visible: true })
          .first(),
        { after: 900 }
      );
      await snap('fire-menu');
      // The menu box: nearest ancestor of the heading that holds the sector buttons.
      const market = page
        .getByText('Which sector is on fire?')
        .locator('xpath=ancestor::div[.//button[contains(., "Local Market")]][1]')
        .getByRole('button', { name: /Local Market/ })
        .first();
      await h.click(market, { after: 3500 });
      await h.click(btn('Circuit'), { after: 4000 });
      await h.click(btn('3D Scene'), { after: 2000 });
    });

    await shot('A10', async () => {
      await h.click(btn('Take back control'), { after: 1500 });
      await h.click(
        page
          .getByRole('button', { name: 'Shift report', exact: true })
          .filter({ visible: true })
          .first(),
        { after: 4000 }
      );
      await page.keyboard.press('Escape');
    });
  }

  if (PART === 'b') {
    const bld = () => page.getByRole('button').filter({ hasText: /Building/ });
    await shot('B1', async () => {
      await nav('Village editor');
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        h.click(btn('Choose a photo')),
      ]);
      await fc.setFiles(path.join(VIDEO, 'images/demo-photo-bourton.jpg'));
      mark('upload');
      await h.wait(2000);
      await page
        .getByText('Looking for appliances…')
        .waitFor({ state: 'hidden', timeout: 240_000 });
      mark('detected');
      await h.wait(2500);
      await h.click(page.getByRole('button', { name: 'Scenery', exact: true }), { after: 1200 });
      await h.click(page.getByRole('button', { name: 'All', exact: true }), { after: 1200 });
      await page.mouse.wheel(0, -2000);
      await h.wait(1500);
    });

    await shot('B2', async () => {
      await h.click(btn('Draw missing objects'), { after: 800 });
      await h.click(
        page
          .getByRole('button', { name: 'Magnetic lasso' })
          .or(page.getByRole('radio', { name: 'Magnetic lasso' }))
          .first(),
        { after: 600 }
      );
      const img = page
        .getByRole('img', { name: /draw around a missing object/i })
        .or(page.locator('[aria-label^="Photo: draw around"]'))
        .first();
      const b = await img.boundingBox();
      const cx = b.x + b.width * 0.18,
        cy = b.y + b.height * 0.8,
        r = Math.min(b.width, b.height) * 0.07;
      await h.moveTo(cx + r, cy);
      await page.mouse.down();
      for (let i = 1; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        await page.mouse.move(cx + r * Math.cos(a), cy + r * 0.8 * Math.sin(a));
        await h.wait(25);
      }
      await page.mouse.up();
      await h.wait(600);
      const hint = page.getByPlaceholder('e.g. fridge, water pump').first();
      await h.click(hint, { after: 200 });
      await page.keyboard.type('water pump', { delay: 70 });
      await h.click(btn('Send the object'), { after: 1000 });
      await page
        .getByText('Identifying…')
        .waitFor({ state: 'hidden', timeout: 90_000 })
        .catch(() => {});
      await h.wait(1500);
    });

    await shot('B3', async () => {
      const cot = bld().filter({ hasText: /cottage/i });
      await h.click((await cot.count()) ? cot.first() : bld().first(), { after: 1500 });
      // The details box appears once a first facade exists: imagine, then refine and retry.
      await h.click(btn('Imagine 2D facade'), { after: 1000 });
      mark('facade1');
      await page
        .getByText('Imagining 2D facade…')
        .first()
        .waitFor({ state: 'hidden', timeout: 180_000 });
      mark('facade1-done');
      await page.getByText('2D Facade Imagination').first().scrollIntoViewIfNeeded();
      await h.wait(2500);
      const details = page.getByPlaceholder(/Add custom details/).first();
      await details.scrollIntoViewIfNeeded();
      await h.click(details, { after: 200 });
      await page.keyboard.type(
        'honey Cotswold stone walls, grey stone-slate roof, white sash windows, red geraniums',
        { delay: 30 }
      );
      await h.click(btn('Retry with details'), { after: 1000 });
      mark('facade2');
      await page
        .getByText('Imagining 2D facade…')
        .first()
        .waitFor({ state: 'hidden', timeout: 180_000 });
      mark('facade2-done');
      await h.wait(3000);
    });

    await shot('B4', async () => {
      await h.click(page.getByRole('button', { name: /^Validate & Generate 3D/ }).first(), {
        after: 1500,
      });
      mark('build');
      // Move on once the last stage (final check) starts: no need to wait for it to finish.
      await page
        .getByText(/stage 5\/5|Model finali[sz]ed/i)
        .first()
        .waitFor({ timeout: 420_000 })
        .catch(() => console.error('no final stage'));
      await h.wait(3000);
      mark('built');
      await h.wait(3000);
    });

    await shot('B5', async () => {
      const view = (name) =>
        page
          .getByRole('tab', { name })
          .or(page.getByRole('button', { name }))
          .filter({ visible: true })
          .first();
      await h.click(view(/^2D Facade$/), { after: 3500 });
      await h.click(view(/^3D model$/), { after: 1500 });
    });

    await shot('B6', async () => {
      const c = page.locator('canvas').filter({ visible: true }).last();
      const b = await c.boundingBox();
      const x = b.x + b.width / 2,
        y = b.y + b.height / 2;
      await h.moveTo(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 60; i++) {
        await page.mouse.move(x + i * 4, y);
        await h.wait(25);
      }
      await page.mouse.up();
      for (const name of [/Model size/i, /Tint/i]) {
        const sl = page.getByRole('slider', { name }).first();
        if (await sl.count()) {
          const sb = await sl.boundingBox();
          await h.moveTo(sb.x + sb.width / 2, sb.y + sb.height / 2);
          await page.mouse.down();
          for (let i = 1; i <= 15; i++) {
            await page.mouse.move(sb.x + sb.width / 2 + i * 5, sb.y + sb.height / 2);
            await h.wait(30);
          }
          await page.mouse.up();
          await h.wait(800);
        }
      }
      const mat = page.getByText(/Materials \(AI\)|Matches the photo outline/).first();
      if (await mat.count()) await h.hover(mat, 1500);
    });

    await shot('B7', async () => {
      await h.click(btn('Configure Load & Insert'), { after: 1500 });
      await h.click(
        page
          .getByRole('button', { name: 'AI estimate' })
          .or(page.getByRole('radio', { name: 'AI estimate' }))
          .first(),
        { after: 1500 }
      );
      await h.click(
        page
          .getByRole('button', { name: 'Manual', exact: true })
          .or(page.getByRole('radio', { name: 'Manual', exact: true }))
          .last(),
        { after: 800 }
      );
      const watts = page.getByLabel('Power per unit (W)').first();
      await h.click(watts, { after: 200 });
      await page.keyboard.press('Control+A');
      await page.keyboard.type('400', { delay: 120 });
      const qty = page.getByLabel('Quantity').first();
      await h.click(qty, { after: 200 });
      await page.keyboard.press('Control+A');
      await page.keyboard.type('3', { delay: 120 });
      await page.keyboard.press('Tab');
      await h.wait(1200);
      const curve = page.getByText('24 h load curve').first();
      if (await curve.count()) await h.hover(curve, 2000);
    });

    await shot('B8', async () => {
      await h.click(btn('Place on the map'), { after: 800 });
      const map = page
        .getByRole('application', { name: 'Village map' })
        .or(page.locator('[aria-label="Village map"]'))
        .first();
      await map
        .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
        .catch(() => {});
      await h.wait(900);
      const mb = await map.boundingBox();
      await h.click(map, { before: 400, after: 1000 }).catch(() => {});
      if (mb) {
        await h.moveTo(mb.x + mb.width * 0.7, mb.y + mb.height * 0.35);
        await page.mouse.down();
        await page.mouse.up();
        await h.wait(1000);
      }
      const feeder = page.getByLabel('Feeder line').first();
      if (await feeder.count()) {
        await h.hover(feeder, 400);
        await feeder.selectOption({ index: 1 }).catch(() => {});
        await h.wait(900);
      }
      await h.click(btn('Insert into simulation'), { after: 2500 });
    });

    await shot('B9', async () => {
      await nav('Live Simulation');
      await page.mouse.wheel(0, -2000);
      await h.wait(2000);
      await cam('Village');
      // Select the inserted object: the camera flies to it and orbits, like a selected sector.
      const chip = page.locator('[data-testid^="appliance-chip-"]').last();
      await h.click(chip, { after: 9000 });
      mark('focused');
      const scrub = page.getByRole('slider', { name: /Hour of day scrubber/i });
      await scrub.fill('20').catch(() => {});
      await h.wait(4000); // evening: the object dims with the village
      await scrub.fill('12').catch(() => {});
      await h.wait(1500);
      await h.click(btn('Topology'), { after: 4000 });
      await h.click(btn('3D Scene'), { after: 1500 });
    });

    await shot('R1', async () => {
      // Keep the inserted object selected: the camera keeps orbiting it (recap background).
      await h.moveTo(1240, 700);
      await h.wait(15_000);
    });
  }

  await browser.close();
})();
