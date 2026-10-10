/* Pixelfugl – Spilltilstand, input, fysikk og oppdatering.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

const buzz = ms => { if ('vibrate' in navigator) try { navigator.vibrate(ms); } catch (e) {} };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Canvas ---------- */
const canvas = document.getElementById('game');
const mainCtx = canvas.getContext('2d', { alpha: false });
let ctx = mainCtx;
let dpr = 1, scale = 1, W = LOGICAL_W, H = 560, safeTop = 0, safeBottom = 0;

/* ---------- Tilstand ---------- */
const State = { MENU: 0, READY: 1, PLAY: 2, DEAD: 3, OVER: 4 };
let state = State.MENU;
let score = 0, time = 0, scoreT = -9;           // scoreT: tidspunkt for siste poeng (driver «sprett» på tallet)
let dotsEaten = 0, combo = 0, overShown = 0, celebrated = false;
let press = { key: null, t: -9 };                // sist trykte knapp (klem-animasjon)
const easeOutBack = k => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

/* ---------- Nøkkelbilder ----------
   keys = [[tid, verdi, ease], ...]; ease gjelder overgangen INN til den nøkkelen. */
const EASE = {
  lin: k => k,
  inOut: k => k * k * (3 - 2 * k),
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  back: easeOutBack
};
function keyframes(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1, e] = keys[i + 1];
    if (t < t1) return v0 + (v1 - v0) * EASE[e || 'inOut']((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}
const loopKeys = (keys, t) => keyframes(keys, ((t % keys[keys.length - 1][0]) + keys[keys.length - 1][0]) % keys[keys.length - 1][0]);
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

let scroll = 0, prevScroll = 0;      // total avstand rullet (px): driver labyrinten i bakgrunnen og gulvet
let bird, pipes = [], particles = [], powers = [], floats = [];
let overT = 0, transitionT = 0, newBest = false, groundBounced = false, menuT = 0;
let active = { shield: false, slow: 0, double: 0 };
let timeScale = 1, slowWas = false;
let intro = null;                    // introen (se startIntro)
let hitStop = 0;                     // kort stopp ved treff (alt står stille et øyeblikk, så treffet kjennes)
let nearMisses = 0;                  // dristige passeringer i denne runden
let worldK = 1;                      // verdens fart (1 = vanlig); bremser ned til 0 når fuglen lander hjemme
let paused = false, resumeT = 0;      // pause + nedtelling før spillet fortsetter
let grace = 0, guidePipe = null;     // usårbarhet og glidemål (åpningen) etter skjoldtreff
let alpha = 1, viewScroll = 0;        // interpolasjonsfaktor mellom forrige og nåværende fysikk-steg + interpolert scroll
let deferredPrompt = null;
let wardrobe = false, wardrobePage = 0, unlocked = [], unlockSounded = false;
let settingsOpen = false;
const hud = {};

/* ---------- Risting og blink ----------
   Risting: dempet svingning langs en retning (bort fra treffet). Blink: en kort farget skjerm. */
const fx = { amp: 0, t: 0, dx: 1, dy: 0, tint: 0, rgb: '255,80,80' };
const shakeEnv = () => fx.amp * Math.exp(-9 * fx.t);
function addShake(amp, dx = 0, dy = 1) {
  if (reduceMotion) return;
  const len = Math.hypot(dx, dy) || 1;
  fx.amp = Math.max(shakeEnv(), amp); fx.t = 0; fx.dx = dx / len; fx.dy = dy / len;
}
function addTint(v, rgb) { fx.tint = Math.max(fx.tint, v); fx.rgb = rgb; }
// statuslinjen og bakgrunnen bak lerretet er svarte, som skjermen
function skyChrome() {
  document.querySelector('meta[name=theme-color]').content = ARC.bg; document.documentElement.style.setProperty('--sky', ARC.bg);
}

// start i hvilehøyden, så fuglen aldri tegnes øverst i ett bilde før første fysikk-steg
function resetBird() {
  bird = {
    x: state === State.MENU ? W / 2 : BIRD_X, y: (H - GROUND_H) * 0.42, vx: 0, vy: 0, rot: 0, angVel: 0, flapT: 9, sx: 1, sy: 1, sv: 0,
    blink: 0, blinkT: 1.5 + Math.random() * 2, happy: 0, chomp: 0, hv: 0, hoverT: 0.2
  };
  bird.px = bird.x; bird.py = bird.y; bird.pr = 0;
}
function resetRun() {
  resetBird(); pipes = []; particles = []; powers = []; floats = []; score = 0; dotsEaten = 0;
  active = { shield: false, slow: 0, double: 0 }; timeScale = 1; paused = false; resumeT = 0; grace = 0;
  combo = 0; overShown = 0; celebrated = false;
  placeIdx = 0; placeT = -9; home = null; worldK = 1; hitStop = 0; nearMisses = 0;
}
function goMenu() { state = State.MENU; menuT = 0; resetRun(); wardrobe = false; settingsOpen = false; transitionT = 1; Sound.music.setMode('menu'); }
function goReady() {
  state = State.READY; settingsOpen = false; wardrobe = false; resetRun(); newBest = false; groundBounced = false; unlocked = []; unlockSounded = false;
  transitionT = 1; Sound.swoosh(); Sound.music.setMode('menu');
}
function goPlay() { state = State.PLAY; spawnPipe(W + 60); Sound.music.setMode('play'); }

/* ---------- Veggene og prikkene ----------
   Hver vegg har en åpning med tre prikker på rad. Av og til ligger det i stedet en ting midt i åpningen:
   kraftprikken (skjold), en snegle (sakte film) eller en gyllen eikenøtt (dobbel poeng). */
function spawnPipe(x) {
  const groundY = H - GROUND_H;
  let gap = Math.max(D.gap * 0.72, D.gap - Math.min(score, 30) * 0.9);
  let variant = 'normal';
  if (score >= D.variantsFrom) { const r = Math.random(); if (r < 0.24) variant = 'moving'; else if (r < 0.44) variant = 'narrow'; }
  if (variant === 'narrow') gap *= 0.8;
  gap = Math.max(MIN_GAP, gap);
  const amp = variant === 'moving' ? 26 : 0;
  // fast sone rett over bakken: ekstra skjermhøyde blir bare luft, så nivået er likt på alle telefoner
  const zoneBot = groundY - 40, zoneTop = Math.max(safeTop + 40, zoneBot - ZONE_H);
  const zLo = zoneTop + amp + gap / 2, zHi = zoneBot - amp - gap / 2;
  let lo = zLo, hi = zHi;
  const prev = pipes[pipes.length - 1];
  if (prev) {   // begrens hoppet fra forrige åpning: gir flyt i stedet for urimelige sprang
    const pc = prev.baseTop + prev.gap / 2;
    lo = Math.max(zLo, pc - D.shift); hi = Math.min(zHi, pc + D.shift);
    if (lo > hi) lo = hi = clamp(pc, zLo, zHi);
  }
  if (lo > hi) lo = hi = (zLo + zHi) / 2;
  const top = lo + Math.random() * (hi - lo) - gap / 2;
  const p = { x, top, baseTop: top, gap, variant, amp, phase: Math.random() * Math.PI * 2, freq: 2.2 + Math.random() * 1.2, scored: false, glow: 0, seed: (Math.random() * 1e9) | 0, dots: [] };
  pipes.push(p);
  if (score >= 3 && variant !== 'narrow' && Math.random() < 0.16 && !powers.some(q => q.x > W - 100)) {
    const kind = active.shield || D.zen ? (Math.random() < 0.5 ? 'slow' : 'double') : ['shield', 'shield', 'slow', 'double'][(Math.random() * 4) | 0];
    powers.push({ x: x + PIPE_W / 2, y: p.top + p.gap / 2, pipe: p, kind, t: Math.random() * 10, taken: false });
  } else {
    for (let i = 0; i < DOTS_PER_GAP; i++) p.dots.push({ dx: (i - (DOTS_PER_GAP - 1) / 2) * DOT_GAP, eaten: false });
  }
}
const dotX = (p, d) => p.x + PIPE_W / 2 + d.dx;
const dotY = p => p.top + p.gap / 2;

/* ---------- Partikler ----------
   Firkantede piksler (sq), små kryss som glimter (spark) og fjær (feather). */
function burst(x, y, n, colors, spd, life, grav = 600, size = 2, { shape = 'sq', drag = 1.4 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life, max: life, grav, drag, shape,
      c: colors[(Math.random() * colors.length) | 0], r: size * (0.6 + Math.random() * 0.8) });
  }
}
function floatText(x, y, txt, color, s = PX, { life = 0.85, vy = -42, blink = false } = {}) {
  floats.push({ x, y, txt, color, s, life, max: life, vy, blink });
}
const feathers = (x, y, n) => burst(x, y, n, [ARC.yellow, '#3D7DFF', ARC.white], 80, 1.1, 120, 2, { shape: 'feather', drag: 2.2 });

/* ---------- Pause ---------- */
function pauseGame() {
  if (state !== State.PLAY || paused) return;
  paused = true; resumeT = 0; Sound.music.setMode('menu');
}
function resumeGame() { if (paused && resumeT <= 0) { resumeT = 1.5; Sound.swoosh(); } }   // 3-2-1 før spillet fortsetter

/* ---------- Input ---------- */
function flap() {
  Sound.unlock();
  if (state === State.MENU) { if (!wardrobe && !settingsOpen) goReady(); return; }
  if (state === State.READY) goPlay();
  if (state === State.PLAY) {
    if (paused) return;
    if (home && (home.phase === 'land' || (home.phase === 'rest' && home.t < 0.9))) return;   // lander: vent til den står
    if (home && home.phase === 'rest') leaveHome();
    // fast impuls: hvert flaks gir nøyaktig samme løft, uansett hvor raskt man trykker
    bird.vy = D.flap;
    bird.flapT = 0; bird.sy = 1.15; bird.sx = 0.9;
    bird.angVel = -9;
    Sound.flap(); buzz(8);
    burst(bird.x - 12, bird.y + 6, 2, [ARC.grey, ARC.dark], 40, 0.35, -20, 2);
    return;
  }
  if (state === State.OVER && overT > 0.7) goReady();
}
function onPointer(e) {
  e.preventDefault();
  if (intro) { skipIntro(); return; }
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
  for (const k in hud) {
    const b = hud[k];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { press = { key: k, t: time }; Sound.unlock(); b.fn(); Sound.tick(); buzz(6); render(); return; }
  }
  // et trykk hvor som helst i menyen starter også; ikke når et panel er åpent
  if (state === State.MENU || state === State.READY || state === State.PLAY) flap();
}
canvas.addEventListener('pointerdown', onPointer, { passive: false });
window.addEventListener('keydown', e => {
  if (intro) { if (['Space', 'ArrowUp', 'Enter', 'Escape'].includes(e.code)) { e.preventDefault(); skipIntro(); } return; }
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    if (e.target instanceof HTMLButtonElement) return;
    e.preventDefault(); if (paused) resumeGame(); else flap();
  }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === State.PLAY) { if (paused) resumeGame(); else pauseGame(); }
    else if (e.code === 'Escape' && state === State.MENU && wardrobe) wardrobe = false;
    else if (e.code === 'Escape' && state === State.MENU && settingsOpen) settingsOpen = false;
    else if (e.code === 'Escape' && (state === State.READY || (state === State.OVER && overT > 0.7))) goMenu();
  }
});
// app i bakgrunnen / mister fokus: pause spillet og stopp lyden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseGame(); Sound.suspend(); lastTime = 0; }
  else Sound.resume();
});
window.addEventListener('blur', pauseGame);

function setDiff(name) { diffName = name; D = DIFFS[name]; store.set('pf.diff', name); best = +store.get(bestKey()) || 0; }
function toggleCrt() { crt = !crt; store.set('pf.crt', crt ? '1' : '0'); }
function setWear(id) { wear = id; store.set('pf.wear', id); }

/* ---------- Kollisjon: sirkel mot avrundet rektangel ---------- */
function circleRRect(cx, cy, r, x, y, w, h, rad) {
  const ix = clamp(cx, x + rad, x + w - rad), iy = clamp(cy, y + rad, y + h - rad);
  const dx = cx - ix, dy = cy - iy;
  return dx * dx + dy * dy < (r + rad) * (r + rad);
}
function hitsPipe(p, groundY) {
  const r = BIRD_R - 1;
  return circleRRect(bird.x, bird.y, r, p.x, -60, PIPE_W, p.top + 60, WALL_R)                         // øvre vegg
      || circleRRect(bird.x, bird.y, r, p.x, p.top + p.gap, PIPE_W, groundY + 60 - p.top - p.gap, WALL_R);   // nedre vegg
}

/* ---------- Reisen hjem ----------
   Hver runde er en reise fra fjellet ned til hytta. Stedene passeres ved faste poeng og vises som et blinkende
   banner. Ved HOME poeng er fuglen hjemme: veggene tar slutt, hytta med fuglebrettet glir inn, og fuglen lander
   og hviler seg. Et trykk sender den videre, og runden fortsetter som før. */
const ROUTE = [
  { at: 0, name: 'Fjellet' },
  { at: 5, name: 'Bjørkelia' },
  { at: 10, name: 'Elgmyra' },
  { at: 15, name: 'Seterbua' },
  { at: 20, name: 'Tjernet' },
  { at: 27, name: 'Sauebeitet' },
  { at: 34, name: 'Stavkirka' },
  { at: 42, name: 'Fyrlykta' },
  { at: 50, name: 'Postkassa' },
  { at: 60, name: 'Hytta' }
];
const HOME = ROUTE[ROUTE.length - 1].at;
const FEEDER = { pole: 55, tray: 32 };   // fuglebrettet: fra bakken til brettet (minus 13) og bredden på brettet
let placeIdx = 0, placeT = -9, home = null;
const placeAt = s => { let i = 0; while (i + 1 < ROUTE.length && ROUTE[i + 1].at <= s) i++; return i; };
const perchY = groundY => groundY - FEEDER.pole - 2 - BIRD_R;   // fuglen står på brettet
// hvor langt kom fuglen? brukes på game over og pause
function journeyLines(s, wasHome) {
  if (wasHome) return { line: 'Du kom hjem til hytta!', next: s > HOME ? `og fløy ${s - HOME} videre` : '' };
  if (s >= HOME) return { line: 'Hytta var rett der framme!', next: '' };
  const i = placeAt(s), nx = ROUTE[i + 1];
  return { line: i ? `Forbi ${ROUTE[i].name}` : 'Ut fra fjellet', next: `${nx.at - s} til ${nx.name}` };
}
function reachPlace(i) {
  placeIdx = i; placeT = time;
  if (ROUTE[i].at >= HOME) startHome(); else Sound.place();
}
function startHome() {
  const last = pipes[pipes.length - 1];
  home = { phase: 'approach', t: 0, x: (last ? last.x : W) + D.spacing + 120 };
  home.px = home.x;
}
// landing og hvile på fuglebrettet (fuglens vanlige fysikk står stille imens)
function homeStep(dt, groundY) {
  const h = home, py = perchY(groundY), d = h.x - bird.x;
  h.t += dt;
  if (h.phase === 'approach') {
    const clear = pipes.every(p => p.x + PIPE_W < bird.x - BIRD_R - 6);
    if (clear && d < 240) { h.phase = 'land'; h.t = 0; Sound.swoosh(); }
    return;
  }
  if (h.phase === 'land') {
    // verden bremser jevnt så brettet stopper rett under fuglen; fuglen glir ned og flakser litt for å bremse
    worldK = d > 0.5 ? clamp(Math.sqrt(d / 150), 0.03, 1) : 0;
    if (d <= 0.5) { worldK = 0; h.x = bird.x; }
    bird.vy += ((py - bird.y) * 16 - bird.vy * 8) * dt;
    bird.y += bird.vy * dt;
    if (bird.flapT > 0.32 && d > 30) { bird.flapT = 0; } else bird.flapT += dt;
    bird.rot = lerp(bird.rot, 0, 1 - Math.exp(-6 * dt));
    if (!worldK && Math.abs(bird.y - py) < 1.5 && Math.abs(bird.vy) < 25) {
      h.phase = 'rest'; h.t = 0; bird.y = py; bird.vy = 0; bird.sy = 0.8; bird.sx = 1.15; bird.happy = 1.2;
      Sound.cheer(); buzz([15, 30, 15]);
      burst(bird.x, py + BIRD_R, 6, [ARC.yellow, ARC.dot], 60, 0.7, 300, 2);
    }
  } else if (h.phase === 'rest') {
    // pikker i frøene på brettet: to raske hakk, så en pause
    bird.y = py; bird.vy = 0; worldK = 0; bird.flapT = 9;
    const peck = reduceMotion ? 0 : loopKeys([[0, 0], [1.4, 0], [1.52, 0.4, 'in'], [1.64, 0.05, 'out'], [1.76, 0.38, 'in'], [1.92, 0, 'out'], [3.4, 0]], h.t);
    bird.rot = lerp(bird.rot, peck, 1 - Math.exp(-30 * dt));
    if (peck > 0.35 && !h.pecked) { h.pecked = true; bird.chomp = 0.12; Sound.chomp(); }
    if (peck < 0.2) h.pecked = false;
  }
  bird.sx = lerp(bird.sx, 1, 1 - Math.exp(-8 * dt)); bird.sy = lerp(bird.sy, 1, 1 - Math.exp(-8 * dt));
}
// et trykk på brettet: fuglen letter, verden kommer i gang igjen, og veggene fortsetter
function leaveHome() {
  home.phase = 'done'; home.t = 0;
  spawnPipe(W + 170);
}

/* ---------- Introen (ved hver oppstart) ----------
   Som på en arkademaskin: labyrintrammen tegnes rundt skjermen, logoen kommer bokstav for bokstav med et
   blipp, og blåmeisen flyr inn og spiser en rad prikker under logoen før den glir ned på plassen sin i menyen.
   Menyen kommer til slutt. Alt regnes fra introens klokke, så et trykk (hopp over) bare spoler fram. */
const INTRO = { frame: [0, 0.7], letters: [0.5, 1.35], fly: [1.35, 2.25], menu: [2.15, 2.55], end: 2.6 };
const INTRO_RM = { menu: [0, 0.5], end: 0.5 };   // redusert bevegelse: alt toner rolig fram
const INTRO_DOTS = 9;
function startIntro() {
  intro = { t: 0, speed: 1, glyph: -1, eaten: 0, rm: reduceMotion };
}
function skipIntro() {
  const m = intro.rm ? INTRO_RM.menu[0] : INTRO.menu[0];
  if (intro.t < m) intro.t = m;
  intro.speed = 2.4; intro.skipped = true;
}
const introPhase = ([a, b]) => intro ? clamp((intro.t - a) / (b - a), 0, 1) : 1;
// prikkraden under logoen (samme plass som i menyen) og hvor fuglen er på den
const introDotX = i => lerp(W * 0.18, W * 0.82, i / (INTRO_DOTS - 1));
const introDotY = () => menuLogoY() + 46;
function introStep(dt, idleY) {
  if (state !== State.MENU) { intro = null; return; }   // spillet er startet på annen måte: introen gir seg
  const I = intro, end = I.rm ? INTRO_RM.end : INTRO.end;
  I.t += dt * I.speed;
  const t = I.t;
  bird.flapT += dt;
  if (I.rm) { bird.x = W / 2; bird.y = idleY; if (t >= end) finishIntro(idleY); return; }
  // ett blipp per bokstav i logoen
  const n = Math.floor(introPhase(INTRO.letters) * 9 + 1e-6);
  while (I.glyph + 1 < n) Sound.introBlip(++I.glyph);
  const [f0, f1] = INTRO.fly, dy = introDotY();
  if (t < f0) { bird.x = -30; bird.y = dy; }
  else if (t < f1) {   // flyr inn langs prikkraden og spiser dem, så en bue ned mot hvileplassen
    const k = (t - f0) / (f1 - f0), xEnd = W * 0.86;
    if (k < 0.7) {
      const u = k / 0.7; bird.x = lerp(-30, xEnd, u); bird.y = dy + Math.sin(u * Math.PI * 3) * 3; bird.rot = 0;
      if (bird.flapT > 0.15) bird.flapT = 0;
      while (I.eaten < INTRO_DOTS && introDotX(I.eaten) < bird.x + 6) { I.eaten++; bird.chomp = 0.1; Sound.chomp(); }
    } else {
      const u = EASE.inOut((k - 0.7) / 0.3);
      bird.x = lerp(xEnd, W / 2, u); bird.y = lerp(dy, idleY, u) - Math.sin(u * Math.PI) * 18;
      bird.rot = lerp(bird.rot, 0, 1 - Math.exp(-8 * dt));
    }
  } else { bird.x = W / 2; bird.y = idleY; }
  if (t >= end) finishIntro(idleY);
}
function finishIntro(idleY = (H - GROUND_H) * 0.42) {
  if (!intro) return;
  intro = null; menuT = 1;
  bird.x = bird.px = W / 2; bird.y = bird.py = idleY; bird.hv = 0; bird.sx = bird.sy = 1; bird.hoverT = 0.2;
  Sound.introDone();
}

/* ---------- Fuglen i hvile ----------
   Den svever med små vingeslag: hvert slag gir et lite løft, og den synker litt imellom. */
function idleStep(dt, idleY) {
  bird.hv += (150 + (idleY - bird.y) * 7) * dt;
  bird.hv -= bird.hv * 1.6 * dt;
  if ((bird.hoverT -= dt) <= 0) {
    bird.hv -= 50 + Math.random() * 8;
    bird.flapT = 0;
    bird.hoverT = 0.24 + Math.random() * 0.12;
  }
  bird.y = clamp(bird.y + bird.hv * dt, idleY - 14, idleY + 14);
  bird.flapT += dt;
  bird.rot = lerp(bird.rot, clamp(bird.hv / 600, -0.08, 0.08), 1 - Math.exp(-10 * dt));
  bird.sx = lerp(bird.sx, 1, 1 - Math.exp(-12 * dt)); bird.sy = lerp(bird.sy, 1, 1 - Math.exp(-12 * dt));
}
function animateBird(dt) {
  if ((bird.blinkT -= dt) <= 0) { bird.blink = 1; bird.blinkT = 2 + Math.random() * 3.5; }
  bird.blink = Math.max(0, bird.blink - dt * 7);
  bird.happy = Math.max(0, bird.happy - dt);
  bird.chomp = Math.max(0, bird.chomp - dt);
}

/* ---------- Oppdatering (dt i sekunder) ---------- */
// lagre tilstanden før steget, så render() kan interpolere mellom forrige og nåværende steg
function snapshot() {
  prevScroll = scroll;
  bird.px = bird.x; bird.py = bird.y; bird.pr = bird.rot;
  for (const p of pipes) { p.px = p.x; p.ptop = p.top; }
  for (const q of powers) { q.px = q.x; q.py = q.y; }
  for (const q of particles) { q.px = q.x; q.py = q.y; }
  if (home) home.px = home.x;
}

function update(dt) {
  snapshot();
  if (hitStop > 0) { hitStop -= dt; return; }   // treffpause: ingenting beveger seg
  time += dt;
  if (paused) {
    if (resumeT > 0 && (resumeT -= dt) <= 0) { resumeT = 0; paused = false; Sound.music.setMode('play'); if (active.slow > 0) Sound.music.slowmo(true); }
    return;
  }
  const wantSlow = state === State.PLAY && active.slow > 0;
  timeScale = lerp(timeScale, wantSlow ? 0.55 : 1, 1 - Math.pow(0.001, dt));
  if (wantSlow !== slowWas) { Sound.music.slowmo(wantSlow); slowWas = wantSlow; }
  const gdt = dt * timeScale;      // spilltid
  const scrolling = state !== State.DEAD && state !== State.OVER && !intro;
  if (scrolling) scroll += D.speed * gdt * worldK;

  transitionT = Math.max(0, transitionT - dt * 2.4); menuT += dt;
  fx.t += dt; fx.tint = Math.max(0, fx.tint - dt * 2.2);
  animateBird(dt);

  const groundY = H - GROUND_H, idleY = groundY * 0.42;

  if (intro) introStep(dt, idleY);
  else if (state === State.MENU || state === State.READY) idleStep(dt, idleY);

  if (state === State.PLAY) {
    const perched = home && (home.phase === 'land' || home.phase === 'rest');
    if (home) homeStep(gdt, groundY);
    if (home && home.phase === 'done' && worldK < 1) worldK = worldK > 0.995 ? 1 : lerp(worldK, 1, 1 - Math.exp(-3.5 * gdt));
    const move = D.speed * gdt * worldK;
    if (!perched) {
      // tyngdekraft + luftmotstand + terminalfart
      bird.vy += D.gravity * gdt;
      bird.vy -= bird.vy * AIR_DRAG * gdt;
      bird.vy = clamp(bird.vy, -900, TERMINAL);
      bird.y += bird.vy * gdt;
      bird.flapT += gdt;
      // etter skjoldtreff: gli mykt inn mot midten av åpningen i stedet for å hoppe dit
      if (grace > 0) {
        grace = Math.max(0, grace - gdt);
        if (grace > SHIELD_GRACE - 0.4) {
          const k = 1 - Math.exp(-8 * gdt), gy = guideY();
          bird.y = lerp(bird.y, gy, k); bird.vy = lerp(bird.vy, -40, k);
        }
      }
      // rotasjon som fjær mot målvinkel (nese opp når den flakser, ned når den faller)
      const target = bird.vy < 0 ? -0.4 : clamp((bird.vy - 60) / 380, 0, 1) * 1.35;
      const k = bird.vy < 0 ? 140 : 40, damp = bird.vy < 0 ? 16 : 10;
      bird.angVel += ((target - bird.rot) * k - bird.angVel * damp) * gdt;
      bird.rot += bird.angVel * gdt;
      bird.sx = lerp(bird.sx, 1, 1 - Math.pow(0.0005, gdt)); bird.sy = lerp(bird.sy, 1, 1 - Math.pow(0.0005, gdt));
      if (bird.y < safeTop + 6) { bird.y = safeTop + 6; bird.vy = Math.max(bird.vy, 0); }
    }
    if (home) home.x -= move;
    for (const p of pipes) {
      p.x -= move;
      if (p.variant === 'moving') { p.phase += p.freq * gdt; p.top = p.baseTop + Math.sin(p.phase) * p.amp; }
      p.glow = Math.max(0, p.glow - dt * 2.5);
    }
    const last = pipes[pipes.length - 1];
    const holdPipes = home && home.phase !== 'done';   // på vei inn til hytta: ingen nye vegger
    if (last && last.x < W - D.spacing && !holdPipes) spawnPipe(last.x + D.spacing);
    if (pipes.length && pipes[0].x < -PIPE_W - 30) pipes.shift();

    active.slow = Math.max(0, active.slow - dt); active.double = Math.max(0, active.double - dt);

    for (const q of powers) {
      q.x -= move; q.t += dt;
      q.y = q.pipe.top + q.pipe.gap / 2;   // står i ro midt i åpningen: lett å sikte på
      if (!q.taken && Math.hypot(q.x - bird.x, q.y - bird.y) < POWER_R + BIRD_R - 2) collect(q);
    }
    powers = powers.filter(q => !q.taken && q.x > -40);

    for (const p of pipes) {
      // prikkene: fuglen spiser dem den berører
      for (const d of p.dots) {
        if (d.eaten) continue;
        const dx = dotX(p, d) - bird.x, dy = dotY(p) - bird.y;
        if (dx * dx + dy * dy < DOT_EAT * DOT_EAT) eatDot(p, d);
      }
      // klaring mens fuglen er inne i åpningen: minste avstand fra treffsonen til kantene over og under
      if (!p.scored && p.x < bird.x + BIRD_R && p.x + PIPE_W > bird.x - BIRD_R) p.minClear = Math.min(p.minClear ?? 99, bird.y - (BIRD_R - 1) - p.top, p.top + p.gap - bird.y - (BIRD_R - 1));
      if (!p.scored && p.x + PIPE_W / 2 < bird.x - DOT_GAP - 2) passPipe(p);
      if (grace <= 0 && p.x < bird.x + BIRD_R + 6 && p.x + PIPE_W > bird.x - BIRD_R - 6 && hitsPipe(p, groundY)) {
        if (D.zen) zenBump(p); else if (active.shield) useShield(p); else { die(false, p); break; }
      }
    }
    if (state === State.PLAY && !perched && bird.y + BIRD_R >= groundY) { bird.y = groundY - BIRD_R; if (D.zen) zenBounce(groundY); else die(true); }
  }

  if (state === State.DEAD) {
    // rekyl fra veggen, tumling, sprett i bakken
    bird.vy += D.gravity * 1.15 * dt; bird.vy = Math.min(bird.vy, TERMINAL + 150);
    bird.vx -= bird.vx * 2.2 * dt;
    bird.x += bird.vx * dt; bird.y += bird.vy * dt;
    bird.angVel -= bird.angVel * 1.5 * dt; bird.rot += bird.angVel * dt;
    bird.sx = lerp(bird.sx, 1, dt * 6); bird.sy = lerp(bird.sy, 1, dt * 6);
    if (bird.y + BIRD_R >= groundY) {
      bird.y = groundY - BIRD_R;
      burst(bird.x, groundY - 2, 8, [ARC.wall, ARC.wallLight, ARC.white], 70, 0.5, 300, 2);
      Sound.thud(); buzz(30);
      if (!groundBounced && bird.vy > 220) { groundBounced = true; bird.vy = -bird.vy * 0.32; bird.angVel = -bird.rot * 5; bird.sy = 0.75; bird.sx = 1.25; addShake(3, 0, 1); }
      else { land(); Sound.sting(); }
    }
  }
  if (state === State.OVER) {
    overT = Math.min(3, overT + dt);
    // poengene telles opp med små blipp; ny rekord feires med fyrverkeri når tallet er framme
    const shown = Math.min(score, Math.floor(Math.max(0, overT - 0.55) * 30));
    if (shown !== overShown) { overShown = shown; Sound.count(); }
    if (newBest && !celebrated && overShown === score) { celebrated = true; Sound.cheer(); celebrate(); }
    if (unlocked.length && !unlockSounded && overT > 1) { unlockSounded = true; Sound.power(); }
    bird.angVel += (-bird.rot * 90 - bird.angVel * 10) * dt; bird.rot += bird.angVel * dt;
    bird.sv += ((1 - bird.sy) * 220 - bird.sv * 9) * dt; bird.sy += bird.sv * dt; bird.sx = 2 - bird.sy;
    bird.y = lerp(bird.y, groundY - BIRD_R, 1 - Math.exp(-12 * dt));
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx -= q.vx * q.drag * dt; q.life -= dt;
    if (q.shape === 'feather') q.vy -= q.vy * 2 * dt;
    if (q.life <= 0) particles.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.y += f.vy * dt; f.life -= dt; if (f.life <= 0) floats.splice(i, 1); }
}

// forbi en vegg: ett poeng, og ett til om hele prikkraden er spist
function passPipe(p) {
  p.scored = true; p.glow = 1; scoreT = time;
  if (grace <= 0 && p.minClear !== undefined && p.minClear < NEAR_MISS) nearMiss(p);
  const mult = active.double > 0 ? 2 : 1, before = score;
  let gain = mult;
  const full = p.dots.length && p.dots.every(d => d.eaten);
  if (full) {
    gain += mult; Sound.row();
    floatText(bird.x + 6, bird.y - 26, `+${mult}`, ARC.yellow, PX, { life: 0.9 });
  }
  score += gain;
  Sound.point(combo++); buzz(12); bird.happy = 0.45;
  if (Math.floor(score / 10) > Math.floor(before / 10)) {   // milepæl hvert 10. poeng: liten fanfare
    Sound.fanfare(); floatText(W / 2, safeTop + 150, `${Math.floor(score / 10) * 10} POENG!`, ARC.cyan, PX, { life: 1.4, vy: -18, blink: true });
    burst(bird.x, bird.y, 14, [ARC.yellow, ARC.cyan, ARC.pink, ARC.white], 130, 0.9, 100, 2, { shape: 'spark' });
  }
  if (mult === 2 && !full) floatText(bird.x + 4, bird.y - 22, '+2', ARC.orange, PX);
  if (!D.zen && score > best) { best = score; newBest = true; store.set(bestKey(), best); }
  if (!home) { const pi = placeAt(score); if (pi > placeIdx) reachPlace(pi); }
}
function eatDot(p, d) {
  d.eaten = true; dotsEaten++; bird.chomp = 0.12;
  Sound.chomp();
  burst(dotX(p, d), dotY(p), 3, [ARC.dot, ARC.white], 40, 0.25, 0, 1.5);
}
function collect(q) {
  q.taken = true; const P = POWERS[q.kind];
  if (q.kind === 'shield') active.shield = true; else active[q.kind] = P.dur;
  Sound.power(); buzz([10, 20, 10]); bird.happy = 0.6; bird.chomp = 0.2;
  burst(q.x, q.y, 10, [P.color, ARC.white], 110, 0.6, 60, 2, { shape: 'spark' });
  floatText(bird.x + 18, bird.y - 30, P.label, P.color, PX, { life: 1.1, vy: -26 });
}
const guideY = () => guidePipe ? guidePipe.top + guidePipe.gap / 2 : bird.y;
function useShield(p) {
  active.shield = false; Sound.shieldPop(); buzz([20, 10, 30]);
  addShake(3, -1, 0); addTint(0.7, '69,227,255');
  burst(bird.x, bird.y, 16, [ARC.cyan, ARC.white], 150, 0.5, 120, 2, { shape: 'spark' });
  // ingen teleport: kort usårbarhet, og fuglen glir inn i åpningen (se update)
  grace = SHIELD_GRACE; guidePipe = p; p.scored = true;
}
// tett forbi: et lite løft i lyden og noen gnister (ingen tekst)
const NEAR_MISS = 6;
function nearMiss(p) {
  nearMisses++; bird.happy = 0.6; buzz(6);
  Sound.nearMiss();
  const up = bird.y < p.top + p.gap / 2;
  burst(bird.x - 6, bird.y + (up ? -10 : 10), 4, [ARC.white, ARC.cyan], 60, 0.4, 0, 1.5, { shape: 'spark' });
}
function die(onGround, p) {
  Sound.hit(); if (!onGround) Sound.die();
  hitStop = reduceMotion ? 0 : (onGround ? 0.05 : 0.08);
  buzz([40, 20, 60]); addTint(0.9, '255,70,70');
  active = { shield: false, slow: 0, double: 0 }; grace = 0;
  earnPoints();
  feathers(bird.x, bird.y, 6);
  if (onGround) {
    burst(bird.x, bird.y + 8, 8, [ARC.wall, ARC.wallLight, ARC.white], 70, 0.5, 300, 2);
    land(); addShake(4, 0, 1); Sound.sting();
  } else {
    state = State.DEAD;
    const side = !p || bird.x + BIRD_R - 3 < p.x;
    const fromRight = p ? bird.x < p.x + PIPE_W / 2 : true;
    burst(bird.x + (fromRight ? 10 : -10), bird.y, 8, [ARC.wall, ARC.wallLight, ARC.white], 60, 0.4, 0, 2, { shape: 'spark' });
    bird.vx = fromRight ? -120 : 80; bird.vy = Math.min(bird.vy, 0) * 0.3 - 150;
    bird.angVel = fromRight ? -4 : 4;
    if (side) { bird.sx = 0.7; bird.sy = 1.25; } else { bird.sx = 1.25; bird.sy = 0.72; }
    addShake(5, fromRight ? -1 : 1, -0.3);
  }
}
// ny rekord: pikselfyrverkeri over skjermen
function celebrate() {
  const cols = [ARC.yellow, ARC.cyan, ARC.pink, ARC.orange, ARC.green, ARC.white];
  for (let i = 0; i < 5; i++) {
    const x = W * (0.15 + Math.random() * 0.7), y = safeTop + 60 + Math.random() * 160;
    setTimeout(() => { burst(x, y, 22, [cols[i % cols.length], ARC.white], 150, 1.2, 140, 2, { shape: 'spark' }); Sound.pop(); }, i * 260);
  }
}
// poengene fra runden legges til totalen; ny pynt som låses opp vises på game over
function earnPoints() {
  const before = COSMETICS.filter(isUnlocked).map(c => c.id);
  totalPoints += score; store.set('pf.total', totalPoints);
  if (score >= 30 && !hasGold) { hasGold = true; store.set('pf.gold', '1'); }
  unlocked = COSMETICS.filter(c => isUnlocked(c) && !before.includes(c.id));
}
// Zen: et treff gir et mykt sprett inn i åpningen (som skjoldet, men uten å bruke det opp), og bakken spretter fuglen opp igjen
function zenBump(p) {
  grace = SHIELD_GRACE; guidePipe = p; p.scored = true;
  Sound.shieldPop(); buzz(10);
  burst(bird.x + 8, bird.y, 6, [ARC.green, ARC.white], 60, 0.4, 0, 2, { shape: 'spark' });
}
function zenBounce(groundY) {
  bird.y = groundY - BIRD_R - 1; bird.vy = D.flap * 0.85; bird.sy = 0.75; bird.sx = 1.25;
  Sound.thud(); buzz(10);
  burst(bird.x, groundY - 2, 6, [ARC.wall, ARC.white], 50, 0.4, 300, 2);
}
function land() {
  state = State.OVER; overT = 0;
  bird.vy = 0; bird.vx = 0; bird.sy = 0.75; bird.sx = 1.25; bird.sv = 0;
}
