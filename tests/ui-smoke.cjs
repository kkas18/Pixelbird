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
  const mime = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
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
        localStorage.setItem('pf.total', '300');
        localStorage.setItem('pf.wear', 'tophat'); localStorage.setItem('pf.diff', 'normal');
        localStorage.setItem('pf.best.normal', '22');
      }
    });
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url); await page.waitForFunction(() => time > 0.8);
    assert.equal(await page.evaluate(() => wear), 'tophat');
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
    assert.equal(await page.getByRole('button', { name: 'Retro-skjerm', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Retro-skjerm', exact: true }).click();
    await page.getByRole('button', { name: 'Ferdig', exact: true }).click();
    await page.waitForTimeout(300); await shot('menu-flat');
    await page.reload(); await page.waitForFunction(() => time > 0.6);
    assert.equal(await page.evaluate(() => crt), false);
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
    await page.evaluate(() => { goReady(); state = State.OVER; score = 12; overShown = 12; best = 22; overT = 2; transitionT = 0; render(); });
    await shot('results');
    // Stage a readable in-game snapshot with a wall gap in view. This is
    // separate from the real tap/death/pause checks above; it is a UI preview.
    await page.evaluate(() => {
      goReady(); goPlay(); score = 12; transitionT = 0; hitStop = 1;
      const p = pipes[0]; p.x = p.px = 207;
      p.top = p.ptop = p.baseTop = bird.y - p.gap / 2;
      bird.rot = bird.pr = -0.15; render();
    });
    await shot('play');
    // The maze behind the walls and the dotted floor keep moving with the flight, and stand still in pause.
    const travel = await page.evaluate(() => {
      const hashes = [];
      for (const seconds of [0, 10, 20, 40, 80]) {
        scroll = prevScroll = seconds * DIFFS.normal.speed; render();
        const g = document.createElement('canvas'); g.width = canvas.width; g.height = canvas.height;
        const gc = g.getContext('2d'); gc.drawImage(canvas, 0, 0);
        const px = gc.getImageData(0, Math.floor(canvas.height * 0.55), canvas.width, Math.floor(canvas.height * 0.3)).data;
        let hash = 2166136261; for (let i = 0; i < px.length; i += 16) hash = Math.imul(hash ^ px[i + 2], 16777619);
        hashes.push(hash);
      }
      return hashes;
    });
    assert.equal(new Set(travel).size, travel.length, 'the maze and floor must move during continued flight');
    await page.evaluate(() => { hitStop = 0; pauseGame(); render(); });
    const frozenScroll = await page.evaluate(() => scroll);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => scroll), frozenScroll);
    await page.evaluate(() => { goMenu(); transitionT = 0; render(); });
    // Native keyboard activation must run once, without the global Space handler flapping.
    const start = page.getByRole('button', { name: 'Spill', exact: true }); await start.focus();
    await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => state), 1);

    // Everything needed to play is in the offline cache on first visit (no fonts, paintings or recordings).
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true); await page.reload(); await page.waitForFunction(() => time > 0.6);
    // the arcade intro runs at every start, and the menu buttons exist only when it is done
    await page.waitForFunction(() => !intro);
    assert.equal(await page.getByRole('button', { name: 'Spill', exact: true }).count(), 1);
    await context.setOffline(false);
    // Reduced motion: no attract animation, the menu fades in, and a tap still starts a run.
    const quietContext = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
    const quiet = await quietContext.newPage();
    quiet.on('pageerror', error => errors.push(error.message));
    await quiet.goto(url); await quiet.waitForFunction(() => time > 0.6 && !intro);
    await quiet.getByRole('button', { name: 'Spill', exact: true }).click();
    await quiet.mouse.click(140, 430);
    assert.equal(await quiet.evaluate(() => state), 2);
    await quietContext.close();
    assert.deepEqual(errors, []);
    console.log('PASS: menu, difficulty, settings, wardrobe, persistence, tap physics, pause/resume, death/retry, keyboard, five viewport sizes, moving maze and floor, pause, offline start and reduced motion.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
