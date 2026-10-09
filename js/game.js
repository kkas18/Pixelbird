/* Pixelfugl – Spilltilstand, input, fysikk og oppdatering.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

const buzz = ms => { if ('vibrate' in navigator) try { navigator.vibrate(ms); } catch (e) {} };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Canvas ---------- */
const canvas = document.getElementById('game');
const mainCtx = canvas.getContext('2d', { alpha: false });
let ctx = mainCtx;   // tegnemålet; byttes midlertidig til et offscreen-lerret under krysstoning av tid på døgnet
let dpr = 1, scale = 1, W = LOGICAL_W, H = 560, safeTop = 0;

/* ---------- Tilstand ---------- */
const State = { MENU: 0, READY: 1, PLAY: 2, DEAD: 3, OVER: 4 };
let state = State.MENU;
let score = 0, time = 0, scoreT = -9;           // scoreT: tidspunkt for siste poeng (driver «sprett» på tallet)
let combo = 0, overShown = 0, overTitle = 'Å nei!', celebrated = false;
let press = { key: null, t: -9 };                // sist trykte knapp (klem-animasjon)
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
const easeOutBack = k => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

/* ---------- Animasjon med intensjon: nøkkelbilder ----------
   I stedet for jevn sinus-vugging: bevegelser med pauser (hold), myk start og stopp, overskyting og
   forberedelse. keys = [[tid, verdi, ease], ...]; ease gjelder overgangen INN til den nøkkelen.
   Samme verdi på to nøkler etter hverandre = en pause. */
const EASE = {
  lin: k => k,
  inOut: k => k * k * (3 - 2 * k),
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  back: easeOutBack,                                   // skyter litt over og faller tilbake
  antic: k => k * k * (2.6 * k - 1.6)                  // går litt bakover før den drar (forberedelse)
};
function keyframes(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1, e] = keys[i + 1];
    if (t < t1) return v0 + (v1 - v0) * EASE[e || 'inOut']((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}
// gjentatt syklus: t går rundt med lengden til siste nøkkel
const loopKeys = (keys, t) => keyframes(keys, ((t % keys[keys.length - 1][0]) + keys[keys.length - 1][0]) % keys[keys.length - 1][0]);
let scroll = 0, prevScroll = 0;      // total avstand rullet (px) – driver alle parallakse-lag
let bird, pipes = [], particles = [], powers = [], floats = [], dust = [], stars = [], clouds = [];
let overT = 0, transitionT = 0, newBest = false, groundBounced = false, menuT = 0;   // menuT: tid siden menyen åpnet
let active = { shield: false, slow: 0, double: 0 };
let timeScale = 1, slowWas = false;
let paused = false, resumeT = 0;      // pause + nedtelling før spillet fortsetter
let grace = 0, guidePipe = null;     // usårbarhet og glidemål (røret) etter skjoldtreff
let alpha = 1, viewScroll = 0;        // interpolasjonsfaktor mellom forrige og nåværende fysikk-steg + interpolert scroll
let deferredPrompt = null;
let wardrobe = false, wardrobePage = 0, unlocked = [], unlockSounded = false;   // garderoben er åpen i menyen; pynt som ble låst opp i siste runde
const hud = {};

/* ---------- Risting og fargetoning ----------
   Risting: dempet svingning langs en retning (bort fra treffet), ikke tilfeldig støy.
   Toning: myk farget vignett i stedet for hvit fullskjerm-blits. */
const fx = { amp: 0, t: 0, dx: 1, dy: 0, tint: 0, rgb: '255,120,100' };
const shakeEnv = () => fx.amp * Math.exp(-9 * fx.t);
function addShake(amp, dx = 0, dy = 1) {
  if (reduceMotion) return;
  const len = Math.hypot(dx, dy) || 1;
  fx.amp = Math.max(shakeEnv(), amp); fx.t = 0; fx.dx = dx / len; fx.dy = dy / len;
}
function addTint(v, rgb) { fx.tint = Math.max(fx.tint, v); fx.rgb = rgb; }

/* ---------- Tid på døgnet ----------
   Hver tid har sin egen ferdig tegnede scene (hurtigbufret). Ved bytte tones hele verden
   myk over fra den gamle til den nye scenen i løpet av 1,8 s. */
let sceneCache = {}, worldFade = null;
// sharp = scenen trenger skarpe kopier av lagene (menyen, der fokus ligger på landskapet); bare starttiden trenger dem
function sceneFor(name, sharp = name === themeName) {
  const have = sceneCache[name];
  if (!have || (sharp && !have.sharp)) {
    const prev = T; T = paletteFor(name);
    sceneCache[name] = { T, scene: buildScene(sharp), sharp };
    T = prev;
  }
  return sceneCache[name];
}
/* ---------- Kamera og fokus ----------
   cam: kameraet følger fuglen litt i høyden (logiske px, + = ned); bakgrunnslagene forskyves etter avstand.
   focusK: 0 = fokus på landskapet (menyen), 1 = fokus på fuglen (spill). */
let cam = 0, camPrev = 0, camV = 0, focusK = 0;
const CAM_MAX = 8;
function cameraStep(dt) {
  const groundY = H - GROUND_H, playing = state === State.PLAY || state === State.DEAD;
  const target = reduceMotion || !playing ? 0 : clamp((bird.y - groundY * 0.45) * 0.045, -CAM_MAX, CAM_MAX);
  camV += ((target - cam) * 30 - camV * 11) * dt;   // kritisk dempet fjær: følger mykt, uten å svinge
  cam = clamp(cam + camV * dt, -CAM_MAX, CAM_MAX);
  const want = state === State.MENU ? 0 : 1;
  focusK = reduceMotion ? want : focusK + (want - focusK) * (1 - Math.exp(-dt * 5));
  if (Math.abs(want - focusK) < 0.002) focusK = want;
}
function setTimeOfDay(name, fade = true) {
  if (name === curTheme && scene) return;
  const next = sceneFor(name), kindBefore = scene ? moteKind() : null;
  worldFade = fade && scene && !reduceMotion ? { from: { T, scene }, k: 0, n: 0 } : null;
  curTheme = name; T = next.T; scene = next.scene;
  if (moteKind() !== kindBefore) initMotes();
  Sound.setNight(T.night); Sound.setTime(name);
  document.querySelector('meta[name=theme-color]').content = T.skyTop; document.documentElement.style.setProperty('--sky', T.skyTop);
}
// tiden runden står på nå: starter på valgt tid og går videre hvert 10. poeng
const runTimeOfDay = () => CYCLE[(CYCLE.indexOf(themeName) + Math.floor(score / 10)) % CYCLE.length];

// start i hvilehøyden, så fuglen aldri tegnes øverst i ett bilde før første fysikk-steg
function resetBird() {
  bird = {
    x: BIRD_X, y: (H - GROUND_H) * 0.42, vx: 0, vy: 0, rot: 0, angVel: 0, flapT: 9, sx: 1, sy: 1, sv: 0,
    blink: 0, blinkT: 1.5 + Math.random() * 2, happy: 0, look: 0, lookTo: 0,            // ansikt
    crest: 0, crestV: 0, scarf: null, zT: 0.6,                                           // sekundærbevegelse
    hv: 0, hoverT: 0.2, act: null, actT: 1.6 + Math.random() * 1.5, lastAct: '',           // hvile: svev og småhandlinger
    preen: 0, lookUp: 0, shakeS: 1
  };
}
function resetRun() {
  resetBird(); pipes = []; particles = []; powers = []; floats = []; score = 0;
  active = { shield: false, slow: 0, double: 0 }; timeScale = 1; paused = false; resumeT = 0; grace = 0;
  combo = 0; overShown = 0; celebrated = false;
}
function goMenu() { state = State.MENU; menuT = 0; resetRun(); wardrobe = false; transitionT = 1; Sound.music.setMode('menu'); setTimeOfDay(themeName); }
function goReady() {
  state = State.READY; resetRun(); newBest = false; groundBounced = false; unlocked = []; unlockSounded = false;
  transitionT = 1; Sound.swoosh(); Sound.music.setMode('menu'); setTimeOfDay(themeName);
  // tegn de neste tidene på døgnet ferdig mens fuglen venter («Klar?»), så byttet midt i runden ikke hakker
  // én scene om gangen med pauser imellom, så «Klar?»-skjermen aldri fryser
  const i = CYCLE.indexOf(themeName), next = [...new Set(CYCLE.slice(i + 1).concat(CYCLE.slice(0, i)))];
  next.forEach((name, k) => setTimeout(() => sceneFor(name), 80 + k * 260));
}
function goPlay() { state = State.PLAY; spawnPipe(W + 60); Sound.music.setMode('play'); }

function spawnPipe(x) {
  const groundY = H - GROUND_H;
  let gap = Math.max(D.gap * 0.72, D.gap - Math.min(score, 30) * 0.9);
  let variant = 'normal';
  if (score >= D.variantsFrom) { const r = Math.random(); if (r < 0.24) variant = 'moving'; else if (r < 0.44) variant = 'narrow'; }
  if (variant === 'narrow') gap *= 0.8;
  gap = Math.max(MIN_GAP, gap);
  const amp = variant === 'moving' ? 26 : 0;
  // fast sone rett over bakken: ekstra skjermhøyde blir bare himmel, så nivået er likt på alle telefoner
  const zoneBot = groundY - 40, zoneTop = Math.max(safeTop + 40, zoneBot - ZONE_H);
  const zLo = zoneTop + amp + gap / 2, zHi = zoneBot - amp - gap / 2;   // mulige gap-midtpunkt
  let lo = zLo, hi = zHi;
  const prev = pipes[pipes.length - 1];
  if (prev) {   // begrens hoppet fra forrige gap – gir flyt i stedet for urimelige sprang
    const pc = prev.baseTop + prev.gap / 2;
    lo = Math.max(zLo, pc - D.shift); hi = Math.min(zHi, pc + D.shift);
    if (lo > hi) lo = hi = clamp(pc, zLo, zHi);
  }
  if (lo > hi) lo = hi = (zLo + zHi) / 2;   // svært lav skjerm
  const top = lo + Math.random() * (hi - lo) - gap / 2;
  const seed = (Math.random() * 1e9) | 0;
  const p = { x, top, baseTop: top, gap, variant, amp, phase: Math.random() * Math.PI * 2, freq: 2.2 + Math.random() * 1.2, scored: false, glow: 0,
    seed, marksTop: barkMarks(seed), marksBot: barkMarks(seed + 1), decor: trunkDecorPlan(seed + 2) };
  pipes.push(p);
  if (score >= 3 && variant !== 'narrow' && Math.random() < 0.16 && !powers.some(q => q.x > W - 100)) {
    const keys = Object.keys(POWERS).filter(k => !(D.zen && k === 'shield'));   // Zen trenger ikke skjold
    const kind = active.shield || D.zen ? (Math.random() < 0.5 ? 'slow' : 'double') : keys[(Math.random() * keys.length) | 0];
    powers.push({ x: x + PIPE_W / 2, y: p.top + p.gap / 2, pipe: p, kind, t: Math.random() * 10, taken: false });
  }
}

/* ---------- Partikler ---------- */
// shape: dot | puff (voksende røyk) | feather (daler og svaier) | seed (bjørkefrø) | leaf | petal | bird (liten meis som flyr)
function burst(x, y, n, colors, spd, life, grav = 700, size = 3, { shape = 'dot', drag = 1.2, vdrag = 0, spin = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life, max: life, grav, drag, vdrag, shape,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * spin, c: colors[(Math.random() * colors.length) | 0], r: size * (0.5 + Math.random()) });
  }
}
function floatText(x, y, txt, color, size = 13, { life = 0.85, vx = 0, vy = -42, stroke = false } = {}) {
  floats.push({ x, y, txt, color, size, life, max: life, vx, vy, stroke });
}
const feathers = (x, y, n) => burst(x, y, n, ['#4A93DA', '#F6CF45', '#FFFDF6'], 70, 1.3, 60, 2.2, { shape: 'feather', drag: 2.2, vdrag: 2.4, spin: 3 });

/* ---------- Pause ---------- */
function pauseGame() {
  if (state !== State.PLAY || paused) return;
  paused = true; resumeT = 0; Sound.music.setMode('menu');
}
function resumeGame() { if (paused && resumeT <= 0) { resumeT = 1.5; Sound.swoosh(); } }   // 3-2-1 før spillet fortsetter

/* ---------- Input ---------- */
function flap() {
  Sound.unlock();
  if (state === State.MENU) { if (!wardrobe) goReady(); return; }
  if (state === State.READY) goPlay();
  if (state === State.PLAY) {
    if (paused) return;
    // fast impuls: hvert flaks gir nøyaktig samme løft, uansett hvor raskt man trykker
    bird.vy = D.flap;
    bird.flapT = 0; bird.sy = 1.22; bird.sx = 0.84;
    bird.angVel = -9;
    Sound.flap(); buzz(8);
    burst(bird.x - 10, bird.y + 8, 2, ['#FFFFFF'], 40, 0.45, -30, 3, { shape: 'puff', drag: 3 });
    if (Math.random() < 0.22) feathers(bird.x - 8, bird.y + 4, 1);
    return;
  }
  if (state === State.OVER && overT > 0.7) goReady();
}
function onPointer(e) {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
  for (const k in hud) {
    const b = hud[k];
    if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) { press = { key: k, t: time }; Sound.unlock(); b.fn(); Sound.tick(); buzz(6); return; }
  }
  flap();
}
canvas.addEventListener('pointerdown', onPointer, { passive: false });
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (paused) resumeGame(); else flap(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === State.PLAY) { if (paused) resumeGame(); else pauseGame(); }
    else if (e.code === 'Escape' && state === State.MENU && wardrobe) wardrobe = false;
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
function toggleTheme() {
  themeName = themeName === 'day' ? 'night' : 'day'; store.set('pf.theme', themeName);
  setTimeOfDay(themeName);
}
function setWear(id) { wear = id; store.set('pf.wear', id); }

/* ---------- Kollisjon: sirkel mot avrundet rektangel ---------- */
function circleRRect(cx, cy, r, x, y, w, h, rad) {
  const ix = clamp(cx, x + rad, x + w - rad), iy = clamp(cy, y + rad, y + h - rad);
  const dx = cx - ix, dy = cy - iy;
  return dx * dx + dy * dy < (r + rad) * (r + rad);
}
function hitsPipe(p, groundY) {
  const r = BIRD_R - 1;
  const by = p.top + p.gap, lw = PIPE_W + TRUNK_LIP * 2;
  return circleRRect(bird.x, bird.y, r, p.x, -40, PIPE_W, p.top + 40 - END_H, 0)                            // øvre stamme
      || circleRRect(bird.x, bird.y, r, p.x - TRUNK_LIP, p.top - END_H, lw, END_H, END_H / 2)              // mosekant (kapsel)
      || circleRRect(bird.x, bird.y, r, p.x - TRUNK_LIP, by, lw, END_H, END_H / 2)
      || circleRRect(bird.x, bird.y, r, p.x, by + END_H, PIPE_W, groundY - by, 0);                         // nedre stamme
}

/* ---------- Fuglens liv: ansikt, fjærtopp og skjerf ---------- */
const KNOT = { x: -9, y: 5 };          // skjerfknuten (lokalt, bak på halsen)
function animateBird(dt) {
  // blunk hvert 2–5,5 s (blink går fra 1 til 0; lukkethet = sin(pi * blink))
  if ((bird.blinkT -= dt) <= 0) { bird.blink = 1; bird.blinkT = 2 + Math.random() * 3.5; }
  bird.blink = Math.max(0, bird.blink - dt * 7);
  bird.happy = Math.max(0, bird.happy - dt);
  // blikket: i hvile styres det av småhandlingene (se idleStep), i spill ser fuglen framover
  if (state !== State.MENU && state !== State.READY) { bird.lookTo = 0.5; bird.act = null; bird.preen = 0; bird.lookUp = 0; bird.shakeS = 1; }
  bird.look = lerp(bird.look, bird.lookTo, 1 - Math.exp(-14 * dt));
  // fjærtoppen henger etter bevegelsen (dempet fjær)
  const vy = state === State.PLAY || state === State.DEAD ? bird.vy : bird.hv;
  bird.crestV += ((clamp(vy / 500, -1, 1) * 0.5 - bird.crest) * 160 - bird.crestV * 10) * dt; bird.crest += bird.crestV * dt;
  // søvnige «z» i menyen om natten
  if (state === State.MENU && T.night && (bird.zT -= dt) <= 0) {
    bird.zT = 1.1; floatText(bird.x + 9, bird.y - 14, 'z', '#FFF6E0', 9 + Math.random() * 4, { life: 1.6, vx: 9, vy: -16 });
  }
  scarfStep(dt);
}
function scarfAnchor(x, y, rot, sx, sy) {
  const kx = KNOT.x * sx, ky = KNOT.y * sy, c = Math.cos(rot), s = Math.sin(rot);
  return { x: x + kx * c - ky * s, y: y + kx * s + ky * c };
}
// skjerfsnippene: to korte kjeder (posisjonsbasert Verlet) som dras bakover av fartsvinden og flagrer litt
function scarfStep(dt) {
  if (!bird.scarf) bird.scarf = [4.4, 3.7].map(len => ({ len, pts: Array.from({ length: 4 }, (_, i) => ({ x: bird.x - 9 - i * len, y: bird.y + 5, ox: bird.x - 9 - i * len, oy: bird.y + 5 })) }));
  const a = scarfAnchor(bird.x, bird.y, bird.rot, bird.sx, bird.sy);
  const airX = state === State.DEAD || state === State.OVER ? 0 : -D.speed * timeScale;
  // stoffet følger kroppen delvis (mest nær knuten): uten dette slenger kjeden fram som en pendel ved hvert flaks
  const pa = bird.scarfA || a, mdx = a.x - pa.x, mdy = a.y - pa.y; bird.scarfA = a;
  bird.scarf.forEach((tail, ti) => {
    let prev = a;
    tail.pts.forEach((pt, i) => {
      const follow = 0.75 - i * 0.15;
      pt.x += mdx * follow; pt.ox += mdx * follow; pt.y += mdy * follow; pt.oy += mdy * follow;
      const vx = (pt.x - pt.ox) / dt, vy = (pt.y - pt.oy) / dt;
      const ax = (airX - vx) * 11, ay = 210 - vy * 3 + Math.sin(time * 17 + i * 1.3 + ti * 2) * 70;   // lett stoff: vinden dominerer over tyngden
      pt.ox = pt.x; pt.oy = pt.y;
      pt.x += vx * dt + ax * dt * dt; pt.y += vy * dt + ay * dt * dt;
      const dx = pt.x - prev.x, dy = pt.y - prev.y, d = Math.hypot(dx, dy) || 1;
      pt.x = prev.x + dx / d * tail.len; pt.y = prev.y + dy / d * tail.len;
      if (pt.x > a.x + 1) pt.x = lerp(pt.x, a.x + 1, 0.5);   // myk grense: snippene legger seg aldri fram foran knuten
      prev = pt;
    });
  });
}

/* ---------- Stammenes utseende (frøbasert, så hver stamme er unik men stabil) ---------- */
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
// bjørkebark slik den faktisk ser ut: merker i klynger med bar bark imellom, noen mørke «belter»,
// «øyne» der greiner har sittet, og mange små lenticeller (faint) – sortert etter avstand fra enden
function barkMarks(seed) {
  const r = rng(seed), out = [];
  for (let d = 6 + r() * 10; d < 900;) {
    const roll = r();
    if (roll < 0.12) { out.push({ d, x: 2 + r() * 6, len: PIPE_W * (0.45 + r() * 0.35), th: 2.2 + r() * 1.4, scar: false }); d += 14 + r() * 16; }
    else if (roll < 0.2) { out.push({ d, x: 6 + r() * (PIPE_W - 24), len: 12, th: 2.4, scar: true }); d += 16 + r() * 18; }
    else {
      const n = 2 + ((r() * 3) | 0), cx = 4 + r() * (PIPE_W - 26);
      for (let i = 0; i < n; i++) out.push({ d: d + i * (2.5 + r() * 3), x: clamp(cx + (r() - 0.5) * 14, 2, PIPE_W - 16), len: 3 + r() * 10, th: 0.9 + r() * 1.6, scar: false });
      d += n * 3 + 14 + r() * 28;
    }
  }
  for (let d = 4 + r() * 6; d < 900; d += 12 + r() * 14) out.push({ d, x: 3 + r() * (PIPE_W - 10), len: 1.6 + r() * 2.2, th: 0.7, scar: false, faint: true });
  return out.sort((a, b) => a.d - b.d);
}
function trunkDecorPlan(seed) {
  const r = rng(seed), side = () => (r() < 0.5 ? -1 : 1);
  return {
    fungus: r() < 0.45 ? side() : 0, fungusD: 26 + r() * 50,          // kjuker på nedre stamme
    sprigBot: r() < 0.45 ? side() : 0, sprigBotD: 60 + r() * 70,      // kvister med blader
    sprigTop: r() < 0.5 ? side() : 0, sprigTopD: 30 + r() * 70,
    owl: r() < 0.14, owlD: 52 + r() * 40,                             // ugle i et hull i øvre stamme
    toad: r() < 0.5 ? side() : 0,                                     // fluesopp ved roten
    moss: (r() * 1e6) | 0
  };
}
// stemningsprikker etter årstid: blomsterblader (vår), pollen (sommer), løv (høst), snø (vinter);
// om kvelden blir pollen og blader til ildfluer nær bakken
function moteKind() {
  const m = SEASONS[seasonName].mote;
  return T.night && (m === 'pollen' || m === 'petal') ? 'firefly' : m;
}
const falling = k => k === 'leaf' || k === 'snow' || k === 'petal';
const moteY = groundY => moteKind() === 'firefly' ? groundY - 25 - Math.random() * 145 : Math.random() * (groundY - 40);

/* ---------- Landemerker: sjeldne ting i landskapet ----------
   Dukker opp omtrent hvert 30.–60. sekund (målt i rullet avstand), aldri samme som de to forrige.
   Hvert landemerke hører til et parallakse-lag (depth = lagets fart) og står plantet på det laget. */
const LANDMARKS = { stavkirke: 0.14, seter: 0.14, fyr: 0.05, elg: 0.3, sau: 0.6, postkasse: 1 };
const LM_SPEED = 118;                  // px/s som avstandene regnes i (fart på «lett»)
let landmarks = [], lmNext = -1, lmRecent = [];
const lmX = (m, s) => m.x0 - (s - m.at) * LANDMARKS[m.kind];
function spawnLandmark(kind) {
  if (!kind) { const free = Object.keys(LANDMARKS).filter(k => !lmRecent.includes(k)); kind = free[(Math.random() * free.length) | 0]; }
  lmRecent = [kind, ...lmRecent].slice(0, 2);
  landmarks.push({ kind, at: scroll, x0: W + 50, seed: (Math.random() * 1e6) | 0 });
  return kind;
}
function landmarkStep() {
  if (lmNext < 0) lmNext = scroll + (10 + Math.random() * 8) * LM_SPEED;   // det første kommer etter 10–18 s
  if (scroll >= lmNext) { spawnLandmark(); lmNext = scroll + (30 + Math.random() * 30) * LM_SPEED; }
  landmarks = landmarks.filter(m => lmX(m, scroll) > -90);
}

/* ---------- Fuglen i hvile ----------
   Den svever med små vingeslag: hvert slag gir et lite løft, og den synker litt imellom (bevegelsen
   henger sammen med vingene). Innimellom gjør den én liten handling, med pauser imellom. */
const IDLE_ACTS = {
  look:   { dur: () => 1.3 + Math.random() * 1 },     // ser til siden, holder blikket, ser tilbake
  preen:  { dur: () => 1.5 },                         // pirker i fjærene under vingen
  blink2: { dur: () => 0.5 },                         // dobbeltblunk
  shake:  { dur: () => 0.55 },                        // rister seg (med forberedelse)
  lookUp: { dur: () => 2.2 }                          // ser opp på noe som passerer
};
// ballongen og fugleflokken (felles for tegning og for at fuglen kan se opp på dem)
function balloonPos() {
  if (H - GROUND_H - safeTop <= 400) return null;
  const x = wrap(W * 0.25 - viewScroll * 0.02 - time * 4, W + 120) - 60;
  const y = safeTop + 58 + (reduceMotion ? 0 : loopKeys([[0, 0], [3.5, -6], [8, -6], [11.5, 0], [15, 0]], time));   // stiger og synker i rolige trinn
  return { x, y };
}
function flockPos() {
  if (T.night) return null;
  const ph = (time % 26) / 26;
  return ph < 0.55 ? { x: W + 30 - ph / 0.55 * (W + 90), y: safeTop + 150 } : null;
}
function startAct(name) {
  bird.act = { name, t: 0, dur: IDLE_ACTS[name].dur(), side: Math.random() < 0.5 ? -1 : 1 };
  bird.lastAct = name;
  if (name === 'blink2') bird.blink = 1;
}
function idleStep(dt, idleY) {
  const asleep = state === State.MENU && T.night;
  // svev: lett tyngde og en fjær mot hvilehøyden; vingeslagene gir løftet
  bird.hv += (150 * (1 - bird.preen) + (idleY - bird.y) * 7) * dt;   // vektløs mens den pirker i fjærene
  bird.hv -= bird.hv * 1.6 * dt;
  if ((bird.hoverT -= dt) <= 0 && !(bird.act && bird.act.name === 'preen')) {
    bird.hv -= asleep ? 34 : 50 + Math.random() * 8;
    bird.flapT = 0;
    bird.hoverT = asleep ? 0.75 + Math.random() * 0.5 : 0.24 + Math.random() * 0.12;
  }
  bird.y = clamp(bird.y + bird.hv * dt, idleY - 16, idleY + 16);
  bird.flapT += dt;
  // småhandlinger (ikke når den sover eller ved redusert bevegelse)
  if (!asleep && !reduceMotion) {
    const b = balloonPos(), f = flockPos(), above = [b, f].some(o => o && Math.abs(o.x - bird.x) < 40 && o.y < bird.y - 40);
    if (above && (!bird.act || bird.act.name === 'look') && bird.lastAct !== 'lookUp') startAct('lookUp');
    if (!bird.act && (bird.actT -= dt) <= 0) {
      const pick = ['look', 'look', 'preen', 'blink2', 'shake'].filter(n => n !== bird.lastAct);
      startAct(pick[(Math.random() * pick.length) | 0]);
    }
  }
  const a = bird.act;
  let lookTo = 0.4, preen = 0, lookUp = 0, sh = 1;
  if (a) {
    a.t += dt; const t = a.t;
    if (a.name === 'look') lookTo = keyframes([[0, 0.4], [0.14, a.side * 0.95, 'out'], [a.dur - 0.22, a.side * 0.95], [a.dur, 0.4, 'inOut']], t);
    else if (a.name === 'preen') preen = keyframes([[0, 0], [0.25, 1, 'antic'], [0.4, 0.8, 'inOut'], [0.55, 1, 'inOut'], [0.7, 0.82, 'inOut'], [0.85, 1, 'inOut'], [1.2, 1], [1.5, 0, 'inOut']], t);
    else if (a.name === 'blink2') { if (t > 0.2 && !a.second) { a.second = true; bird.blink = 1; } }
    else if (a.name === 'shake') sh = keyframes([[0, 1], [0.1, 0.9, 'out'], [0.17, 1.12, 'out'], [0.24, 0.92, 'inOut'], [0.31, 1.06, 'inOut'], [0.39, 0.97, 'inOut'], [0.55, 1, 'out']], t);
    else if (a.name === 'lookUp') { lookUp = keyframes([[0, 0], [0.2, 1, 'out'], [a.dur - 0.3, 1], [a.dur, 0, 'inOut']], t); lookTo = 0.6; }
    if (a.name === 'shake' && t > 0.17 && !a.puffed) { a.puffed = true; feathers(bird.x, bird.y, 2); }
    if (t >= a.dur) { bird.act = null; bird.actT = 2.2 + Math.random() * 2.8; }
  }
  bird.lookTo = lookTo; bird.preen = preen; bird.lookUp = lookUp; bird.shakeS = sh;
  // kroppen heller litt etter farten, fram når den pirker i fjærene, bakover når den ser opp
  const rotTo = clamp(bird.hv / 500, -0.1, 0.1) + preen * 0.32 - lookUp * 0.2;
  bird.rot = lerp(bird.rot, rotTo, 1 - Math.exp(-10 * dt));
  bird.sx = lerp(bird.sx, sh, 1 - Math.exp(-25 * dt)); bird.sy = lerp(bird.sy, 2 - sh, 1 - Math.exp(-25 * dt));
}

/* ---------- Oppdatering (dt i sekunder) ---------- */
// lagre tilstanden før steget, så render() kan interpolere mellom forrige og nåværende steg
function snapshot() {
  prevScroll = scroll; camPrev = cam;
  bird.px = bird.x; bird.py = bird.y; bird.pr = bird.rot;
  for (const p of pipes) { p.px = p.x; p.ptop = p.top; }
  for (const q of powers) { q.px = q.x; q.py = q.y; }
  for (const q of particles) { q.px = q.x; q.py = q.y; }
  for (const m of dust) { m.px = m.x; m.py = m.y; }
}

function update(dt) {
  snapshot();
  time += dt;
  if (paused) {
    if (resumeT > 0 && (resumeT -= dt) <= 0) { resumeT = 0; paused = false; Sound.music.setMode('play'); if (active.slow > 0) Sound.music.slowmo(true); }
    return;
  }
  const wantSlow = state === State.PLAY && active.slow > 0;
  timeScale = lerp(timeScale, wantSlow ? 0.55 : 1, 1 - Math.pow(0.001, dt));
  if (wantSlow !== slowWas) { Sound.music.slowmo(wantSlow); slowWas = wantSlow; }
  const gdt = dt * timeScale;      // spilltid
  const scrolling = state !== State.DEAD && state !== State.OVER;
  if (scrolling) { scroll += D.speed * gdt; landmarkStep(); }

  transitionT = Math.max(0, transitionT - dt * 2.4); menuT += dt;
  if (worldFade && (worldFade.k += dt / 1.8) >= 1) worldFade = null;   // krysstoning over 1,8 s
  fx.t += dt; fx.tint = Math.max(0, fx.tint - dt * 2.2);
  animateBird(dt);
  cameraStep(dt);

  const groundY = H - GROUND_H, idleY = groundY * 0.42;

  if (state === State.MENU || state === State.READY) idleStep(dt, idleY);

  if (state === State.PLAY) {
    // tyngdekraft + luftmotstand + terminalfart
    bird.vy += D.gravity * gdt;
    bird.vy -= bird.vy * AIR_DRAG * gdt;
    bird.vy = clamp(bird.vy, -900, TERMINAL);
    bird.y += bird.vy * gdt;
    bird.flapT += gdt;
    // etter skjoldtreff: gli mykt inn mot midten av gapet i stedet for å hoppe dit
    if (grace > 0) {
      grace = Math.max(0, grace - gdt);
      if (grace > SHIELD_GRACE - 0.4) {
        const k = 1 - Math.exp(-8 * gdt), gy = guideY();
        bird.y = lerp(bird.y, gy, k); bird.vy = lerp(bird.vy, -40, k);
      }
    }
    // rotasjon som fjær mot målvinkel
    const target = bird.vy < 0 ? -0.45 : clamp((bird.vy - 60) / 380, 0, 1) * 1.4;
    const k = bird.vy < 0 ? 140 : 40, damp = bird.vy < 0 ? 16 : 10;
    bird.angVel += ((target - bird.rot) * k - bird.angVel * damp) * gdt;
    bird.rot += bird.angVel * gdt;
    // squash & stretch – fjærer tilbake til 1, strekkes litt ved fall
    const fallStretch = clamp(bird.vy / TERMINAL, 0, 1) * 0.1;
    bird.sx = lerp(bird.sx, 1 - fallStretch * 0.5, 1 - Math.pow(0.0005, gdt));
    bird.sy = lerp(bird.sy, 1 + fallStretch, 1 - Math.pow(0.0005, gdt));
    if (bird.y < safeTop + 6) { bird.y = safeTop + 6; bird.vy = Math.max(bird.vy, 0); }
    for (const p of pipes) {
      p.x -= D.speed * gdt;
      if (p.variant === 'moving') { p.phase += p.freq * gdt; p.top = p.baseTop + Math.sin(p.phase) * p.amp; }
      p.glow = Math.max(0, p.glow - dt * 2.5);
    }
    const last = pipes[pipes.length - 1];
    if (last && last.x < W - D.spacing) spawnPipe(last.x + D.spacing);
    if (pipes.length && pipes[0].x < -PIPE_W - 20) pipes.shift();

    active.slow = Math.max(0, active.slow - dt); active.double = Math.max(0, active.double - dt);

    for (const q of powers) {
      q.x -= D.speed * gdt; q.t += dt;
      q.y = q.pipe.top + q.pipe.gap / 2;   // står i ro midt i gapet: lettere å sikte på
      if (!q.taken && Math.hypot(q.x - bird.x, q.y - bird.y) < POWER_R + BIRD_R - 2) collect(q);
    }
    powers = powers.filter(q => !q.taken && q.x > -40);

    for (const p of pipes) {
      if (!p.scored && p.x + PIPE_W / 2 < bird.x) {
        p.scored = true; p.glow = 1; scoreT = time;
        const gain = active.double > 0 ? 2 : 1, before = score; score += gain;
        Sound.point(combo++); buzz(12); bird.happy = 0.45;
        if (Math.floor(score / 10) > Math.floor(before / 10)) {   // milepæl hvert 10. poeng: liten fanfare
          Sound.fanfare(); floatText(bird.x + 12, bird.y - 34, `${Math.floor(score / 10) * 10}!`, '#FFD27A', 18, { stroke: true, life: 1.1, vy: -30 });
          burst(bird.x + 10, bird.y - 10, 10, leafColors(), 110, 1.1, 40, 2.6, { shape: 'leaf', drag: 2, vdrag: 1.5, spin: 5 });   // en virvel av blader
        }
        burst(bird.x + 14, bird.y - 4, 4, ['#C9A06A', '#E8D3A8', '#B88A55'], 70, 0.9, 30, 2, { shape: 'seed', drag: 2.4, vdrag: 2, spin: 7 });   // bjørkefrø som virvler
        burst(bird.x + 10, bird.y - 8, 1, leafColors(), 50, 0.9, 30, 2.2, { shape: 'leaf', drag: 2, vdrag: 2, spin: 4 });
        if (gain === 2) floatText(bird.x + 4, bird.y - 22, '+2', '#FFD27A', 14, { stroke: true });
        if (!D.zen && score > best) { best = score; newBest = true; store.set(bestKey(), best); }
        const tod = runTimeOfDay(); if (tod !== curTheme) setTimeOfDay(tod);   // tiden glir videre hvert 10. poeng
      }
      if (grace <= 0 && p.x < bird.x + BIRD_R + 6 && p.x + PIPE_W > bird.x - BIRD_R - 6 && hitsPipe(p, groundY)) {
        if (D.zen) zenBump(p); else if (active.shield) useShield(p); else { die(false, p); break; }
      }
    }
    if (state === State.PLAY && bird.y + BIRD_R >= groundY) { bird.y = groundY - BIRD_R; if (D.zen) zenBounce(groundY); else die(true); }
  }

  if (state === State.DEAD) {
    // rekyl fra røret, tumling, sprett i bakken
    bird.vy += D.gravity * 1.15 * dt; bird.vy = Math.min(bird.vy, TERMINAL + 150);
    bird.vx -= bird.vx * 2.2 * dt;
    bird.x += bird.vx * dt; bird.y += bird.vy * dt;
    bird.angVel -= bird.angVel * 1.5 * dt; bird.rot += bird.angVel * dt;
    bird.sx = lerp(bird.sx, 1, dt * 6); bird.sy = lerp(bird.sy, 1, dt * 6);
    if (bird.y + BIRD_R >= groundY) {
      bird.y = groundY - BIRD_R;
      burst(bird.x, groundY - 2, 6, [T.soil, '#FFFFFF'], 60, 0.6, -20, 4, { shape: 'puff', drag: 3 });
      Sound.thud(); buzz(30);
      if (!groundBounced && bird.vy > 220) { groundBounced = true; bird.vy = -bird.vy * 0.32; bird.angVel = -bird.rot * 5; bird.sy = 0.7; bird.sx = 1.3; addShake(3, 0, 1); }
      else { land(); Sound.swoosh(); Sound.sting(); }
    }
  }
  if (state === State.OVER) {
    overT = Math.min(3, overT + dt);
    // poengene telles opp med små klikk; ny rekord feires med en meiseflokk når tallet er framme
    const shown = Math.min(score, Math.floor(Math.max(0, overT - 0.55) * 30));
    if (shown !== overShown) { overShown = shown; Sound.count(); }
    if (newBest && !celebrated && overShown === score) { celebrated = true; Sound.cheer(); celebrate(); }
    if (unlocked.length && !unlockSounded && overT > 1) { unlockSounded = true; Sound.power(); }
    // fuglen setter seg: rotasjon og «gelé»-klem fjærer tilbake, og den sitter på føttene
    bird.angVel += (-bird.rot * 90 - bird.angVel * 10) * dt; bird.rot += bird.angVel * dt;
    bird.sv += ((1 - bird.sy) * 220 - bird.sv * 9) * dt; bird.sy += bird.sv * dt; bird.sx = 2 - bird.sy;
    bird.y = lerp(bird.y, groundY - 15, 1 - Math.exp(-12 * dt));
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx -= q.vx * q.drag * dt; q.life -= dt;
    if (q.vdrag) q.vy -= q.vy * q.vdrag * dt;
    q.rot += q.vr * dt;
    if (q.life <= 0) particles.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; if (f.life <= 0) floats.splice(i, 1); }
  const mk = moteKind(), fall = falling(mk);
  for (const m of dust) {
    const nz = m.near ? 2.2 : 1;   // nær kameraet: raskere forbi (parallakse)
    m.x -= (D.speed * 0.2 * (scrolling ? 1 : 0) + m.vx) * nz * dt;
    if (fall) {   // løv, snø og blomsterblader daler og svaier
      m.y += m.fall * nz * dt; m.x += Math.sin(time * m.f + m.p) * 10 * dt; m.rot += m.vr * dt;
      if (m.y > groundY + 4) { m.x = m.px = Math.random() * W; m.y = m.py = -8; }
    } else m.y += Math.sin(time * m.f + m.p) * 6 * dt;
    if (m.x < -10) { m.x = m.px = W + 10; m.y = m.py = fall ? Math.random() * groundY : moteY(groundY); }   // ingen interpolering over skjermen ved omstart
  }
}

function collect(q) {
  q.taken = true; const P = POWERS[q.kind];
  if (q.kind === 'shield') active.shield = true; else active[q.kind] = P.dur;
  Sound.power(); buzz([10, 20, 10]); bird.happy = 0.6;
  burst(q.x, q.y, 8, [P.color, '#FFFFFF'], 100, 0.7, 60, 2.2, { shape: 'seed', drag: 2.2, vdrag: 1.6, spin: 6 });
  floatText(bird.x + 4, bird.y - 26, P.label, P.color, 13, { stroke: true });
}
const guideY = () => guidePipe ? guidePipe.top + guidePipe.gap / 2 : bird.y;
function useShield(p) {
  active.shield = false; Sound.shieldPop(); buzz([20, 10, 30]);
  addShake(3, -1, 0); addTint(0.8, '63,169,245');
  burst(bird.x, bird.y, 14, ['#BFEAFB', '#FFFFFF', '#FFC6DD'], 150, 0.5, 120, 2.6);   // boblen spretter
  burst(bird.x, bird.y, 1, ['#FFFFFF'], 0, 0.35, 0, 9, { shape: 'puff', drag: 0 });   // boblens siste «pust» (ingen tekst; lyden sier plopp)
  // ingen teleport: kort usårbarhet, og fuglen glir inn i gapet (se update)
  grace = SHIELD_GRACE; guidePipe = p; p.scored = true;
}
function die(onGround, p) {
  Sound.hit(); if (!onGround) Sound.die();
  buzz([40, 20, 60]); addTint(1, '255,110,90');
  active = { shield: false, slow: 0, double: 0 }; grace = 0;
  overTitle = newBest ? 'Ny rekord!' : ['Å nei!', 'Oi da!', 'Uff da!'][(Math.random() * 3) | 0];
  earnPoints();
  feathers(bird.x, bird.y, 5);   // fjær som løsner – ingen stjerner eller tekst; lyden og klemmen sier resten
  if (onGround) {
    burst(bird.x, bird.y + 8, 6, [T.soil, '#FFFFFF'], 60, 0.6, -20, 4, { shape: 'puff', drag: 3 });
    land(); addShake(4, 0, 1); Sound.sting();
  } else {
    state = State.DEAD;
    // «Bonk!»: klemmes flatt mot stammen (sidetreff) eller mot snittflaten (ovenfra/nedenfra), så rekyl og en rolig vipp bakover
    const side = !p || bird.x + BIRD_R - 3 < p.x;
    const fromRight = p ? bird.x < p.x + PIPE_W / 2 : true;
    burst(bird.x + (fromRight ? 10 : -10), bird.y, 4, ['#FFFFFF', '#F3E6D2'], 50, 0.5, -10, 3.5, { shape: 'puff', drag: 3 });   // en liten sky av barkstøv
    bird.vx = fromRight ? -120 : 80; bird.vy = Math.min(bird.vy, 0) * 0.3 - 150;
    bird.angVel = fromRight ? -4 : 4;
    if (side) { bird.sx = 0.62; bird.sy = 1.3; } else { bird.sx = 1.3; bird.sy = 0.66; }
    addShake(5, fromRight ? -1 : 1, -0.3);
  }
}
// ny rekord: en liten flokk meiser letter fra bakken og flyr opp og av gårde, og blader virvler opp etter dem
function celebrate() {
  const groundY = H - GROUND_H;
  for (let i = 0; i < 7; i++) {
    const life = 3 + Math.random() * 0.8, x = 20 + Math.random() * (W * 0.6);
    particles.push({ x, y: groundY - 4 - Math.random() * 10, vx: 55 + Math.random() * 40, vy: -120 - Math.random() * 60, grav: 20, drag: 0.15, vdrag: 0.25,
      shape: 'bird', rot: Math.random() * 6.28, vr: 0, c: Math.random() < 0.7 ? '#4A93DA' : '#F6CF45', r: 2.6 + Math.random() * 0.8, life, max: life, delay: i * 0.12 });
  }
  const cols = leafColors();
  for (let i = 0; i < 16; i++) {
    const life = 2.2 + Math.random();
    particles.push({ x: Math.random() * W, y: groundY - Math.random() * 20, vx: (Math.random() - 0.3) * 60, vy: -90 - Math.random() * 90, grav: 60, drag: 0.8, vdrag: 0.6,
      shape: 'leaf', rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6, c: cols[(Math.random() * cols.length) | 0], r: 2.4 + Math.random(), life, max: life });
  }
}
// bladfarger etter årstiden
const leafColors = () => ({ spring: ['#B4E39C', '#FFC2D4', '#9FDB78'], summer: ['#A6D68E', '#86C35C', '#C9E6A0'], autumn: ['#F2994A', '#F7C548', '#E46B3C'], winter: ['#FFFFFF', '#DCE6F0', '#C9D7E3'] })[seasonName];
// landing etter krasj: fuglen blir sittende oppreist og svimmel (ikke opp-ned)
// poengene fra runden legges til totalen; ny pynt som låses opp vises på game over
function earnPoints() {
  const before = COSMETICS.filter(isUnlocked).map(c => c.id);
  totalPoints += score; store.set('pf.total', totalPoints);
  if (score >= 30 && !hasGold) { hasGold = true; store.set('pf.gold', '1'); }
  unlocked = COSMETICS.filter(c => isUnlocked(c) && !before.includes(c.id));
}
// Zen: et treff gir et mykt sprett inn i gapet (som skjoldet, men uten å bruke det opp), og bakken spretter fuglen opp igjen
function zenBump(p) {
  grace = SHIELD_GRACE; guidePipe = p; p.scored = true;
  Sound.shieldPop(); buzz(10);
  burst(bird.x + 8, bird.y, 5, ['#FFFFFF', '#BFE6D9'], 60, 0.5, -20, 3.5, { shape: 'puff', drag: 3 });
  feathers(bird.x, bird.y, 1);
}
function zenBounce(groundY) {
  bird.y = groundY - BIRD_R - 1; bird.vy = D.flap * 0.85; bird.sy = 0.7; bird.sx = 1.3;
  Sound.thud(); buzz(10);
  burst(bird.x, groundY - 2, 5, [T.soil, '#FFFFFF'], 50, 0.5, -20, 3.5, { shape: 'puff', drag: 3 });
}
function land() {
  state = State.OVER; overT = 0;
  Sound.creak(0.3);   // treskiltet begynner å svinge i tauene
  bird.vy = 0; bird.vx = 0; bird.sy = 0.7; bird.sx = 1.3; bird.sv = 0;
}
