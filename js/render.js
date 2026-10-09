/* Pixelfugl – Tegning: forhåndstegnede lag, hinder, fugl, partikler og brukergrensesnitt.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ============================================================
   TEGNING
   Stil: varm pastell, myke former og varme konturer.
   Statiske bakgrunnslag tegnes én gang (buildScene) til offscreen-lerreter
   og blittes hvert bilde; bare det som beveger seg tegnes live.
   ============================================================ */
const UI_INK = '#5B4636';               // kontur og tekst i brukergrensesnittet (lik i begge tema)
const BODY_R = 12.5;                    // fuglens tegnede kropp (treffsirkelen er litt mindre = tilgivende)
const BIRD = {
  body: '#7CC7F0', light: '#B4E2F8', dark: '#4FA6DB', belly: '#FFF5E2', ink: '#2E4467',
  beak: '#FFAE57', beakDark: '#E8842E', cheek: 'rgba(255,128,150,.55)', scarf: '#E5574A', scarfDark: '#B93E34'
};

const wrap = (v, m) => ((v % m) + m) % m;
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function rr(x, y, w, h, r, g = ctx) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath();
}
function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
// union av sirkler med ren ytterkontur: konturen tegnes som litt større sirkler under fyllet
function blob(g, pts, fill, ink, lw = 1.2, inkAlpha = 1) {
  if (ink) { g.globalAlpha = inkAlpha; g.fillStyle = ink; for (const [x, y, r] of pts) circle(g, x, y, r + lw); g.globalAlpha = 1; }
  g.fillStyle = fill; for (const [x, y, r] of pts) circle(g, x, y, r);
}
function starPath(x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const k = i % 2 ? r * 0.45 : r, a = rot - Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
  ctx.closePath();
}
function heartPath(x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); ctx.closePath();
}
function text(txt, x, y, size, opts = {}) {
  const { weight = 700, align = 'center', color = T.text, shadow = true, alpha = 1, baseline = 'middle', stroke = false } = opts;
  ctx.font = `${weight} ${size}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = baseline; ctx.globalAlpha = alpha;
  if (shadow) { ctx.fillStyle = T.textShadow; ctx.fillText(txt, x, y + Math.max(1.5, size * 0.08)); }
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.2, size * 0.15); ctx.strokeStyle = UI_INK; ctx.strokeText(txt, x, y); }
  ctx.fillStyle = color; ctx.fillText(txt, x, y); ctx.globalAlpha = 1;
}

/* ---------- Offscreen-lag ---------- */
let scene = null;
// flislag: bredden rundes til hele skjermpiksler, så flisene møtes uten søm
function makeLayer(wWanted, h, draw) {
  const R = dpr * scale, cw = Math.max(1, Math.round(wWanted * R)), ch = Math.max(1, Math.ceil(h * R));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'); g.setTransform(R, 0, 0, R, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round';
  const L = { c, w: cw / R, h: ch / R };
  draw(g, L.w, L.h, L);
  return L;
}
const makeSprite = (w, h, draw) => makeLayer(w, h, draw);
// fyll fra en sømløs kamlinje y = top(x) ned til bunnen av laget
function ridgePath(g, w, h, top, step = 2) {
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w + 0.01; x += step) g.lineTo(x, top(x));
  g.lineTo(w, top(w)); g.lineTo(w, h); g.closePath();
}
function strokeRidge(g, w, top, color, lw, step = 2) {
  g.beginPath(); g.moveTo(0, top(0));
  for (let x = step; x <= w + 0.01; x += step) g.lineTo(x, top(x));
  g.strokeStyle = color; g.lineWidth = lw; g.stroke();
}
// myke «klokker» som gjentar seg med periode w (max = tydelige topper, sum = bølgende åser)
function bumps(w, list, mode) {
  return x => {
    let y = 0;
    for (const b of list) { const d = wrap(x - b.x + w / 2, w) - w / 2, v = b.h * Math.exp(-(d * d) / (b.s * b.s)); y = mode === 'max' ? Math.max(y, v) : y + v; }
    return y;
  };
}
// tegn et objekt to ganger hvis det krysser flisens kant
const tiled = (w, x, pad, fn) => { fn(x); if (x < pad) fn(x + w); if (x > w - pad) fn(x - w); };

// sola står lavt bak fjellene i solnedgang, høyt ellers
const sunPos = () => ({ sx: W - 64, sy: T.sunLow ? H - GROUND_H - 178 : safeTop + 104 });
function buildScene() {
  const scene = {};
  const TAU = Math.PI * 2;

  // 1) fjell, snø, dis og fjord (topp = groundY - 230)
  scene.mountains = makeLayer(420, 230, (g, w, h) => {
    const r = rng(11), base = h - 70;
    const far = bumps(w, Array.from({ length: 5 }, (_, i) => ({ x: (i + 0.2 + r() * 0.6) * w / 5, h: 96 + r() * 56, s: 46 + r() * 18 })), 'max');
    const near = bumps(w, Array.from({ length: 6 }, (_, i) => ({ x: (i + r()) * w / 6, h: 48 + r() * 30, s: 36 + r() * 14 })), 'max');
    const farTop = x => base - far(x);
    ridgePath(g, w, h, farTop); g.fillStyle = T.mountainFar; g.fill();
    g.save(); g.clip();   // snø: alt over en bølgete snølinje, klippet mot fjellet
    g.fillStyle = T.snow; g.beginPath(); g.moveTo(0, -5);
    for (let x = 0; x <= w + 0.01; x += 3) g.lineTo(x, base - 112 + Math.sin(x / w * TAU * 9) * 3 + Math.sin(x / w * TAU * 4) * 4);
    g.lineTo(w, -5); g.closePath(); g.fill(); g.restore();
    strokeRidge(g, w, farTop, hexA(T.ink, 0.18), 1.2);
    const nearTop = x => base + 10 - near(x);
    ridgePath(g, w, h, nearTop); g.fillStyle = T.mountainNear; g.fill();
    strokeRidge(g, w, nearTop, hexA(T.ink, 0.22), 1.2);
    const hz = g.createLinearGradient(0, base - 50, 0, base + 4);   // atmosfærisk dis mot foten
    hz.addColorStop(0, hexA(T.skyBot, 0)); hz.addColorStop(1, hexA(T.skyBot, 0.6));
    g.fillStyle = hz; g.fillRect(0, base - 50, w, 54);
    g.fillStyle = T.fjord; g.fillRect(0, base + 2, w, h - base - 2);
    g.fillStyle = hexA(T.fjordLight, 0.9); g.fillRect(0, base + 2, w, 1.5);
    g.fillStyle = hexA(T.fjordLight, 0.7);
    for (let i = 0; i < 22; i++) { const x = r() * w, y = base + 7 + r() * (h - base - 12), l = 4 + r() * 8; tiled(w, x, l, xx => g.fillRect(xx, y, l, 1.1)); }
  });

  // 2) åser med røde hytter og torvtak (topp = groundY - 96); pipene huskes for røyken
  scene.hills = makeLayer(360, 96, (g, w, h, L) => {
    const r = rng(23), base = h - 46;
    const list = Array.from({ length: 4 }, (_, i) => ({ x: (i + 0.3 + r() * 0.4) * w / 4, h: 16 + r() * 16, s: 32 + r() * 12 }));
    const f = bumps(w, list, 'sum'), top = x => base - f(x);
    ridgePath(g, w, h, top); g.fillStyle = T.hillFar; g.fill();
    strokeRidge(g, w, top, hexA(T.ink, 0.25), 1.2);
    L.chimneys = [];
    for (const i of [0, 2]) cabin(g, list[i].x, top(list[i].x) + 1.5, L);
    for (const i of [1, 3]) for (const dx of [-9, 0, 8]) {   // små runde trær
      const x = list[i].x + dx + r() * 4, y = top(x) + 1, s = 0.75 + r() * 0.35;
      g.fillStyle = T.roof; g.fillRect(x - 0.7, y - 6 * s, 1.4, 6 * s);
      blob(g, [[x, y - 9 * s, 5 * s], [x - 3 * s, y - 6.5 * s, 3.6 * s], [x + 3 * s, y - 6.5 * s, 3.6 * s]], T.forest, hexA(T.ink, 0.5), 0.9);
    }
  });

  // 3) bjørkeskog med skogbunn (topp = groundY - 84)
  scene.forest = makeLayer(300, 84, (g, w, h) => {
    const r = rng(37);
    const floor = x => h - 30 - (Math.sin(x / w * TAU * 3) * 4 + Math.sin(x / w * TAU * 5 + 1) * 3);
    const trees = Array.from({ length: 17 }, () => ({ x: r() * w, s: 0.7 + r() * 0.45, warm: r() < 0.18, back: r() < 0.5 }));
    trees.sort((a, b) => (a.back !== b.back ? (a.back ? -1 : 1) : a.s - b.s));
    for (const t of trees) tiled(w, t.x, 16, x => birchTree(g, x, floor(t.x) + (t.back ? -4 : 3), t.s, t.warm, t.back));
    ridgePath(g, w, h, floor); g.fillStyle = T.hillNear; g.fill();
    strokeRidge(g, w, floor, hexA(T.ink, 0.28), 1.2);
  });

  // 4) busker og blomster (topp = groundY - 40)
  scene.bushes = makeLayer(240, 40, (g, w, h) => {
    const r = rng(53);
    for (let i = 0; i < 5; i++) { const x = (i + 0.2 + r() * 0.6) * w / 5, s = 0.75 + r() * 0.5; tiled(w, x, 22, xx => bush(g, xx, h + 2, s)); }
    const petals = ['#FFFFFF', '#FFC6D6', '#FFE27A', '#D9C6F7'];
    if (seasonName !== 'winter') for (let i = 0; i < 16; i++) { const x = r() * w, y = h - 3 - r() * 7, c = petals[(r() * 4) | 0]; tiled(w, x, 4, xx => flower(g, xx, y, 1.5, c)); }
  });

  // 5) bakken: gress med kamskjell-kant, tuster og blomster, jord med steiner (topp = groundY - 10)
  scene.ground = makeLayer(144, GROUND_H + 10, (g, w, h) => {
    const r = rng(71), top = 10;
    const sg = g.createLinearGradient(0, top, 0, h); sg.addColorStop(0, T.soil); sg.addColorStop(1, T.soilDark);
    g.fillStyle = sg; g.fillRect(0, top + 6, w, h - top - 6);
    g.fillStyle = hexA(T.soilDark, 0.6);   // et mørkere jordlag
    g.beginPath(); g.moveTo(0, top + 44);
    for (let x = 0; x <= w + 0.01; x += 3) g.lineTo(x, top + 44 + Math.sin(x / w * TAU * 2) * 3);
    for (let x = w; x >= -0.01; x -= 3) g.lineTo(x, top + 52 + Math.sin(x / w * TAU * 3 + 1) * 2.5);
    g.closePath(); g.fill();
    for (let i = 0; i < 10; i++) {   // småstein
      const x = r() * w, y = top + 24 + r() * (h - top - 32), rx = 2.5 + r() * 3.5, ry = 1.8 + r() * 1.8;
      tiled(w, x, rx + 2, xx => {
        g.fillStyle = hexA(T.ink, 0.3); g.beginPath(); g.ellipse(xx, y, rx + 0.9, ry + 0.9, 0, 0, TAU); g.fill();
        g.fillStyle = T.stone; g.beginPath(); g.ellipse(xx, y, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(xx - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3, 0, 0, TAU); g.fill();
      });
    }
    g.fillStyle = hexA(T.soilDark, 0.8);
    for (let i = 0; i < 26; i++) { const x = r() * w, y = top + 18 + r() * (h - top - 22); tiled(w, x, 1, xx => circle(g, xx, y, 0.7 + r() * 0.5)); }
    // gresskant: mørk underkant, så lys kamskjell-kant
    g.fillStyle = hexA(T.ink, 0.18); g.fillRect(0, top + 10, w, 3);
    g.fillStyle = T.grassDark; g.fillRect(0, top, w, 10); for (let x = 0; x < w; x += 12) circle(g, x + 6, top + 10, 6);
    g.fillStyle = T.grass; g.fillRect(0, top, w, 6); for (let x = 0; x < w; x += 12) circle(g, x + 6, top + 6, 5.5);
    for (let i = 0; i < 18; i++) {   // gresstuster over kanten
      const x = (i + r() * 0.8) * w / 18, hh = 5 + r() * 4;
      tiled(w, x, 4, xx => {
        g.strokeStyle = i % 3 ? T.grass : T.grassDark; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(xx - 2, top + 3); g.quadraticCurveTo(xx - 2.5, top - hh * 0.5, xx - 3.5, top + 2 - hh);
        g.moveTo(xx, top + 3); g.quadraticCurveTo(xx + 0.5, top - hh * 0.6, xx + 0.5, top + 1 - hh * 1.1);
        g.moveTo(xx + 2, top + 3); g.quadraticCurveTo(xx + 2.5, top - hh * 0.4, xx + 4, top + 3 - hh * 0.8); g.stroke();
      });
    }
    if (seasonName !== 'winter') for (let i = 0; i < 5; i++) { const x = r() * w, c = ['#FFFFFF', '#FFE27A', '#FFC6D6'][i % 3]; tiled(w, x, 4, xx => flower(g, xx, top - 1 - r() * 2, 1.7, c)); }
  });

  // himmel med solglød, og vignett: tegnes én gang i full skjermstørrelse (ugjennomsiktig blit er billigere enn gradienter hvert bilde)
  const groundY = H - GROUND_H, { sx, sy } = sunPos();
  scene.sky = makeSprite(W, groundY, g => {
    const gr = g.createLinearGradient(0, 0, 0, groundY);
    gr.addColorStop(0, T.skyTop); gr.addColorStop(0.55, T.skyMid); gr.addColorStop(1, T.skyBot);
    g.fillStyle = gr; g.fillRect(0, 0, W + 2, groundY + 2);
    const sg = g.createRadialGradient(sx, sy, 8, sx, sy, 78);
    sg.addColorStop(0, T.sunGlow); sg.addColorStop(1, hexA(T.skyMid, 0));
    g.fillStyle = sg; g.fillRect(sx - 80, sy - 80, 160, 160);
  });
  scene.vignette = makeSprite(W, H, g => {
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, hexA('#000000', 0)); vg.addColorStop(1, T.vignette);
    g.fillStyle = vg; g.fillRect(0, 0, W + 2, H + 2);
  });
  // sprites: tre skyformer, luftballong og glød (ildfluer/vinduer)
  scene.clouds = [0, 1, 2].map(v => makeSprite(86, 44, g => {
    const sets = [
      [[22, 28, 12], [38, 20, 15], [56, 24, 13], [70, 30, 9], [44, 31, 11]],
      [[18, 29, 10], [33, 21, 13], [51, 19, 15], [67, 28, 11], [42, 31, 10]],
      [[24, 27, 11], [42, 22, 13], [59, 29, 10], [40, 31, 9]]
    ][v];
    g.fillStyle = T.cloudShade; for (const [x, y, k] of sets) circle(g, x, y + 4, k);
    g.fillStyle = T.cloud; for (const [x, y, k] of sets) circle(g, x, y, k);
    g.fillStyle = 'rgba(255,255,255,.5)'; circle(g, sets[1][0] - 4, sets[1][1] - 5, sets[1][2] * 0.35);
  }));
  scene.balloon = makeSprite(30, 48, g => {
    g.strokeStyle = T.ink; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(8, 25); g.lineTo(11.5, 37); g.moveTo(22, 25); g.lineTo(18.5, 37); g.stroke();
    g.fillStyle = '#C08A57'; rr(10.5, 37, 9, 6.5, 1.8, g); g.fill(); g.lineWidth = 1; g.stroke();
    g.save(); g.beginPath(); g.ellipse(15, 14.5, 12, 13.5, 0, 0, Math.PI * 2); g.clip();
    ['#FF8F70', '#FFF1D6', '#FFD27A', '#FFF1D6', '#FF8F70'].forEach((c, i) => { g.fillStyle = c; g.fillRect(3 + i * 4.8, 0, 4.8, 30); });
    g.restore();
    g.beginPath(); g.ellipse(15, 14.5, 12, 13.5, 0, 0, Math.PI * 2); g.lineWidth = 1.1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(10, 8.5, 3, 5, -0.4, 0, Math.PI * 2); g.fill();
  });
  scene.glow = makeSprite(24, 24, g => {
    const gr = g.createRadialGradient(12, 12, 0, 12, 12, 12);
    gr.addColorStop(0, 'rgba(255,240,150,.95)'); gr.addColorStop(0.4, 'rgba(255,230,120,.35)'); gr.addColorStop(1, 'rgba(255,230,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 24, 24);
  });
  // sylinderskygge for bjørkestammene (gjenbrukes; stammene tegnes med translate)
  const tg = ctx.createLinearGradient(0, 0, PIPE_W, 0);
  tg.addColorStop(0, T.trunkShade); tg.addColorStop(0.2, T.trunk); tg.addColorStop(0.62, T.trunk); tg.addColorStop(1, T.trunkShade);
  scene.trunkGrad = tg;
  return scene;
}

function cabin(g, x, y, L) {
  const w = 18, h = 11;
  g.save(); g.translate(x, y); g.lineWidth = 1.1; g.strokeStyle = T.ink;
  g.fillStyle = T.cabinDark; g.fillRect(3.5, -h - 12, 3.6, 8); g.strokeRect(3.5, -h - 12, 3.6, 8);   // pipe
  g.fillStyle = T.cabin; g.fillRect(-w / 2, -h, w, h);
  g.fillStyle = T.cabinDark; for (let i = -w / 2 + 3; i < w / 2; i += 3) g.fillRect(i, -h + 1, 0.6, h - 1);   // panel
  g.strokeRect(-w / 2, -h, w, h);
  g.fillStyle = T.roof; g.beginPath(); g.moveTo(-w / 2 - 3, -h + 0.5); g.lineTo(0, -h - 8); g.lineTo(w / 2 + 3, -h + 0.5); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = T.moss; g.lineWidth = 2.6;   // torvtak
  g.beginPath(); g.moveTo(-w / 2 - 2, -h - 0.6); g.lineTo(0, -h - 8.6); g.lineTo(w / 2 + 2, -h - 0.6); g.stroke();
  g.fillStyle = T.roof; g.fillRect(-6.5, -7, 3.6, 7);   // dør
  if (T.windowLit) {   // varmt lys i vinduet om kvelden
    const gl = g.createRadialGradient(3.5, -6, 0, 3.5, -6, 13);
    gl.addColorStop(0, 'rgba(255,214,130,.55)'); gl.addColorStop(1, 'rgba(255,214,130,0)');
    g.fillStyle = gl; g.fillRect(-10, -19, 27, 26);
  }
  g.fillStyle = T.window; g.fillRect(1, -8, 5.2, 4.4);
  g.strokeStyle = T.cabinDark; g.lineWidth = 0.7; g.strokeRect(1, -8, 5.2, 4.4);
  g.beginPath(); g.moveTo(3.6, -8); g.lineTo(3.6, -3.6); g.stroke();
  g.restore();
  L.chimneys.push({ x: x + 5.3, y: y - h - 12 });
}
function birchTree(g, x, y, s, warm, back) {
  const th = 30 * s;
  g.fillStyle = hexA(T.ink, back ? 0.35 : 0.55); g.fillRect(x - 1.7 * s, y - th, 3.4 * s, th);
  g.fillStyle = back ? T.trunkShade : T.trunk; g.fillRect(x - 1.1 * s, y - th, 2.2 * s, th);
  g.fillStyle = T.bark; for (let k = 6; k < th; k += 5 * s) g.fillRect(x - 1.1 * s, y - k, 1.3 * s, 0.8);
  const c = warm ? T.crownWarm : back ? T.forest : T.crown;
  blob(g, [[x, y - th - 4 * s, 8 * s], [x - 6 * s, y - th + 1 * s, 6 * s], [x + 6 * s, y - th + 1 * s, 6 * s], [x, y - th + 3 * s, 6 * s]], c, T.ink, 1, back ? 0.25 : 0.45);
  g.fillStyle = 'rgba(255,255,255,.18)'; circle(g, x - 2.5 * s, y - th - 6 * s, 3 * s);
}
function bush(g, x, y, s) {
  blob(g, [[x - 11 * s, y - 6 * s, 8 * s], [x, y - 11 * s, 10 * s], [x + 11 * s, y - 6 * s, 8 * s], [x, y - 3 * s, 9 * s]], T.grassDark, T.ink, 1.1, 0.45);
  g.fillStyle = hexA(T.grass, 0.9); circle(g, x - 3 * s, y - 14 * s, 4.5 * s); circle(g, x - 11 * s, y - 9 * s, 3 * s);
}
function flower(g, x, y, r, c) {
  g.fillStyle = c; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; circle(g, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75); }
  g.fillStyle = '#F2B544'; circle(g, x, y, r * 0.6);
}

/* ---------- Stemningselementer (live) ---------- */
function initAmbient() {
  const groundY = H - GROUND_H, r = rng(91);
  stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * (groundY - 200), r: Math.random() < 0.3 ? 1.6 : 1, p: Math.random() * 10 }));
  initMotes();
  const span = Math.max(60, groundY - 310 - safeTop);
  clouds = Array.from({ length: 6 }, (_, i) => ({ x: r() * (W + 160), y: safeTop + 34 + r() * span, s: i < 3 ? 0.55 + r() * 0.2 : 0.85 + r() * 0.3, sp: i < 3 ? 0.03 : 0.07, drift: 2 + r() * 3, v: i % 3, far: i < 3 }));
}
function initMotes() {
  const groundY = H - GROUND_H, k = moteKind();
  const n = { firefly: 14, pollen: 18, leaf: 16, petal: 18, snow: 46 }[k];
  dust = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: moteY(groundY), r: k === 'snow' ? 0.8 + Math.random() * 1.6 : 0.8 + Math.random() * 1.2,
    vx: k === 'snow' ? 2 + Math.random() * 6 : 4 + Math.random() * 10, f: 0.5 + Math.random(), p: Math.random() * 6,
    fall: k === 'snow' ? 18 + Math.random() * 22 : 14 + Math.random() * 16, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 3,
    c: k === 'leaf' ? ['#F2994A', '#F7C548', '#E46B3C', '#D9A85E'][(Math.random() * 4) | 0] : ['#FFC6D6', '#FFE3EC', '#FF9EB5'][(Math.random() * 3) | 0]
  }));
}
// tegn et flislag med scroll; snapper til skjermpiksler så flisene aldri får søm
function drawLayer(L, y, speed, each) {
  const R = dpr * scale;
  let x = Math.round(-wrap(viewScroll * speed, L.w) * R) / R;
  for (; x < W; x += L.w) { ctx.drawImage(L.c, x, y, L.w, L.h); if (each) each(x); }
}
function drawSky(groundY) {
  ctx.drawImage(scene.sky.c, 0, 0, scene.sky.w, scene.sky.h);
  if (T.night) {
    ctx.fillStyle = '#FFF3D6';
    for (const s of stars) { ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2 + s.p)); circle(ctx, s.x, s.y, s.r); }
    ctx.globalAlpha = 1;
    const ph = (time % 13) / 13;   // stjerneskudd av og til
    if (ph < 0.06 && !reduceMotion) {
      const k = ph / 0.06, x = W * 0.78 - k * 130, y = safeTop + 50 + k * 46, a = Math.sin(k * Math.PI);
      const sg = ctx.createLinearGradient(x, y, x + 30, y - 11); sg.addColorStop(0, `rgba(255,246,220,${a})`); sg.addColorStop(1, 'rgba(255,246,220,0)');
      ctx.strokeStyle = sg; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30, y - 11); ctx.stroke();
    }
  }
  // myk sol / søvnig halvmåne (ingen harde lysstråler); gløden ligger ferdig i himmelbildet
  const { sx, sy } = sunPos();
  ctx.fillStyle = T.sun;
  if (T.night) {
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, 19, 0, 7); ctx.clip();
    ctx.beginPath(); ctx.rect(sx - 21, sy - 21, 42, 42); ctx.arc(sx + 8, sy - 5, 16, 0, 7); ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = hexA(T.ink, 0.8); ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(sx - 9, sy + 1, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();   // lukket øye
    ctx.fillStyle = 'rgba(255,150,170,.5)'; ctx.beginPath(); ctx.ellipse(sx - 11.5, sy + 6, 2.4, 1.4, 0, 0, 7); ctx.fill();
  } else {
    circle(ctx, sx, sy, 20);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; circle(ctx, sx - 6, sy - 6, 6);
  }
  // skyer (to lag) og luftballong
  for (const c of clouds) {
    const x = wrap(c.x - viewScroll * c.sp - time * c.drift, W + 160) - 80, S = scene.clouds[c.v];
    ctx.globalAlpha = c.far ? 0.8 : 1; ctx.drawImage(S.c, x, c.y, S.w * c.s, S.h * c.s);
  }
  ctx.globalAlpha = 1;
  if (groundY - safeTop > 400) {
    const B = scene.balloon, bx = wrap(W * 0.25 - viewScroll * 0.02 - time * 4, W + 120) - 60, by = safeTop + 58 + Math.sin(time * 0.6) * 5;
    ctx.drawImage(B.c, bx, by, B.w, B.h);
  }
  if (!T.night) {   // en liten fugleflokk krysser himmelen innimellom
    const ph = (time % 26) / 26;
    if (ph < 0.55) {
      const x0 = W + 30 - ph / 0.55 * (W + 90), y0 = safeTop + 150;
      ctx.strokeStyle = hexA(T.ink, 0.55); ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      [[0, 0], [12, -6], [22, 4]].forEach(([dx, dy], i) => {
        const f = Math.sin(time * 9 + i) * 2.2, x = x0 + dx, y = y0 + dy + Math.sin(time * 1.5 + i) * 2;
        ctx.beginPath(); ctx.moveTo(x - 4, y - f); ctx.quadraticCurveTo(x - 2, y - 1, x, y); ctx.quadraticCurveTo(x + 2, y - 1, x + 4, y - f); ctx.stroke();
      });
    }
  }
}
function drawScenery(groundY) {
  const M = scene.mountains;
  drawLayer(M, groundY - M.h, 0.05);
  // seilbåt på fjorden
  const bx = wrap(W * 0.3 - viewScroll * 0.05 - time * 2.5, W + 60) - 30, by = groundY - 63 + Math.sin(time * 1.6) * 0.6;
  ctx.fillStyle = '#FFF8EC'; ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(bx + 1, by - 2); ctx.lineTo(bx + 1, by - 13); ctx.lineTo(bx + 8, by - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#D0583F'; ctx.beginPath(); ctx.moveTo(bx - 5, by - 1.5); ctx.lineTo(bx + 9, by - 1.5); ctx.lineTo(bx + 6.5, by + 1.6); ctx.lineTo(bx - 3, by + 1.6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // åser med hytter + røyk fra pipene
  const Hl = scene.hills, hy = groundY - Hl.h;
  drawLayer(Hl, hy, 0.14, tx => {
    for (const c of Hl.chimneys) {
      const cx = tx + c.x, cy = hy + c.y;
      if (cx < -30 || cx > W + 10) continue;
      for (let k = 0; k < 6; k++) {
        const a = wrap(time * 0.32 + k / 6 + c.x * 0.013, 1), al = Math.min(1, a * 6) * (1 - a) * 0.55;
        ctx.fillStyle = T.night ? `rgba(225,220,245,${al})` : `rgba(255,255,255,${al})`;
        circle(ctx, cx - a * 18 + Math.sin(a * 7 + k) * 2, cy - a * 30, 1.6 + a * 4.5);
      }
    }
  });
  drawLayer(scene.forest, groundY - scene.forest.h, 0.3);
  drawLayer(scene.bushes, groundY - scene.bushes.h, 0.6);
}
function drawMotes() {
  const k = moteKind();
  if (k === 'leaf' || k === 'petal') {   // løv og blomsterblader som snurrer mens de daler
    for (const m of dust) {
      ctx.save(); ctx.translate(ip(m.px, m.x), ip(m.py, m.y)); ctx.rotate(m.rot); ctx.fillStyle = T.night ? mixHex(m.c, '#2A2C5A', 0.45) : m.c;
      ctx.beginPath(); ctx.ellipse(0, 0, m.r * 2.4, m.r * 1.2, 0, 0, 7); ctx.fill();
      if (k === 'leaf') { ctx.strokeStyle = hexA(T.ink, 0.35); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-m.r * 2.2, 0); ctx.lineTo(m.r * 2.2, 0); ctx.stroke(); }
      ctx.restore();
    }
    return;
  }
  if (k === 'snow') {
    ctx.fillStyle = T.night ? 'rgba(225,230,255,.85)' : 'rgba(255,255,255,.95)';
    for (const m of dust) circle(ctx, ip(m.px, m.x), ip(m.py, m.y), m.r);
    return;
  }
  if (k === 'firefly') {   // ildfluer som blinker
    for (const m of dust) {
      const a = Math.sin(time * m.f * 2 + m.p); if (a < 0.05) continue;
      const x = ip(m.px, m.x), y = ip(m.py, m.y);
      ctx.globalAlpha = a; ctx.drawImage(scene.glow.c, x - 7, y - 7, 14, 14);
      ctx.fillStyle = '#FFF6B0'; circle(ctx, x, y, 1.1);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(255,250,235,.7)';
    for (const m of dust) circle(ctx, ip(m.px, m.x), ip(m.py, m.y), m.r);
  }
}

/* ---------- Bjørkestammer ---------- */
function drawTrunkShadow(p, groundY) {
  ctx.fillStyle = hexA(T.ink, 0.16); ctx.beginPath(); ctx.ellipse(p.x + PIPE_W / 2 + 4, groundY + 3, PIPE_W / 2 + 9, 3.5, 0, 0, 7); ctx.fill();
}
function drawTrunk(p, groundY) {
  const ry = END_H / 2 - 0.5, by = p.top + p.gap;
  ctx.save(); ctx.translate(p.x, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  trunkBody(-10, p.top - ry, p.marksTop, p.top - ry, -1);
  trunkBody(by + ry, groundY + 2, p.marksBot, by + ry, 1);
  trunkDecor(p, p.top - ry, by + ry, groundY);
  trunkEnd(p, p.top - ry, false);
  trunkEnd(p, by + ry, true);
  ctx.restore();
  if (p.glow > 0) {   // varm glød i åpningen når man får poeng
    const cx = p.x + PIPE_W / 2, cy = p.top + p.gap / 2, gg = ctx.createRadialGradient(cx, cy, 2, cx, cy, p.gap * 0.6);
    gg.addColorStop(0, `rgba(255,236,170,${p.glow * 0.55})`); gg.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = gg; ctx.fillRect(cx - p.gap * 0.6, cy - p.gap * 0.6, p.gap * 1.2, p.gap * 1.2);
  }
}
// stammekropp: sylinderskygge + svarte barkmerker, målt fra enden (så merkene følger stammen når den beveger seg)
function trunkBody(y0, y1, marks, ref, dir) {
  if (y1 <= y0) return;
  const w = PIPE_W;
  ctx.fillStyle = scene.trunkGrad; ctx.fillRect(0, y0, w, y1 - y0);
  ctx.strokeStyle = T.bark;
  for (const m of marks) {
    const y = ref + dir * m.d;
    if (dir < 0 ? y < y0 - 4 : y > y1 + 4) break;
    if (m.scar) {   // «øye» der en gren har sittet
      ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(m.x, y + 3); ctx.lineTo(m.x + 6, y - 2.5); ctx.lineTo(m.x + 12, y + 3); ctx.stroke();
    } else {
      ctx.lineWidth = m.th; ctx.beginPath(); ctx.moveTo(m.x, y); ctx.quadraticCurveTo(m.x + m.len / 2, y + 0.9, m.x + m.len, y); ctx.stroke();
    }
  }
  ctx.strokeStyle = hexA(T.ink, 0.6); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(0, y1); ctx.moveTo(w, y0); ctx.lineTo(w, y1); ctx.stroke();
}
// snittflate med årringer og en mosekant (høstløv på bevegelige stammer, lyng på smale)
function trunkEnd(p, y, upper) {
  const w = PIPE_W, cx = w / 2, rx = w / 2 + 1, ry = END_H / 2 - 0.5, r = rng(p.decor.moss + (upper ? 1 : 2));
  const autumn = p.variant === 'moving', heather = p.variant === 'narrow';
  const lip = autumn ? ['#F2994A', '#F7C548', '#E46B3C'] : [T.moss];
  const bumpsAt = (a0, a1, n, size) => {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * rx, y + Math.sin(a) * ry + (upper ? 0.5 : 1), size * (0.75 + r() * 0.5)]); }
    return out;
  };
  const lipBlob = pts => {
    blob(ctx, pts, lip[0], T.ink, 1.1, 0.7);
    if (lip.length > 1) for (const [x, yy, k] of pts) { ctx.fillStyle = lip[(r() * lip.length) | 0]; circle(ctx, x, yy, k * 0.8); }
    ctx.fillStyle = autumn ? 'rgba(255,255,255,.25)' : hexA('#FFFFFF', 0.22);
    for (const [x, yy, k] of pts) circle(ctx, x - k * 0.3, yy - k * 0.35, k * 0.35);
    if (heather) for (const [x, yy, k] of pts) if (r() < 0.6) { ctx.fillStyle = r() < 0.5 ? '#C58BE0' : '#E3B5F2'; circle(ctx, x + (r() - 0.5) * k, yy - k * 0.5, 1.2); }
  };
  if (upper) lipBlob(bumpsAt(Math.PI * 1.08, Math.PI * 1.92, 6, 2.4));   // mose bak på kanten
  ctx.fillStyle = upper ? T.cut : T.cutRing;
  ctx.beginPath(); ctx.ellipse(cx, y, rx, ry, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = upper ? T.cutRing : hexA(T.ink, 0.35); ctx.lineWidth = 1;
  for (const k of [0.68, 0.38]) { ctx.beginPath(); ctx.ellipse(cx + 1, y + 0.3, rx * k, ry * k, 0, 0, 7); ctx.stroke(); }
  ctx.strokeStyle = hexA(T.ink, 0.75); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(cx, y, rx, ry, 0, 0, 7); ctx.stroke();
  lipBlob(bumpsAt(-0.12, Math.PI + 0.12, 10, 3.2));   // forkant
  if (!upper) {   // små mosedrypp som henger under den øvre stammen
    for (let i = 0; i < 3; i++) { const x = 8 + r() * (w - 16), l = 3 + r() * 4; blob(ctx, [[x, y + ry + l, 1.6], [x, y + ry + l * 0.5, 1.4]], lip[0], T.ink, 0.9, 0.6); }
  }
}
function trunkDecor(p, upBot, loTop, groundY) {
  const d = p.decor, w = PIPE_W, autumn = p.variant === 'moving';
  if (d.toad) toadstool(d.toad < 0 ? -6 : w + 6, groundY + 2);
  if (d.fungus) { const y = loTop + d.fungusD; if (y < groundY - 16) fungus(d.fungus < 0 ? 0 : w, y, d.fungus); }
  if (d.sprigBot) { const y = loTop + d.sprigBotD; if (y < groundY - 20) sprig(d.sprigBot < 0 ? 0 : w, y, d.sprigBot, autumn); }
  if (d.sprigTop) { const y = upBot - d.sprigTopD; if (y > safeTop) sprig(d.sprigTop < 0 ? 0 : w, y, d.sprigTop, autumn); }
  if (d.owl) { const y = upBot - d.owlD; if (y > safeTop + 16) owl(w * 0.5, y, p.seed); }
}
function fungus(x, y, side) {   // kjuker (hyllesopp) på siden av stammen
  ctx.strokeStyle = hexA(T.ink, 0.8); ctx.lineWidth = 1.1;
  for (const [dy, s] of [[0, 1], [8, 0.75]]) {
    ctx.fillStyle = '#E9D2A6'; ctx.beginPath(); ctx.ellipse(x + side * 3 * s, y + dy, 8 * s, 3.4 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C9A578'; ctx.beginPath(); ctx.ellipse(x + side * 3 * s, y + dy + 1.2 * s, 6.5 * s, 1.6 * s, 0, 0, Math.PI); ctx.fill();
  }
}
function sprig(x, y, side, autumn) {   // liten kvist med blader
  ctx.strokeStyle = '#7A5A44'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + side * 7, y - 1, x + side * 13, y - 7); ctx.stroke();
  const leaves = autumn ? ['#F2994A', '#F7C548', '#E46B3C'] : [T.crown, T.moss, T.crown];
  [[6, -1.5, -0.3], [10, -5, 0.5], [13.5, -8, -0.2]].forEach(([dx, dy, a], i) => {
    ctx.save(); ctx.translate(x + side * dx, y + dy); ctx.rotate(side * (a - 0.6));
    ctx.fillStyle = leaves[i]; ctx.beginPath(); ctx.ellipse(side * 2.5, -1.5, 3.6, 2, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = hexA(T.ink, 0.6); ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
  });
}
function owl(x, y, seed) {   // ugle som titter ut av et hull – blunker innimellom
  ctx.fillStyle = '#3B2F2A'; ctx.beginPath(); ctx.ellipse(x, y, 9, 10, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = hexA(T.ink, 0.9); ctx.lineWidth = 1.3; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 8.3, 9.3, 0, 0, 7); ctx.clip();
  ctx.fillStyle = '#A9825F'; circle(ctx, x, y + 3, 8);
  ctx.fillStyle = '#C9A57F'; circle(ctx, x - 3.2, y + 1, 3.6); circle(ctx, x + 3.2, y + 1, 3.6);
  const closed = wrap(time + (seed % 7), 4.3) < 0.14;
  if (closed) { ctx.strokeStyle = '#3B2F2A'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 4.8, y + 1); ctx.lineTo(x - 1.6, y + 1); ctx.moveTo(x + 1.6, y + 1); ctx.lineTo(x + 4.8, y + 1); ctx.stroke(); }
  else { ctx.fillStyle = '#2B211D'; circle(ctx, x - 3.2, y + 1, 1.8); circle(ctx, x + 3.2, y + 1, 1.8); ctx.fillStyle = '#FFFFFF'; circle(ctx, x - 2.6, y + 0.4, 0.6); circle(ctx, x + 3.8, y + 0.4, 0.6); }
  ctx.fillStyle = '#F2B544'; ctx.beginPath(); ctx.moveTo(x - 1, y + 3.4); ctx.lineTo(x + 1, y + 3.4); ctx.lineTo(x, y + 5.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function toadstool(x, y) {   // fluesopp ved roten
  ctx.strokeStyle = hexA(T.ink, 0.85); ctx.lineWidth = 1.1;
  ctx.fillStyle = '#FFF4E0'; rr(x - 1.8, y - 8, 3.6, 8, 1.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#E5574A'; ctx.beginPath(); ctx.ellipse(x, y - 8, 6.5, 4.6, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; circle(ctx, x - 2.5, y - 10, 1); circle(ctx, x + 2, y - 11, 0.9); circle(ctx, x + 3.8, y - 9, 0.7);
}

/* ---------- Power-ups: såpeboble, snegl og eikenøtt ---------- */
function bubble(x, y, r, t) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(0.75, 'rgba(170,225,250,.18)'); g.addColorStop(1, 'rgba(127,208,242,.55)');
  ctx.fillStyle = g; circle(ctx, x, y, r);
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,170,210,.65)'; ctx.beginPath(); ctx.arc(x, y, r - 2, t * 1.5, t * 1.5 + 1.1); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,240,220,.65)'; ctx.beginPath(); ctx.arc(x, y, r - 2, t * 1.5 + 2.4, t * 1.5 + 3.2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 0.48, r * 0.26, r * 0.15, -0.6, 0, 7); ctx.fill();
}
function drawPower(q) {
  const P = POWERS[q.kind], pulse = 1 + Math.sin(q.t * 5) * 0.05;
  const g = ctx.createRadialGradient(q.x, q.y, 3, q.x, q.y, POWER_R * 2.2);
  g.addColorStop(0, P.glow); g.addColorStop(1, hexA('#FFFFFF', 0));
  ctx.fillStyle = g; ctx.fillRect(q.x - 30, q.y - 30, 60, 60);
  if (q.kind === 'shield') { bubble(q.x, q.y, POWER_R * pulse, q.t); return; }
  ctx.save(); ctx.translate(q.x, q.y); ctx.scale(pulse, pulse);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.2;
  if (q.kind === 'slow') {   // snegl
    ctx.fillStyle = '#F6E3C2';
    ctx.beginPath(); ctx.moveTo(-11, 7); ctx.quadraticCurveTo(0, 9, 8, 6.5); ctx.quadraticCurveTo(11.5, 5, 11, 0); ctx.quadraticCurveTo(10, -3, 7.5, -2); ctx.lineTo(6, 5); ctx.lineTo(-9, 5); ctx.quadraticCurveTo(-12, 5.5, -11, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8.5, -2); ctx.lineTo(7.5, -7.5); ctx.moveTo(10.5, -1.5); ctx.lineTo(11.5, -7); ctx.stroke();
    ctx.fillStyle = UI_INK; circle(ctx, 7.5, -7.8, 1.1); circle(ctx, 11.5, -7.3, 1.1);
    ctx.fillStyle = '#B49BE8'; circle(ctx, -2, -0.5, 7.6); ctx.beginPath(); ctx.arc(-2, -0.5, 7.6, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#7E62C4'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let a = 0; a < 4 * Math.PI; a += 0.25) { const k = 0.55 * a; ctx.lineTo(-2 + Math.cos(a) * k, -0.5 + Math.sin(a) * k); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,130,150,.55)'; circle(ctx, 10.5, 2.5, 1.3);
  } else {   // gyllen eikenøtt
    ctx.fillStyle = '#F2B544'; ctx.beginPath(); ctx.ellipse(0, 3, 7, 8.5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-2.6, 3, 1.6, 3.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#9A6B3F'; ctx.beginPath(); ctx.ellipse(0, -3, 8.6, 4.6, 0, Math.PI, 0); ctx.quadraticCurveTo(0, -0.5, -8.6, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#B9875A'; for (const [dx, dy] of [[-4, -4.5], [0, -5.5], [4, -4.5], [-2, -2.5], [2, -2.5]]) circle(ctx, dx, dy, 0.9);
    ctx.strokeStyle = '#7A5A44'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.quadraticCurveTo(1, -10, 3, -10.5); ctx.stroke();
    const tw = (Math.sin(q.t * 6) + 1) / 2;   // gnistre
    ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`; starPath(8, -8, 2.2 + tw, 0); ctx.fill();
  }
  ctx.restore();
}

/* ---------- Fuglen ---------- */
// interpolert verdi mellom forrige og nåværende fysikk-steg (nye objekter har ingen forrige verdi ennå)
const ip = (prev, cur) => prev === undefined ? cur : prev + (cur - prev) * alpha;

function birdExpr() {
  if (state === State.DEAD || state === State.OVER) return 'dizzy';
  if (state === State.MENU && T.night) return 'sleep';
  if (bird.happy > 0) return 'happy';
  if (state === State.PLAY && bird.vy > 330) return 'wide';
  return 'normal';
}
function eye(x, y, s, expr, look) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = BIRD.ink; ctx.fillStyle = BIRD.ink; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  if (expr === 'happy') { ctx.beginPath(); ctx.arc(0, 1.2, 2.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  else if (expr === 'sleep') { ctx.beginPath(); ctx.arc(0, -0.8, 2.4, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
  else if (expr === 'dizzy') {
    ctx.lineWidth = 1.1; ctx.beginPath();
    for (let a = 0; a < 3 * Math.PI; a += 0.3) { const k = a * 0.3; ctx.lineTo(Math.cos(a + time * 7) * k, Math.sin(a + time * 7) * k); }
    ctx.stroke();
  } else {
    const closed = Math.sin(Math.PI * bird.blink), big = expr === 'wide' ? 1.2 : 1;
    ctx.beginPath(); ctx.ellipse(look, 0, 2.3 * big, 2.9 * big * Math.max(0.12, 1 - closed), 0, 0, 7); ctx.fill();
    if (closed < 0.6) {
      ctx.fillStyle = '#FFFFFF'; circle(ctx, look + 0.8, -1.1 * big, 0.95 * big); circle(ctx, look - 0.7, 1 * big, 0.45);
    }
  }
  ctx.restore();
}
function birdShape(expr, look = wear) {   // look = pynt (garderobe)
  const B = BIRD, R = BODY_R, flying = state === State.PLAY || state === State.DEAD;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = B.ink;
  // halefjær
  ctx.fillStyle = B.dark; ctx.lineWidth = 1.3;
  for (const [a, l] of [[-0.45, 8], [0.05, 7]]) {
    ctx.save(); ctx.translate(-R + 2.5, 1); ctx.rotate(Math.PI + a - bird.crest * 0.4);
    ctx.beginPath(); ctx.ellipse(l * 0.5, 0, l * 0.6, 2.6, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // føtter (henger ned i hvile, står når fuglen sitter; gjemt i flukt)
  if (!flying) {
    ctx.strokeStyle = B.beakDark; ctx.lineWidth = 1.6;
    for (const fx of [-2.6, 2.8]) { ctx.beginPath(); ctx.moveTo(fx, R - 2); ctx.lineTo(fx, R + 2.6); ctx.moveTo(fx - 1.8, R + 3); ctx.lineTo(fx + 1.8, R + 3); ctx.stroke(); }
    ctx.strokeStyle = B.ink;
  }
  // kropp med myk lyssetting og kremhvit mage
  const g = ctx.createRadialGradient(-4, -6, 2, 0, 0, R + 2);
  g.addColorStop(0, B.light); g.addColorStop(0.55, B.body); g.addColorStop(1, B.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = B.belly; ctx.beginPath(); ctx.ellipse(3, 7.5, 9.5, 7, -0.2, 0, 7); ctx.fill(); ctx.restore();
  ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
  // fjærtopp (henger litt etter bevegelsen) – skjules under luer og krone
  if (look !== 'beanie' && look !== 'santa' && look !== 'crown') {
    ctx.save(); ctx.translate(-1, -R + 1.5); ctx.rotate(-0.25 + bird.crest);
    ctx.strokeStyle = B.dark; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-1, -6, -5, -6.5); ctx.moveTo(1.6, 0); ctx.quadraticCurveTo(2.6, -6.5, -0.4, -8.6); ctx.stroke();
    ctx.restore();
  }
  // strikket skjerf rundt halsen (rødt med hvite striper)
  ctx.save();
  const band = () => { ctx.beginPath(); ctx.moveTo(-10.5, 3.6); ctx.quadraticCurveTo(0, 10, 11.6, 4); };
  band(); ctx.strokeStyle = B.ink; ctx.lineWidth = 6.2; ctx.stroke();
  band(); ctx.strokeStyle = B.scarf; ctx.lineWidth = 4.2; ctx.stroke();
  ctx.lineCap = 'butt'; band(); ctx.setLineDash([1.3, 2.6]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = B.scarf; ctx.strokeStyle = B.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(KNOT.x, KNOT.y, 2.6, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
  // vinge
  const t = Math.min(bird.flapT, 0.3) / 0.3;
  const wingA = flying ? -Math.sin(t * Math.PI) * 1.1 + 0.25
    : state === State.OVER ? 0.35 : Math.sin(time * (expr === 'sleep' ? 3 : 10)) * 0.4 + 0.1;
  ctx.save(); ctx.translate(-4, 2); ctx.rotate(wingA);
  ctx.fillStyle = B.dark; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(-3, 0, 7, 4.4, 0.2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = hexA(B.ink, 0.45); ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-6.5, 0.5); ctx.lineTo(-2, 1.2); ctx.moveTo(-6, 2.6); ctx.lineTo(-2.5, 2.8); ctx.stroke();
  ctx.restore();
  // ansikt i 3/4-vinkel: to øyne, kinn og et lite nebb
  eye(3, -3.4, 0.92, expr, bird.look); eye(9.6, -3.6, 0.8, expr, bird.look);
  ctx.fillStyle = B.cheek;
  ctx.beginPath(); ctx.ellipse(2.2, 1.8, 2.4, 1.4, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(11, 1.3, 1.9, 1.2, 0, 0, 7); ctx.fill();
  const open = state === State.PLAY ? (1 - t) * 1.4 : expr === 'dizzy' ? 0.7 : 0;
  ctx.strokeStyle = B.ink; ctx.lineWidth = 1;
  ctx.fillStyle = B.beak; ctx.beginPath(); ctx.moveTo(5.2, -0.8); ctx.quadraticCurveTo(8.2, -1.6, 10.6, 0.3 - open * 0.3); ctx.quadraticCurveTo(8, 1.2, 5.2, 0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = B.beakDark; ctx.beginPath(); ctx.moveTo(5.6, 1.1); ctx.quadraticCurveTo(8, 1.5 + open, 9.6, 1.2 + open); ctx.quadraticCurveTo(7.5, 2.8 + open, 5.6, 1.9); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (look !== 'none') accessory(look);
}
// pynt fra garderoben, i fuglens lokale koordinater (følger rotasjon og klem)
function accessory(id) {
  const B = BIRD;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = B.ink; ctx.lineWidth = 1.3;
  if (id === 'beanie') {   // strikkelue med brett og dusk
    ctx.fillStyle = '#E5574A'; ctx.beginPath(); ctx.moveTo(-10.5, -6.5); ctx.bezierCurveTo(-11, -17.5, 10, -18.5, 10.5, -7.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; for (const x of [-5.5, -1.5, 2.5, 6]) circle(ctx, x, -12.5 + Math.abs(x) * 0.15, 0.85);
    ctx.fillStyle = '#FFF1D6'; rr(-11.8, -9.4, 23.4, 4.8, 2.2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#E8D2AE'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let x = -9.5; x < 10; x += 2.4) { ctx.moveTo(x, -8.6); ctx.lineTo(x, -5.4); } ctx.stroke();
    ctx.strokeStyle = B.ink; ctx.lineWidth = 1.2; ctx.fillStyle = '#FFF1D6'; ctx.beginPath(); ctx.arc(0.5, -18.6, 3.5, 0, 7); ctx.fill(); ctx.stroke();
  } else if (id === 'santa') {   // nisselue som henger bakover
    ctx.fillStyle = '#D9483B'; ctx.beginPath(); ctx.moveTo(-10.2, -7); ctx.bezierCurveTo(-9, -19, 0, -23, -13.5, -25.5); ctx.bezierCurveTo(3, -23, 10, -16, 10.5, -7.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; rr(-11.8, -9.6, 23.4, 5.2, 2.6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-13.5, -25.5, 3.1, 0, 7); ctx.fill(); ctx.stroke();
  } else if (id === 'flower') {   // blomst i fjærtoppen
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.fillStyle = '#FF9EB5'; ctx.beginPath(); ctx.arc(-6 + Math.cos(a) * 2.4, -13.5 + Math.sin(a) * 2.4, 1.9, 0, 7); ctx.fill(); ctx.lineWidth = 0.7; ctx.stroke(); }
    ctx.fillStyle = '#FFD45C'; ctx.beginPath(); ctx.arc(-6, -13.5, 1.5, 0, 7); ctx.fill(); ctx.stroke();
  } else if (id === 'glasses') {   // runde briller over øynene
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(3, -3.4, 3.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(9.7, -3.6, 2.9, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.4, -3.8); ctx.lineTo(6.8, -3.8); ctx.moveTo(-0.4, -3.2); ctx.lineTo(-7, -2.2); ctx.stroke();
  } else if (id === 'crown') {   // liten gullkrone
    ctx.fillStyle = '#F2C14E'; ctx.beginPath();
    ctx.moveTo(-6, -10.5); ctx.lineTo(-6.8, -17.5); ctx.lineTo(-3, -14); ctx.lineTo(0, -19); ctx.lineTo(3, -14); ctx.lineTo(6.8, -17.5); ctx.lineTo(6, -10.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E5574A'; circle(ctx, 0, -12.6, 1.2); ctx.fillStyle = '#FFFFFF'; for (const [x, y] of [[-6.8, -17.5], [0, -19], [6.8, -17.5]]) circle(ctx, x, y, 0.9);
  }
  ctx.restore();
}
// skjerfsnippene i verdenskoordinater (fysikk), forskjøvet til den interpolerte fuglen
function drawScarfTails(ox, oy, a) {
  if (!bird.scarf) return;
  ctx.lineJoin = 'round';
  for (const tail of bird.scarf) {
    const pts = [a, ...tail.pts.map(p => ({ x: p.x + ox, y: p.y + oy }))];
    const line = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); };
    ctx.lineCap = 'round';
    line(); ctx.strokeStyle = BIRD.ink; ctx.lineWidth = 5.4; ctx.stroke();
    line(); ctx.strokeStyle = BIRD.scarf; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.lineCap = 'butt'; line(); ctx.setLineDash([1.2, 2.4]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke(); ctx.setLineDash([]);
    const e = pts[pts.length - 1], f = pts[pts.length - 2], dl = Math.hypot(e.x - f.x, e.y - f.y) || 1, ux = (e.x - f.x) / dl, uy = (e.y - f.y) / dl;
    ctx.strokeStyle = BIRD.scarfDark; ctx.lineWidth = 0.9; ctx.lineCap = 'round'; ctx.beginPath();
    for (const k of [-1.3, 0, 1.3]) { ctx.moveTo(e.x - uy * k, e.y + ux * k); ctx.lineTo(e.x + ux * 2.4 - uy * k, e.y + uy * 2.4 + ux * k); }
    ctx.stroke();
  }
}
function dizzyStars(bx, by, front) {
  if (state !== State.DEAD && state !== State.OVER) return;
  for (let i = 0; i < 3; i++) {
    const a = time * 3.2 + i * Math.PI * 2 / 3;
    if ((Math.sin(a) > 0) !== front) continue;
    starPath(bx + Math.cos(a) * 13, by - 16 + Math.sin(a) * 3.2, front ? 3.2 : 2.5, a);
    ctx.fillStyle = '#FFD45C'; ctx.fill(); ctx.strokeStyle = UI_INK; ctx.lineWidth = 0.9; ctx.stroke();
  }
}
function drawBird() {
  const bx = ip(bird.px, bird.x), by = ip(bird.py, bird.y), br = ip(bird.pr, bird.rot), expr = birdExpr();
  if (grace > 0 && Math.floor(time * 14) % 2) ctx.globalAlpha = 0.45;   // usårbar etter skjoldtreff: rolig blinking
  ctx.fillStyle = hexA(T.ink, 0.12); ctx.beginPath(); ctx.ellipse(bx + 1, by + 4, BODY_R * bird.sx, BODY_R * bird.sy * 0.95, 0, 0, 7); ctx.fill();
  dizzyStars(bx, by, false);
  drawScarfTails(bx - bird.x, by - bird.y, scarfAnchor(bx, by, br, bird.sx, bird.sy));
  ctx.save(); ctx.translate(bx, by); ctx.rotate(br); ctx.scale(bird.sx, bird.sy); birdShape(expr); ctx.restore();
  dizzyStars(bx, by, true);
  ctx.globalAlpha = 1;
  if (active.shield) {   // såpeboble rundt fuglen, vugger litt
    const wob = Math.sin(time * 5) * 0.04;
    ctx.save(); ctx.translate(bx, by); ctx.scale(1 + wob, 1 - wob); bubble(0, 0, BODY_R + 8, time); ctx.restore();
  }
}

function drawParticles() {
  for (const q of particles) {
    const a = clamp(q.life / q.max, 0, 1), x = ip(q.px, q.x), y = ip(q.py, q.y);
    ctx.globalAlpha = a; ctx.fillStyle = q.c;
    if (q.shape === 'puff') { ctx.globalAlpha = a * 0.75; circle(ctx, x, y, q.r * (1 + (1 - a) * 1.4)); }
    else if (q.shape === 'star') { starPath(x, y, q.r * 1.5, q.rot); ctx.fill(); }
    else if (q.shape === 'heart') { heartPath(x, y, q.r * 1.3); ctx.fill(); }
    else if (q.shape === 'feather') {
      const age = q.max - q.life;
      ctx.save(); ctx.translate(x + Math.sin(age * 6 + q.rot) * 3, y); ctx.rotate(Math.sin(age * 5 + q.rot) * 0.8);
      ctx.beginPath(); ctx.ellipse(0, 0, q.r * 1.8, q.r * 0.7, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = hexA(BIRD.ink, 0.5); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-q.r * 1.8, 0); ctx.lineTo(q.r * 1.8, 0); ctx.stroke();
      ctx.restore();
    } else if (q.shape === 'petal') {
      const age = q.max - q.life;
      ctx.globalAlpha = Math.min(1, q.life / 0.6);
      ctx.save(); ctx.translate(x + Math.sin(age * 3 + q.rot) * 6, y); ctx.rotate(q.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, q.r * 1.5, q.r * 0.8, 0, 0, 7); ctx.fill(); ctx.restore();
    } else circle(ctx, x, y, q.r);
  }
  ctx.globalAlpha = 1;
  for (const f of floats) text(f.txt, f.x, f.y, f.size, { color: f.color, alpha: clamp(f.life / 0.3, 0, 1), stroke: f.stroke, shadow: !f.stroke });
}

/* ---------- Brukergrensesnitt ---------- */
function button(key, x, y, w, h, label, fn, opts = {}) {
  const { fill = '#FFD27A', color = '#4A3424', size = 13, active = true } = opts;
  hud[key] = { x, y, w, h, fn };
  const pk = press.key === key ? (time - press.t) / 0.22 : 1;   // kort klem ved trykk
  ctx.save();
  if (pk < 1 && !reduceMotion) { const s = 1 - 0.08 * Math.sin(Math.PI * pk); ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - h / 2); }
  ctx.fillStyle = hexA(UI_INK, 0.25); rr(x, y + 3, w, h, h / 2); ctx.fill();
  ctx.fillStyle = active ? fill : 'rgba(255,248,236,.6)'; rr(x, y, w, h, h / 2); ctx.fill();
  if (active) { ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(x + 5, y + 3, w - 10, h * 0.36, h / 2); ctx.fill(); }
  ctx.strokeStyle = active ? UI_INK : hexA(UI_INK, 0.45); ctx.lineWidth = 1.6; rr(x, y, w, h, h / 2); ctx.stroke();
  text(label, x + w / 2, y + h / 2 + 0.5, size, { color: active ? color : hexA(UI_INK, 0.75), shadow: false, weight: 600 });
  ctx.restore();
}
// kremfarget panel med «strikkesøm» innenfor kanten
function panel(x, y, w, h) {
  ctx.fillStyle = hexA(UI_INK, 0.25); rr(x, y + 6, w, h, 18); ctx.fill();
  ctx.fillStyle = '#FFF8EC'; rr(x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = UI_INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#E8D2AE'; ctx.lineWidth = 1.6; rr(x + 7, y + 7, w - 14, h - 14, 12); ctx.stroke(); ctx.setLineDash([]);
}
function medalFor(s) {
  if (s >= 40) return ['#E3EEF8', '#9FB8CC', 'Platina'];
  if (s >= 30) return ['#FFD27A', '#D19A00', 'Gull'];
  if (s >= 20) return ['#E8E4EC', '#9A96A6', 'Sølv'];
  if (s >= 10) return ['#E8A06A', '#9C5B2A', 'Bronse'];
  return null;
}
function drawMedal(x, y, m) {
  const [c, d] = m;
  ctx.fillStyle = hexA(UI_INK, 0.18); circle(ctx, x, y + 2, 20);
  const g = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, 20); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.35, c); g.addColorStop(1, d);
  ctx.fillStyle = g; circle(ctx, x, y, 20);
  ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.stroke();
  ctx.strokeStyle = d; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.stroke();
  ctx.fillStyle = d; starPath(x, y, 9, 0); ctx.fill();
  if (!reduceMotion) { const sp = (time * 1.4) % 1; if (sp < 0.25) { ctx.fillStyle = 'rgba(255,255,255,.85)'; circle(ctx, x - 12 + sp * 96, y - 12, 2.5); } }
}
// ingen medalje ennå: et lite egg som vugger (i stedet for en grå plassholder)
function drawEgg(x, y) {
  ctx.fillStyle = hexA(UI_INK, 0.15); ctx.beginPath(); ctx.ellipse(x, y + 19, 12, 3, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y + 17); ctx.rotate(reduceMotion ? 0 : Math.sin(time * 2.4) * 0.08); ctx.translate(0, -17);
  ctx.fillStyle = '#FFF4DE'; ctx.beginPath(); ctx.moveTo(0, -18);
  ctx.bezierCurveTo(10, -18, 14, 2, 13.5, 6); ctx.bezierCurveTo(13, 14, 6, 18, 0, 18); ctx.bezierCurveTo(-6, 18, -13, 14, -13.5, 6); ctx.bezierCurveTo(-14, 2, -10, -18, 0, -18);
  ctx.closePath(); ctx.fill(); ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = '#E7C79B'; for (const [dx, dy, k] of [[-5, -4, 1.6], [4, 2, 1.3], [-2, 8, 1.1], [6, -8, 1], [-7, 5, 0.9]]) circle(ctx, dx, dy, k);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-5, -9, 2.2, 4, 0.3, 0, 7); ctx.fill();
  ctx.restore();
}
function drawActiveHud(y) {
  const items = [];
  if (active.shield) items.push(['shield', 1]);
  if (active.slow > 0) items.push(['slow', active.slow / POWERS.slow.dur]);
  if (active.double > 0) items.push(['double', active.double / POWERS.double.dur]);
  const w = 120, h = 20; let yy = y;
  for (const [k, frac] of items) {
    const P = POWERS[k], x = (W - w) / 2;
    ctx.fillStyle = hexA(UI_INK, 0.38); rr(x, yy, w, h, h / 2); ctx.fill();
    ctx.save(); rr(x, yy, w, h, h / 2); ctx.clip(); ctx.fillStyle = P.color; ctx.fillRect(x, yy, w * frac, h); ctx.restore();
    ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.4; rr(x, yy, w, h, h / 2); ctx.stroke();
    text(P.label, x + w / 2, yy + h / 2 + 0.5, 11, { shadow: false, weight: 600, stroke: true });
    yy += h + 6;
  }
}
// garderoben: rutenett med pynt; låst pynt vises gjennomsiktig med krav
function drawWardrobe(groundY) {
  ctx.fillStyle = 'rgba(40,28,50,.4)'; ctx.fillRect(0, 0, W, H);
  const pw = 256, ph = 248, px = (W - pw) / 2, py = Math.max(safeTop + 120, groundY * 0.52 - ph / 2);
  panel(px, py, pw, ph);
  text('Garderobe', W / 2, py + 25, 18, { color: UI_INK, shadow: false });
  text(`${totalPoints} poeng samlet`, W / 2, py + 44, 10, { color: '#9A7B5E', shadow: false, weight: 600 });
  const cw = 70, chh = 84, gx = 8, gy = 8, x0 = px + (pw - (cw * 3 + gx * 2)) / 2, y0 = py + 56;
  COSMETICS.forEach((c, i) => {
    const cx = x0 + (i % 3) * (cw + gx), cy = y0 + Math.floor(i / 3) * (chh + gy), ok = isUnlocked(c), on = wear === c.id;
    hud['w_' + c.id] = { x: cx, y: cy, w: cw, h: chh, fn: () => { if (ok) setWear(c.id); } };
    ctx.fillStyle = on ? '#FFE7A8' : '#FFFDF7'; rr(cx, cy, cw, chh, 12); ctx.fill();
    ctx.strokeStyle = UI_INK; ctx.lineWidth = on ? 2.2 : 1.2; ctx.stroke();
    ctx.save(); ctx.translate(cx + cw / 2, cy + 36); ctx.scale(1.25, 1.25); if (!ok) ctx.globalAlpha = 0.3;
    birdShape('normal', c.id); ctx.restore(); ctx.globalAlpha = 1;
    if (ok) text(c.label, cx + cw / 2, cy + 73, 9, { color: UI_INK, shadow: false, weight: 600 });
    else {
      text(c.gold ? 'Gull i én runde' : `${c.need} poeng`, cx + cw / 2, cy + 73, 9, { color: '#9A7B5E', shadow: false, weight: 600 });
      ctx.fillStyle = UI_INK; rr(cx + cw - 19, cy + 11, 10, 8, 2); ctx.fill();   // liten hengelås
      ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx + cw - 14, cy + 11, 3, Math.PI, 0); ctx.stroke();
    }
  });
  button('w_done', (W - 120) / 2, py + ph + 14, 120, 36, 'Ferdig', () => { wardrobe = false; }, { size: 15 });
}
function drawPauseButton(x, y, s) {
  hud.pause = { x, y, w: s, h: s, fn: pauseGame };
  ctx.fillStyle = hexA(UI_INK, 0.2); rr(x, y + 2, s, s, s / 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,248,236,.8)'; rr(x, y, s, s, s / 2); ctx.fill();
  ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = UI_INK; rr(x + s * 0.34, y + s * 0.3, s * 0.11, s * 0.4, 2); ctx.fill(); rr(x + s * 0.55, y + s * 0.3, s * 0.11, s * 0.4, 2); ctx.fill();
}
function drawPauseOverlay(groundY) {
  ctx.fillStyle = 'rgba(40,28,50,.38)'; ctx.fillRect(0, 0, W, H);
  if (resumeT > 0) {   // nedtelling 3-2-1 før spillet fortsetter
    const n = Math.ceil(resumeT / 0.5), f = (resumeT % 0.5) / 0.5, pop = 1 + f * f * 0.5;
    ctx.save(); ctx.translate(W / 2, groundY * 0.42); ctx.scale(pop, pop); text(String(n), 0, 0, 56, { color: '#FFD27A', alpha: 0.4 + 0.6 * (1 - f * f), stroke: true }); ctx.restore();
    return;
  }
  text('Pause', W / 2, groundY * 0.36, 34, { color: '#FFD27A', stroke: true });
  const bw = 120, bh = 38, y = groundY * 0.36 + 40;
  button('resume', (W - bw) / 2, y, bw, bh, 'Fortsett', resumeGame, { size: 15 });
  button('pmenu', (W - bw) / 2, y + bh + 14, bw, bh, 'Meny', goMenu, { fill: '#FFF8EC', size: 15 });
}

function drawWorld(groundY, pv, qv) {
  drawSky(groundY);
  drawScenery(groundY);
  drawMotes();
  for (const p of pv) drawTrunkShadow(p, groundY);
  for (const p of pv) drawTrunk(p, groundY);
  for (const q of qv) drawPower(q);
  drawLayer(scene.ground, groundY - 10, 1);
}
let fadeCanvas = null;
function fadeLayer() {   // offscreen-lerret i full skjermstørrelse for krysstoningen (lages ved behov)
  if (!fadeCanvas || fadeCanvas.c.width !== canvas.width || fadeCanvas.c.height !== canvas.height) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    fadeCanvas = { c, g: c.getContext('2d') };
  }
  return fadeCanvas;
}

function render() {
  const groundY = H - GROUND_H;
  ctx.save();
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  // dempet risting langs treffretningen; zoomer litt inn så kantene aldri blottlegges
  const env = shakeEnv();
  if (env > 0.05) {
    const w = fx.t * Math.PI * 2, o = Math.sin(w * 13) * env, q = Math.sin(w * 9.3 + 1) * env * 0.35;
    const z = 1 + 2 * env / Math.min(W, H);
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2 + fx.dx * o - fx.dy * q, -H / 2 + fx.dy * o + fx.dx * q);
  }
  viewScroll = ip(prevScroll, scroll);
  const pv = pipes.map(p => ({ ...p, x: ip(p.px, p.x), top: ip(p.ptop, p.top) }));
  const qv = powers.map(q => ({ ...q, x: ip(q.px, q.x), y: ip(q.py, q.y) }));

  drawWorld(groundY, pv, qv);   // ny tid
  if (worldFade) {   // gammel tid tegnes på et eget lerret og tones ut over den nye (hele verden blandes riktig, også overlappende lag)
    const cur = { T, scene }, off = fadeLayer(), k = worldFade.k * worldFade.k * (3 - 2 * worldFade.k);
    // den gamle verden oppdateres bare annethvert bilde – den blekner bort, så 30 bilder/s merkes ikke, og det halverer kostnaden
    if (!worldFade.n++ || worldFade.n % 2) {
      off.g.setTransform(1, 0, 0, 1, 0, 0); off.g.clearRect(0, 0, off.c.width, off.c.height); off.g.setTransform(mainCtx.getTransform());
      T = worldFade.from.T; scene = worldFade.from.scene; ctx = off.g;
      drawWorld(groundY, pv, qv);
    }
    ctx = mainCtx; T = cur.T; scene = cur.scene;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - k; ctx.drawImage(off.c, 0, 0); ctx.restore();
  }
  drawParticles();
  drawBird();
  for (const k in hud) delete hud[k];

  const topY = safeTop + 26;

  if (state === State.MENU) {
    const ty = topY + 40 + Math.sin(time * 2.4) * 3;
    text('Pixelfugl', W / 2, ty, 42, { color: '#FFD27A', stroke: true });
    text(`${SEASONS[seasonName].label} i bjørkeskogen`, W / 2, ty + 34, 13, { weight: 600, stroke: true, shadow: false });
    if (wardrobe) { drawWardrobe(groundY); return finishFrame(groundY); }
    text('Trykk for å flakse', W / 2, groundY * 0.58, 15, { weight: 600, stroke: true });
    if (D.zen) text('Zen: ingen poengjag – bare kos', W / 2, groundY * 0.58 + 24, 12, { weight: 600, color: '#BFE6D9', stroke: true });
    else if (best > 0) text(`Beste (${D.label.toLowerCase()}): ${best}`, W / 2, groundY * 0.58 + 24, 12, { weight: 600, color: '#FFD27A', stroke: true });
    const bw = 62, bh = 30, gapX = 6, total = bw * 4 + gapX * 3, x0 = (W - total) / 2, y0 = groundY * 0.58 + 52;
    text('Vanskelighet', W / 2, y0 - 12, 11, { weight: 600, stroke: true, shadow: false });
    let i = 0;
    for (const k in DIFFS) { const on = k === diffName; button('d_' + k, x0 + i * (bw + gapX), y0, bw, bh, DIFFS[k].label, () => setDiff(k), { fill: DIFFS[k].color, active: on, size: 12 }); i++; }
    button('wardrobe', (W - 132) / 2, y0 + bh + 12, 132, 28, 'Garderobe', () => { wardrobe = true; }, { fill: '#D9C6F7', size: 12 });
    const w3 = 80, g3 = 8, x3 = (W - (w3 * 3 + g3 * 2)) / 2, y3 = groundY + 32;
    button('sound', x3, y3, w3, 30, Sound.sfxMuted ? 'Lyd av' : 'Lyd på', () => Sound.toggleSfx(), { active: !Sound.sfxMuted, size: 12 });
    button('music', x3 + w3 + g3, y3, w3, 30, Sound.musMuted ? 'Musikk av' : 'Musikk', () => Sound.toggleMusic(), { active: !Sound.musMuted, fill: '#FFB8CB', size: 12 });
    button('theme', x3 + (w3 + g3) * 2, y3, w3, 30, themeName === 'day' ? 'Dag' : 'Natt', toggleTheme, { fill: themeName === 'day' ? '#FFE08A' : '#CFC6F4', size: 12 });
  }

  if (state === State.READY) {
    text('Klar?', W / 2, topY + 40, 32, { color: '#FFD27A', stroke: true });
    text(D.label, W / 2, topY + 70, 13, { weight: 600, color: D.color, stroke: true, shadow: false });
    const hy = groundY * 0.42 + 30 + Math.sin(time * 6) * 3;
    ctx.fillStyle = '#FFF8EC'; ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.5; rr(W / 2 + 36, hy, 20, 30, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = UI_INK; rr(W / 2 + 44, hy + 5, 4, 10, 2); ctx.fill();
    text('Trykk', W / 2, groundY * 0.42 + 80, 14, { weight: 600, stroke: true });
  }

  if (state === State.PLAY || state === State.DEAD) {
    const ds = time - scoreT, pop = ds < 0.8 && !reduceMotion ? 1 + 0.45 * Math.exp(-ds * 7) * Math.cos(ds * 22) : 1;
    ctx.save(); ctx.translate(W / 2, topY + 16); ctx.scale(pop, pop); text(String(score), 0, 0, 40, { stroke: true }); ctx.restore();
    drawActiveHud(topY + 46);
    if (state === State.PLAY && !paused) drawPauseButton(W - 46, safeTop + 12, 34);
  }

  if (state === State.OVER) {
    const e = Math.min(1, overT / 0.55), ease = easeOutCubic(e), back = reduceMotion ? ease : easeOutBack(e);
    const pw = 236, ph = 132, pxx = (W - pw) / 2, py = groundY * 0.46 - ph / 2 + (1 - back) * 80;
    ctx.fillStyle = `rgba(40,28,50,${(0.22 * ease).toFixed(3)})`; ctx.fillRect(0, 0, W, H);   // demp bakgrunnen bak panelet
    const tk = Math.min(1, Math.max(0, (overT - 0.1) / 0.45)), ts = reduceMotion ? 1 : easeOutBack(tk);
    ctx.save(); ctx.translate(W / 2, py - 34); ctx.scale(ts, ts);
    text(overTitle, 0, 0, 30, { color: newBest ? '#FFD27A' : '#FFA28C', stroke: true, alpha: Math.min(1, tk * 2) });
    ctx.restore();
    panel(pxx, py, pw, ph);
    if (unlocked.length && overT > 1) {   // ny pynt låst opp: et lite bånd over tittelen
      const uk = Math.min(1, (overT - 1) / 0.4), us = reduceMotion ? 1 : easeOutBack(uk), label = `Ny pynt: ${unlocked.map(c => c.label).join(', ')}!`;
      ctx.save(); ctx.translate(W / 2, py - 72); ctx.scale(us, us);
      ctx.font = '600 12px Fredoka, system-ui, sans-serif'; const tw = ctx.measureText(label).width + 28;
      ctx.fillStyle = '#D9C6F7'; rr(-tw / 2, -12, tw, 24, 12); ctx.fill(); ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.5; ctx.stroke();
      text(label, 0, 0.5, 12, { color: '#4A3424', shadow: false, weight: 600 });
      ctx.restore();
    }
    // medaljen (eller egget) snurrer inn når opptellingen er ferdig
    const mk = Math.min(1, Math.max(0, (overT - 0.55 - score / 30) / 0.45)), ms = reduceMotion ? mk : easeOutBack(mk);
    const m = medalFor(score), mx = pxx + 50, my = py + 63;
    if (mk > 0) {
      ctx.save(); ctx.translate(mx, my); ctx.rotate((1 - mk) * -1.4); ctx.scale(ms, ms); ctx.translate(-mx, -my);
      if (m) drawMedal(mx, py + 64, m); else drawEgg(mx, py + 62);
      ctx.restore();
      ctx.globalAlpha = mk;
      if (m) text(m[2], mx, py + 103, 11, { color: UI_INK, shadow: false, weight: 600, alpha: mk });
      else {
        text('Nesten!', mx, py + 101, 11, { color: UI_INK, shadow: false, weight: 600, alpha: mk });
        text(`${10 - score} til bronse`, mx, py + 114, 9, { color: '#9A7B5E', shadow: false, weight: 600, alpha: mk });
      }
      ctx.globalAlpha = 1;
    }
    const shown = overShown;
    text('Poeng', pxx + pw - 28, py + 30, 12, { align: 'right', color: '#9A7B5E', shadow: false, weight: 600 });
    text(String(shown), pxx + pw - 28, py + 54, 28, { align: 'right', color: UI_INK, shadow: false });
    text('Beste', pxx + pw - 28, py + 84, 12, { align: 'right', color: '#9A7B5E', shadow: false, weight: 600 });
    text(String(best), pxx + pw - 28, py + 108, 28, { align: 'right', color: UI_INK, shadow: false });
    if (newBest && shown === score) {
      ctx.fillStyle = '#FFA28C'; rr(pxx + pw - 120, py + 74, 34, 18, 9); ctx.fill(); ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.4; ctx.stroke();
      text('Ny!', pxx + pw - 103, py + 83.5, 11, { shadow: false, weight: 600, color: '#FFFDF6', stroke: true });
    }
    text(D.label, pxx + 50, py + 22, 11, { color: D.ink, shadow: false, weight: 600 });
    // tydelige valg i stedet for «trykk hvor som helst»: spill igjen, eller tilbake til menyen
    if (overT > 0.9) {
      const k = Math.min(1, (overT - 0.9) / 0.3), slide = (1 - (1 - Math.pow(1 - k, 3))) * 24;
      const bh = 38, b1 = 128, b2 = 92, gap = 10, x0 = (W - b1 - b2 - gap) / 2, by = py + ph + 22 + slide;
      button('again', x0, by, b1, bh, 'Spill igjen', goReady, { size: 15 });
      button('menu', x0 + b1 + gap, by, b2, bh, 'Meny', goMenu, { fill: '#FFF8EC', size: 15 });
    }
  }

  finishFrame(groundY);
}
// felles avslutning av bildet: vignett, effekter, pause og overgang
function finishFrame(groundY) {
  // vignett: varm og lys om dagen, mørkeblå om natten
  ctx.drawImage(scene.vignette.c, 0, 0, scene.vignette.w, scene.vignette.h);
  if (state === State.PLAY && active.slow > 0) {
    const sg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    sg.addColorStop(0, 'rgba(180,155,232,0)'); sg.addColorStop(1, 'rgba(180,155,232,.3)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  }
  // myk farget kant ved treff (erstatter hvit fullskjerm-blits)
  if (fx.tint > 0) {
    const tg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    tg.addColorStop(0, `rgba(${fx.rgb},0)`); tg.addColorStop(1, `rgba(${fx.rgb},${(fx.tint * 0.45).toFixed(3)})`);
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H);
  }
  if (paused) drawPauseOverlay(groundY);
  if (transitionT > 0) {   // overgang: en sirkel som åpner seg rundt fuglen (eller en enkel toning ved redusert bevegelse)
    if (reduceMotion) { ctx.fillStyle = `rgba(40,28,50,${transitionT * 0.45})`; ctx.fillRect(0, 0, W, H); }
    else {
      const k = easeOutCubic(1 - transitionT), R = Math.hypot(W, H) * (0.12 + 0.88 * k);
      ctx.fillStyle = `rgba(40,28,50,${(0.75 * (1 - k * 0.5)).toFixed(3)})`;
      ctx.beginPath(); ctx.rect(-20, -20, W + 40, H + 40); ctx.arc(ip(bird.px, bird.x), ip(bird.py, bird.y), R, 0, Math.PI * 2); ctx.fill('evenodd');
    }
  }
  ctx.restore();
}
