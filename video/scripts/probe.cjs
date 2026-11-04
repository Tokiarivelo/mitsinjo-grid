// Dev aid: run a steps file headless and screenshot. node probe.cjs <steps.cjs> <outdir>
const { launch, helpers, BASE } = require('./lib.cjs');
(async () => {
  const steps = require(require('path').resolve(process.argv[2]));
  const out = process.argv[3];
  const { browser, page } = await launch({
    headed: !!process.env.PROBE_HEADED,
    fakeAudio: process.env.FAKE_AUDIO,
  });
  const h = helpers(page);
  let n = 0;
  const shot = async (name) =>
    page.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${name}.png` });
  try {
    await steps(page, h, shot, BASE);
  } catch (e) {
    console.error('FAIL', e.message.split('\n')[0]);
    await shot('fail');
  }
  await browser.close();
})();
