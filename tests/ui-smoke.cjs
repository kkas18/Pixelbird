/* Run with: npm install --no-save playwright && npx playwright install chromium
   then node tests/ui-smoke.cjs. No build or dependencies are needed to play. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const errors = [];
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  const mime = { '.js': 'text/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
  res.setHeader('Content-Type', mime[path.extname(file)] || 'text/plain');
  res.end(fs.readFileSync(file));
});

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const launch = { headless: true };
  if (process.env.CHROMIUM_EXECUTABLE_PATH) launch.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  // Optional for constrained Linux test hosts; regular Playwright needs neither.
  if (process.env.CHROMIUM_ARGS) launch.args = JSON.parse(process.env.CHROMIUM_ARGS);
  const browser = await chromium.launch(launch);
  try {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.addInitScript(() => {
      if (!localStorage.getItem('qa.seeded')) {
        localStorage.setItem('qa.seeded', '1');
        localStorage.setItem('pf.season', 'autumn');
        localStorage.setItem('pf.theme', 'night'); localStorage.setItem('pf.total', '300');
        localStorage.setItem('pf.wear', 'tophat'); localStorage.setItem('pf.diff', 'normal');
        localStorage.setItem('pf.best.normal', '22');
      }
    });
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url); await page.waitForFunction(() => time > 0.8);
    assert.equal(await page.evaluate(() => wear), 'tophat');
    assert.equal(await page.evaluate(() => hasPaintedForest() && !!ART.birch && !!ART.foreground && !!ART.panoramaNight && !!ART.panoramaDay && !!ART.woodland), true);
    assert.equal(await page.evaluate(() => best), 22);
    await page.getByRole('button', { name: 'Hard', exact: true }).click();
    assert.equal(await page.evaluate(() => diffName), 'hard');
    assert.equal(await page.getByRole('button', { name: 'Hard', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Normal', exact: true }).click();
    assert.equal(await page.evaluate(() => best), 22);

    const screenshotDir = process.env.SCREENSHOT_DIR;
    const shot = async name => { if (screenshotDir) { fs.mkdirSync(screenshotDir, { recursive: true }); await page.screenshot({ path: path.join(screenshotDir, name + '.png') }); } };
    await shot('menu');
    await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
    assert.equal(await page.evaluate(() => settingsOpen), true);
    await page.mouse.click(8, 400); // Backdrop must not start a run or close the modal.
    assert.equal(await page.evaluate(() => state), 0);
    await page.getByRole('button', { name: 'Musikk', exact: true }).click();
    assert.equal(await page.evaluate(() => Sound.musMuted), true);
    await shot('settings');
    await page.getByRole('button', { name: 'Garderobe', exact: true }).click();
    await shot('wardrobe');
    if (await page.evaluate(() => wardrobePage) !== 1) await page.getByRole('button', { name: 'Neste side' }).click();
    await page.getByRole('button', { name: 'Vikinghjelm', exact: true }).click();
    assert.equal(await page.evaluate(() => wear), 'viking');
    assert.equal(await page.evaluate(() => totalPoints), 300);
    await page.getByRole('button', { name: 'Flosshatt', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => wardrobe), false);

    await page.getByRole('button', { name: 'Spill', exact: true }).click();
    assert.equal(await page.evaluate(() => state), 1);
    await shot('ready');
    await page.mouse.click(140, 430);
    assert.equal(await page.evaluate(() => state), 2);
    assert(await page.evaluate(() => bird.vy < 0));
    await shot('play');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(await page.evaluate(() => paused), true);
    const frozenY = await page.evaluate(() => bird.y);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => bird.y), frozenY);
    await shot('pause');
    await page.getByRole('button', { name: 'Fortsett', exact: true }).click();
    await page.waitForFunction(() => !paused);
    await page.evaluate(() => die(true));
    await page.waitForFunction(() => state === State.OVER && overT > 1);
    assert.equal(await page.evaluate(() => best), 22);
    await page.getByRole('button', { name: 'Spill igjen', exact: true }).click();
    assert.equal(await page.evaluate(() => state), 1);
    await page.getByRole('button', { name: 'Tilbake til menyen' }).click();
    assert.equal(await page.evaluate(() => state), 0);
    await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
    await page.getByRole('button', { name: 'Kveldsstemning', exact: true }).click();
    await page.getByRole('button', { name: 'Ferdig', exact: true }).click();
    await page.waitForTimeout(1900); await shot('menu-day');
    await page.reload(); await page.waitForFunction(() => time > 0.6);
    assert.equal(await page.evaluate(() => themeName), 'day');
    assert.equal(await page.evaluate(() => wear), 'tophat');
    assert.equal(await page.evaluate(() => Sound.musMuted), true);

    // Short phones, modern tall phones, and browser rotation: no clipped controls.
    for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 412, height: 915 }, { width: 430, height: 932 }, { width: 915, height: 412 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(150);
      const checkBounds = async () => {
        const bad = await page.evaluate(() => Object.entries(hud).filter(([, b]) => b.x < 0 || b.y < safeTop || b.x + b.w > W + 0.5 || b.y + b.h > H - safeBottom + 0.5).map(([k]) => k));
        assert.deepEqual(bad, [], `clipped controls at ${viewport.width}×${viewport.height}`);
      };
      await checkBounds();
      await page.getByRole('button', { name: 'Innstillinger', exact: true }).click(); await checkBounds();
      await page.getByRole('button', { name: 'Garderobe', exact: true }).click(); await checkBounds();
      await page.keyboard.press('Escape');
      await page.evaluate(() => { goReady(); state = State.OVER; score = 12; overShown = 12; best = 22; overT = 2; transitionT = 0; render(); });
      await checkBounds();
      await page.getByRole('button', { name: 'Meny', exact: true }).click();
    }
    await page.setViewportSize({ width: 412, height: 915 });
    await page.evaluate(() => { themeName = 'night'; setTimeOfDay('night', false); goReady(); state = State.OVER; score = 12; overShown = 12; best = 22; overT = 2; transitionT = 0; render(); });
    await shot('results');
    // Stage a readable in-game art snapshot with a birch gap in view. This is
    // separate from the real tap/death/pause checks above; it is a UI preview.
    await page.evaluate(() => {
      goReady(); goPlay(); score = 12; transitionT = 0; hitStop = 1;
      const p = pipes[0]; p.x = p.px = 207;
      p.top = p.ptop = p.baseTop = bird.y - p.gap / 2;
      bird.rot = bird.pr = -0.15; render();
    });
    await shot('play');
    if (process.env.DEPTH_PREVIEW_DIR) {
      fs.mkdirSync(process.env.DEPTH_PREVIEW_DIR, { recursive: true });
      // Controlled motion preview: the same renderer and collision dimensions,
      // staged positions. Actual gameplay is exercised independently above.
      for (let i = 0; i < 96; i++) {
        await page.evaluate(i => {
          hitStop = 1; scroll = prevScroll = i * 10;
          pipes[0].x = pipes[0].px = 207 - i * 10;
          render();
        }, i);
        await page.screenshot({ path: path.join(process.env.DEPTH_PREVIEW_DIR, String(i).padStart(3, '0') + '.png') });
      }
    }
    await page.evaluate(() => { scroll = prevScroll = 800; render(); });
    await shot('depth-scroll');
    const phases = await page.evaluate(() => depthOffsets(depthScroll()));
    assert(phases.sky < phases.mountains && phases.mountains < phases.woodland && phases.woodland < phases.foreground);
    // Regression for the reported static background: sample the actual rendered
    // scenery across two minutes of forward travel, including tile boundaries.
    const journeyMotion = await page.evaluate(() => {
      const saved = { ctx, viewScroll };
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      ctx = c.getContext('2d');
      const samples = [];
      try {
        for (const seconds of [0, 10, 20, 40, 80, 120]) {
          viewScroll = seconds * DIFFS.normal.speed;
          ctx.clearRect(0, 0, W, H); drawPaintedBackdrop(H - GROUND_H);
          let hash = 2166136261;
          const pixels = ctx.getImageData(0, Math.floor(H * 0.25), W, Math.floor(H * 0.55)).data;
          for (let i = 0; i < pixels.length; i += 16) hash = Math.imul(hash ^ pixels[i], 16777619);
          const cornerAlpha = [ctx.getImageData(1, 1, 1, 1).data[3], ctx.getImageData(W - 2, 1, 1, 1).data[3]];
          samples.push({ offsets: depthOffsets(viewScroll), hash, cornerAlpha });
        }
      } finally { ctx = saved.ctx; viewScroll = saved.viewScroll; }
      return samples;
    });
    assert.equal(new Set(journeyMotion.map(s => s.hash)).size, journeyMotion.length, 'landscape must change during continued flight');
    for (let i = 0; i < journeyMotion.length; i++) {
      assert.deepEqual(journeyMotion[i].cornerAlpha, [255, 255], 'no exposed canvas at tile seams');
      if (i) for (const layer of ['sky', 'mountains', 'woodland']) assert(journeyMotion[i].offsets[layer] > journeyMotion[i-1].offsets[layer], 'scenery must keep travelling forward');
    }
    await page.evaluate(() => { pauseGame(); render(); });
    const frozenDepth = await page.evaluate(() => depthScroll());
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => depthScroll()), frozenDepth);
    await page.evaluate(() => { goMenu(); transitionT = 0; render(); });
    // Native keyboard activation must run once, without the global Space handler flapping.
    const start = page.getByRole('button', { name: 'Spill', exact: true }); await start.focus();
    await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => state), 1);

    // The paintings, new font and UI are included in the offline cache on first visit.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true); await page.reload(); await page.waitForFunction(() => time > 0.6);
    assert.equal(await page.evaluate(() => document.fonts.check('700 38px Storybook')), true);
    // v10: introen vises ved hver oppstart, og menyknappene finnes først når den er ferdig
    await page.waitForFunction(() => !intro);
    assert.equal(await page.getByRole('button', { name: 'Spill', exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => hasPaintedForest() && !!ART.birch && !!ART.foreground && !!ART.panoramaNight && !!ART.panoramaDay && !!ART.woodland), true);
    // A missing painting still permits startup, rendering and actual taps.
    const fallbackContext = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    const fallback = await fallbackContext.newPage();
    fallback.on('pageerror', error => errors.push(error.message));
    await fallback.route('**/art/*.webp', route => route.abort());
    await fallback.goto(url); await fallback.waitForFunction(() => time > 0.6);
    assert.equal(await fallback.evaluate(() => hasPaintedForest()), false);
    assert.equal(await fallback.evaluate(() => depthScroll()), 0);
    await fallback.getByRole('button', { name: 'Spill', exact: true }).click();
    await fallback.mouse.click(140, 430);
    assert.equal(await fallback.evaluate(() => state), 2);
    await fallbackContext.close();
    const quietContext = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
    const quiet = await quietContext.newPage();
    quiet.on('pageerror', error => errors.push(error.message));
    await quiet.addInitScript(() => localStorage.setItem('pf.season', 'autumn'));
    await quiet.goto(url); await quiet.waitForFunction(() => time > 0.6);
    assert.equal(await quiet.evaluate(() => hasPaintedForest() && !!ART.foreground && !!ART.panoramaNight && !!ART.panoramaDay && !!ART.woodland), true);
    await quiet.evaluate(() => { goReady(); goPlay(); scroll = prevScroll = 800; render(); });
    assert.equal(await quiet.evaluate(() => depthScroll()), 0);
    await quietContext.close();
    assert.deepEqual(errors, []);
    console.log('PASS: menu, difficulty, settings, wardrobe, persistence, tap physics, pause/resume, death/retry, keyboard, five viewport sizes, offline paintings/font, continuous two-minute scenery travel, depth parallax and pause, reduced motion, and missing-art fallback.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
