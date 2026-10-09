/* Pixelfugl – Oppstart: skjermstørrelse, spill-løkke og PWA.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ---------- Størrelse ---------- */
function resize() {
  // maks 2x skjermpiksler: ~42 % færre piksler på 2,6x-telefoner, uten synlig forskjell i den myke tegnestilen
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = vw / LOGICAL_W; W = LOGICAL_W; H = Math.round(vh / scale);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top,0px);visibility:hidden';
  document.body.appendChild(probe); safeTop = Math.round(probe.getBoundingClientRect().top / scale); probe.remove();
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  const groundY = H - GROUND_H;
  // ny størrelse: alle ferdig tegnede scener må lages på nytt
  sceneCache = {}; worldFade = null;
  const sc = sceneFor(curTheme); T = sc.T; scene = sc.scene;
  initAmbient();
  if (bird && state !== State.PLAY) bird.y = bird.py = groundY * 0.42;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

/* ---------- Løkke: fast fysikk-steg, render hver frame ---------- */
let lastTime = 0, acc = 0;
function loop(t) {
  requestAnimationFrame(loop);   // først: en feil i ett bilde skal ikke stoppe spillet for godt
  if (!lastTime) lastTime = t;
  let dt = (t - lastTime) / 1000; lastTime = t;
  if (dt > 0.1) dt = 0.1;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n++ < 12) { update(STEP); acc -= STEP; }
  alpha = clamp(acc / STEP, 0, 1);   // hvor langt vi er mellom forrige og neste fysikk-steg
  render();
}

/* ---------- PWA ---------- */
const installBtn = document.getElementById('install');
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; installBtn.classList.add('show'); });
installBtn.addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.classList.remove('show'); });
window.addEventListener('appinstalled', () => installBtn.classList.remove('show'));
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// oppstart: lin fra første bilde (samme farge som oppstartsskjermen), så introen. Introen trenger ikke fonten
// (logoen er brodert), så den starter med en gang; menyen vises først når fonten er lastet (se introStep).
resize(); startIntro(); goMenu(); Sound.setNight(T.night);
if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("700 20px Fredoka"), document.fonts.load("600 14px Fredoka")]).finally(() => { fontsReady = true; });
else fontsReady = true;
requestAnimationFrame(loop);
