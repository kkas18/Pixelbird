/* Pixelfugl – Oppstart: skjermstørrelse, spill-løkke og PWA.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ---------- Størrelse ---------- */
function resize() {
  // maks 3x skjermpiksler: pikslene i figurene og skriften legges på hele skjermpiksler, så de blir skarpe
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const vw = window.innerWidth, vh = window.innerHeight;
  // Keep the same portrait physics; short/landscape screens show more world
  // horizontally, with enough vertical space for every menu and touch target.
  scale = Math.min(vw / LOGICAL_W, vh / 440); W = Math.round(vw / scale); H = Math.round(vh / scale);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden';
  document.body.appendChild(probe);
  safeTop = Math.round(probe.getBoundingClientRect().top / scale);
  safeBottom = Math.round(parseFloat(getComputedStyle(probe).paddingBottom) / scale); probe.remove();
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  const groundY = H - GROUND_H;
  if (bird && (state === State.MENU || state === State.READY)) {
    bird.y = bird.py = groundY * 0.42;
    bird.x = bird.px = state === State.MENU ? W / 2 : BIRD_X;
  }
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
// knappen vises først når introen er ferdig (den skal ikke ligge over lerretet)
const showInstall = () => { if (!deferredPrompt) return; if (intro) setTimeout(showInstall, 300); else installBtn.classList.add('show'); };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; showInstall(); });
installBtn.addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.classList.remove('show'); });
window.addEventListener('appinstalled', () => installBtn.classList.remove('show'));
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// oppstart: svart fra første bilde (samme farge som oppstartsskjermen), så arkadeintroen. Alt tegnes i koden,
// så det er ingenting å vente på.
resize(); startIntro(); goMenu(); skyChrome();
requestAnimationFrame(loop);
