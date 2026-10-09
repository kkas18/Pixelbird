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
// blåmeis: blå hette, vinger og hale, hvitt ansikt med mørk øyestripe og halsring, gul buk og gulgrønn rygg
const BIRD = {
  cap: '#3A8AD6', capLight: '#6FB2EC', wing: '#4A93DA', wingDark: '#2F6FB4', back: '#A9BE5A', belly: '#FFD23E',
  face: '#FFFDF6', mask: '#22304F', ink: '#22304F', eye: '#10141F', beak: '#4A505E', beakDark: '#2E323C', feet: '#7487A8',
  scarf: '#D9473A', scarfDark: '#A7352B', lus: '#FFF8EC', shade: 'rgba(52,44,96,.13)'
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
  if (ink) {   // konturen forskyves mot skyggesiden: tykk nede til venstre, tynn oppe til høyre
    const ox = SHADE_X * lw * 0.5, oy = SHADE_Y * lw * 0.5;
    g.globalAlpha = inkAlpha; g.fillStyle = ink; for (const [x, y, r] of pts) circle(g, x + ox, y + oy, r + lw); g.globalAlpha = 1;
  }
  g.fillStyle = fill; for (const [x, y, r] of pts) circle(g, x, y, r);
}
function text(txt, x, y, size, opts = {}) {
  const { weight = 700, align = 'center', color = T.text, shadow = true, alpha = 1, baseline = 'middle', stroke = false } = opts;
  ctx.font = `${weight} ${size}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = baseline; ctx.globalAlpha = alpha;
  if (shadow) { ctx.fillStyle = T.textShadow; ctx.fillText(txt, x, y + Math.max(1.5, size * 0.08)); }
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.2, size * 0.15); ctx.strokeStyle = UI_INK; ctx.strokeText(txt, x, y); }
  ctx.fillStyle = color; ctx.fillText(txt, x, y); ctx.globalAlpha = 1;
}

/* ---------- Håndlaget preg: ujevn strek, korssting og papirkorn ----------
   Lyset kommer fra sola oppe til høyre, så konturene er tykkest nede til venstre (skyggesiden).
   All ujevnhet er frøstyrt: samme ting får samme strek hvert bilde, så ingenting flimrer. */
const SHADE_X = -0.6, SHADE_Y = 0.8;    // enhetsvektor mot skyggesiden
// glatt, frøstyrt støy rundt en lukket kurve (t i radianer) eller langs en linje; verdier ca. −1 … 1
function wobble(seed) {
  const r = rng(seed), p = [r() * 6.28, r() * 6.28, r() * 6.28];
  return t => Math.sin(t * 2 + p[0]) * 0.5 + Math.sin(t * 3 + p[1]) * 0.32 + Math.sin(t * 5 + p[2]) * 0.18;
}
// punkter rundt et avrundet rektangel, med utoverrettet normal (for konturer og søm)
function rrPoints(x, y, w, h, r, step = 3) {
  r = Math.min(r, w / 2, h / 2);
  const pts = [], H2 = Math.PI / 2;
  // hjørnesentre med startvinkel, i retning med klokka fra øverst til høyre
  const corners = [[x + w - r, y + r, -H2], [x + w - r, y + h - r, 0], [x + r, y + h - r, H2], [x + r, y + r, Math.PI]];
  corners.forEach(([cx, cy, a0], k) => {
    const n = Math.max(2, Math.ceil(r * H2 / step));
    for (let i = 0; i <= n; i++) { const a = a0 + i / n * H2, nx = Math.cos(a), ny = Math.sin(a); pts.push({ x: cx + nx * r, y: cy + ny * r, nx, ny }); }
    // rett kant fram til neste hjørne (normalen peker utover)
    const nx = Math.cos(a0 + H2), ny = Math.sin(a0 + H2), [qx, qy, qa] = corners[(k + 1) % 4];
    const ax = cx + nx * r, ay = cy + ny * r, bx = qx + Math.cos(qa) * r, by = qy + Math.sin(qa) * r;
    const m = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (step * 2)));
    for (let i = 1; i < m; i++) pts.push({ x: ax + (bx - ax) * i / m, y: ay + (by - ay) * i / m, nx, ny });
  });
  return pts;
}
// håndtegnet kontur: fyll mellom formen og en ujevn ytterkant, tykkest mot skyggesiden.
// Tegnes FØR fyllet; fyllet dekker innsiden. rot = hvor mye formen er rotert (lyset står stille).
function inkEdge(g, pts, lw, seed, amp = 0.35, rot = 0) {
  const n = wobble(seed), sx = SHADE_X * Math.cos(rot) + SHADE_Y * Math.sin(rot), sy = -SHADE_X * Math.sin(rot) + SHADE_Y * Math.cos(rot);
  g.beginPath();
  pts.forEach((p, i) => {
    const k = lw * (1 + 0.45 * (p.nx * sx + p.ny * sy)) + amp * n(i / pts.length * 6.283);
    g.lineTo(p.x + p.nx * k, p.y + p.ny * k);
  });
  g.closePath(); g.fill();
}
const circlePoints = (x, y, r, n = 40) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, nx = Math.cos(a), ny = Math.sin(a); return { x: x + nx * r, y: y + ny * r, nx, ny }; });
function inkCircle(g, x, y, r, lw, seed, amp, rot) { inkEdge(g, circlePoints(x, y, r), lw, seed, amp, rot); }
function inkRR(g, x, y, w, h, r, lw, seed, amp) { inkEdge(g, rrPoints(x, y, w, h, r), lw, seed, amp); }

// ett korssting i en rute (s = rutestørrelse): understing «/» og overstinget «\» i en lysere tråd
function stitch(g, x, y, s, under, over, jit = 0) {
  const i = s * 0.16;
  g.lineWidth = s * 0.34; g.lineCap = 'round';
  g.strokeStyle = under; g.beginPath(); g.moveTo(x + i + jit, y + s - i); g.lineTo(x + s - i, y + i - jit); g.stroke();
  g.strokeStyle = over; g.beginPath(); g.moveTo(x + i, y + i + jit); g.lineTo(x + s - i - jit, y + s - i); g.stroke();
}
// et rutemønster (strenger med «X» og «.») som korssting på stoff, med mørk ytterkant rundt hele motivet
function stitchGrid(g, rows, x0, y0, s, colors, seed, outline = null) {
  const r = rng(seed), cells = [];
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') cells.push([x0 + i * s, y0 + j * s, ch]); }));
  if (outline) {   // ytterkant: litt større ruter under alt, forskjøvet mot skyggesiden
    const o = outline.w;
    g.fillStyle = outline.color;
    for (const [x, y] of cells) g.fillRect(x - o + SHADE_X * o * 0.5, y - o + SHADE_Y * o * 0.5, s + o * 2, s + o * 2);
  }
  for (const [x, y, ch] of cells) {
    const c = colors[ch] || colors.X;
    g.fillStyle = c[0]; g.fillRect(x, y, s, s);               // stoffet skimter mellom trådene
    stitch(g, x, y, s, c[1], c[2], (r() - 0.5) * s * 0.12);   // litt ujevne sting, som for hånd
  }
}

function buildLogo(s) {
  const rows = logoRows('Pixelfugl'), pad = 4;
  return makeSprite(rows[0].length * s + pad * 2, rows.length * s + pad * 2 + 2, g => {
    g.fillStyle = hexA(UI_INK, 0.3);   // myk skygge under broderiet
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') g.fillRect(pad + i * s - 1, pad + j * s + 2.6, s + 2, s + 2); }));
    stitchGrid(g, rows, pad, pad, s, {
      X: ['#DC952B', '#F4B53F', '#FFDA7E'],
      B: ['#2C68AC', '#3A8AD6', '#86C4F2']
    }, 909, { w: 1.7, color: UI_INK });
  });
}
// håndlaget pikselskrift for logoen: hver rute er ett korssting (9 rader: 2 over x-høyden, 5 x-høyde, 2 under).
// B = blått sting (i-prikken er en liten blåmeis-hilsen)
const LOGO_GLYPHS = {
  P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....', '.....', '.....'],
  i: ['B', '.', 'X', 'X', 'X', 'X', 'X', '.', '.'],
  x: ['.....', '.....', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', '.....', '.....'],
  e: ['.....', '.....', '.XXX.', 'X...X', 'XXXXX', 'X....', '.XXXX', '.....', '.....'],
  l: ['X.', 'X.', 'X.', 'X.', 'X.', 'X.', '.X', '..', '..'],
  f: ['..XX', '.X..', 'XXX.', '.X..', '.X..', '.X..', '.X..', '....', '....'],
  u: ['.....', '.....', 'X...X', 'X...X', 'X...X', 'X..XX', '.XX.X', '.....', '.....'],
  g: ['.....', '.....', '.XXXX', 'X...X', 'X...X', '.XXXX', '....X', 'X...X', '.XXX.'],
  // til overskriftene
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X', '.....', '.....'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.', '.....', '.....'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.', '.....', '.....'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X', '.....', '.....'],
  G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.', '.....', '.....'],
  Å: ['..X..', '.X.X.', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X', '.....', '.....', '..X..', '.X.X.'],   // to ekstra rader: ringen over
  y: ['.....', '.....', 'X...X', 'X...X', 'X...X', '.XXXX', '....X', '...X.', 'XXX..'],
  r: ['....', '....', 'X.XX', 'XX..', 'X...', 'X...', 'X...', '....', '....'],
  k: ['X...', 'X...', 'X..X', 'X.X.', 'XX..', 'X.X.', 'X..X', '....', '....'],
  o: ['.....', '.....', '.XXX.', 'X...X', 'X...X', 'X...X', '.XXX.', '.....', '.....'],
  d: ['....X', '....X', '.XXXX', 'X...X', 'X...X', 'X...X', '.XXXX', '.....', '.....'],
  n: ['.....', '.....', 'XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', '.....', '.....'],
  a: ['.....', '.....', '.XXX.', '....X', '.XXXX', 'X...X', '.XXXX', '.....', '.....'],
  s: ['....', '....', '.XXX', 'X...', '.XX.', '...X', 'XXX.', '....', '....'],
  b: ['X....', 'X....', 'XXXX.', 'X...X', 'X...X', 'X...X', 'XXXX.', '.....', '.....'],
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X', '.....', '.....'],
  j: ['.B', '..', '.X', '.X', '.X', '.X', '.X', '.X', 'X.'],
  m: ['.....', '.....', 'XX.X.', 'X.X.X', 'X.X.X', 'X.X.X', 'X.X.X', '.....', '.....'],
  '!': ['X', 'X', 'X', 'X', 'X', '.', 'X', '.', '.'],
  '?': ['.XXX.', 'X...X', '....X', '..XX.', '..X..', '.....', '..X..', '.....', '.....'],
  ' ': ['..', '..', '..', '..', '..', '..', '..', '..', '..']
};
// sett sammen et ord til ett rutenett med én tom kolonne mellom bokstavene. Rutenettet har to rader over
// versalhøyden (til ringen i Å) når ordet trenger dem; ellers 9 rader.
const glyphRows = ch => { const gl = LOGO_GLYPHS[ch]; return gl.length > 9 ? [...gl.slice(9), ...gl.slice(0, 9)] : ['', ''].map(() => '.'.repeat(gl[0].length)).concat(gl); };
function logoRows(word) {
  const accents = [...word].some(ch => LOGO_GLYPHS[ch] && LOGO_GLYPHS[ch].length > 9), n = accents ? 11 : 9, rows = Array(n).fill('');
  [...word].forEach((ch, k) => { const gl = glyphRows(ch).slice(11 - n); for (let j = 0; j < n; j++) rows[j] += (k ? '.' : '') + gl[j]; });
  return rows;
}
const canStitch = txt => [...txt].every(ch => LOGO_GLYPHS[ch]);
// broderte overskrifter (samme håndlagde skrift som logoen), ferdig tegnet og hurtigbufret per tekst og stil
const STITCH_STYLES = {
  gold: { X: ['#DC952B', '#F4B53F', '#FFDA7E'], B: ['#2C68AC', '#3A8AD6', '#86C4F2'], outline: true },
  coral: { X: ['#D9573F', '#F07A5F', '#FFB09A'], B: ['#2C68AC', '#3A8AD6', '#86C4F2'], outline: true },
  ink: { X: ['#4A3628', '#5B4636', '#7A604C'], B: ['#2C68AC', '#3A8AD6', '#86C4F2'], outline: false }
};
const stitchCache = new Map();
function stitchSprite(txt, cell, style) {
  const key = `${txt}|${cell}|${style}|${dpr * scale}`;
  if (stitchCache.has(key)) return stitchCache.get(key);
  const rows = logoRows(txt), st = STITCH_STYLES[style], pad = st.outline ? 3 : 1;
  const L = makeSprite(rows[0].length * cell + pad * 2, rows.length * cell + pad * 2 + 2, g => {
    if (st.outline) { g.fillStyle = hexA(UI_INK, 0.3); rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') g.fillRect(pad + i * cell - 1, pad + j * cell + cell * 0.5, cell + 2, cell + 2); })); }
    stitchGrid(g, rows, pad, pad, cell, st, seedOf(txt), st.outline ? { w: cell * 0.34, color: UI_INK } : null);
  });
  L.base = pad + (rows.length - 2) * cell;   // grunnlinjen (bunnen av versalene) fra toppen
  L.mid = pad + (rows.length - 6) * cell;    // midt på x-høyden
  stitchCache.set(key, L);
  return L;
}
// tegn en overskrift sentrert på (x, y = midt på teksten); faller tilbake til fonten hvis en bokstav mangler
function stitchHeading(txt, x, y, cell, style, alpha = 1) {
  if (!canStitch(txt)) return text(txt, x, y, cell * 9.5, { color: style === 'coral' ? '#FFA28C' : style === 'ink' ? UI_INK : '#FFD27A', stroke: style !== 'ink', shadow: false, alpha });
  const L = stitchSprite(txt, cell, style), a = ctx.globalAlpha;
  ctx.globalAlpha = a * alpha; ctx.drawImage(L.c, Math.round(x - L.w / 2), y - L.mid, L.w, L.h); ctx.globalAlpha = a;
}
// selburose (åttebladsrose) – det klassiske norske strikkemotivet, brukt på medaljene
const SELBUROSE = [
  '...X.....X...', '...XX...XX...', '...XXX.XXX...', 'XXX.XXXXX.XXX', '.XXX.XXX.XXX.', '..XXX.X.XXX..', '...XXX.XXX...',
  '..XXX.X.XXX..', '.XXX.XXX.XXX.', 'XXX.XXXXX.XXX', '...XXX.XXX...', '...XX...XX...', '...X.....X...'
];

// papirkorn: fint støymønster i skjermpiksler, med noen lange fibre; bakes inn i de stillestående lagene
let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), r = rng(4242);
  // myk marmorering: grov støy skalert opp med utjevning (papirets ujevne fibre)
  const m = 64, sm = document.createElement('canvas'); sm.width = sm.height = m;
  const sg = sm.getContext('2d'), img = sg.createImageData(m, m);
  for (let i = 0; i < m * m; i++) {
    const v = r(), light = v > 0.5, a = Math.abs(v - 0.5) * 2 * 26;
    img.data[i * 4] = light ? 255 : 120; img.data[i * 4 + 1] = light ? 252 : 92; img.data[i * 4 + 2] = light ? 240 : 70; img.data[i * 4 + 3] = a;
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(sm, 0, 0, n, n);
  // fint korn: spredte, svake prikker (mest lyse)
  for (let i = 0; i < 1400; i++) {
    const x = r() * n, y = r() * n, lt = r() < 0.7;
    g.fillStyle = lt ? 'rgba(255,253,244,.35)' : 'rgba(110,84,62,.16)'; g.fillRect(x, y, 1, 1);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {   // fibre
    const x = r() * n, y = r() * n, a = r() * 6.28, l = 5 + r() * 12;
    g.strokeStyle = r() < 0.5 ? 'rgba(110,84,62,.07)' : 'rgba(255,252,240,.18)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return (grainTile = c);
}
// papirkorn over et område på hovedlerretet (klipp først); mønsteret ligger i skjermpiksler
let grainPat = null;
function paperOn(g, alpha) {
  if (!grainPat || grainPat.g !== g) grainPat = { g, p: g.createPattern(grain(), 'repeat') };
  const m = g.getTransform();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha *= alpha; g.fillStyle = grainPat.p;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
  g.setTransform(m);
}
// legg papirkorn over det som allerede er tegnet på lerretet (bare der det finnes farge)
function paper(g, alpha) {
  const c = g.canvas;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = alpha;
  g.fillStyle = g.createPattern(grain(), 'repeat'); g.fillRect(0, 0, c.width, c.height);
  g.restore();
}

/* ---------- Dybde: dybdeskarphet, dis og fokus ----------
   Lagene får uskarphet og dis etter avstand, bakt inn én gang når scenen tegnes (ingen kostnad per bilde).
   Spilleplanet (stammer, fugl, bakke) er skarpt. I menyen ligger fokus på landskapet: da brukes en skarp
   kopi av lagene, og fokus glir over til fuglen når runden starter (focusK går fra 0 til 1). */
const DEPTH = {   // blur i logiske px, dis = andel himmelfarge; s = lagets parallakse
  0.05: { blur: 2.2, haze: 0.2 }, 0.14: { blur: 1.4, haze: 0.11 }, 0.3: { blur: 0.8, haze: 0.05 }, 0.6: { blur: 0.35, haze: 0 },
  sky: { blur: 0.7, haze: 0 }, fore: { blur: 3.2, haze: 0 }
};
// Canvas-filter (blur) finnes ikke i alle nettlesere; da lages uskarpheten i JavaScript (samme resultat, litt tregere)
const canFilter = (() => { try { const g = document.createElement('canvas').getContext('2d'); g.filter = 'blur(2px)'; return g.filter === 'blur(2px)'; } catch (e) { return false; } })();
let forceJsBlur = false;   // for testene
// tre ganger boksuskarphet ≈ gaussisk; på forhåndsmultiplisert alfa, så kantene ikke får mørke render
function boxBlurCanvas(c, r) {
  const g = c.getContext('2d'), w = c.width, h = c.height, img = g.getImageData(0, 0, w, h), d = img.data, n = w * h;
  const f = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const a = d[i * 4 + 3] / 255; f[i * 4] = d[i * 4] * a; f[i * 4 + 1] = d[i * 4 + 1] * a; f[i * 4 + 2] = d[i * 4 + 2] * a; f[i * 4 + 3] = d[i * 4 + 3]; }
  const tmp = new Float32Array(Math.max(w, h) * 4), rad = Math.max(1, Math.round((Math.sqrt(4 * r * r + 1) - 1) / 2));   // tre boksbredder gir sigma ≈ r
  const pass = (len, stride, start) => {
    for (let k = 0; k < len; k++) { const o = (start + k * stride) * 4; tmp[k * 4] = f[o]; tmp[k * 4 + 1] = f[o + 1]; tmp[k * 4 + 2] = f[o + 2]; tmp[k * 4 + 3] = f[o + 3]; }
    const sum = [0, 0, 0, 0], at = (k, ch) => tmp[Math.min(len - 1, Math.max(0, k)) * 4 + ch];
    for (let ch = 0; ch < 4; ch++) for (let k = -rad; k <= rad; k++) sum[ch] += at(k, ch);
    for (let k = 0; k < len; k++) {
      const o = (start + k * stride) * 4;
      for (let ch = 0; ch < 4; ch++) { f[o + ch] = sum[ch] / (rad * 2 + 1); sum[ch] += at(k + rad + 1, ch) - at(k - rad, ch); }
    }
  };
  for (let it = 0; it < 3; it++) { for (let y = 0; y < h; y++) pass(w, 1, y * w); for (let x = 0; x < w; x++) pass(h, w, x); }
  for (let i = 0; i < n; i++) { const a = f[i * 4 + 3]; d[i * 4 + 3] = a; const k = a > 0 ? 255 / a : 0; d[i * 4] = f[i * 4] * k; d[i * 4 + 1] = f[i * 4 + 1] * k; d[i * 4 + 2] = f[i * 4 + 2] * k; }
  g.putImageData(img, 0, 0);
}
const copyCanvas = src => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; };
// Uskarphet i lav oppløsning: laget skaleres ned én gang (med luft rundt), gjøres uskarpt der og beholdes i lav
// oppløsning – det skaleres opp først når det tegnes. Innholdet er uansett uskarpt, så det ser likt ut, og det er
// mange ganger billigere (og bruker mye mindre minne) enn i full oppløsning.
// tiled: luften til venstre/høyre fylles med motsatt kant (sømløs flis), og nederste rad forlenges nedover.
function lowResBlur(c, r, tiled, haze) {
  const k = r >= 6 ? 4 : r >= 3 ? 3 : r >= 1.5 ? 2 : 1, pad = Math.ceil(r * 3), cw = c.width, ch = c.height;
  const tw = cw + pad * 2, th = ch + pad * (tiled ? 1 : 2), oy = tiled ? 0 : pad;
  const mk = () => { const x = document.createElement('canvas'); x.width = Math.ceil(tw / k); x.height = Math.ceil(th / k); return x; };
  const A = mk(), ag = A.getContext('2d');
  ag.imageSmoothingQuality = 'high'; ag.setTransform(1 / k, 0, 0, 1 / k, 0, 0);
  ag.drawImage(c, pad, oy);
  if (tiled) {
    ag.drawImage(c, cw - pad, 0, pad, ch, 0, 0, pad, ch);          // høyre kant til venstre for flisen
    ag.drawImage(c, 0, 0, pad, ch, pad + cw, 0, pad, ch);          // venstre kant til høyre for flisen
    ag.drawImage(c, 0, ch - 1, cw, 1, pad, ch, cw, pad);           // nederste rad forlenget
  }
  if (haze) hazeOver(A, haze);
  let B;
  if (canFilter && !forceJsBlur) { B = mk(); const bg = B.getContext('2d'); bg.filter = `blur(${r / k}px)`; bg.drawImage(A, 0, 0); }
  else { boxBlurCanvas(A, r / k); B = A; }
  return { B, k, pad };
}
// dis: himmelfarge over det som har farge (ikke over det gjennomsiktige)
function hazeOver(c, a) {
  const g = c.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a;
  g.fillStyle = mixHex(T.skyMid, T.skyBot, 0.5); g.fillRect(0, 0, c.width, c.height); g.restore();
}
// gi et lag dybde. Etterpå er L.c det uskarpe bildet i lav oppløsning (L.k ganger mindre), L.cw/L.ch lagets størrelse i
// skjermpiksler, og L.ox/L.oy hvor laget starter i L.c (før nedskalering). tiled = flislag; ellers et frittstående bilde
// som får luft rundt seg (L.pad i logiske px). keepSharp: behold en skarp kopi (med dis) til menyen.
function depthify(L, d, { tiled = true, keepSharp = false } = {}) {
  const R = dpr * scale, c = L.c;
  if (!d.blur) { if (d.haze) hazeOver(c, d.haze); return L; }
  const { B, k, pad } = lowResBlur(c, d.blur * R, tiled, d.haze);
  let sharp = null;
  if (keepSharp) {
    sharp = document.createElement('canvas'); sharp.width = c.width + (tiled ? 0 : pad * 2); sharp.height = c.height + (tiled ? 0 : pad * 2);
    sharp.getContext('2d').drawImage(c, tiled ? 0 : pad, tiled ? 0 : pad);
    if (d.haze) hazeOver(sharp, d.haze);
  }
  if (tiled) Object.assign(L, { c: B, k, ox: pad, oy: 0, cw: c.width, ch: c.height });
  else { Object.assign(L, { c: B, k, ox: 0, oy: 0, cw: c.width + pad * 2, ch: c.height + pad * 2, pad: pad / R }); L.w += pad * 2 / R; L.h += pad * 2 / R; }
  if (sharp) L.sharp = sharp;
  return L;
}
// tegn et utsnitt (sx, sy, sw, sh i lagets skjermpiksler) med fokus: skarp kopi i menyen, uskarp i spill, myk overgang imellom
function blitDepth(L, sx, sy, sw, sh, dx, dy, dw, dh) {
  const f = L.sharp ? focusK : 1, k = L.k || 1, ox = L.ox || 0, oy = L.oy || 0;
  if (f < 0.999) { const a = ctx.globalAlpha; ctx.globalAlpha = a * (1 - f * f); ctx.drawImage(L.sharp, sx, sy, sw, sh, dx, dy, dw, dh); ctx.globalAlpha = a; }
  if (f > 0.001) { const a = ctx.globalAlpha; ctx.globalAlpha = a * f; ctx.drawImage(L.c, (sx + ox) / k, (sy + oy) / k, sw / k, sh / k, dx, dy, dw, dh); ctx.globalAlpha = a; }
}
const layerW = L => L.cw || L.c.width, layerH = L => L.ch || L.c.height;
const blitWhole = (L, x, y, w, h) => blitDepth(L, 0, 0, layerW(L), layerH(L), x, y, w ?? L.w, h ?? L.h);
// kameraets høydeforskyvning for et lag med parallakse s (fjerne lag flytter seg mest i forhold til spilleplanet)
const camShift = s => ip(camPrev, cam) * (1 - s);

/* ---------- Offscreen-lag ---------- */
let scene = null;
// flislag: bredden rundes til hele skjermpiksler, så flisene møtes uten søm
function makeLayer(wWanted, h, draw, grainA = 0) {
  const R = dpr * scale, cw = Math.max(1, Math.round(wWanted * R)), ch = Math.max(1, Math.ceil(h * R));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'); g.setTransform(R, 0, 0, R, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round';
  const L = { c, w: cw / R, h: ch / R };
  draw(g, L.w, L.h, L);
  if (grainA) paper(g, grainA);
  return L;
}
const makeSprite = (w, h, draw, grainA) => makeLayer(w, h, draw, grainA);
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
// skjev fjelltopp: wl/wr = bredde mot venstre/høyre, p = spisshet (lav = bratt og spiss), periodisk med w
function peak(w, x0, h, wl, wr, p = 1.6) {
  return x => { const d = wrap(x - x0 + w / 2, w) - w / 2; return h * Math.exp(-Math.pow(Math.abs(d) / (d < 0 ? wl : wr), p)); };
}
// den fjerne fjellrekka: hovedtopp, skar og nabotopper
function farPeaks(w) {
  const P = [peak(w, w * 0.3, 160, 30, 74, 1.3), peak(w, w * 0.6, 112, 46, 30, 1.6), peak(w, w * 0.82, 92, 40, 52, 1.8), peak(w, w * 0.04, 82, 36, 30, 1.7), peak(w, w * 0.47, 70, 24, 24, 2)];
  const notch = peak(w, w * 0.3 + 52, 16, 5, 7, 2);
  return x => Math.max(...P.map(f => f(x))) - notch(x);
}
// tegn et objekt to ganger hvis det krysser flisens kant
const tiled = (w, x, pad, fn) => { fn(x); if (x < pad) fn(x + w); if (x > w - pad) fn(x - w); };

/* ---------- Bakken: stykker med felles kant ----------
   Hvert stykke er SEG_W bredt og møter naboen sømløst: jordlagene og gressbuene ender i samme høyde
   i begge kanter, og ingen småting ligger nærmere kanten enn 6 px. Over gresset er det SEG_HEAD px
   plass til stubber, tuer og lyng. */
const SEG_W = 96, SEG_HEAD = 12;
const GROUND_KINDS = ['tuer', 'stubbe', 'stein', 'lyng', 'sti', 'maurtue', 'sopp', 'blomster', 'tuer', 'stein', 'lyng', 'tuer', 'blomster', 'stubbe'];
// rekkefølgen er tilfeldig, men fast for hver posisjon (samme i alle tider på døgnet), og et stykke kommer
// aldri igjen før minst SEG_GAP andre har passert (mer enn en skjermbredde)
// godt blandet hash (0 … 1) for et heltall; første tall fra rng() følger frøet nesten lineært og gir mønstre
function hash01(i) {
  let h = Math.imul(i ^ 0x9E3779B9, 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const segSeq = [], SEG_GAP = 4;
function segAt(k) {
  k = Math.max(0, k);
  const n = GROUND_KINDS.length;
  while (segSeq.length <= k) {
    const i = segSeq.length, recent = segSeq.slice(-SEG_GAP), free = [];
    for (let j = 0; j < n; j++) if (!recent.includes(j)) free.push(j);
    segSeq.push(free[(hash01(i + 1) * free.length) | 0]);
  }
  return segSeq[k];
}
// tone en fast farge etter tiden på døgnet (kveld og solnedgang), som årstidsfargene
const tc = hex => T.tint ? mixHex(hex, T.tint[0], T.tint[1]) : hex;
function groundSeg(g, w, h, kind, seed) {
  const r = rng(seed), top = SEG_HEAD + 10, TAU = Math.PI * 2, winter = seasonName === 'winter';
  const inner = (pad = 6) => pad + r() * (w - pad * 2);
  g.fillStyle = T.soil; g.fillRect(0, top + 6, w, h - top - 6);
  g.fillStyle = hexA(T.soilDark, 0.45); g.fillRect(0, top + 52, w, h - top - 52);
  // et mørkere jordlag som bølger, men treffer samme høyde i begge kanter
  const k1 = 1 + ((r() * 3) | 0), a1 = 2 + r() * 2.5, k2 = 1 + ((r() * 2) | 0), a2 = 1.5 + r() * 2;
  g.fillStyle = hexA(T.soilDark, 0.6); g.beginPath(); g.moveTo(0, top + 44);
  for (let x = 0; x <= w + 0.01; x += 3) g.lineTo(x, top + 44 + Math.sin(x / w * Math.PI * k1) * a1);
  for (let x = w; x >= -0.01; x -= 3) g.lineTo(x, top + 52 + Math.sin(x / w * Math.PI * k2) * a2);
  g.closePath(); g.fill();
  const stone = (x, y, rx, ry) => {
    g.fillStyle = hexA(T.ink, 0.3); g.beginPath(); g.ellipse(x + SHADE_X * 0.6, y + SHADE_Y * 0.6, rx + 0.9, ry + 0.9, 0, 0, TAU); g.fill();
    g.fillStyle = T.stone; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(x + rx * 0.25, y - ry * 0.35, rx * 0.4, ry * 0.3, 0, 0, TAU); g.fill();
  };
  for (let i = 0, n = 3 + ((r() * 5) | 0); i < n; i++) { const rx = 2.2 + r() * 3.6; stone(inner(rx + 6), top + 24 + r() * (h - top - 32), rx, 1.6 + r() * 1.9); }
  g.fillStyle = hexA(T.soilDark, 0.8);
  for (let i = 0; i < 16; i++) circle(g, inner(), top + 18 + r() * (h - top - 22), 0.6 + r() * 0.6);
  // stien går inn i bildet: gresset er slitt bort over et stykke
  const path = kind === 'sti' ? [w * 0.32, w * 0.7] : null;
  // gresskant med ujevne buer (8–16 px brede, ulik høyde) som starter og slutter i kantene
  const arcs = []; for (let x = 0; x < w;) { const aw = Math.min(w - x, 8 + r() * 8); arcs.push([x, w - x - aw < 6 ? w : x + aw, 4 + r() * 3]); x = arcs[arcs.length - 1][1]; }
  const grassBand = (col, y0, hgt) => { g.fillStyle = col; g.fillRect(0, y0, w, hgt); };
  g.fillStyle = hexA(T.ink, 0.18); g.fillRect(0, top + 10, w, 3);
  grassBand(T.grassDark, top, 10);
  for (const [a, b, ry] of arcs) { g.fillStyle = T.grassDark; g.beginPath(); g.ellipse((a + b) / 2, top + 10, (b - a) / 2 + 0.4, ry, 0, 0, Math.PI); g.fill(); }
  grassBand(T.grass, top, 6);
  for (const [a, b, ry] of arcs) { g.fillStyle = T.grass; g.beginPath(); g.ellipse((a + b) / 2, top + 6, (b - a) / 2 - 0.2, ry - 0.8, 0, 0, Math.PI); g.fill(); }
  if (path) {   // tråkket sti som går innover i bildet: bred foran, smal bak, med småstein
    const [p0, p1] = path, cx = (p0 + p1) / 2, wb = (p1 - p0) / 2, wt = wb * 0.4, light = mixHex(T.soil, '#FFFFFF', 0.2);
    g.fillStyle = light; g.beginPath(); g.moveTo(cx - wt, top - 1.5);
    g.quadraticCurveTo(cx - wb * 0.75, top + 6, cx - wb, top + 15); g.lineTo(cx + wb + 2, top + 15);
    g.quadraticCurveTo(cx + wb * 0.7, top + 6, cx + wt + 1, top - 1.5); g.closePath(); g.fill();
    g.fillStyle = hexA(T.soilDark, 0.25); g.beginPath(); g.ellipse(cx + 1, top + 8, wb * 0.45, 1.4, 0, 0, TAU); g.fill();
    for (let i = 0; i < 4; i++) stone(cx - wb * 0.5 + r() * wb, top + 2 + r() * 9, 1 + r() * 1.1, 0.7 + r() * 0.5);
  }
  const tuft = (x, hh, col) => {
    g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath();
    g.moveTo(x - 2, top + 3); g.quadraticCurveTo(x - 2.5, top - hh * 0.5, x - 3.5, top + 2 - hh);
    g.moveTo(x, top + 3); g.quadraticCurveTo(x + 0.5, top - hh * 0.6, x + 0.5, top + 1 - hh * 1.1);
    g.moveTo(x + 2, top + 3); g.quadraticCurveTo(x + 2.5, top - hh * 0.4, x + 4, top + 3 - hh * 0.8); g.stroke();
  };
  const nT = kind === 'tuer' ? 14 : 7 + ((r() * 4) | 0);
  for (let i = 0; i < nT; i++) { const x = inner(7); if (path && x > path[0] - 3 && x < path[1] + 3) continue; tuft(x, (kind === 'tuer' ? 6 : 4.5) + r() * 4.5, r() < 0.35 ? T.grassDark : T.grass); }
  const flowers = winter ? 0 : kind === 'blomster' ? 0 : 1 + ((r() * 3) | 0);
  for (let i = 0; i < flowers; i++) { const x = inner(8); if (!path || x < path[0] || x > path[1]) flower(g, x, top - 1 - r() * 2, 1.6, ['#FFFFFF', '#FFE27A', '#FFC6D6'][(r() * 3) | 0]); }
  const fx = w * (0.35 + r() * 0.3), snowCap = (x, y, rx) => { if (winter) { g.fillStyle = '#FBFDFF'; g.beginPath(); g.ellipse(x, y, rx, 2.2, 0, Math.PI, 0); g.fill(); } };
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (kind === 'stubbe') {   // bjørkestubbe med årringer og mose
    const x = fx, y = top + 3, sw = 11, sh = 9;
    g.fillStyle = hexA(T.ink, 0.6); g.fillRect(x - sw / 2 - 1.2, y - sh, sw + 2, sh);
    g.fillStyle = T.trunk; g.fillRect(x - sw / 2, y - sh, sw, sh);
    g.fillStyle = T.trunkShade; g.fillRect(x - sw / 2, y - sh, sw * 0.28, sh);
    g.fillStyle = T.bark; g.fillRect(x - 3, y - 6, 3.5, 1.1); g.fillRect(x + 1, y - 3, 3, 1);
    g.fillStyle = T.cut; g.strokeStyle = hexA(T.ink, 0.7); g.lineWidth = 0.9; g.beginPath(); g.ellipse(x, y - sh, sw / 2 + 0.4, 2.2, 0, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = T.cutRing; g.lineWidth = 0.6; g.beginPath(); g.ellipse(x + 0.3, y - sh, sw * 0.28, 1.2, 0, 0, TAU); g.stroke();
    blob(g, [[x - 4.5, y - sh + 0.5, 1.8], [x - 2.5, y - sh - 0.2, 1.5]], T.moss, T.ink, 0.7, 0.5);
    snowCap(x, y - sh, sw / 2 + 0.6);
  } else if (kind === 'stein') {   // stor stein halvveis i bakken, mose på toppen
    const x = fx, y = top + 4, rx = 9 + r() * 3, ry = 6.5;
    g.fillStyle = hexA(T.ink, 0.55); g.beginPath(); g.ellipse(x + SHADE_X, y - 2 + SHADE_Y, rx + 1.2, ry + 1.2, 0, Math.PI, 0); g.fill();
    g.fillStyle = mixHex(T.stone, T.mountainNear, 0.35); g.beginPath(); g.ellipse(x, y - 2, rx, ry, 0, Math.PI, 0); g.fill();
    g.fillStyle = hexA(T.ink, 0.12); g.beginPath(); g.ellipse(x - rx * 0.35, y - 2, rx * 0.65, ry * 0.7, 0, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x + rx * 0.3, y - ry + 0.5, rx * 0.35, 1.2, 0.1, 0, TAU); g.fill();
    if (!winter) blob(g, [[x - 2, y - ry - 1, 2], [x + 1, y - ry - 1.2, 1.6]], T.moss, T.ink, 0.6, 0.45);
    snowCap(x, y - ry + 0.2, rx * 0.8);
  } else if (kind === 'lyng') {   // blåbærlyng: bær om sommeren, røde blader om høsten, blomster om våren
    for (let i = 0; i < 3; i++) {
      const x = fx - 14 + i * 13 + r() * 4, s = 0.8 + r() * 0.4;
      blob(g, [[x, top - 2 * s, 4.2 * s], [x - 3.5 * s, top, 3.4 * s], [x + 3.5 * s, top, 3.4 * s]], seasonName === 'autumn' ? tc('#C8553D') : mixHex(T.grassDark, '#2F5A3A', 0.35), T.ink, 0.8, 0.45);
      const berry = seasonName === 'summer' ? tc('#3D4F9A') : seasonName === 'spring' ? tc('#F4C1CF') : seasonName === 'autumn' ? tc('#7A2E3A') : null;
      if (berry) { g.fillStyle = berry; for (let k = 0; k < 3; k++) circle(g, x - 3 + r() * 6, top - 3 * s + r() * 4, 0.95); }
      snowCap(x, top - 4.5 * s, 4 * s);
    }
  } else if (kind === 'maurtue') {   // maurtue av barnåler, med noen maur
    const x = fx, y = top + 3;
    g.fillStyle = hexA(T.ink, 0.5); g.beginPath(); g.ellipse(x - 0.5, y, 11, 10, 0, Math.PI, 0); g.fill();
    g.fillStyle = tc('#B98A5A'); g.beginPath(); g.ellipse(x, y, 10, 9, 0, Math.PI, 0); g.fill();
    g.fillStyle = hexA(T.ink, 0.15); g.beginPath(); g.ellipse(x - 3, y, 7, 7, 0, Math.PI, 0); g.fill();
    g.strokeStyle = tc('#7E5A38'); g.lineWidth = 0.6; g.beginPath();
    for (let i = 0; i < 22; i++) { const a = Math.PI + r() * Math.PI, d = r() * 8; const px = x + Math.cos(a) * d * 1.1, py = y + Math.sin(a) * d; g.moveTo(px, py); g.lineTo(px + 1.4, py - 0.6); }
    g.stroke();
    if (!winter) { g.fillStyle = tc('#3A2A24'); for (const [dx, dy] of [[12, 1], [15, 2.2], [-12, 1.5]]) { circle(g, x + dx, y + dy - 1, 0.55); circle(g, x + dx + 0.9, y + dy - 1, 0.45); } }
    snowCap(x, y - 8.5, 7);
  } else if (kind === 'sopp' && !winter) {   // kantareller og en liten steinsopp
    for (let i = 0; i < 3; i++) {   // traktformet hatt med bølget kant over en stilk som smalner nedover
      const x = fx - 8 + i * 7 + r() * 2, s = 0.85 + r() * 0.35, y = top + 1, ch = y - 4.4 * s;
      const shape = () => { g.beginPath(); g.moveTo(x - 1 * s, y); g.quadraticCurveTo(x - 1.3 * s, ch + 1.8 * s, x - 4 * s, ch);
        g.quadraticCurveTo(x - 2 * s, ch - 1.5 * s, x, ch - 0.7 * s); g.quadraticCurveTo(x + 2 * s, ch - 1.6 * s, x + 4 * s, ch);
        g.quadraticCurveTo(x + 1.3 * s, ch + 1.8 * s, x + 1 * s, y); g.closePath(); };
      g.save(); g.translate(SHADE_X * 0.7, SHADE_Y * 0.7); shape(); g.fillStyle = hexA(T.ink, 0.5); g.fill(); g.restore();
      shape(); g.fillStyle = tc('#F2A93B'); g.fill();
      g.strokeStyle = tc('#C97A1E'); g.lineWidth = 0.5; g.beginPath(); g.moveTo(x - 2, ch + 0.8 * s); g.lineTo(x - 0.5, ch + 2.6 * s); g.moveTo(x + 2, ch + 0.8 * s); g.lineTo(x + 0.5, ch + 2.6 * s); g.stroke();
    }
    const x = fx + 13;
    g.fillStyle = tc('#F3E4C6'); g.fillRect(x - 1.6, top - 4, 3.2, 5);
    g.fillStyle = tc('#8A5A36'); g.strokeStyle = hexA(T.ink, 0.6); g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, top - 4, 4.4, 3.2, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
  } else if (kind === 'blomster' && !winter) {   // markblomster: blåklokker og prestekrager
    for (let i = 0; i < 7; i++) {
      const x = fx - 16 + r() * 32, hh = 5 + r() * 6, bell = i % 2 === 0;
      g.strokeStyle = mixHex(T.grassDark, '#2F5A3A', 0.3); g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, top + 2); g.quadraticCurveTo(x + 1, top - hh * 0.5, x + (bell ? 1.6 : 0.4), top - hh); g.stroke();
      if (bell) { g.fillStyle = tc('#6E7FD8'); g.beginPath(); g.moveTo(x + 0.4, top - hh + 0.4); g.quadraticCurveTo(x + 1.6, top - hh - 2.6, x + 2.8, top - hh + 0.4); g.lineTo(x + 2.4, top - hh + 1.6); g.lineTo(x + 0.8, top - hh + 1.6); g.closePath(); g.fill(); }
      else flower(g, x + 0.4, top - hh, 1.5, tc('#FFFFFF'));
    }
  }
}

// sola står lavt bak fjellene i solnedgang, høyt ellers
const sunPos = () => ({ sx: W - 64, sy: T.sunLow ? H - GROUND_H - 178 : safeTop + 104 });
function buildScene(keepSharp = false) {
  const scene = {};
  const TAU = Math.PI * 2;

  // 1) fjell, snø, dis og fjord (topp = groundY - 230)
  scene.mountains = makeLayer(420, 230, (g, w, h) => {
    const r = rng(11), base = h - 70;
    // én tydelig hovedtopp med bratt vegg mot venstre og lang skulder mot høyre, et skar i skulderen,
    // mindre nabotopper og en rufsete rygg (heltallsfrekvenser, så flisen fortsatt møtes sømløst)
    const ridge = x => 1 * Math.sin(x / w * TAU * 23 + 1) + 0.7 * Math.sin(x / w * TAU * 37 + 2) + 0.45 * Math.sin(x / w * TAU * 61);
    const far = farPeaks(w), farTop = x => base - Math.max(0, far(x) + ridge(x) * Math.min(1, far(x) / 40));
    ridgePath(g, w, h, farTop); g.fillStyle = T.mountainFar; g.fill();
    g.save(); g.clip();
    // snø over en snølinje som renner ned i søkkene (fonner), klippet mot fjellet
    // fonnene er smale og spisse (V-form), litt skjeve etter fallretningen, ikke runde «drypp»
    const gullies = [[0.262, 34, 5], [0.318, 18, 3.5], [0.352, 26, 4], [0.4, 12, 3], [0.585, 22, 4], [0.625, 12, 3], [0.8, 16, 3.5], [0.032, 10, 3]];
    const snowLine = x => base - 108 + Math.sin(x / w * TAU * 5) * 4 + gullies.reduce((a, [gx, d, gw]) => { const dd = (wrap(x / w - gx + 0.5, 1) - 0.5) * w; return a + d * Math.max(0, 1 - Math.abs(dd + (dd > 0 ? 0.6 : 0) * gw) / gw); }, 0);
    g.fillStyle = T.snow; g.beginPath(); g.moveTo(0, -5);
    for (let x = 0; x <= w + 0.01; x += 1.5) g.lineTo(x, snowLine(x));
    g.lineTo(w, -5); g.closePath(); g.fill();
    g.fillStyle = hexA(T.ink, 0.1);   // skyggesiden av hovedtoppen (venstre for toppunktet) i ett flatt tonetrinn
    g.beginPath(); g.moveTo(w * 0.3, base - 164);   // skillet følger en takket rygg ned fra toppen
    for (const [dx, dy] of [[3, 22], [-1, 40], [6, 62], [2, 84], [10, 108], [7, 130], [16, 166]]) g.lineTo(w * 0.3 + dx, base - 160 + dy);
    g.lineTo(w * 0.3 - 70, base + 6); g.closePath(); g.fill();
    g.strokeStyle = hexA(T.ink, 0.16); g.lineWidth = 1;   // hamrer: korte, skrå streker i den bratte veggen
    for (const [fx, fy, l] of [[0.27, 60, 9], [0.255, 78, 12], [0.28, 96, 8], [0.24, 104, 10], [0.6, 74, 8], [0.585, 88, 9]]) { g.beginPath(); g.moveTo(w * fx, base - fy); g.lineTo(w * fx - l * 0.35, base - fy + l); g.stroke(); }
    g.restore();
    strokeRidge(g, w, farTop, hexA(T.ink, 0.2), 1.2, 1.5);
    const near = (() => { const P = [[0.12, 58, 30, 44, 1.7], [0.44, 74, 26, 52, 1.5], [0.7, 50, 40, 28, 1.9], [0.92, 64, 34, 30, 1.6]].map(([x0, hh, wl, wr, pp]) => peak(w, x0 * w, hh, wl, wr, pp)); return x => Math.max(...P.map(f => f(x))); })();
    const ridge2 = x => 1.2 * Math.sin(x / w * TAU * 17 + 0.5) + 0.8 * Math.sin(x / w * TAU * 29 + 1.2);
    const nearTop = x => base + 10 - near(x) - ridge2(x) * Math.min(1, near(x) / 30);
    ridgePath(g, w, h, nearTop); g.fillStyle = T.mountainNear; g.fill();
    strokeRidge(g, w, nearTop, hexA(T.ink, 0.22), 1.2);
    const hz = g.createLinearGradient(0, base - 50, 0, base + 4);   // atmosfærisk dis mot foten
    hz.addColorStop(0, hexA(T.skyBot, 0)); hz.addColorStop(1, hexA(T.skyBot, 0.6));
    g.fillStyle = hz; g.fillRect(0, base - 50, w, 54);
    g.fillStyle = T.fjord; g.fillRect(0, base + 2, w, h - base - 2);
    g.fillStyle = hexA(T.fjordLight, 0.9); g.fillRect(0, base + 2, w, 1.5);
    g.fillStyle = hexA(T.fjordLight, 0.7);
    for (let i = 0; i < 22; i++) { const x = r() * w, y = base + 7 + r() * (h - base - 12), l = 4 + r() * 8; tiled(w, x, l, xx => g.fillRect(xx, y, l, 1.1)); }
  }, 0.5);

  // 2) åser med hus som er forskjellige (hytte, gårdshus, seterbu, stabbur) – to skjermbredder lange (topp = groundY - 118)
  scene.hills = makeLayer(720, 118, (g, w, h, L) => {   // 22 px ekstra luft over åskammen til flaggstang og vimpel
    const r = rng(23), base = h - 46;
    const list = Array.from({ length: 8 }, (_, i) => ({ x: (i + 0.25 + r() * 0.5) * w / 8, h: 12 + r() * 20, s: 28 + r() * 18 }));
    const f = bumps(w, list, 'sum'), top = x => base - f(x);
    L.top = top;
    ridgePath(g, w, h, top); g.fillStyle = T.hillFar; g.fill();
    strokeRidge(g, w, top, hexA(T.ink, 0.25), 1.2);
    L.chimneys = [];
    const houses = { 0: 'hytte', 2: 'gard', 5: 'seter', 6: 'stabbur' };
    for (const i in houses) house(g, list[i].x + (r() - 0.5) * 10, top(list[i].x) + 1.5, houses[i], L);
    for (const i of [1, 3, 4, 7]) for (let k = 0, n = 2 + ((r() * 3) | 0); k < n; k++) {   // små trær i klynger av ulik størrelse
      const x = list[i].x - 14 + r() * 28, y = top(x) + 1, s = 0.6 + r() * 0.5, spruce = r() < 0.35;
      if (spruce) {   // gran
        g.fillStyle = mixHex(T.forest, '#24463A', 0.35); g.strokeStyle = hexA(T.ink, 0.45); g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x, y - 15 * s); g.lineTo(x + 5 * s, y - 1); g.lineTo(x - 5 * s, y - 1); g.closePath(); g.fill(); g.stroke();
      } else {
        g.fillStyle = T.roof; g.fillRect(x - 0.7, y - 6 * s, 1.4, 6 * s);
        blob(g, [[x, y - 9 * s, 5 * s], [x - 3 * s, y - 6.5 * s, 3.6 * s], [x + 3 * s, y - 6.5 * s, 3.6 * s]], T.forest, hexA(T.ink, 0.5), 0.9);
      }
    }
  }, 0.5);

  // 3) bjørkeskog med skogbunn (topp = groundY - 84)
  scene.forest = makeLayer(600, 84, (g, w, h, L) => {
    const r = rng(37);
    const floor = x => h - 30 - (Math.sin(x / w * TAU * 5) * 4 + Math.sin(x / w * TAU * 9 + 1) * 3 + Math.sin(x / w * TAU * 2) * 2);
    L.floor = floor;
    // trærne står i klynger med glenner imellom, ikke jevnt spredt
    const groves = Array.from({ length: 9 }, () => ({ x: r() * w, n: 2 + ((r() * 5) | 0), spread: 14 + r() * 26 }));
    const trees = groves.flatMap(gv => Array.from({ length: gv.n }, () => ({ x: wrap(gv.x + (r() - 0.5) * gv.spread * 2, w), s: 0.6 + r() * 0.6, warm: r() < 0.18, back: r() < 0.5 })));
    trees.sort((a, b) => (a.back !== b.back ? (a.back ? -1 : 1) : a.s - b.s));
    for (const t of trees) tiled(w, t.x, 16, x => birchTree(g, x, floor(t.x) + (t.back ? -4 : 3), t.s, t.warm, t.back));
    ridgePath(g, w, h, floor); g.fillStyle = T.hillNear; g.fill();
    strokeRidge(g, w, floor, hexA(T.ink, 0.28), 1.2);
  }, 0.5);

  // 4) busker og blomster (topp = groundY - 40)
  scene.bushes = makeLayer(480, 40, (g, w, h) => {
    const r = rng(53);
    // busker i ujevne grupper: noen alene, noen tett sammen
    for (let x = r() * 30; x < w - 10; x += 26 + r() * 70) { const s = 0.6 + r() * 0.65; tiled(w, x, 22, xx => bush(g, xx, h + 2, s)); if (r() < 0.4) { const s2 = 0.5 + r() * 0.3; tiled(w, x + 16 * s, 22, xx => bush(g, xx, h + 3, s2)); } }
    const petals = ['#FFFFFF', '#FFC6D6', '#FFE27A', '#D9C6F7'];
    if (seasonName !== 'winter') for (let i = 0; i < 30; i++) { const x = r() * w, y = h - 3 - r() * 7, c = petals[(r() * 4) | 0]; tiled(w, x, 4, xx => flower(g, xx, y, 1.5, c)); }
  }, 0.45);

  // 5) bakken: ti bakkestykker som settes sammen i tilfeldig rekkefølge (se segAt), så bakken aldri gjentar seg i et fast mønster
  scene.groundSegs = GROUND_KINDS.map((kind, i) => makeLayer(SEG_W, GROUND_H + 10 + SEG_HEAD, (g, w, h) => groundSeg(g, w, h, kind, 71 + i * 13), 0.6));
  // dybde: dis og uskarphet etter avstand (skarpe kopier bare for scenen menyen bruker)
  depthify(scene.mountains, DEPTH[0.05], { keepSharp }); depthify(scene.hills, DEPTH[0.14], { keepSharp });
  depthify(scene.forest, DEPTH[0.3], { keepSharp }); depthify(scene.bushes, DEPTH[0.6], { keepSharp });
  // forgrunn helt nær kameraet: store, uskarpe bregner, gress og blader nederst (alltid uskarp – nærmere enn fokus)
  // (klynger med god avstand langs en 864 px lang strekning; bare klyngene tegnes, ikke det tomme imellom)
  scene.fore = foreClumps();
  // seilbåten på fjorden (samme avstand som fjellene)
  scene.boat = depthify(makeSprite(20, 18, g => {
    g.translate(8, 15); g.lineJoin = 'round'; g.fillStyle = '#FFF8EC'; g.strokeStyle = T.ink; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(1, -2); g.lineTo(1, -13); g.lineTo(8, -3); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = tc('#D0583F'); g.beginPath(); g.moveTo(-5, -1.5); g.lineTo(9, -1.5); g.lineTo(6.5, 1.6); g.lineTo(-3, 1.6); g.closePath(); g.fill(); g.stroke();
  }), DEPTH[0.05], { tiled: false, keepSharp });

  // himmel med solglød, og vignett: tegnes én gang i full skjermstørrelse (ugjennomsiktig blit er billigere enn gradienter hvert bilde)
  const groundY = H - GROUND_H, { sx, sy } = sunPos();
  scene.sky = makeSprite(W, groundY, g => {
    const gr = g.createLinearGradient(0, 0, 0, groundY);
    gr.addColorStop(0, T.skyTop); gr.addColorStop(0.55, T.skyMid); gr.addColorStop(1, T.skyBot);
    g.fillStyle = gr; g.fillRect(0, 0, W + 2, groundY + 2);
    g.fillStyle = T.sunGlow;   // solglød som flate, malte glorier (ingen gradient)
    for (const [r, a] of [[68, 0.13], [50, 0.2], [35, 0.32]]) { g.globalAlpha = a; inkCircle(g, sx, sy, r - 2, 2, r, 1.2); }
    g.globalAlpha = 1;
  }, 0.7);
  scene.vignette = makeSprite(W, H, g => {
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, hexA('#000000', 0)); vg.addColorStop(1, T.vignette);
    g.fillStyle = vg; g.fillRect(0, 0, W + 2, H + 2);
  });
  // sprites: tre skyformer, luftballong og glød (ildfluer/vinduer)
  // fluffy skyer: mange puffer (store i midten, små «blomkål»-krøller langs kanten), myk dun-kant,
  // skyggekant under, volumgradient fra lys topp mot mørkere bunn og lyse topper på hver puff
  scene.clouds = [0, 1, 2].map(v => makeSprite(128, 72, (g, w, h) => {
    const r = rng(301 + v * 37), base = h - 16, puffs = [];
    const nb = 5 + (v % 2);   // bunnrad: brede puffer gir en myk, nesten flat underkant
    for (let i = 0; i < nb; i++) puffs.push([18 + i * (w - 36) / (nb - 1), base - 2 - r() * 3, 11 + r() * 3]);
    for (let i = 0; i < 4; i++) puffs.push([28 + i * (w - 56) / 3 + (r() - 0.5) * 6, base - 13 - r() * 5, 13 + r() * 4]);   // midtrad
    const nt = v === 1 ? 3 : 2;   // topp: store puffer som bygger seg opp mot midten
    for (let i = 0; i < nt; i++) puffs.push([w / 2 + (i - (nt - 1) / 2) * 22 + (r() - 0.5) * 8, base - 25 - r() * 6, 13 + r() * 5]);
    for (const [x, y, k] of puffs.slice()) if (y < base - 8) {   // små krøller langs toppkanten
      const ang = -Math.PI / 2 + (r() - 0.5) * 2.2;
      puffs.push([x + Math.cos(ang) * k * 0.8, y + Math.sin(ang) * k * 0.8, k * 0.42]);
    }
    const fill = (col, dy = 0, grow = 0) => { g.fillStyle = col; for (const [x, y, k] of puffs) circle(g, x, y + dy, k + grow); };
    g.globalAlpha = 0.35; fill(T.cloud, 0, 2.2); g.globalAlpha = 1;   // myk dun-kant
    fill(T.cloudShade, 4);                                             // skyggesiden under
    fill(T.cloud);                                                     // hovedfyll
    // kantlys: skyformen minus en litt forskjøvet kopi gir en flat, lys kant oppe mot sola (cel-stil, ingen gradient)
    const t = document.createElement('canvas'); t.width = g.canvas.width; t.height = g.canvas.height;
    const tg = t.getContext('2d'); tg.setTransform(g.getTransform());
    tg.fillStyle = '#FFFFFF'; for (const [x, y, k] of puffs) if (y < base - 6) circle(tg, x, y, k);
    tg.globalCompositeOperation = 'destination-out'; for (const [x, y, k] of puffs) circle(tg, x - 2.2, y + 3.2, k);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = T.night ? 0.3 : 0.75; g.drawImage(t, 0, 0);
    g.restore();
  }, 0.4)).map(L => depthify(L, DEPTH.sky, { tiled: false, keepSharp }));
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
  scene.marks = buildLandmarks(keepSharp);
  // logoen: «Pixelfugl» brodert i korssting (håndlaget pikselskrift i stedet for en ferdig font)
  scene.logo = buildLogo(5);
  return scene;
}

// hus i åsen: hver sin form og farge, så ingen er kloner
function house(g, x, y, kind, L) {
  g.save(); g.translate(x, y); g.lineWidth = 1.1; g.strokeStyle = T.ink; g.lineJoin = 'round';
  const glow = (wx, wy) => { if (T.windowLit) { g.fillStyle = 'rgba(255,214,130,.22)'; circle(g, wx, wy, 8); circle(g, wx, wy, 5); } };
  const win = (wx, wy, ww, wh, trim) => {
    glow(wx + ww / 2, wy + wh / 2);
    g.fillStyle = T.window; g.fillRect(wx, wy, ww, wh);
    g.strokeStyle = trim; g.lineWidth = 0.8; g.strokeRect(wx, wy, ww, wh); g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.stroke();
    g.strokeStyle = T.ink; g.lineWidth = 1.1;
  };
  const roof = (w, h, rise, col, turf) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(-w / 2 - 3, -h + 0.5); g.lineTo(0, -h - rise); g.lineTo(w / 2 + 3, -h + 0.5); g.closePath(); g.fill(); g.stroke();
    if (turf) { g.strokeStyle = T.moss; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-w / 2 - 2, -h - 0.6); g.lineTo(0, -h - rise - 0.6); g.lineTo(w / 2 + 2, -h - 0.6); g.stroke(); g.strokeStyle = T.ink; g.lineWidth = 1.1; }
  };
  const walls = (w, h, col, dark) => {
    g.fillStyle = col; g.fillRect(-w / 2, -h, w, h);
    g.fillStyle = dark; for (let i = -w / 2 + 3; i < w / 2; i += 3) g.fillRect(i, -h + 1, 0.6, h - 1);   // panel
    g.fillStyle = hexA(T.ink, 0.12); g.fillRect(-w / 2, -h, w * 0.22, h);   // skyggesiden (lyset kommer fra høyre)
    g.strokeRect(-w / 2, -h, w, h);
  };
  const chimney = (cx, cy, hh) => { g.fillStyle = T.cabinDark; g.fillRect(cx, cy - hh, 3.6, hh); g.strokeRect(cx, cy - hh, 3.6, hh); L.chimneys.push({ x: x + cx + 1.8, y: y + cy - hh }); };
  if (kind === 'hytte') {   // liten rød hytte med torvtak og en vimpel
    const w = 18, h = 11;
    chimney(3.5, -h - 4, 8);
    walls(w, h, T.cabin, T.cabinDark); roof(w, h, 8, T.roof, true);
    g.fillStyle = T.roof; g.fillRect(-6.5, -7, 3.6, 7); win(1, -8, 5.2, 4.4, T.cabinDark);
    g.strokeStyle = T.roof; g.lineWidth = 0.9; g.beginPath(); g.moveTo(14, 0); g.lineTo(14, -22); g.stroke();   // vimpelstang
    g.fillStyle = tc('#D9473A'); g.beginPath(); g.moveTo(14, -21.5); g.quadraticCurveTo(20, -20, 25, -19.6); g.quadraticCurveTo(20, -18.6, 14, -18.4); g.closePath(); g.fill();
  } else if (kind === 'gard') {   // større okergult gårdshus med hvite vinduskarmer, skifertak og flaggstang
    const w = 30, h = 14;
    chimney(6, -h - 6, 8);
    walls(w, h, tc('#E2B04A'), tc('#C08E30')); roof(w, h, 10, mixHex(T.roof, '#5A6270', 0.4), false);
    for (const wx of [-11, -3, 6]) win(wx, -10, 4.4, 5, tc('#FFFFFF'));
    g.fillStyle = tc('#FFFFFF'); g.fillRect(-w / 2, -h, w, 1.2);
    g.strokeStyle = tc('#E8E4DC'); g.lineWidth = 0.9; g.beginPath(); g.moveTo(-24, 0); g.lineTo(-24, -28); g.stroke();   // flaggstang
    g.fillStyle = tc('#C8313E'); g.fillRect(-24, -27.5, 9, 6.4);   // det norske flagget
    g.fillStyle = tc('#FFFFFF'); g.fillRect(-21.6, -27.5, 2.2, 6.4); g.fillRect(-24, -25.4, 9, 2.2);
    g.fillStyle = tc('#1F3F8C'); g.fillRect(-21.1, -27.5, 1.2, 6.4); g.fillRect(-24, -24.9, 9, 1.2);
  } else if (kind === 'seter') {   // lav, hvitmalt seterbu med vedstabel ved veggen
    const w = 16, h = 9;
    chimney(-4, -h - 3, 6);
    walls(w, h, tc('#F2EEE6'), tc('#D6D0C4')); roof(w, h, 6, T.roof, true);
    win(-2, -7, 4.6, 4, tc('#7A5A44')); g.fillStyle = tc('#7A5A44'); g.fillRect(-6.8, -6.5, 3.2, 6.5);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - (row ? 1 : 0); i++) {   // vedstabel: endeved med årringer
      const cx = 11 + i * 2.6 + row * 1.3, cy = -1.3 - row * 2.4;
      g.fillStyle = tc('#C9A578'); circle(g, cx, cy, 1.3); g.fillStyle = tc('#8E6B48'); circle(g, cx, cy, 0.45);
    }
  } else if (kind === 'stabbur') {   // stabbur på stolper: andre etasje stikker ut, mørk tjærebeiset tømmer
    const w = 12, h = 9, leg = 3.5, wood = tc('#8A5638'), woodDark = tc('#6A3F28');
    g.fillStyle = woodDark; for (const lx of [-4, 3]) { g.fillRect(lx, -leg, 1.8, leg); g.strokeRect(lx, -leg, 1.8, leg); }
    g.save(); g.translate(0, -leg);
    walls(w, h, wood, woodDark);
    g.fillStyle = wood; g.fillRect(-w / 2 - 2.5, -h - 6, w + 5, 6); g.strokeRect(-w / 2 - 2.5, -h - 6, w + 5, 6);   // utkraget loft
    g.fillStyle = woodDark; for (let i = -w / 2 - 1; i < w / 2 + 2; i += 2.4) g.fillRect(i, -h - 5.5, 0.6, 5);
    g.translate(0, -6); roof(w + 5, h, 7, T.roof, true);
    g.restore();
    g.strokeStyle = woodDark; g.lineWidth = 1; g.beginPath(); g.moveTo(-9, 0); g.lineTo(-5, -leg - 2); g.stroke();   // trapp
  }
  g.restore();
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

// forgrunnen: tuer, bregner og store blader i klynger med god avstand; mørkere og mettere enn resten (nærmest kameraet)
const FORE_LEN = 864, FORE_W = 84, FORE_H = 84;   // små, sparsomme klynger: synlige som dybde, men billige å tegne
function foreClumps() {
  const r = rng(777), out = [];
  for (let u = 40 + r() * 40; u < FORE_LEN - 60; u += 200 + r() * 140) {
    const kind = r(), seed = (r() * 1e6) | 0;
    out.push({ u, L: depthify(makeLayer(FORE_W, FORE_H, (g, w, h) => foreClump(g, w, h, kind, seed)), DEPTH.fore, { tiled: false }) });
  }
  return out;
}
function foreClump(g, w, h, kind, seed) {
  const r = rng(seed), TAU = Math.PI * 2, winter = seasonName === 'winter', autumn = seasonName === 'autumn', cx = w / 2;
  const leaf = winter ? '#E8EEF6' : mixHex(T.grassDark, '#1E3A2A', 0.45), leaf2 = winter ? '#CBD6E4' : mixHex(T.crown, '#2E5A34', 0.4);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind < 0.4) {   // høyt gress
    for (let i = 0; i < 9; i++) {
      const x = cx + (r() - 0.5) * 30, len = 34 + r() * 40, lean = (r() - 0.5) * 24;
      g.strokeStyle = r() < 0.5 ? leaf : leaf2; g.lineWidth = 3 + r() * 2.5;
      g.beginPath(); g.moveTo(x, h + 4); g.quadraticCurveTo(x + lean * 0.3, h - len * 0.6, x + lean, h - len); g.stroke();
    }
  } else if (kind < 0.75) {   // bregne: bøyd stilk med småblad
    for (const side of [-1, 1]) {
      const x0 = cx + side * 7, len = 52 + r() * 22, tilt = side * (0.45 + r() * 0.25);
      g.strokeStyle = leaf; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0, h + 4);
      const ex = x0 + Math.sin(tilt) * len, ey = h - Math.cos(tilt) * len * 0.9; g.quadraticCurveTo(x0 + Math.sin(tilt) * len * 0.2, h - len * 0.7, ex, ey); g.stroke();
      g.fillStyle = leaf2;
      for (let t = 0.2; t < 0.95; t += 0.12) {
        const px = x0 + (ex - x0) * t, py = h + 4 + (ey - h - 4) * t, sz = 9 * (1 - t * 0.7);
        for (const sd of [-1, 1]) { g.save(); g.translate(px, py); g.rotate(tilt + sd * 1.1); g.beginPath(); g.ellipse(sz * 0.5, 0, sz * 0.55, 2.4, 0, 0, TAU); g.fill(); g.restore(); }
      }
    }
  } else {   // store blader (bjørk), om høsten gule og oransje
    for (let i = 0; i < 4; i++) {
      const x = cx + (r() - 0.5) * 34, y = h - 10 - r() * 30, a = r() * TAU, sz = 12 + r() * 8;
      g.fillStyle = autumn ? ['#E8963A', '#F2C14E', '#D9663A'][(r() * 3) | 0] : (r() < 0.5 ? leaf : leaf2);
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-sz, 0); g.quadraticCurveTo(0, -sz * 0.75, sz, 0); g.quadraticCurveTo(0, sz * 0.75, -sz, 0); g.fill(); g.restore();
    }
  }
}
// forgrunnsklyngene glir forbi raskest (parallakse 1,45); bunnen ligger under skjermkanten, så kameraet aldri blotter den
function drawForeground() {
  const off = wrap(viewScroll * 1.45, FORE_LEN), y0 = H + 4 + camShift(1.45);
  for (const { u, L } of scene.fore) for (const base of [0, FORE_LEN]) {
    const x = u + base - off - L.w / 2;
    if (x > W || x + L.w < 0) continue;
    blitWhole(L, x, y0 - L.h + L.pad);
  }
}

/* ---------- Landemerker ----------
   Forhåndstegnet per tid på døgnet; ankeret er midt nede (der de står på bakken). */
function buildLandmarks(keepSharp) {
  const out = {}, TAU = Math.PI * 2;
  const sprite = (name, w, h, draw) => { out[name] = makeSprite(w, h, g => { g.lineJoin = 'round'; g.lineCap = 'round'; g.translate(w / 2, h - 2); draw(g); }, 0.4); };
  const ink = (g, lw = 1) => { g.strokeStyle = T.ink; g.lineWidth = lw; };
  sprite('stavkirke', 42, 54, g => {   // stavkirke: svalgang rundt foten, bratte saltak i trinn, drakehoder på gavlene og et spir
    const tar = tc('#5E3D29'), roof = tc('#3F2A1E'), shingle = tc('#6E4A31');
    ink(g);
    g.fillStyle = roof; g.beginPath(); g.moveTo(-18, -5); g.lineTo(-13, -10); g.lineTo(13, -10); g.lineTo(18, -5); g.closePath(); g.fill(); g.stroke();   // svalgangens tak
    g.fillStyle = tar; g.fillRect(-16, -5, 32, 5); g.strokeRect(-16, -5, 32, 5);
    g.fillStyle = hexA(T.ink, 0.45); for (let x = -13; x < 15; x += 4.5) g.fillRect(x, -4, 2.2, 3);   // åpne buer i svalgangen
    g.fillStyle = tar; g.fillRect(-10, -18, 20, 8); g.strokeRect(-10, -18, 20, 8);
    g.fillStyle = shingle; for (let x = -8; x < 10; x += 3) g.fillRect(x, -17, 0.7, 6);
    g.fillStyle = T.windowLit ? '#FFD47E' : roof; g.fillRect(-1.5, -16, 3, 4);
    // bratte saltak (gavlene vender mot oss), hvert trinn smalere
    const gable = (y, hw, rise, dragons) => {
      g.fillStyle = roof; g.beginPath(); g.moveTo(-hw, y); g.lineTo(0, y - rise); g.lineTo(hw, y); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = shingle; g.lineWidth = 0.6; g.beginPath(); for (let k = 0.3; k < 1; k += 0.25) { g.moveTo(-hw * (1 - k), y - rise * k); g.lineTo(hw * (1 - k), y - rise * k); } g.stroke();
      if (dragons) {   // drakehode: en liten bøyd hals med snute som peker ut og opp fra mønet
        g.strokeStyle = roof; g.lineWidth = 1.3;
        for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 1, y - rise + 1.2); g.quadraticCurveTo(sx * 4, y - rise - 1.5, sx * 5.5, y - rise - 4.5); g.lineTo(sx * 7.2, y - rise - 4); g.stroke(); }
      }
      ink(g);
    };
    gable(-17, 13, 10, false);
    g.fillStyle = tar; g.fillRect(-6, -31, 12, 6); g.strokeRect(-6, -31, 12, 6);
    gable(-30, 9, 9, true);
    g.fillStyle = tar; g.fillRect(-3, -40, 6, 5); g.strokeRect(-3, -40, 6, 5);
    g.fillStyle = roof; g.beginPath(); g.moveTo(-4, -39); g.lineTo(0, -50); g.lineTo(4, -39); g.closePath(); g.fill(); g.stroke();   // spir
    g.strokeStyle = tc('#C9A35A'); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, -50); g.lineTo(0, -52.5); g.stroke();
  });
  sprite('seter', 52, 26, g => {   // seter: liten tømmerbu med torvtak, gjerde og to kuer
    const log = tc('#8A5A3A');
    ink(g); g.fillStyle = log; g.fillRect(-22, -10, 15, 10); g.strokeRect(-22, -10, 15, 10);
    g.fillStyle = tc('#6A4029'); for (let y = -8; y < 0; y += 2.4) g.fillRect(-22, y, 15, 0.6);
    g.fillStyle = T.roof; g.beginPath(); g.moveTo(-25, -9.5); g.lineTo(-14.5, -16); g.lineTo(-4, -9.5); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = T.moss; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-24, -10.2); g.lineTo(-14.5, -16.6); g.lineTo(-5, -10.2); g.stroke();
    g.strokeStyle = tc('#9C7A55'); g.lineWidth = 0.8; g.beginPath();   // skigard (skrå gjerdestaur)
    for (let x = -2; x < 24; x += 4) { g.moveTo(x, 0); g.lineTo(x + 2.5, -6); }
    g.moveTo(-2, -2.5); g.lineTo(24, -2.5); g.moveTo(-1, -4.5); g.lineTo(25, -4.5); g.stroke();
    const cow = (x, flip, patch) => {
      g.save(); g.translate(x, 0); g.scale(flip, 1); ink(g, 0.8);
      g.strokeStyle = T.ink; for (const lx of [-3.5, -1.8, 2, 3.6]) { g.beginPath(); g.moveTo(lx, -3); g.lineTo(lx, 0); g.stroke(); }
      g.fillStyle = tc('#FBF6EE'); g.beginPath(); g.ellipse(0, -5, 5.2, 3, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = patch; g.beginPath(); g.ellipse(-1.5, -5.6, 1.8, 1.4, 0.3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(2.4, -4.4, 1.2, 1, 0, 0, TAU); g.fill();
      g.fillStyle = tc('#FBF6EE'); g.beginPath(); g.ellipse(6, -6.6, 2, 1.6, 0.3, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = tc('#F3B7A8'); circle(g, 7.4, -6, 0.9);
      g.restore();
    };
    cow(6, 1, tc('#6A4029')); cow(17, -1, tc('#2E2A30'));
  });
  sprite('fyr', 24, 40, g => {   // fyr på et lite skjær i fjorden: hvitt med røde bånd
    ink(g, 0.9);
    g.fillStyle = mixHex(T.stone, T.mountainNear, 0.4); g.beginPath(); g.ellipse(0, 0, 10, 3.2, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = tc('#FBF8F1'); g.beginPath(); g.moveTo(-3.6, -1.5); g.lineTo(-2.6, -24); g.lineTo(2.6, -24); g.lineTo(3.6, -1.5); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = tc('#D9473A'); for (const y of [-8, -17]) { g.beginPath(); g.moveTo(-3.3 + (y / -24) * 1, y); g.lineTo(-3.1 + (y / -24) * 1, y - 3.4); g.lineTo(3.1 - (y / -24) * 1, y - 3.4); g.lineTo(3.3 - (y / -24) * 1, y); g.closePath(); g.fill(); }
    g.fillStyle = T.windowLit ? '#FFE9A8' : tc('#CFEFF7'); g.fillRect(-2.4, -28.5, 4.8, 4.5); g.strokeRect(-2.4, -28.5, 4.8, 4.5);
    g.fillStyle = tc('#D9473A'); g.beginPath(); g.moveTo(-3.4, -28.5); g.lineTo(0, -32.5); g.lineTo(3.4, -28.5); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = T.ink; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-4, -24); g.lineTo(4, -24); g.stroke();
  });
  sprite('elg', 40, 34, g => {   // elg i skogkanten: høye skuldre, lange bein og skovlhorn
    const fur = tc('#5A3E2E'), dark = tc('#3E2A20');
    ink(g, 0.9);
    g.strokeStyle = dark; g.lineWidth = 1.8; for (const [x0, x1] of [[-8, -9], [-5, -5.5], [6, 6.5], [9, 9.5]]) { g.beginPath(); g.moveTo(x0, -12); g.lineTo(x1, 0); g.stroke(); }
    g.fillStyle = fur; g.strokeStyle = T.ink; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-11, -12); g.quadraticCurveTo(-12, -19, -6, -19); g.quadraticCurveTo(2, -23, 8, -22); g.quadraticCurveTo(12, -20, 11, -12); g.quadraticCurveTo(0, -9, -11, -12); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(8, -21); g.quadraticCurveTo(13, -21, 15, -17); g.lineTo(18, -13.5); g.quadraticCurveTo(19, -11.5, 16.5, -11.5); g.quadraticCurveTo(13, -13, 10, -16); g.closePath(); g.fill(); g.stroke();   // hode
    g.fillStyle = dark; g.beginPath(); g.ellipse(13.5, -12, 1, 2.2, 0, 0, TAU); g.fill();   // skjegg
    g.fillStyle = tc('#D9C29A'); g.strokeStyle = T.ink; g.lineWidth = 0.7;
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(12, -19.5); g.quadraticCurveTo(12 + sx * 2, -24, 9 + sx * 5, -25.5); g.lineTo(10 + sx * 6.5, -23); g.lineTo(11 + sx * 6, -21.4); g.quadraticCurveTo(12 + sx * 3, -20.5, 12, -19.5); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#FFFFFF'; circle(g, 14.4, -17.4, 0.55); g.fillStyle = dark; circle(g, 14.3, -17.3, 0.35);
  });
  sprite('sau', 22, 18, g => {   // sau (kropp; hodet tegnes live så den kan beite)
    ink(g, 0.8); g.strokeStyle = tc('#2E2A30'); g.lineWidth = 1.3;
    for (const x of [-4.5, -2, 2.5, 4.8]) { g.beginPath(); g.moveTo(x, -3.5); g.lineTo(x, 0); g.stroke(); }
    blob(g, [[-4, -6.5, 3.2], [-1, -8, 3.4], [2.6, -7.5, 3.3], [4.8, -6, 2.8], [0.5, -5, 3.6], [-3, -4.8, 2.8]], tc('#FBF8F2'), T.ink, 0.8, 0.8);
  });
  sprite('tjern', 72, 18, g => {   // lite tjern i lyngen: blankt vann, siv i kanten og et nøkkerosblad
    ink(g, 0.9);
    g.fillStyle = mixHex(T.fjord, T.grassDark, 0.2); g.beginPath(); g.ellipse(0, -7, 31, 6.5, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = hexA(T.fjordLight, 0.8); g.beginPath(); g.ellipse(-8, -9, 13, 1.6, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(6, -5, 6, 0.9, 0, 0, TAU); g.fill();   // lys refleks
    g.fillStyle = tc('#6FAE5A'); g.beginPath(); g.ellipse(13, -6, 3.4, 1.5, 0, 0.4, TAU - 0.2); g.lineTo(13, -6); g.closePath(); g.fill();
    g.fillStyle = tc('#FBF6EE'); circle(g, 13.8, -6.8, 1.2);
    g.strokeStyle = tc('#6E8A4A'); g.lineWidth = 1; g.beginPath();   // siv
    for (const [x, hh] of [[-30, 11], [-27.5, 8], [-25.5, 13], [-23, 9], [25, 10], [27.5, 14], [30, 9]]) { g.moveTo(x, -4); g.quadraticCurveTo(x + 0.6, -4 - hh * 0.6, x + 1.4, -4 - hh); }
    g.stroke();
    g.fillStyle = tc('#7A5A3A'); for (const [x, y] of [[-24.6, -15.5], [28.4, -16.5]]) { g.beginPath(); g.ellipse(x, y, 1.1, 2.6, 0, 0, TAU); g.fill(); }   // dunkjevle
  });
  sprite('postkasse', 16, 26, g => {   // postkasse på en stolpe ved stien, med avisrør
    ink(g, 0.9);
    g.fillStyle = tc('#8A6A4A'); g.fillRect(-1.2, -14, 2.4, 14); g.strokeRect(-1.2, -14, 2.4, 14);
    g.fillStyle = tc('#C8313E'); g.beginPath(); g.moveTo(-5.5, -14); g.lineTo(-5.5, -19.5); g.quadraticCurveTo(0, -23.5, 5.5, -19.5); g.lineTo(5.5, -14); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = hexA(T.ink, 0.15); g.fillRect(-5.5, -19.5, 2, 5.5);
    g.fillStyle = tc('#FFFFFF'); g.fillRect(-2, -18.2, 4, 1.6);
    g.fillStyle = tc('#3E6E4A'); g.fillRect(-4, -11.5, 8, 3); g.strokeRect(-4, -11.5, 8, 3);   // avisrør
  });
  for (const k in out) if (DEPTH[LANDMARKS[k]]) depthify(out[k], DEPTH[LANDMARKS[k]], { tiled: false, keepSharp });
  return out;
}
// tegn landemerkene som hører til laget med fart «depth», plantet på lagets overflate
function drawLandmarks(groundY, depth) {
  for (const m of landmarks) {
    if (LANDMARKS[m.kind] !== depth) continue;
    const x = lmX(m, viewScroll), S = scene.marks[m.kind];
    if (x < -60 || x > W + 60) continue;
    let y;
    if (depth === 0.05) y = groundY - 70 + 5;                                                 // skjær i fjorden
    else if (depth === 0.14) { const L = scene.hills; y = groundY - L.h + L.top(wrap(x + viewScroll * depth, L.w)) + 2; }
    else if (depth === 0.3) { const L = scene.forest; y = groundY - L.h + L.floor(wrap(x + viewScroll * depth, L.w)) + 3; }
    else if (depth === 0.6) y = groundY - 1;
    else y = groundY + 3;
    y += camShift(depth);
    const pad = S.pad || 0;
    blitWhole(S, x - S.w / 2, y - S.h + 2 + pad);
    if (m.kind === 'sau') sheepHead(x, y, m.seed);
    if (m.kind === 'fyr' && T.windowLit) lighthouseBeam(x, y - 26);
  }
}
// sauen beiter: hodet nede en stund, så opp og ser seg rundt (pauser, ikke jevn vugging)
function sheepHead(x, y, seed) {
  const t = wrap(time + seed % 10, 6.5), down = t < 3.8, k = down ? Math.min(1, t / 0.35) : Math.min(1, (t - 3.8) / 0.35), a = down ? 0.9 * k : 0.9 * (1 - k);
  const ang = reduceMotion ? 0.9 : a;   // redusert bevegelse: sauen står og beiter
  ctx.save(); ctx.translate(x + 5.5, y - 7); ctx.rotate(ang);
  ctx.fillStyle = tc('#2E2A30'); ctx.strokeStyle = T.ink; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.ellipse(2.6, 0.4, 2.6, 1.7, 0.35, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.8, -1.4, 1.3, 0.6, -0.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; circle(ctx, 2.8, -0.2, 0.4);
  ctx.restore();
}
// fyrlykta om kvelden: flat glorie og en stråle som feier rundt (lengden viser vinkelen mot oss)
function lighthouseBeam(x, y) {
  ctx.fillStyle = 'rgba(255,233,168,.25)'; circle(ctx, x, y, 7); circle(ctx, x, y, 4);
  if (reduceMotion) return;
  const c = Math.cos(time * 1.3), len = 70 * c;
  ctx.fillStyle = `rgba(255,236,180,${(0.18 + 0.12 * Math.abs(c)).toFixed(3)})`;
  ctx.beginPath(); ctx.moveTo(x, y - 1); ctx.lineTo(x + len, y - 6); ctx.lineTo(x + len, y + 4); ctx.closePath(); ctx.fill();
}

/* ---------- Stemningselementer (live) ---------- */
function initAmbient() {
  const groundY = H - GROUND_H, r = rng(91);
  stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * (groundY - 200), r: Math.random() < 0.3 ? 1.6 : 1, p: Math.random() * 10 }));
  initMotes();
  const span = Math.max(60, groundY - 310 - safeTop);
  clouds = Array.from({ length: 6 }, (_, i) => ({ x: r() * (W + 260), y: safeTop + 34 + r() * span, s: i < 3 ? 0.4 + r() * 0.12 : 0.62 + r() * 0.22, sp: i < 3 ? 0.03 : 0.07, drift: 2 + r() * 3, v: i % 3, far: i < 3 }));
}
function initMotes() {
  const groundY = H - GROUND_H, k = moteKind();
  const n = { firefly: 14, pollen: 18, leaf: 16, petal: 18, snow: 46 }[k];
  dust = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: moteY(groundY), r: k === 'snow' ? 0.8 + Math.random() * 1.6 : 0.8 + Math.random() * 1.2,
    vx: k === 'snow' ? 2 + Math.random() * 6 : 4 + Math.random() * 10, f: 0.5 + Math.random(), p: Math.random() * 6,
    fall: k === 'snow' ? 18 + Math.random() * 22 : 14 + Math.random() * 16, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 3,
    c: k === 'leaf' ? ['#F2994A', '#F7C548', '#E46B3C', '#D9A85E'][(Math.random() * 4) | 0] : ['#FFC6D6', '#FFE3EC', '#FF9EB5'][(Math.random() * 3) | 0],
    near: Math.random() < 0.12   // noen få helt nær kameraet: store, uskarpe og raske
  }));
}
// tegn et flislag med scroll; snapper til skjermpiksler så flisene aldri får søm
// y forskyves med kameraets høyde etter lagets avstand; extend = forleng nederste rad når laget løftes
// (skogbunnen og forgrunnen må alltid nå ned til bakken / skjermkanten)
function drawLayer(L, y, speed, each, extend = false) {
  const R = dpr * scale, sh = camShift(speed);
  y = Math.round((y + sh) * R) / R;
  let x = Math.round(-wrap(viewScroll * speed, L.w) * R) / R;
  for (; x < W; x += L.w) {
    // bare den synlige delen av flisen (de lange lagene stikker ofte langt utenfor skjermen)
    const s0 = Math.max(0, Math.round(-x * R)), s1 = Math.min(layerW(L), Math.round((W - x) * R)), lh = layerH(L);
    if (s1 > s0) {
      blitDepth(L, s0, 0, s1 - s0, lh, x + s0 / R, y, (s1 - s0) / R, L.h);
      if (extend && sh < 0) blitDepth(L, s0, lh - 1, s1 - s0, 1, x + s0 / R, y + L.h - 0.5, (s1 - s0) / R, -sh + 1);
    }
    if (each) each(x, y);
  }
}
// bakken: stykkene legges etter hverandre etter rekkefølgen i segAt (snappet til skjermpiksler)
function drawGround(groundY) {
  const R = dpr * scale, segs = scene.groundSegs, w = segs[0].w, k0 = Math.floor(viewScroll / w);
  for (let k = k0, x = Math.round((k0 * w - viewScroll) * R) / R; x < W; k++, x += w) {
    const L = segs[segAt(k)]; ctx.drawImage(L.c, x, groundY - 10 - SEG_HEAD, L.w, L.h);
  }
}
function drawSky(groundY) {
  ctx.drawImage(scene.sky.c, 0, 0, scene.sky.w, scene.sky.h);
  if (T.night) {
    ctx.fillStyle = '#FFF3D6';
    for (const s of stars) {   // de fleste lyser jevnt; en og annen blinker kort (ikke alle i takt)
      const per = 5 + (s.p % 1) * 6, k = ((time + s.p * 3) % per) / 0.45;
      ctx.globalAlpha = (0.55 + 0.35 * (s.p % 0.7)) * (k < 1 && !reduceMotion ? 1 - 0.75 * Math.sin(Math.PI * k) : 1); circle(ctx, s.x, s.y, s.r);
    }
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
  } else {
    circle(ctx, sx, sy, 20);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; circle(ctx, sx - 6, sy - 6, 6);
  }
  // skyer (to lag) og luftballong
  for (const c of clouds) {
    const x = wrap(c.x - viewScroll * c.sp - time * c.drift, W + 260) - 130, S = scene.clouds[c.v];   // margen er bredere enn den største skyen, så ingen sky forsvinner synlig
    const bob = 0;   // skyene driver jevnt; de vugger ikke
    const k = c.s, pad = S.pad * k;   // skyene ligger langt unna: følger kameraet nesten fullt
    ctx.globalAlpha = c.far ? 0.8 : 1; blitWhole(S, x - pad, c.y + bob + camShift(c.far ? 0.03 : 0.07) - pad, S.w * k, S.h * k);
  }
  ctx.globalAlpha = 1;
  const bp = balloonPos();   // stiger og synker i rolige trinn med pauser (som i termikk)
  if (bp) { const B = scene.balloon; ctx.drawImage(B.c, bp.x, bp.y + camShift(0.02), B.w, B.h); }
  const fp = flockPos();   // en liten fugleflokk krysser himmelen innimellom: flakser i støt og glir imellom
  if (fp) {
    const x0 = fp.x, y0 = fp.y + camShift(0.05);
    {
      ctx.strokeStyle = hexA(T.ink, 0.55); ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      [[0, 0], [12, -6], [22, 4]].forEach(([dx, dy], i) => {
        const ph2 = (time * 0.8 + i * 0.23) % 1.7, flapping = ph2 < 0.65 && !reduceMotion;
        const f = flapping ? Math.sin(ph2 * 30) * 2.4 : 0.5, x = x0 + dx, y = y0 + dy + (flapping ? 0 : (ph2 - 0.65) * 1.6);
        ctx.beginPath(); ctx.moveTo(x - 4, y - f); ctx.quadraticCurveTo(x - 2, y - 1, x, y); ctx.quadraticCurveTo(x + 2, y - 1, x + 4, y - f); ctx.stroke();
      });
    }
  }
}
function drawScenery(groundY) {
  const M = scene.mountains;
  drawLayer(M, groundY - M.h, 0.05);
  // seilbåt på fjorden
  const bx = wrap(W * 0.3 - viewScroll * 0.05 - time * 2.5, W + 60) - 30, by = groundY - 63 + Math.sin(time * 1.6) * 0.6 + camShift(0.05), Bt = scene.boat;
  blitWhole(Bt, bx - 8 - Bt.pad, by - 15 - Bt.pad);
  drawLandmarks(groundY, 0.05);
  // åser med hytter + røyk fra pipene
  const Hl = scene.hills, hy = groundY - Hl.h;
  drawLayer(Hl, hy, 0.14, (tx, ty) => {
    for (const c of Hl.chimneys) {
      const cx = tx + c.x, cy = ty + c.y;
      if (cx < -30 || cx > W + 10) continue;
      for (let k = 0; k < 6; k++) {
        const a = wrap(time * 0.32 + k / 6 + c.x * 0.013, 1), al = Math.min(1, a * 6) * (1 - a) * 0.55;
        ctx.fillStyle = T.night ? `rgba(225,220,245,${al})` : `rgba(255,255,255,${al})`;
        circle(ctx, cx - a * 18 + Math.sin(a * 7 + k) * 2, cy - a * 30, 1.6 + a * 4.5);
      }
    }
  });
  drawLandmarks(groundY, 0.14);
  drawLayer(scene.forest, groundY - scene.forest.h, 0.3, null, true);
  drawLandmarks(groundY, 0.3);
  drawLayer(scene.bushes, groundY - scene.bushes.h, 0.6);
  drawLandmarks(groundY, 0.6);
}
// en partikkel nær kameraet: stor og uskarp (to flate, gjennomsiktige skiver i stedet for et filter)
function nearMote(x, y, r, c, a = 1) {
  ctx.fillStyle = c; ctx.globalAlpha = 0.22 * a; circle(ctx, x, y, r * 4.2); ctx.globalAlpha = 0.3 * a; circle(ctx, x, y, r * 2.8);
  ctx.globalAlpha = 1;
}
// ildfluer blinker i små serier (to eller tre blink) med mørke pauser imellom, slik ekte ildfluer gjør
function fireflyA(m) {
  if (reduceMotion) return 0.6;
  const per = 3 + m.f * 2, k = (time + m.p * 2) % per, n = 2 + (((m.p * 10) | 0) % 2);
  for (let i = 0; i < n; i++) { const d = k - i * 0.32; if (d >= 0 && d < 0.2) return Math.sin(Math.PI * d / 0.2); }
  return 0;
}
function drawMotes() {
  const k = moteKind();
  for (const m of dust) if (m.near) {
    const x = ip(m.px, m.x), y = ip(m.py, m.y);
    if (k === 'firefly') { const a = fireflyA(m); if (a > 0.05) nearMote(x, y, m.r, '#FFF2A0', a); }
    else nearMote(x, y, m.r, k === 'snow' ? (T.night ? '#E1E6FF' : '#FFFFFF') : k === 'pollen' ? '#FFFAEB' : (T.night ? mixHex(m.c, '#2A2C5A', 0.45) : m.c));
  }
  if (k === 'leaf' || k === 'petal') {   // løv og blomsterblader som snurrer mens de daler
    for (const m of dust) {
      if (m.near) continue;
      ctx.save(); ctx.translate(ip(m.px, m.x), ip(m.py, m.y)); ctx.rotate(m.rot); ctx.fillStyle = T.night ? mixHex(m.c, '#2A2C5A', 0.45) : m.c;
      ctx.beginPath(); ctx.ellipse(0, 0, m.r * 2.4, m.r * 1.2, 0, 0, 7); ctx.fill();
      if (k === 'leaf') { ctx.strokeStyle = hexA(T.ink, 0.35); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-m.r * 2.2, 0); ctx.lineTo(m.r * 2.2, 0); ctx.stroke(); }
      ctx.restore();
    }
    return;
  }
  if (k === 'snow') {
    ctx.fillStyle = T.night ? 'rgba(225,230,255,.85)' : 'rgba(255,255,255,.95)';
    for (const m of dust) if (!m.near) circle(ctx, ip(m.px, m.x), ip(m.py, m.y), m.r);
    return;
  }
  if (k === 'firefly') {   // ildfluer som blinker
    for (const m of dust) {
      if (m.near) continue;
      const a = fireflyA(m); if (a < 0.05) continue;
      const x = ip(m.px, m.x), y = ip(m.py, m.y);
      ctx.globalAlpha = a; ctx.drawImage(scene.glow.c, x - 7, y - 7, 14, 14);
      ctx.fillStyle = '#FFF6B0'; circle(ctx, x, y, 1.1);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(255,250,235,.7)';
    for (const m of dust) if (!m.near) circle(ctx, ip(m.px, m.x), ip(m.py, m.y), m.r);
  }
}

/* ---------- Bjørkestammer ---------- */
function drawTrunkShadow(p, groundY) {
  ctx.fillStyle = hexA(T.ink, 0.16); ctx.beginPath(); ctx.ellipse(p.x + PIPE_W / 2 + 4, groundY + 3, PIPE_W / 2 + 9, 3.5, 0, 0, 7); ctx.fill();
}
function drawTrunk(p, groundY) {
  const ry = END_H / 2 - 0.5, by = p.top + p.gap;
  ctx.save(); ctx.translate(p.x, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const sq = p.sq, behind = sq && ip(sq.pout, sq.out) < 0.95;   // ekornet bak stammen (gjemmer seg eller titter fram)
  if (behind) drawSquirrel(p, groundY);
  trunkBody(p, 'top', -10, p.top - ry, p.marksTop, p.top - ry, -1, p.seed);
  trunkBody(p, 'bot', by + ry, groundY + 2, p.marksBot, by + ry, 1, p.seed + 1);
  trunkDecor(p, p.top - ry, by + ry, groundY);
  trunkEnd(p, p.top - ry, false);
  trunkEnd(p, by + ry, true);
  if (sq && !behind) drawSquirrel(p, groundY);
  if (p.sn) drawSnail(p);
  if (p.wp) drawWoodpecker(p);
  ctx.restore();
  if (p.glow > 0) {   // varm glød i åpningen når man får poeng
    const cx = p.x + PIPE_W / 2, cy = p.top + p.gap / 2, gg = ctx.createRadialGradient(cx, cy, 2, cx, cy, p.gap * 0.6);
    gg.addColorStop(0, `rgba(255,236,170,${p.glow * 0.55})`); gg.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = gg; ctx.fillRect(cx - p.gap * 0.6, cy - p.gap * 0.6, p.gap * 1.2, p.gap * 1.2);
  }
}
// stammekropp: sylinderskygge + svarte barkmerker, målt fra enden (så merkene følger stammen når den beveger seg)
// stammedel: flate tonetrinn, bark og ujevne sidekanter, tegnet direkte (i programvaretegning er dette billigere
// enn å blitte et ferdig tegnet bilde med gjennomsiktighet)
function trunkBody(p, part, y0, y1, marks, ref, dir, seed) {
  if (y1 > y0) paintTrunk(ctx, marks, ref, dir, y0, y1, seed);
}
function paintTrunk(g, marks, ref, dir, y0, y1, seed) {
  const w = PIPE_W, h = y1 - y0;
  // cel-skygge: lys fra høyre, så skyggesiden er til venstre (tre flate tonetrinn og en smal refleks i høyre kant)
  g.fillStyle = T.trunk; g.fillRect(0, y0, w, h);
  g.fillStyle = T.trunkShade; g.fillRect(0, y0, w * 0.2, h);
  g.fillStyle = mixHex(T.trunk, T.trunkShade, 0.5); g.fillRect(w * 0.2, y0, w * 0.1, h); g.fillRect(w - 3.5, y0, 3.5, h);
  // barkmerkene samles i noen få stier etter strektykkelse
  const byWidth = new Map(), faint = [];
  for (const m of marks) {
    const y = ref + dir * m.d;
    if (dir < 0 ? y < y0 - 4 : y > y1 + 4) break;
    if (m.faint) { faint.push(m.x, y, m.len); continue; }
    const lw = m.scar ? 2.4 : Math.round(m.th * 2) / 2;
    if (!byWidth.has(lw)) byWidth.set(lw, []);
    byWidth.get(lw).push(m, y);
  }
  g.strokeStyle = T.bark; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [lw, list] of byWidth) {
    g.lineWidth = lw; g.beginPath();
    for (let i = 0; i < list.length; i += 2) {
      const m = list[i], y = list[i + 1];
      if (m.scar) { g.moveTo(m.x, y + 3); g.lineTo(m.x + 6, y - 2.5); g.lineTo(m.x + 12, y + 3); }   // «øye» der en gren har sittet
      else { g.moveTo(m.x, y); g.lineTo(m.x + m.len * 0.5, y + 0.45); g.lineTo(m.x + m.len, y); }   // svak knekk (billigere enn kurve)
    }
    g.stroke();
  }
  if (faint.length) {   // lenticeller
    g.fillStyle = hexA(T.bark, 0.42); g.beginPath();
    for (let i = 0; i < faint.length; i += 3) g.rect(faint[i], faint[i + 1] - 0.35, faint[i + 2], 0.7);
    g.fill();
  }
  // ujevne sidekanter, målt fra enden så de følger stammen; tykkere på skyggesiden
  g.strokeStyle = hexA(T.ink, 0.6);
  for (const [x, lw, off] of [[0, 2.1, 0], [w, 1.3, 9]]) {
    const n = wobble(seed * 7 + off); g.lineWidth = lw; g.beginPath();
    for (let y = y0; ; y += 7) { const yy = Math.min(y, y1); g.lineTo(x + n((yy - ref) * dir / 26) * 0.6, yy); if (yy >= y1) break; }
    g.stroke();
  }
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
// ekornet: tegnes i stammens koordinater (x = 0 er venstre kant). Grunnformen står i profil med hodet
// mot +x og magen mot +y; på kanten roteres det så magen ligger mot barken og hodet peker dit det skal.
const SQ_FUR = { summer: ['#C8632E', '#A94F24', '#FBEBD5'], winter: ['#9C7A66', '#7E5F4E', '#F4EEE6'] };
function drawSquirrel(p, groundY) {
  const q = p.sq, ry = END_H / 2 - 0.5, s = ip(q.ps, q.s), out = ip(q.pout, q.out);
  const fur = SQ_FUR[seasonName === 'winter' ? 'winter' : 'summer'].map(tc);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (q.state === 'sit') {   // sitter oppå snittflaten og gnager på en kongle
    const nib = reduceMotion ? 0 : loopKeys([[0, 0], [0.12, 1, 'out'], [0.24, 0, 'in'], [0.36, 1, 'out'], [0.48, 0, 'in'], [1.6, 0], [1.75, 0.6, 'out'], [2.1, 0, 'inOut'], [3.2, 0]], q.t + (q.seed % 13) * 0.1);
    const flick = reduceMotion ? 0 : loopKeys([[0, 0], [2.4, 0], [2.52, 1, 'out'], [2.7, 0, 'back'], [4.1, 0]], q.t + (q.seed % 7) * 0.3);
    ctx.translate(PIPE_W / 2 + q.side * 6, p.top + p.gap + ry + 1.5); ctx.scale(-q.side, 1);   // vender innover mot midten
    squirrelSit(fur, nib, flick);
  } else {
    const edge = q.side < 0 ? 0 : PIPE_W, k = out, x = edge + q.side * (-7 + 10 * k);   // ute: kroppen griper rundt kanten
    const y = q.part === 'bot' ? p.top + p.gap + ry + s : p.top - ry - s;
    const up = q.part === 'bot' ? q.face < 0 : q.face > 0;
    ctx.translate(x, y);
    // magen mot stammen: venstre kant = magen mot +x, høyre kant = magen mot -x
    if (up) { ctx.rotate(-Math.PI / 2); if (q.side > 0) ctx.scale(1, -1); }
    else { ctx.rotate(Math.PI / 2); if (q.side < 0) ctx.scale(1, -1); }
    const run = q.phase === 'run' && q.state !== 'hide' && q.state !== 'peek';
    const g = run ? Math.sin(q.gait * Math.PI * 2) : 0;
    const flick = reduceMotion || run ? 0 : loopKeys([[0, 0], [1.1, 0], [1.2, 1, 'out'], [1.38, 0, 'back'], [2.3, 0]], q.t + (q.seed % 5) * 0.2);
    squirrelClimb(fur, g, flick, q.state === 'peek');
  }
  ctx.restore();
}
function squirrelTail(fur, x0, y0, c1x, c1y, c2x, c2y, x1, y1, w) {   // busket hale: en tykk, myk bue med lysere kant
  ctx.strokeStyle = T.ink; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1); ctx.stroke();
  ctx.strokeStyle = fur[1]; ctx.lineWidth = w; ctx.stroke();
  ctx.strokeStyle = fur[0]; ctx.lineWidth = w * 0.55; ctx.stroke();
}
function squirrelHead(fur, x, y, peek) {
  ctx.fillStyle = fur[0]; ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(x + 1.2, y - 2.2); ctx.quadraticCurveTo(x + 1.6, y - 5.6, x + 2.6, y - 5.4); ctx.quadraticCurveTo(x + 3.6, y - 4.6, x + 3.6, y - 2.4); ctx.closePath(); ctx.fill(); ctx.stroke();   // rundt øre med dusk
  ctx.strokeStyle = fur[1]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2.5, y - 5.4); ctx.lineTo(x + 2.2, y - 6.5); ctx.moveTo(x + 2.7, y - 5.4); ctx.lineTo(x + 3.1, y - 6.3); ctx.stroke();
  ctx.fillStyle = fur[0]; ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(x, y, 3.4, 2.9, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + 3, y + 0.6, 1.9, 1.5, 0.2, 0, 7); ctx.fill(); ctx.stroke();   // snute
  ctx.fillStyle = fur[2]; ctx.beginPath(); ctx.ellipse(x + 1.4, y + 1.6, 1.8, 0.9, 0.2, 0, 7); ctx.fill();   // lys kjake
  ctx.fillStyle = '#2B211D'; circle(ctx, x + 1.6, y - 0.6, peek ? 1.05 : 0.9); circle(ctx, x + 4.7, y + 0.4, 0.55);   // øye og nese
  ctx.fillStyle = '#FFFFFF'; circle(ctx, x + 1.9, y - 0.9, 0.35);
}
// klatrende ekorn (grunnform: hodet mot +x, magen mot +y); g = galopp (-1..1), flick = haleflikk
function squirrelClimb(fur, g, flick, peek) {
  const st = 1 + g * 0.1;
  squirrelTail(fur, -5, -0.5, -10, -1, -15, -4 - flick * 3, -16, -9 - flick * 3, 5);   // halen henger bak langs stammen og bøyer seg litt ut
  ctx.strokeStyle = T.ink; ctx.lineWidth = 2.6;   // bein som griper barken
  ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(-3 - g * 2.2, 5.2); ctx.moveTo(4, 2); ctx.lineTo(4 + g * 2.2, 5); ctx.stroke();
  ctx.strokeStyle = fur[1]; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = fur[0]; ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(0, 0, 6.2 * st, 3.6 / st, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fur[1]; ctx.beginPath(); ctx.ellipse(-3.2, 0.2, 2.8, 2.6, 0, 0, 7); ctx.fill();   // lår
  ctx.fillStyle = fur[2]; ctx.beginPath(); ctx.ellipse(0.8, 2.3, 4, 1.1, 0, 0, 7); ctx.fill();      // lys mage
  squirrelHead(fur, 7.4 * st, -0.8, peek);
}
// sittende ekorn (grunnform: står på y = 0, vender mot +x) med kongle i forpotene
function squirrelSit(fur, nib, flick) {
  squirrelTail(fur, -3, -2, -10, -6, -9 + flick, -18 - flick * 2, -3, -21 - flick * 2, 5);
  ctx.fillStyle = fur[1]; ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(-0.5, -2.6, 3.6, 2.6, 0, 0, 7); ctx.fill(); ctx.stroke();   // lår
  ctx.fillStyle = fur[0]; ctx.beginPath(); ctx.ellipse(0.6, -7, 3.8, 5.6, 0.12, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fur[2]; ctx.beginPath(); ctx.ellipse(2.4, -6.4, 1.6, 4, 0.12, 0, 7); ctx.fill();   // lys bringe
  ctx.fillStyle = fur[1]; ctx.beginPath(); ctx.ellipse(3, 0, 2.4, 0.9, 0, 0, 7); ctx.fill();          // bakpote
  const hy = -13.2 + nib * 0.7;
  squirrelHead(fur, 2.2, hy, false);
  // kongle i potene, rett under snuten; den vrir seg litt når ekornet gnager
  ctx.save(); ctx.translate(5.4, hy + 4.2); ctx.rotate(0.5 + nib * 0.25);
  ctx.fillStyle = tc('#8A5A33'); ctx.strokeStyle = T.ink; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(0, 0, 1.9, 2.8, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = tc('#5E3B22'); ctx.lineWidth = 0.6; ctx.beginPath(); for (const yy of [-1.2, 0, 1.2]) { ctx.moveTo(-1.5, yy); ctx.lineTo(1.5, yy + 0.6); } ctx.stroke();
  ctx.restore();
  ctx.fillStyle = fur[0]; ctx.strokeStyle = T.ink; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(4.2, hy + 5.6, 1.4, 1, 0.3, 0, 7); ctx.fill(); ctx.stroke();   // forpote
}
// flaggspett: svart rygg, hvite skulderflekker, hvitt bryst, rød undergump og rød nakke; henger på kanten
// med magen mot barken og nebbet inn mot stammen (grunnform vender mot +x, speiles på høyre kant)
function drawWoodpecker(p) {
  const q = p.wp, ry = END_H / 2 - 0.5, s = ip(q.ps, q.s), edge = q.side < 0 ? 0 : PIPE_W;
  const y = q.part === 'bot' ? p.top + p.gap + ry + s : p.top - ry - s;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (q.state === 'fly') {
    ctx.translate(edge + q.side * 4 + ip(q.pfx, q.fx), y + ip(q.pfy, q.fy)); woodpeckerFly(q.t); ctx.restore(); return;
  }
  ctx.translate(edge + q.side * 4.5, y); ctx.scale(-q.side, 1);
  woodpeckerCling(ip(q.phead, q.head));
  ctx.restore();
}
const WP_COL = { black: '#2A2526', white: '#F6F1E8', red: '#D8322C', beak: '#4A4444' };
function woodpeckerBody() {
  const c = {}; for (const k in WP_COL) c[k] = tc(WP_COL[k]);
  ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9;
  ctx.fillStyle = c.black; ctx.beginPath(); ctx.moveTo(-1.6, 5.5); ctx.lineTo(2.4, 5.5); ctx.lineTo(4.6, 14); ctx.lineTo(2.2, 14.6); ctx.closePath(); ctx.fill(); ctx.stroke();   // stiv hale mot barken
  ctx.strokeStyle = c.black; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(2.6, -2.5); ctx.lineTo(4.8, -1.5); ctx.moveTo(2.6, 3); ctx.lineTo(4.8, 4); ctx.stroke();   // klør i barken
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 7, -0.08, 0, 7); ctx.clip();
  ctx.fillStyle = c.white; ctx.fillRect(-5, -8, 10, 16);
  ctx.fillStyle = c.black; ctx.fillRect(-5, -8, 5.2, 16);                                   // svart rygg
  ctx.fillStyle = c.white; ctx.beginPath(); ctx.ellipse(-2.2, -2.2, 1.2, 2.6, 0.1, 0, 7); ctx.fill();   // skulderflekk
  for (const yy of [2.2, 4, 5.8]) { ctx.fillRect(-3.6, yy, 1.1, 0.8); ctx.fillRect(-1.8, yy + 0.4, 1.1, 0.8); }   // hvite prikker på vingen
  ctx.fillStyle = c.red; ctx.beginPath(); ctx.ellipse(1.6, 6.4, 2.6, 1.8, 0, 0, 7); ctx.fill();   // rød undergump
  ctx.restore();
  ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 7, -0.08, 0, 7); ctx.stroke();
}
function woodpeckerCling(head) {
  // kroppen (hale, klør, rygg og bryst) er lik hvert bilde: tegnes én gang per palett; bare hodet hakker
  const L = cachedSurface('spett', 12, 24, 0, T.skyTop, (ox, oy) => { ctx.save(); ctx.translate(ox + 5, oy + 8); woodpeckerBody(); ctx.restore(); });
  ctx.drawImage(L.c, -5 - L.pad, -8 - L.pad, L.w, L.h);
  const c = {}; for (const k in WP_COL) c[k] = tc(WP_COL[k]);
  // hodet hakker inn mot stammen
  ctx.save(); ctx.translate(head * 1.7, head * 0.4); ctx.rotate(head * 0.12);
  ctx.fillStyle = c.beak; ctx.beginPath(); ctx.moveTo(3.4, -9.6); ctx.lineTo(8.4, -9.2); ctx.lineTo(3.4, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.white; ctx.beginPath(); ctx.arc(0.6, -9, 3.7, 0, 7); ctx.fill(); ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.fillStyle = c.black; ctx.beginPath(); ctx.arc(0.6, -9, 3.7, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();   // svart isse
  ctx.fillStyle = c.red; ctx.beginPath(); ctx.ellipse(-2.4, -9.6, 1.4, 1.2, 0, 0, 7); ctx.fill();                                 // rød nakkeflekk
  ctx.strokeStyle = c.black; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(3.6, -7.6); ctx.quadraticCurveTo(1, -6.4, -1.8, -7.6); ctx.stroke();   // bartstripe
  ctx.fillStyle = '#1E1A1A'; circle(ctx, 1.9, -9.6, 0.8); ctx.fillStyle = '#FFFFFF'; circle(ctx, 2.1, -9.9, 0.3);
  ctx.restore();
}
function woodpeckerFly(t) {   // i bølgeflukt: noen vingeslag, så vingene inntil
  const c = {}; for (const k in WP_COL) c[k] = tc(WP_COL[k]);
  const beat = (t % 0.5) < 0.28, w = beat ? Math.sin((t % 0.5) / 0.28 * Math.PI * 2) : -0.2;
  ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9;
  ctx.fillStyle = c.black; ctx.beginPath(); ctx.moveTo(-5, -0.5); ctx.lineTo(-10, -1.2); ctx.lineTo(-10, 1.4); ctx.lineTo(-5, 1); ctx.closePath(); ctx.fill(); ctx.stroke();   // hale
  ctx.fillStyle = c.white; ctx.beginPath(); ctx.ellipse(0, 0, 5.6, 3.2, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.red; ctx.beginPath(); ctx.ellipse(-3.6, 1.6, 1.6, 1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = c.white; ctx.beginPath(); ctx.arc(5.6, -1.2, 2.8, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.black; ctx.beginPath(); ctx.arc(5.6, -1.2, 2.8, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.beak; ctx.beginPath(); ctx.moveTo(8.2, -1.6); ctx.lineTo(11.4, -1); ctx.lineTo(8.2, -0.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1E1A1A'; circle(ctx, 6.4, -1.6, 0.6);
  ctx.fillStyle = c.black; ctx.beginPath(); ctx.moveTo(-2, -1); ctx.quadraticCurveTo(0, -1 - 8 * w, 3, -1.4 - 9 * w); ctx.lineTo(3, -0.6); ctx.closePath(); ctx.fill(); ctx.stroke();   // vinge
  ctx.fillStyle = c.white; circle(ctx, 0.6, -1 - 4.5 * w, 0.8);
}
// snegle på den nedre stammen: blankt spor bak seg, sneglehus på ryggen, følehorn med øyne
function drawSnail(p) {
  const q = p.sn, ry = END_H / 2 - 0.5, s = ip(q.ps, q.s), out = ip(q.pout, q.out), edge = q.side < 0 ? 0 : PIPE_W;
  const cut = p.top + p.gap + ry, y = cut + s;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.6;   // slimsporet glinser langs kanten
  ctx.beginPath(); ctx.moveTo(edge + q.side * 0.6, y + 6); ctx.lineTo(edge + q.side * 0.6, cut + q.s0 + 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,225,255,.35)'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.translate(edge + q.side * 3, y); ctx.scale(-q.side, 1);
  const body = tc('#CDB8A0'), shell = tc('#C98B4A'), band = tc('#E7B977'), dark = tc('#8A5A2E');
  const head = -3 - 7 * out, wig = reduceMotion ? 0 : Math.sin(q.t * 2.2) * 0.6 * out;
  ctx.fillStyle = body; ctx.strokeStyle = T.ink; ctx.lineWidth = 0.8;   // foten langs barken, hodet strekker seg opp
  ctx.beginPath(); ctx.moveTo(1.6, 7); ctx.quadraticCurveTo(2.2, 1, 1.6, head + 1); ctx.quadraticCurveTo(0.4, head - 1.6, -1.2, head + 0.6); ctx.quadraticCurveTo(-1.4, 2, -0.6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (out > 0.3) {   // følehorn med øyne
    const k = (out - 0.3) / 0.7;
    ctx.strokeStyle = body; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(0, head); ctx.lineTo(-1.6 + wig, head - 4.4 * k); ctx.moveTo(0.8, head); ctx.lineTo(1.8 + wig, head - 4 * k); ctx.stroke();
    ctx.fillStyle = '#3A2E28'; circle(ctx, -1.6 + wig, head - 4.4 * k, 0.75); circle(ctx, 1.8 + wig, head - 4 * k, 0.7);
  }
  // sneglehuset er likt hvert bilde: tegnes én gang per palett
  const L = cachedSurface('snegl', 12, 12, 0, T.skyTop, (ox, oy) => snailShell(ox + 6, oy + 6, shell, band, dark));
  ctx.drawImage(L.c, -3.4 - 6 - L.pad, 1.4 - 6 - L.pad, L.w, L.h);
  ctx.restore();
}
function snailShell(x, y, shell, band, dark) {   // sneglehus med spiral, sentrert i (x, y)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = shell; ctx.strokeStyle = T.ink; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(x, y, 5.2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = band; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 3.6, -2.4, 1.6); ctx.stroke();
  ctx.strokeStyle = dark; ctx.lineWidth = 0.8; ctx.beginPath();
  for (let a = 0; a < Math.PI * 3.2; a += 0.25) { const r = 0.6 + a * 0.42, xx = x + Math.cos(a) * r, yy = y + Math.sin(a) * r; if (a === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; circle(ctx, x - 1.6, y - 2.8, 1.1);
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
  // hjerteslag: to korte slag og en pause, i stedet for jevn pulsering
  const P = POWERS[q.kind], beat = reduceMotion ? 0 : loopKeys([[0, 0], [0.09, 1, 'out'], [0.2, 0, 'in'], [0.3, 0.6, 'out'], [0.45, 0, 'in'], [1.3, 0]], q.t), pulse = 1 + beat * 0.07;
  ctx.fillStyle = P.glow; ctx.globalAlpha = 0.45; circle(ctx, q.x, q.y, POWER_R * 1.9); ctx.globalAlpha = 0.6; circle(ctx, q.x, q.y, POWER_R * 1.45); ctx.globalAlpha = 1;
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
    const tw = beat;   // gnistrer i takt med hjerteslaget
    ctx.fillStyle = `rgba(255,255,255,${0.35 + tw * 0.65})`; circle(ctx, 5.6, -6, 1.1 + tw * 0.9);   // et lite lysglimt i takt med hjerteslaget
  }
  ctx.restore();
}

/* ---------- Fuglen ---------- */
// interpolert verdi mellom forrige og nåværende fysikk-steg (nye objekter har ingen forrige verdi ennå)
const ip = (prev, cur) => prev === undefined ? cur : prev + (cur - prev) * alpha;

function birdExpr() {
  if (state === State.DEAD || state === State.OVER) return 'dizzy';
  if (state === State.MENU && T.night) return 'sleep';
  if (bird.happy > 0 || bird.preen > 0.5) return 'happy';   // lukker øynene fornøyd når den pirker i fjærene
  if (state === State.PLAY && bird.vy > 330) return 'wide';
  return 'normal';
}
function eye(x, y, s, expr, look) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round';
  // øynene sitter i den mørke øyestripen: en lys kant under gjør dem lesbare
  const arc = (y0, a0, a1, wave) => {
    ctx.beginPath();
    if (wave) for (let a = 0; a < 3 * Math.PI; a += 0.3) { const k = a * 0.3; ctx.lineTo(Math.cos(a + time * 7) * k, Math.sin(a + time * 7) * k); }
    else ctx.arc(0, y0, 2.4, a0, a1);
    ctx.strokeStyle = 'rgba(255,253,246,.9)'; ctx.lineWidth = 2.8; ctx.stroke();
    ctx.strokeStyle = BIRD.eye; ctx.lineWidth = 1.4; ctx.stroke();
  };
  if (expr === 'happy') arc(1.2, Math.PI * 1.15, Math.PI * 1.85);
  else if (expr === 'sleep') arc(-0.8, Math.PI * 0.15, Math.PI * 0.85);
  else if (expr === 'dizzy') arc(0, 0, 0, true);
  else {
    const closed = Math.sin(Math.PI * bird.blink), big = expr === 'wide' ? 1.2 : 1, ry = 2.9 * big * Math.max(0.12, 1 - closed);
    ctx.fillStyle = 'rgba(255,253,246,.85)'; ctx.beginPath(); ctx.ellipse(look, 0.35, 2.3 * big + 0.7, ry + 0.7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = BIRD.eye; ctx.beginPath(); ctx.ellipse(look, 0, 2.3 * big, ry, 0, 0, 7); ctx.fill();
    if (closed < 0.6) {
      ctx.fillStyle = '#FFFFFF'; circle(ctx, look + 0.8, -1.1 * big, 0.95 * big); circle(ctx, look - 0.7, 1 * big, 0.45);
    }
  }
  ctx.restore();
}
// blåmeisen i lokale koordinater (nebbet peker mot +x). rot = fuglens rotasjon, så skyggen alltid ligger nede til venstre
function birdShape(expr, look = wear, rot = 0) {   // look = pynt (garderobe)
  const B = BIRD, R = BODY_R, flying = state === State.PLAY || state === State.DEAD;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = B.ink;
  // halefjær (blå)
  ctx.fillStyle = B.wing; ctx.lineWidth = 1.3;
  for (const [a, l] of [[-0.45, 8], [0.05, 7]]) {
    ctx.save(); ctx.translate(-R + 2.5, 1); ctx.rotate(Math.PI + a - bird.crest * 0.4);
    ctx.beginPath(); ctx.ellipse(l * 0.5, 0, l * 0.6, 2.6, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = B.wingDark; ctx.beginPath(); ctx.ellipse(l * 0.85, 0, l * 0.22, 1.6, 0, 0, 7); ctx.fill();
    ctx.restore(); ctx.fillStyle = B.wing;
  }
  // føtter (blågrå; henger ned i hvile, står når fuglen sitter; gjemt i flukt)
  if (!flying) {
    ctx.strokeStyle = B.feet; ctx.lineWidth = 1.6;
    for (const fx of [-2.6, 2.8]) { ctx.beginPath(); ctx.moveTo(fx, R - 2); ctx.lineTo(fx, R + 2.6); ctx.moveTo(fx - 1.8, R + 3); ctx.lineTo(fx + 1.8, R + 3); ctx.stroke(); }
    ctx.strokeStyle = B.ink;
  }
  // kontur med ujevn strek, tykkest på skyggesiden
  ctx.fillStyle = B.ink; inkCircle(ctx, 0, 0, R, 1.45, 17, 0.28, rot);
  // fjærdrakten: flate felt, klippet til kroppen
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.clip();
  ctx.fillStyle = B.belly; ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.fillStyle = B.back; ctx.beginPath(); ctx.ellipse(-8, -1.5, 8.5, 13, 0.25, 0, 7); ctx.fill();
  ctx.fillStyle = B.face; ctx.beginPath(); ctx.ellipse(4.2, -1.6, 8.8, 6.2, 0.05, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1.2, -12.2, 12.9, 7.7, 0.08, 0, 7); ctx.fill();   // hvit ring rundt hetta
  ctx.fillStyle = B.cap; ctx.beginPath(); ctx.ellipse(1.2, -12.9, 11.4, 6.5, 0.08, 0, 7); ctx.fill();
  ctx.fillStyle = B.capLight; ctx.beginPath(); ctx.ellipse(4.2, -9.4, 4.2, 1.4, 0.15, 0, 7); ctx.fill();
  // øyestripe fra nebbet gjennom øynene og bak til nakken, og halsringen rundt det hvite kinnet
  ctx.strokeStyle = B.mask;
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(5.6, -1.4); ctx.quadraticCurveTo(3.2, -3.6, -1.5, -4.6); ctx.quadraticCurveTo(-6.5, -5.4, -12, -4.6); ctx.stroke();
  ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(8, -1.5); ctx.quadraticCurveTo(9.6, -3.8, 13, -4.4); ctx.stroke();
  ctx.lineWidth = 1.9; ctx.beginPath(); ctx.moveTo(-11.5, -4.4); ctx.quadraticCurveTo(-8.5, 3.5, -1, 4.3); ctx.quadraticCurveTo(5, 4.6, 8.5, 3); ctx.stroke();
  ctx.fillStyle = B.mask; ctx.beginPath(); ctx.ellipse(7.6, 3.4, 2.6, 1.7, -0.2, 0, 7); ctx.fill();   // liten «hake»
  // cel-skygge: to flate tonetrinn ut fra en fast lysretning (oppe til høyre), uansett hvordan fuglen roterer
  const c = Math.cos(rot), s = Math.sin(rot), lx = -(SHADE_X * c + SHADE_Y * s), ly = -(-SHADE_X * s + SHADE_Y * c);
  ctx.fillStyle = B.shade; ctx.beginPath(); ctx.rect(-R - 2, -R - 2, R * 2 + 4, R * 2 + 4); ctx.arc(lx * 2.2, ly * 2.2, R, 0, 7); ctx.fill('evenodd');
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.rect(-R - 2, -R - 2, R * 2 + 4, R * 2 + 4); ctx.arc(-lx * 1.5, -ly * 1.5, R, 0, 7); ctx.fill('evenodd');
  ctx.restore();
  // liten fjærtust i hetta (henger litt etter bevegelsen) – skjules under luer og krone
  if (!HIDES_CREST.has(look)) {
    ctx.save(); ctx.translate(0.5, -R + 1.2); ctx.rotate(-0.3 + bird.crest);
    ctx.strokeStyle = B.ink; ctx.lineWidth = 3.6;
    const tuft = () => { ctx.beginPath(); ctx.moveTo(-1.6, 0.6); ctx.quadraticCurveTo(-2.4, -3.2, -4.6, -4); ctx.moveTo(0.8, 0.4); ctx.quadraticCurveTo(1.2, -3.6, -0.8, -5.2); };
    tuft(); ctx.stroke(); ctx.strokeStyle = B.cap; ctx.lineWidth = 1.8; tuft(); ctx.stroke();
    ctx.restore();
  }
  // strikket lusekofte-skjerf rundt halsen
  const band = scarfBand();
  ctx.save();
  polyline(band); ctx.strokeStyle = B.ink; ctx.lineWidth = 6.2; ctx.stroke();
  polyline(band); ctx.strokeStyle = B.scarf; ctx.lineWidth = 4.2; ctx.stroke();
  lusekofte(band, 3.1);
  ctx.fillStyle = B.scarf; ctx.strokeStyle = B.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(KNOT.x, KNOT.y, 2.6, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
  // vinge (blå med hvitt vingebånd)
  const t = Math.min(bird.flapT, 0.3) / 0.3;
  // vingeslaget: raskt kraftslag ned, saktere opp igjen med en liten overskyting (vekt); løftet når den pirker i fjærene
  const wingA = state === State.OVER ? 0.35
    : keyframes([[0, 0.25], [0.07, -0.95, 'in'], [0.3, 0.25, 'back']], bird.flapT) * (1 - bird.preen) - bird.preen * 0.7;
  ctx.save(); ctx.translate(-4, 2); ctx.rotate(wingA);
  ctx.fillStyle = B.wing; ctx.strokeStyle = B.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(-3, 0, 7, 4.4, 0.2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip();   // svingfjærene (mørkere) under et hvitt vingebånd langs midten
  ctx.fillStyle = B.wingDark; ctx.beginPath(); ctx.moveTo(-11, 1.6); ctx.quadraticCurveTo(-4, 0.4, 4, 1.4); ctx.lineTo(4, 6); ctx.lineTo(-11, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = B.face;   // vingebåndet: hvite fjærspisser på rad
  for (const [x, y] of [[-8.6, 1.3], [-5.4, 0.6], [-2.2, 0.5], [1, 0.9]]) { ctx.beginPath(); ctx.ellipse(x, y, 1.5, 0.95, 0.1, 0, 7); ctx.fill(); }
  ctx.strokeStyle = hexA(B.ink, 0.5); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-8, 3.6); ctx.lineTo(-5, 3.2); ctx.moveTo(-4, 4.2); ctx.lineTo(-1, 3.6); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // ansikt i 3/4-vinkel: to øyne i øyestripen og et lite, mørkt nebb
  const up = bird.lookUp * 1.3;   // ser opp på noe som passerer
  eye(3, -3.4 - up, 0.92, expr, bird.look); eye(9.6, -3.6 - up, 0.8, expr, bird.look);
  const open = state === State.PLAY ? (1 - t) * 1.4 : expr === 'dizzy' ? 0.7 : 0;
  ctx.strokeStyle = B.ink; ctx.lineWidth = 0.9;
  ctx.fillStyle = B.beak; ctx.beginPath(); ctx.moveTo(5.4, -0.9); ctx.quadraticCurveTo(7.8, -1.5, 9.8, 0.1 - open * 0.3); ctx.quadraticCurveTo(7.6, 1, 5.4, 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = B.beakDark; ctx.beginPath(); ctx.moveTo(5.7, 1); ctx.quadraticCurveTo(7.6, 1.3 + open, 9, 1.1 + open); ctx.quadraticCurveTo(7.2, 2.5 + open, 5.7, 1.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(6.8, -0.6, 1.2, 0.35, -0.2, 0, 7); ctx.fill();
  if (look !== 'none') accessory(look);
}
// skjerfbåndet rundt halsen som punkter (andregradskurve), og en hjelpefunksjon for å følge punktene
function scarfBand() {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, u = 1 - t; pts.push({ x: u * u * -10.5 + 2 * u * t * 0 + t * t * 11.6, y: u * u * 3.6 + 2 * u * t * 10 + t * t * 4 }); }
  return pts;
}
function polyline(pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); }
// lusekofte: små hvite korssting («lus») i forskjøvne rader langs en strikket stripe
function lusekofte(pts, every, off = 0) {
  ctx.strokeStyle = BIRD.lus; ctx.lineWidth = 0.62; ctx.lineCap = 'round';
  ctx.beginPath();
  let acc = off, n = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dl = Math.hypot(b.x - a.x, b.y - a.y);
    if (!dl) continue;
    const ux = (b.x - a.x) / dl, uy = (b.y - a.y) / dl;
    for (; acc < dl; acc += every) {
      const side = n++ % 2 ? 0.85 : -0.85, x = a.x + ux * acc - uy * side, y = a.y + uy * acc + ux * side, k = 0.62;
      ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x - k, y + k); ctx.lineTo(x + k, y - k);
    }
    acc -= dl;
  }
  ctx.stroke();
}
// hodeplagg som dekker fjærtoppen
const HIDES_CREST = new Set(['beanie', 'santa', 'crown', 'toadstool', 'viking', 'tophat']);
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
  } else if (id === 'bow') {   // rosa sløyfe på toppen av hodet
    ctx.save(); ctx.translate(3, -12.4); ctx.rotate(0.25); ctx.lineWidth = 1.1;
    ctx.fillStyle = '#FF9EB5';
    ctx.beginPath(); ctx.ellipse(-4.3, 0, 4.3, 2.8, -0.35, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(4.3, 0, 4.3, 2.8, 0.35, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E86F8E'; ctx.beginPath(); ctx.ellipse(-4.6, 0.3, 1.8, 1, -0.35, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(4.6, 0.3, 1.8, 1, 0.35, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 1.9, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (id === 'toadstool') {   // fluesopphatt: rød hatt med hvite prikker
    ctx.fillStyle = '#E5574A'; ctx.beginPath(); ctx.moveTo(-12.5, -6.5); ctx.bezierCurveTo(-12, -21.5, 12, -21.5, 12.5, -6.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFF1D6'; rr(-11.8, -8.2, 23.6, 3.2, 1.6); ctx.fill(); ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; for (const [x, y, r] of [[-6, -12.5, 2], [1, -16.5, 2.3], [7, -11.5, 1.7], [-1, -11, 1.2], [-9.5, -9.6, 1]]) circle(ctx, x, y, r);
  } else if (id === 'sunglasses') {   // mørke solbriller med glans
    ctx.fillStyle = '#2E2A3A'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(3, -3.4, 3.9, 3.1, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(9.8, -3.6, 3.2, 2.7, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.7, -3.9); ctx.lineTo(6.9, -3.9); ctx.moveTo(-0.8, -3.2); ctx.lineTo(-7, -2.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(1.7, -4.7, 1.2, 0.5, -0.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(8.9, -4.8, 0.9, 0.4, -0.5, 0, 7); ctx.fill();
  } else if (id === 'flowercrown') {   // blomsterkrans rundt toppen av hodet
    const cols = ['#FF9EB5', '#FFE27A', '#FFFFFF', '#D9C6F7'];
    for (let i = 0; i < 6; i++) {
      const a = -2.6 + i * 0.38, x = Math.cos(a) * 12.2, y = Math.sin(a) * 12.2;
      ctx.fillStyle = '#86C35C'; ctx.beginPath(); ctx.ellipse(Math.cos(a + 0.19) * 12.6, Math.sin(a + 0.19) * 12.6, 2.2, 1, a + 1.2, 0, 7); ctx.fill();
      ctx.fillStyle = cols[i % cols.length]; ctx.lineWidth = 0.6;
      for (let k = 0; k < 5; k++) { const b = k * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(x + Math.cos(b) * 1.5, y + Math.sin(b) * 1.5, 1.25, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#F2B544'; circle(ctx, x, y, 0.9);
    }
  } else if (id === 'viking') {   // vikinghjelm med horn
    ctx.fillStyle = '#FFF1D6';
    ctx.beginPath(); ctx.moveTo(-8, -9); ctx.quadraticCurveTo(-16.5, -10, -17.5, -19.5); ctx.quadraticCurveTo(-13, -14, -6, -12.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -10); ctx.quadraticCurveTo(15.5, -11, 16.5, -20.5); ctx.quadraticCurveTo(12, -14.5, 5, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#B8C2CC'; ctx.beginPath(); ctx.moveTo(-10.5, -7); ctx.bezierCurveTo(-10, -20.5, 10, -20.5, 10.5, -7.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-3.5, -14.5, 2.6, 1.5, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#9C7A4E'; rr(-11.6, -9.4, 23.2, 4.2, 1.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E9D2A6'; for (const x of [-7.5, -2.5, 2.5, 7.5]) circle(ctx, x, -7.3, 0.8);
  } else if (id === 'tophat') {   // flosshatt med rødt bånd, litt på skakke
    ctx.save(); ctx.rotate(-0.08); ctx.lineWidth = 1.2;
    ctx.fillStyle = '#3A3340'; rr(-7, -26, 14, 16, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E5574A'; ctx.fillRect(-7, -14.6, 14, 3);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-5, -24, 1.4, 8.5);
    ctx.fillStyle = '#4A4252'; ctx.beginPath(); ctx.ellipse(0, -26, 7, 1.6, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3A3340'; ctx.beginPath(); ctx.ellipse(0, -10.6, 11.5, 2.6, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
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
    ctx.lineCap = 'round';
    polyline(pts); ctx.strokeStyle = BIRD.ink; ctx.lineWidth = 5.4; ctx.stroke();
    polyline(pts); ctx.strokeStyle = BIRD.scarf; ctx.lineWidth = 3.4; ctx.stroke();
    lusekofte(pts, 3, 1.5);
    const e = pts[pts.length - 1], f = pts[pts.length - 2], dl = Math.hypot(e.x - f.x, e.y - f.y) || 1, ux = (e.x - f.x) / dl, uy = (e.y - f.y) / dl;
    ctx.strokeStyle = BIRD.scarfDark; ctx.lineWidth = 0.9; ctx.lineCap = 'round'; ctx.beginPath();
    for (const k of [-1.3, 0, 1.3]) { ctx.moveTo(e.x - uy * k, e.y + ux * k); ctx.lineTo(e.x + ux * 2.4 - uy * k, e.y + uy * 2.4 + ux * k); }
    ctx.stroke();
  }
}
function drawBird() {
  const bx = ip(bird.px, bird.x), by = ip(bird.py, bird.y), br = ip(bird.pr, bird.rot), expr = birdExpr();
  if (grace > 0 && Math.floor(time * 14) % 2) ctx.globalAlpha = 0.45;   // usårbar etter skjoldtreff: rolig blinking
  ctx.fillStyle = hexA(T.ink, 0.12); ctx.beginPath(); ctx.ellipse(bx + 1, by + 4, BODY_R * bird.sx, BODY_R * bird.sy * 0.95, 0, 0, 7); ctx.fill();
  drawScarfTails(bx - bird.x, by - bird.y, scarfAnchor(bx, by, br, bird.sx, bird.sy));
  ctx.save(); ctx.translate(bx, by); ctx.rotate(br); ctx.scale(bird.sx, bird.sy); birdShape(expr, wear, br); ctx.restore();
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
    else if (q.shape === 'seed') {   // bjørkefrø: liten nøtt med to tynne vinger
      ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot);
      ctx.globalAlpha = a * 0.55; ctx.beginPath(); ctx.ellipse(-q.r * 0.9, 0, q.r * 0.9, q.r * 0.5, 0, 0, 7); ctx.ellipse(q.r * 0.9, 0, q.r * 0.9, q.r * 0.5, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = a; ctx.beginPath(); ctx.ellipse(0, 0, q.r * 0.45, q.r * 0.7, 0, 0, 7); ctx.fill(); ctx.restore();
    } else if (q.shape === 'leaf') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.beginPath(); ctx.ellipse(0, 0, q.r * 1.7, q.r * 0.85, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = hexA(T.ink, 0.35); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-q.r * 1.5, 0); ctx.lineTo(q.r * 1.5, 0); ctx.stroke(); ctx.restore();
    } else if (q.shape === 'bird') {   // en liten meis som flakser (først når det er dens tur)
      const age = q.max - q.life; if (age < (q.delay || 0)) continue;
      const f = Math.sin((age - (q.delay || 0)) * 22) * q.r * 1.1;
      ctx.globalAlpha = Math.min(1, q.life / 0.6);
      ctx.strokeStyle = BIRD.ink; ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - q.r * 1.8, y - f); ctx.quadraticCurveTo(x - q.r * 0.6, y - q.r * 0.3, x, y); ctx.quadraticCurveTo(x + q.r * 0.6, y - q.r * 0.3, x + q.r * 1.8, y - f); ctx.stroke();
      circle(ctx, x, y + 0.6, q.r * 0.75); ctx.fillStyle = BIRD.belly; circle(ctx, x + 0.4, y + 1, q.r * 0.38);
    }
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
// stabilt frø fra en tekst (samme knapp får samme strek hvert bilde)
function seedOf(str) { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }
function button(key, x, y, w, h, label, fn, opts = {}) {
  const { fill = '#FFD27A', color = '#4A3424', size = 13, active = true } = opts;
  hud[key] = { x, y, w, h, fn };
  const pk = press.key === key ? (time - press.t) / 0.22 : 1;   // kort klem ved trykk
  ctx.save();
  if (pk < 1 && !reduceMotion) { const s = 1 - 0.08 * Math.sin(Math.PI * pk); ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - h / 2); }
  ctx.fillStyle = hexA(UI_INK, 0.25); rr(x, y + 3, w, h, h / 2); ctx.fill();
  ctx.fillStyle = active ? UI_INK : hexA(UI_INK, 0.45); inkRR(ctx, x, y, w, h, h / 2, 1.6, seedOf(key), 0.32);
  ctx.fillStyle = active ? fill : '#F4ECDF'; rr(x, y, w, h, h / 2); ctx.fill();
  if (active) {   // flat, litt mørkere underkant (ett tonetrinn) i stedet for blank glans
    ctx.save(); rr(x, y, w, h, h / 2); ctx.clip(); ctx.fillStyle = hexA(UI_INK, 0.1); rr(x - 2, y + h * 0.66, w + 4, h, h / 2); ctx.fill(); ctx.restore();
  }
  text(label, x + w / 2, y + h / 2 + 0.5, size, { color: active ? color : hexA(UI_INK, 0.75), shadow: false, weight: 600 });
  ctx.restore();
}
// kremfarget panel med «strikkesøm» innenfor kanten
function panel(x, y, w, h) {
  ctx.fillStyle = hexA(UI_INK, 0.25); rr(x, y + 6, w, h, 18); ctx.fill();
  ctx.fillStyle = UI_INK; inkRR(ctx, x, y, w, h, 18, 2, Math.round(w * 7 + h), 0.45);
  ctx.fillStyle = '#FFF8EC'; rr(x, y, w, h, 18); ctx.fill();
  ctx.save(); ctx.clip(); paperOn(ctx, 0.55); ctx.restore();
  runningStitch(rrPoints(x + 7, y + 7, w - 14, h - 14, 12, 1), '#E3C99F', Math.round(w + h * 3));
  rosemal(x + w / 2, y + 7);   // rosemaling midt på den sydde kanten
}
/* ---------- Paneler som ting i verden ---------- */
// farger på treskiltet (lys furu); tekst på treet bruker WOOD_TEXT eller UI_INK (kontrast minst 4,5:1)
const WOOD = { a: '#EDD2A8', b: '#E7C899', seam: 'rgba(120,80,45,.55)', grain: 'rgba(160,110,60,.22)', knot: 'rgba(150,100,55,.35)' };
const WOOD_TEXT = '#6B4B31';
function nail(x, y) { ctx.fillStyle = '#6B5A4C'; circle(ctx, x, y, 2.1); ctx.fillStyle = 'rgba(255,255,255,.55)'; circle(ctx, x - 0.6, y - 0.7, 0.8); }
// skilt av liggende furuplanker med årer, kvister, fuger, spikre i hjørnene og (valgfritt) malt rosemaling
// skiltet og neveret er like hvert bilde: de tegnes én gang per størrelse og gjenbrukes (som et bilde)
const surfaceCache = new Map();
function cachedSurface(kind, w, h, seed, opt, draw) {
  const R = dpr * scale, key = `${kind}|${w}|${h}|${seed}|${opt}|${R}`, pad = 12;
  let L = surfaceCache.get(key);
  if (!L) {
    L = makeSprite(w + pad * 2, h + pad * 2, g => { const old = ctx; ctx = g; try { draw(pad, pad); } finally { ctx = old; } });
    L.pad = pad; surfaceCache.set(key, L);
  }
  return L;
}
function woodSign(x, y, w, h, seed, rose = true) {
  const L = cachedSurface('wood', w, h, seed, rose, (px, py) => paintWoodSign(px, py, w, h, seed, rose));
  ctx.drawImage(L.c, x - L.pad, y - L.pad, L.w, L.h);
}
function paintWoodSign(x, y, w, h, seed, rose) {
  const r = rng(seed);
  ctx.fillStyle = hexA(UI_INK, 0.25); rr(x, y + 6, w, h, 8); ctx.fill();
  ctx.fillStyle = UI_INK; inkRR(ctx, x, y, w, h, 8, 2, seed, 0.5);
  ctx.save(); rr(x, y, w, h, 8); ctx.clip();
  const n = Math.max(2, Math.round(h / 44)), ph = h / n;
  for (let i = 0; i < n; i++) {
    const py = y + i * ph;
    ctx.fillStyle = i % 2 ? WOOD.b : WOOD.a; ctx.fillRect(x, py, w, ph + 1);
    ctx.strokeStyle = WOOD.grain; ctx.lineWidth = 0.8;   // årer: lange, svakt bølgete streker
    for (let k = 0; k < 4; k++) {
      const gy = py + 6 + r() * (ph - 12), f = 0.03 + r() * 0.03, ph0 = r() * 6;
      ctx.beginPath(); ctx.moveTo(x, gy); for (let xx = x; xx <= x + w + 12; xx += 12) ctx.lineTo(xx, gy + Math.sin(xx * f + ph0) * 1.3); ctx.stroke();
    }
    if (r() < 0.65) {   // kvist
      const kx = x + 24 + r() * (w - 48), ky = py + ph * (0.3 + r() * 0.4);
      ctx.fillStyle = WOOD.knot; ctx.beginPath(); ctx.ellipse(kx, ky, 4.2, 2.2, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = WOOD.knot; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(kx, ky, 7.5, 3.6, 0, 0, 7); ctx.stroke();
    }
    if (i) { ctx.fillStyle = WOOD.seam; ctx.fillRect(x, py - 0.8, w, 1.6); ctx.fillStyle = 'rgba(255,240,210,.5)'; ctx.fillRect(x, py + 0.8, w, 1); }
  }
  ctx.fillStyle = 'rgba(255,245,220,.45)'; ctx.fillRect(x, y, w, 2);          // flat fas: lys oppe, mørkere nede
  ctx.fillStyle = 'rgba(120,80,45,.22)'; ctx.fillRect(x, y + h - 3, w, 3);
  paperOn(ctx, 0.5);
  ctx.restore();
  for (const [nx, ny] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) nail(nx, ny);
  if (rose) rosemal(x + w / 2, y + 11, 0.9, false);   // malt rett på treet, slik rosemaling er
}
// tau som skiltet henger i (tvunnet: en lys strek med skrå vridninger)
function rope(x, y0, y1) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7A5E43'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  ctx.strokeStyle = '#B99872'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,64,44,.55)'; ctx.lineWidth = 0.7; ctx.beginPath();
  for (let yy = y1 - 3; yy > y0; yy -= 4) { ctx.moveTo(x - 1.1, yy + 1.2); ctx.lineTo(x + 1.1, yy - 1.2); }
  ctx.stroke();
}
// bjørkenever: lys bark med ujevn, revet kant, lenticeller, mørke «øyne» og en krøllet flik i ett hjørne
function birchBark(x, y, w, h, seed) {
  const L = cachedSurface('bark', w, h, seed, '', (px, py) => paintBirchBark(px, py, w, h, seed));
  ctx.drawImage(L.c, x - L.pad, y - L.pad, L.w, L.h);
}
function paintBirchBark(x, y, w, h, seed) {
  const r = rng(seed), pts = rrPoints(x, y, w, h, 8, 3), nz = wobble(seed + 3);
  const edge = (g, k) => { g.beginPath(); pts.forEach((p, i) => { const d = k * (1 + nz(i / pts.length * 6.283) * 0.8); g.lineTo(p.x + p.nx * d, p.y + p.ny * d); }); g.closePath(); };
  ctx.fillStyle = hexA(UI_INK, 0.28); ctx.save(); ctx.translate(0, 6); edge(ctx, 0.6); ctx.fill(); ctx.restore();
  ctx.fillStyle = UI_INK; edge(ctx, 2); ctx.fill();
  ctx.fillStyle = '#F6F1E7'; edge(ctx, 0.4); ctx.fill();
  ctx.save(); edge(ctx, 0.4); ctx.clip();
  ctx.fillStyle = 'rgba(210,198,182,.5)'; ctx.fillRect(x, y, w * 0.16, h);   // skyggeside
  ctx.fillStyle = 'rgba(60,52,50,.55)';
  for (let i = 0; i < 46; i++) { const lx = x + 6 + r() * (w - 12), ly = y + 6 + r() * (h - 12), l = 3 + r() * 9; ctx.fillRect(lx, ly, l, 0.9 + r() * 0.9); }
  ctx.strokeStyle = 'rgba(50,44,42,.8)'; ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) { const ex = x + 20 + r() * (w - 40), ey = y + 20 + r() * (h - 40); ctx.beginPath(); ctx.moveTo(ex - 6, ey + 3); ctx.lineTo(ex, ey - 2.5); ctx.lineTo(ex + 6, ey + 3); ctx.stroke(); }
  paperOn(ctx, 0.5);
  ctx.restore();
  // krøllet flik oppe til høyre (barken som skreller seg)
  const cx = x + w - 6, cy = y + 4;
  ctx.fillStyle = '#E7D3B4'; ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(cx - 22, cy); ctx.quadraticCurveTo(cx - 8, cy + 3, cx, cy + 16); ctx.quadraticCurveTo(cx - 9, cy + 16, cx - 14, cy + 9); ctx.quadraticCurveTo(cx - 17, cy + 5, cx - 22, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,110,70,.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx - 16, cy + 3); ctx.quadraticCurveTo(cx - 9, cy + 6, cx - 4, cy + 13); ctx.stroke();
}
// forsting for hånd: sting og mellomrom av litt ulik lengde, med en lys glans på hvert sting
function runningStitch(pts, color, seed) {
  const r = rng(seed); let on = true, left = 3 + r() * 2;
  ctx.lineCap = 'round'; ctx.lineWidth = 1.6; ctx.strokeStyle = color; ctx.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (on) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    left -= Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= 0) { on = !on; left = on ? 3.6 + r() * 2.2 : 2.6 + r() * 1.4; }
  }
  ctx.stroke();
}
// rosemaling: en liten rose med C-snirkler, blad og prikker til hver side (sitter midt på en kant)
function rosemal(x, y, k = 1, patch = true) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const green = '#7E9A58', rust = '#C4553C', ochre = '#E2A845', liner = '#FFF4DC';
  if (patch) { ctx.fillStyle = '#FFF8EC'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 6, 0, 0, 7); ctx.fill(); }   // bryter kantlinja bak ornamentet
  for (const sx of [-1, 1]) {   // speilvendt, men med litt ulike blad på hver side – som malt for hånd
    ctx.save(); ctx.scale(sx, 1);
    ctx.strokeStyle = green; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(4, 0.5); ctx.bezierCurveTo(10, -6, 18, -6.5, 24, -2.5); ctx.arc(22.2, 0.6, 3.4, -Math.PI * 0.32, Math.PI * 0.95);
    ctx.moveTo(4, 1.5); ctx.bezierCurveTo(9, 5.5, 14, 6, 17, 4.5);
    ctx.stroke();
    const leaf = (lx, ly, a, l) => {
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(a);
      ctx.fillStyle = green; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(l * 0.5, -l * 0.42, l, 0); ctx.quadraticCurveTo(l * 0.5, l * 0.42, 0, 0); ctx.fill();
      ctx.strokeStyle = liner; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(l * 0.2, 0); ctx.quadraticCurveTo(l * 0.5, -l * 0.12, l * 0.8, 0); ctx.stroke();
      ctx.restore();
    };
    if (sx < 0) { leaf(9, -3.6, -0.75, 7); leaf(13, 4.6, 0.2, 5.5); } else { leaf(9.5, -3.8, -0.6, 6.5); leaf(12.5, 4.8, 0.35, 6); }
    ctx.fillStyle = ochre; for (const [dx, dy, r] of [[17, -7.6, 0.95], [20.4, -8, 0.75], [19.5, 4.6, 0.8]]) circle(ctx, dx, dy, r);
    ctx.restore();
  }
  ctx.fillStyle = rust; ctx.beginPath(); ctx.arc(0, 0.6, 5, 0, 7); ctx.fill();   // rosen
  ctx.fillStyle = '#A84330'; ctx.beginPath(); ctx.arc(0.4, 1.6, 2.6, 0, 7); ctx.fill();
  ctx.strokeStyle = liner; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, 0.6, 3.6, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.beginPath(); ctx.arc(0.4, 1.8, 1.5, Math.PI * 1.15, Math.PI * 1.9); ctx.stroke();
  ctx.restore();
}
function medalFor(s) {
  if (s >= 40) return ['#E3EEF8', '#9FB8CC', 'Platina'];
  if (s >= 30) return ['#FFD27A', '#D19A00', 'Gull'];
  if (s >= 20) return ['#E8E4EC', '#9A96A6', 'Sølv'];
  if (s >= 10) return ['#E8A06A', '#9C5B2A', 'Bronse'];
  return null;
}
// medaljen er et brodert merke: stoff med kant i plattsøm og en selburose i korssting
function drawMedal(x, y, m) {
  const [c, d] = m, R = 21, TAU = Math.PI * 2;
  ctx.fillStyle = hexA(UI_INK, 0.18); circle(ctx, x, y + 2.5, R);
  ctx.fillStyle = UI_INK; inkCircle(ctx, x, y, R, 1.5, 31, 0.3);
  ctx.fillStyle = c; circle(ctx, x, y, R);
  ctx.strokeStyle = hexA(d, 0.55); ctx.lineWidth = 0.7; ctx.lineCap = 'round'; ctx.beginPath();   // plattsøm: tette, korte sting
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU + 0.03; ctx.moveTo(x + Math.cos(a) * (R - 4.6), y + Math.sin(a) * (R - 4.6)); ctx.lineTo(x + Math.cos(a + 0.05) * (R - 0.6), y + Math.sin(a + 0.05) * (R - 0.6)); }
  ctx.stroke();
  ctx.fillStyle = '#FFF7E6'; circle(ctx, x, y, R - 5);   // stoffet
  ctx.strokeStyle = hexA(d, 0.7); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x, y, R - 5, 0, TAU); ctx.stroke();
  const s = 1.85, half = SELBUROSE.length * s / 2;
  stitchGrid(ctx, SELBUROSE, x - half, y - half, s, { X: [hexA(d, 0.45), mixHex(d, '#3A2A20', 0.15), mixHex(d, c, 0.3)] }, 77);
}
// ingen medalje ennå: et lite egg som vugger (i stedet for en grå plassholder)
function drawEgg(x, y) {
  ctx.fillStyle = hexA(UI_INK, 0.15); ctx.beginPath(); ctx.ellipse(x, y + 19, 12, 3, 0, 0, 7); ctx.fill();
  // egget ligger stille og rister innimellom i et kort støt (som om noe er på vei ut)
  const wob = reduceMotion ? 0 : loopKeys([[0, 0], [1.8, 0], [1.92, -0.13, 'out'], [2.04, 0.11, 'inOut'], [2.16, -0.07, 'inOut'], [2.28, 0.03, 'inOut'], [2.45, 0, 'out'], [3.2, 0]], time);
  ctx.save(); ctx.translate(x, y + 17); ctx.rotate(wob); ctx.translate(0, -17);
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
  const pages = Math.ceil(COSMETICS.length / WARDROBE_PAGE), page = Math.min(wardrobePage, pages - 1);
  const pw = 256, ph = 274, px = (W - pw) / 2, py = Math.max(safeTop + 110, groundY * 0.52 - ph / 2);
  woodSign(px, py, pw, ph, 4711, false);   // en knaggrekke av furu: pynten henger på knagger
  stitchHeading('Garderobe', W / 2, py + 24, 2.6, 'ink');
  const owned = COSMETICS.filter(isUnlocked).length;
  text(`${totalPoints} poeng samlet, ${owned} av ${COSMETICS.length} låst opp`, W / 2, py + 44, 10, { color: WOOD_TEXT, shadow: false, weight: 600 });
  const cw = 70, chh = 84, gx = 8, gy = 8, x0 = px + (pw - (cw * 3 + gx * 2)) / 2, y0 = py + 56;
  COSMETICS.slice(page * WARDROBE_PAGE, (page + 1) * WARDROBE_PAGE).forEach((c, i) => {
    const cx = x0 + (i % 3) * (cw + gx), cy = y0 + Math.floor(i / 3) * (chh + gy), ok = isUnlocked(c), on = wear === c.id;
    hud['w_' + c.id] = { x: cx, y: cy, w: cw, h: chh, fn: () => { if (ok) setWear(c.id); } };
    // knagg og hyssing, og en stoffbit (lapp) med sydd kant som pynten ligger på
    const kx = cx + cw / 2, ky = cy - 3;
    ctx.strokeStyle = '#9C7A55'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(cx + 12, cy + 3); ctx.moveTo(kx, ky); ctx.lineTo(cx + cw - 12, cy + 3); ctx.stroke();
    ctx.fillStyle = UI_INK; inkRR(ctx, cx, cy, cw, chh, 10, on ? 2 : 1.3, 300 + i, 0.3);
    ctx.fillStyle = on ? '#FFE7A8' : '#FFFBF2'; rr(cx, cy, cw, chh, 10); ctx.fill();
    runningStitch(rrPoints(cx + 4, cy + 4, cw - 8, chh - 8, 7, 1), on ? '#E2B24E' : '#E8D6B8', 77 + i);
    ctx.fillStyle = '#7A5636'; circle(ctx, kx, ky, 3.4); ctx.fillStyle = '#A57A52'; circle(ctx, kx - 0.6, ky - 0.7, 2); nail(kx, ky);
    ctx.save(); ctx.translate(cx + cw / 2, cy + 36); ctx.scale(1.25, 1.25); if (!ok) ctx.globalAlpha = 0.3;
    birdShape('normal', c.id); ctx.restore(); ctx.globalAlpha = 1;
    if (ok) text(c.label, cx + cw / 2, cy + 73, 9, { color: UI_INK, shadow: false, weight: 600 });
    else {
      text(c.gold ? 'Gull i én runde' : `${c.need} poeng`, cx + cw / 2, cy + 73, 9, { color: WOOD_TEXT, shadow: false, weight: 600 });
      ctx.fillStyle = UI_INK; rr(cx + cw - 19, cy + 11, 10, 8, 2); ctx.fill();   // liten hengelås
      ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx + cw - 14, cy + 11, 3, Math.PI, 0); ctx.stroke();
    }
  });
  // sidebytte: tegnede piler og prikker (ingen tegn eller emoji)
  const ny = py + ph - 22;
  arrowButton('w_prev', px + 18, ny - 11, 34, 22, -1, () => { wardrobePage = (page + pages - 1) % pages; });
  arrowButton('w_next', px + pw - 52, ny - 11, 34, 22, 1, () => { wardrobePage = (page + 1) % pages; });
  for (let i = 0; i < pages; i++) { ctx.fillStyle = i === page ? UI_INK : hexA(UI_INK, 0.25); circle(ctx, W / 2 + (i - (pages - 1) / 2) * 12, ny, 3.2); }
  button('w_done', (W - 120) / 2, py + ph + 14, 120, 36, 'Ferdig', () => { wardrobe = false; }, { size: 15 });
}
function arrowButton(key, x, y, w, h, dir, fn) {
  hud[key] = { x, y, w, h, fn };
  const pk = press.key === key ? (time - press.t) / 0.22 : 1, s = pk < 1 && !reduceMotion ? 1 - 0.1 * Math.sin(Math.PI * pk) : 1;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s);
  ctx.fillStyle = UI_INK; inkRR(ctx, -w / 2, -h / 2, w, h, h / 2, 1.4, seedOf(key), 0.3);
  ctx.fillStyle = '#FFF1D6'; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = UI_INK; ctx.lineJoin = 'round'; ctx.beginPath();
  ctx.moveTo(dir * 5, 0); ctx.lineTo(-dir * 3, -5); ctx.lineTo(-dir * 3, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// ikonknapp: et rundt trestykke (som snittflaten på stammene) med bark, årringer og et tegnet ikon
function logButton(key, cx, cy, r, icon, fn, on = true) {
  hud[key] = { x: cx - r, y: cy - r, w: r * 2, h: r * 2, fn };
  const pk = press.key === key ? (time - press.t) / 0.22 : 1, sc = pk < 1 && !reduceMotion ? 1 - 0.1 * Math.sin(Math.PI * pk) : 1;
  // trestykket er likt hvert bilde (per ikon og av/på): tegnes én gang og gjenbrukes
  // flaten er hele trestykket (2r × 2r); skyggen under får plass i kanten rundt
  const L = cachedSurface('log', r * 2, r * 2, seedOf(key), `${icon.name}|${on}`, (px, py) => paintLog(px + r, py + r, r, icon, on, seedOf(key)));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.drawImage(L.c, -r - L.pad, -r - L.pad, L.w, L.h); ctx.restore();
}
function paintLog(cx, cy, r, icon, on, seed) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = hexA(UI_INK, 0.25); ctx.beginPath(); ctx.ellipse(0, r * 0.25 + 2.5, r, r * 0.95, 0, 0, 7); ctx.fill();
  ctx.fillStyle = UI_INK; inkCircle(ctx, 0, 0, r, 1.5, seed, 0.35);
  ctx.fillStyle = '#7A5636'; circle(ctx, 0, 0, r);                       // bark
  ctx.fillStyle = on ? '#F2D9AE' : '#DCCDB6'; circle(ctx, 0, 0, r - 3.2);  // snittflaten
  ctx.strokeStyle = on ? 'rgba(176,128,78,.45)' : 'rgba(140,120,100,.35)'; ctx.lineWidth = 0.8;
  for (const k of [0.78, 0.55, 0.3]) { ctx.beginPath(); ctx.ellipse(0.6, 0.4, (r - 3.2) * k, (r - 3.2) * k * 0.94, 0.3, 0, 7); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(0, 0, r - 3.2, -2.6, -0.8); ctx.arc(0, 0, r - 7, -0.8, -2.6, true); ctx.fill();   // flatt lys oppe til høyre
  ctx.strokeStyle = on ? UI_INK : hexA(UI_INK, 0.55); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  icon(r * 0.5);
  if (!on) { ctx.strokeStyle = '#B5503C'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-r * 0.48, r * 0.48); ctx.lineTo(r * 0.48, -r * 0.48); ctx.stroke(); }   // av: en skrå strek over
  ctx.restore();
}
// ikonene (tegnet med streker, ingen tegn): høyttaler, note, sol, måne og pause
const ICONS = {
  sound: k => { ctx.beginPath(); ctx.moveTo(-k * 0.9, -k * 0.35); ctx.lineTo(-k * 0.45, -k * 0.35); ctx.lineTo(0, -k * 0.85); ctx.lineTo(0, k * 0.85); ctx.lineTo(-k * 0.45, k * 0.35); ctx.lineTo(-k * 0.9, k * 0.35); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(k * 0.15, 0, k * 0.45, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(k * 0.15, 0, k * 0.85, -0.8, 0.8); ctx.stroke(); },
  music: k => { ctx.beginPath(); ctx.ellipse(-k * 0.35, k * 0.55, k * 0.36, k * 0.27, -0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-k * 0.02, k * 0.5); ctx.lineTo(-k * 0.02, -k * 0.85); ctx.quadraticCurveTo(k * 0.35, -k * 0.55, k * 0.7, -k * 0.35); ctx.stroke(); },
  sun: k => { ctx.beginPath(); ctx.arc(0, 0, k * 0.42, 0, 7); ctx.fill(); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * k * 0.65, Math.sin(a) * k * 0.65); ctx.lineTo(Math.cos(a) * k * 0.92, Math.sin(a) * k * 0.92); } ctx.stroke(); },
  moon: k => {   // sigd: hel sirkel minus en forskjøvet sirkel, klippet til den første
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, k * 0.78, 0, 7); ctx.clip();
    ctx.beginPath(); ctx.rect(-k, -k, k * 2, k * 2); ctx.arc(k * 0.42, -k * 0.22, k * 0.62, 0, 7); ctx.fill('evenodd'); ctx.restore(); },
  pause: k => { rr(-k * 0.5, -k * 0.6, k * 0.32, k * 1.2, 1.5); ctx.fill(); rr(k * 0.18, -k * 0.6, k * 0.32, k * 1.2, 1.5); ctx.fill(); }
};
function drawPauseButton(x, y, s) {
  logButton('pause', x + s / 2, y + s / 2, s / 2, ICONS.pause, pauseGame);
}
function drawPauseOverlay(groundY) {
  ctx.fillStyle = 'rgba(40,28,50,.38)'; ctx.fillRect(0, 0, W, H);
  if (resumeT > 0) {   // nedtelling 3-2-1 før spillet fortsetter
    const n = Math.ceil(resumeT / 0.5), f = (resumeT % 0.5) / 0.5, pop = 1 + f * f * 0.5;
    ctx.save(); ctx.translate(W / 2, groundY * 0.42); ctx.scale(pop, pop); text(String(n), 0, 0, 56, { color: '#FFD27A', alpha: 0.4 + 0.6 * (1 - f * f), stroke: true }); ctx.restore();
    return;
  }
  const cy = groundY * 0.36, bw = 120, bh = 38, y = cy + 40;
  birchBark((W - 200) / 2, cy - 38, 200, 212, 8128);   // et stykke bjørkenever bak pausemenyen
  stitchHeading('Pause', W / 2, cy - 6, 3.6, 'gold');
  rosemal(W / 2, cy + 22, 1, false);
  button('resume', (W - bw) / 2, y, bw, bh, 'Fortsett', resumeGame, { size: 15 });
  button('pmenu', (W - bw) / 2, y + bh + 14, bw, bh, 'Meny', goMenu, { fill: '#FFF8EC', size: 15 });
  const jl = journeyLines(score, homeReached());   // hvor på veien hjem fuglen er
  text(jl.line.replace('Du kom', 'Du er kommet'), W / 2, y + bh * 2 + 34, 11, { color: UI_INK, shadow: false, weight: 600 });
  if (jl.next) text(jl.next, W / 2, y + bh * 2 + 49, 10, { color: WOOD_TEXT, shadow: false, weight: 600 });
}

/* ---------- Reisen hjem: veiskilt, hytta og fuglebrettet ---------- */
// veiskilt ved stien: en stolpe med en pilformet planke og stedsnavnet malt på
function roadSign(x, groundY, name, seed) {
  ctx.font = '700 9px Fredoka, system-ui, sans-serif';
  const bw = Math.ceil(ctx.measureText(name).width) + 20, bh = 15, postH = 36, w = bw + 2, h = postH;
  const L = cachedSurface('skilt', w, h, seed, `${name}|${T.skyTop}`, (ox, oy) => paintRoadSign(ox, oy, bw, bh, postH, name, seed));
  ctx.drawImage(L.c, x - w / 2 - L.pad, groundY + 3 - h - L.pad, L.w, L.h);
}
function paintRoadSign(ox, oy, bw, bh, postH, name, seed) {
  const r = rng(seed), px = ox + bw * 0.42;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = tc('#8A6A4A'); ctx.strokeStyle = T.ink; ctx.lineWidth = 1;
  ctx.fillRect(px - 1.8, oy + 4, 3.6, postH - 4); ctx.strokeRect(px - 1.8, oy + 4, 3.6, postH - 4);
  ctx.fillStyle = hexA(T.ink, 0.25); ctx.beginPath(); ctx.ellipse(px, oy + postH, 6, 1.6, 0, 0, 7); ctx.fill();   // tue rundt foten
  const y0 = oy + 2 + (r() - 0.5) * 1.2, tip = ox + bw;   // planken heller en anelse, som ekte skilt
  ctx.save(); ctx.translate(ox + bw / 2, y0 + bh / 2); ctx.rotate((r() - 0.5) * 0.06); ctx.translate(-(ox + bw / 2), -(y0 + bh / 2));
  ctx.beginPath(); ctx.moveTo(ox + 1, y0); ctx.lineTo(tip - 7, y0); ctx.lineTo(tip, y0 + bh / 2); ctx.lineTo(tip - 7, y0 + bh); ctx.lineTo(ox + 1, y0 + bh); ctx.closePath();
  ctx.fillStyle = tc(WOOD.a); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = T.ink; ctx.stroke();
  ctx.strokeStyle = WOOD.grain; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(ox + 3, y0 + 3.5); ctx.lineTo(tip - 9, y0 + 3 + r()); ctx.moveTo(ox + 4, y0 + bh - 3); ctx.lineTo(tip - 10, y0 + bh - 3.5); ctx.stroke();
  ctx.font = '700 9px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = tc(WOOD_TEXT); ctx.fillText(name, ox + (bw - 6) / 2 + 1, y0 + bh / 2 + 0.5);
  ctx.restore();
  ctx.fillStyle = tc('#6B5A4C'); circle(ctx, px, y0 + bh / 2, 1.2);   // spikeren som holder planken
}
// hytta med fuglebrettet foran: falurøde tømmervegger, hvite vindskier, torvtak og lys i vinduene om kvelden
// (bildene hurtigbufres per palett, så den gamle tiden under en krysstoning får sine egne farger)
const HOME_W = 196, HOME_H = 112, FEEDER_X = 24;   // fuglebrettets stolpe står FEEDER_X fra venstre kant
function drawHome(x, groundY) {
  const L = cachedSurface('hjem', HOME_W, HOME_H, 60, T.skyTop, (ox, oy) => paintHome(ox, oy));
  ctx.drawImage(L.c, x - FEEDER_X - L.pad, groundY + 3 - HOME_H - L.pad, L.w, L.h);
  // røyk fra pipa: små dotter som stiger og blekner (ingen jevn sinus: hver dott har sin egen fase)
  if (!reduceMotion) for (let i = 0; i < 4; i++) {
    const k = ((time * 0.35 + i / 4) % 1), sx = x - FEEDER_X + 148 + k * 10 + Math.sin(i * 2.1) * 2, sy = groundY + 3 - HOME_H + 4 - k * 34;
    ctx.fillStyle = hexA(T.night ? '#B9B4D8' : '#FFFFFF', 0.45 * (1 - k)); circle(ctx, sx, sy, 2.5 + k * 4);
  }
}
function paintHome(ox, oy) {
  const gy = oy + HOME_H - 3, r = rng(60), fx = ox + FEEDER_X;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ink = (lw = 1.2) => { ctx.strokeStyle = T.ink; ctx.lineWidth = lw; };
  // hytta
  const cx = ox + 62, cw = 124, wallH = 44, wy = gy - wallH;
  ctx.fillStyle = hexA(T.ink, 0.2); ctx.beginPath(); ctx.ellipse(cx + cw / 2, gy, cw * 0.58, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = T.cabin; ctx.fillRect(cx, wy, cw, wallH); ink(); ctx.strokeRect(cx, wy, cw, wallH);
  ctx.strokeStyle = T.cabinDark; ctx.lineWidth = 0.8; ctx.beginPath();
  for (let y = wy + 5; y < gy - 1; y += 5) { ctx.moveTo(cx + 1, y + (r() - 0.5) * 0.6); ctx.lineTo(cx + cw - 1, y + (r() - 0.5) * 0.6); }
  ctx.stroke();
  ctx.fillStyle = tc('#FBF6EE'); ctx.fillRect(cx, wy, 4, wallH); ctx.fillRect(cx + cw - 4, wy, 4, wallH);   // hvite hjørnebord
  ink(0.8); ctx.strokeRect(cx, wy, 4, wallH); ctx.strokeRect(cx + cw - 4, wy, 4, wallH);
  const win = (x, y) => {
    ctx.fillStyle = tc('#FBF6EE'); ctx.fillRect(x - 2, y - 2, 22, 20); ink(0.9); ctx.strokeRect(x - 2, y - 2, 22, 20);
    ctx.fillStyle = T.windowLit ? '#FFD47E' : T.window; ctx.fillRect(x, y, 18, 16);
    if (T.windowLit) { ctx.fillStyle = 'rgba(255,236,170,.5)'; ctx.fillRect(x + 1, y + 1, 7, 6); }
    ctx.fillStyle = tc('#FBF6EE'); ctx.fillRect(x + 8, y, 2, 16); ctx.fillRect(x, y + 7, 18, 2);
    ink(0.8); ctx.strokeRect(x, y, 18, 16);
  };
  win(cx + 14, wy + 10); win(cx + 88, wy + 10);
  ctx.fillStyle = tc('#7A4A32'); ctx.fillRect(cx + 50, wy + 8, 20, wallH - 8); ink(0.9); ctx.strokeRect(cx + 50, wy + 8, 20, wallH - 8);   // dør
  ctx.strokeStyle = hexA(T.ink, 0.5); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(cx + 56.5, wy + 10); ctx.lineTo(cx + 56.5, gy - 1); ctx.moveTo(cx + 63.5, wy + 10); ctx.lineTo(cx + 63.5, gy - 1); ctx.stroke();
  ctx.fillStyle = tc('#E8C46A'); circle(ctx, cx + 66, wy + 28, 1.2);
  ctx.fillStyle = tc('#9C8A76'); ctx.fillRect(cx + 46, gy - 3, 28, 3); ink(0.8); ctx.strokeRect(cx + 46, gy - 3, 28, 3);   // steinhelle foran døra
  // torvtak: mørke bord, så en tykk grønn kant med gress og noen blomster
  const ry = wy - 2, top = wy - 24;
  ctx.fillStyle = T.roof; ctx.beginPath(); ctx.moveTo(cx - 8, ry); ctx.lineTo(cx + 10, top); ctx.lineTo(cx + cw - 10, top); ctx.lineTo(cx + cw + 8, ry); ctx.closePath(); ctx.fill(); ink(); ctx.stroke();
  ctx.fillStyle = tc('#FBF6EE'); ctx.beginPath(); ctx.moveTo(cx - 8, ry); ctx.lineTo(cx + 10, top); ctx.lineTo(cx + 13, top); ctx.lineTo(cx - 4, ry); ctx.closePath(); ctx.fill(); ink(0.8); ctx.stroke();   // vindski
  ctx.fillStyle = T.moss; ctx.beginPath(); ctx.moveTo(cx + 8, top + 2);
  for (let x = cx + 8; x <= cx + cw - 8; x += 4) ctx.lineTo(x, top - 1.5 - r() * 2.5);
  ctx.lineTo(cx + cw - 8, top + 3); ctx.closePath(); ctx.fill(); ink(0.9); ctx.stroke();
  ctx.strokeStyle = T.grassDark; ctx.lineWidth = 0.8; ctx.beginPath();
  for (let x = cx + 12; x < cx + cw - 10; x += 5 + r() * 4) { ctx.moveTo(x, top - 1); ctx.lineTo(x + (r() - 0.5) * 2, top - 5 - r() * 3); }
  ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = tc(['#FFFDF6', '#F6CF45', '#E58BB0'][i % 3]); circle(ctx, cx + 18 + r() * (cw - 36), top - 3 - r() * 3, 1.2); }
  const chx = cx + 84;   // pipe av stein
  ctx.fillStyle = tc('#BDB3A6'); ctx.fillRect(chx, top - 14, 11, 14); ink(0.9); ctx.strokeRect(chx, top - 14, 11, 14);
  ctx.strokeStyle = hexA(T.ink, 0.45); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(chx, top - 9); ctx.lineTo(chx + 11, top - 9); ctx.moveTo(chx + 5, top - 9); ctx.lineTo(chx + 5, top - 4); ctx.stroke();
  // fuglebrettet: stolpe, brett med kant og frø, og et lite saltak på to stolper
  const tray = FEEDER.tray, ty = gy - FEEDER.pole - 4;
  ctx.fillStyle = tc('#8A6A4A'); ctx.fillRect(fx - 2.2, ty + 4, 4.4, FEEDER.pole); ink(1); ctx.strokeRect(fx - 2.2, ty + 4, 4.4, FEEDER.pole);
  ctx.strokeStyle = tc('#8A6A4A'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx - 1, ty + 18); ctx.lineTo(fx - 9, ty + 5); ctx.moveTo(fx + 1, ty + 18); ctx.lineTo(fx + 9, ty + 5); ctx.stroke();   // skråstivere
  ctx.fillStyle = tc(WOOD.a); ctx.fillRect(fx - tray / 2, ty, tray, 4); ink(1); ctx.strokeRect(fx - tray / 2, ty, tray, 4);
  ctx.fillStyle = tc('#C9A06A'); for (let i = 0; i < 9; i++) circle(ctx, fx - tray / 2 + 3 + r() * (tray - 6), ty - 0.6, 0.9);   // frø på brettet
  const postTop = ty - 36;
  ctx.strokeStyle = tc('#8A6A4A'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx - tray / 2 + 1.5, ty); ctx.lineTo(fx - tray / 2 + 1.5, postTop + 3); ctx.moveTo(fx + tray / 2 - 1.5, ty); ctx.lineTo(fx + tray / 2 - 1.5, postTop + 3); ctx.stroke();
  ctx.fillStyle = T.cabin; ctx.beginPath(); ctx.moveTo(fx - tray / 2 - 5, postTop + 6); ctx.lineTo(fx, postTop - 6); ctx.lineTo(fx + tray / 2 + 5, postTop + 6); ctx.lineTo(fx + tray / 2 + 2, postTop + 8); ctx.lineTo(fx, postTop - 2); ctx.lineTo(fx - tray / 2 - 2, postTop + 8); ctx.closePath(); ctx.fill(); ink(1); ctx.stroke();
  paperOn(ctx, 0.35);
}
function drawJourney(groundY) {
  for (const sg of signs) {
    const x = ip(sg.px, sg.x);
    if (x > -60 && x < W + 60) roadSign(x, groundY, sg.name, sg.seed);
  }
  if (home) { const x = ip(home.px, home.x); if (x - FEEDER_X < W + 10 && x - FEEDER_X + HOME_W > -10) drawHome(x, groundY); }
}
// den broderte ruten hjem på treskiltet: en sting-sti med et merke per sted, hytta i enden og fuglen der den kom
function drawRoute(x0, x1, y, reached, homeNow) {
  const px = at => x0 + (x1 - x0) * at / HOME, pts = [];
  for (let x = x0; x <= x1 + 0.1; x += 3) pts.push({ x, y: y + Math.sin((x - x0) * 0.09) * 1.3 });
  runningStitch(pts, '#9C7A55', 77);
  for (const pl of ROUTE.slice(0, -1)) {
    const on = homeNow || pl.at <= reached, x = px(pl.at), yy = y + Math.sin((x - x0) * 0.09) * 1.3;
    ctx.fillStyle = on ? '#E9A23B' : WOOD.a; ctx.strokeStyle = UI_INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, yy, on ? 2.6 : 2.2, 0, 7); ctx.fill(); ctx.stroke();
  }
  // hytta i enden
  ctx.fillStyle = '#C9503B'; ctx.fillRect(x1 - 4, y - 3, 8, 6); ctx.strokeStyle = UI_INK; ctx.lineWidth = 1; ctx.strokeRect(x1 - 4, y - 3, 8, 6);
  ctx.fillStyle = '#86C35C'; ctx.beginPath(); ctx.moveTo(x1 - 6, y - 2.5); ctx.lineTo(x1, y - 7.5); ctx.lineTo(x1 + 6, y - 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  // fuglen: en liten blåmeis-prikk som står der reisen sluttet
  const bx = px(homeNow ? HOME : Math.min(reached, HOME)), by = y - 7;
  ctx.fillStyle = '#F6CF45'; circle(ctx, bx, by, 3.4); ctx.fillStyle = '#4A93DA'; ctx.beginPath(); ctx.arc(bx, by, 3.4, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = UI_INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 3.4, 0, 7); ctx.stroke();
}
const homeReached = () => !!home && (home.phase === 'rest' || home.phase === 'done');

function drawWorld(groundY, pv, qv) {
  drawSky(groundY);
  drawScenery(groundY);
  drawMotes();
  for (const p of pv) drawTrunkShadow(p, groundY);
  for (const p of pv) drawTrunk(p, groundY);
  for (const q of qv) drawPower(q);
  drawGround(groundY);
  drawLandmarks(groundY, 1);
  drawJourney(groundY);
  drawBirdGroundShadow(groundY);
  drawForeground();   // forgrunnen: nærmest kameraet, raskest
}
// fuglens skygge på bakken: mindre og svakere jo høyere den flyr (et sterkt dybdesignal)
function drawBirdGroundShadow(groundY) {
  const bx = ip(bird.px, bird.x), by = ip(bird.py, bird.y), hgt = groundY - by - BODY_R;
  if (hgt < 0 || hgt > 320) return;
  const k = 1 - hgt / 320;
  ctx.fillStyle = hexA(T.ink, 0.22 * k * k);
  ctx.beginPath(); ctx.ellipse(bx + 2, groundY + 2.5, BODY_R * (0.55 + 0.6 * k), 2.6 * (0.5 + 0.5 * k), 0, 0, 7); ctx.fill();
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
    const ty = topY + 40 + (reduceMotion ? 0 : keyframes([[0, -22], [0.6, 0, 'back']], menuT));   // faller på plass når menyen åpnes, står så stille
    const LG = scene.logo; ctx.drawImage(LG.c, Math.round(W / 2 - LG.w / 2), ty - 24, LG.w, LG.h);
    text(`${SEASONS[seasonName].label} i bjørkeskogen`, W / 2, ty + 34, 13, { weight: 600, stroke: true, shadow: false });
    if (wardrobe) { drawWardrobe(groundY); return finishFrame(groundY); }
    text('Trykk for å flakse', W / 2, groundY * 0.58, 15, { weight: 600, stroke: true });
    if (D.zen) text('Zen: ingen poengjag – bare kos', W / 2, groundY * 0.58 + 24, 12, { weight: 600, color: '#BFE6D9', stroke: true });
    else if (best > 0) text(`Beste (${D.label.toLowerCase()}): ${best}`, W / 2, groundY * 0.58 + 24, 12, { weight: 600, color: '#FFD27A', stroke: true });
    const bw = 62, bh = 30, gapX = 6, total = bw * 4 + gapX * 3, x0 = (W - total) / 2, y0 = groundY * 0.58 + 52;
    text('Vanskelighet', W / 2, y0 - 12, 11, { weight: 600, stroke: true, shadow: false });
    let i = 0;
    for (const k in DIFFS) { const on = k === diffName; button('d_' + k, x0 + i * (bw + gapX), y0, bw, bh, DIFFS[k].label, () => setDiff(k), { fill: DIFFS[k].color, active: on, size: 12 }); i++; }
    button('wardrobe', (W - 132) / 2, y0 + bh + 12, 132, 28, 'Garderobe', () => { wardrobe = true; wardrobePage = Math.floor(COSMETICS.findIndex(c => c.id === wear) / WARDROBE_PAGE); }, { fill: '#D9C6F7', size: 12 });
    const y3 = groundY + 46;   // tre trestykker nede til venstre, litt forskjøvet i høyden
    logButton('sound', 34, y3, 19, ICONS.sound, () => Sound.toggleSfx(), !Sound.sfxMuted);
    logButton('music', 80, y3 + 6, 19, ICONS.music, () => Sound.toggleMusic(), !Sound.musMuted);
    logButton('theme', 126, y3 - 2, 19, themeName === 'day' ? ICONS.sun : ICONS.moon, toggleTheme);
  }

  if (state === State.READY) {
    stitchHeading('Klar?', W / 2, topY + 40, 3.8, 'gold');
    text(D.label, W / 2, topY + 70, 13, { weight: 600, color: D.color, stroke: true, shadow: false });
    text('Fra fjellet hjem til hytta', W / 2, topY + 90, 12, { weight: 600, color: '#FFF1D6', stroke: true, shadow: false });
    const hy = groundY * 0.42 + 30 + (reduceMotion ? 0 : loopKeys([[0, 0], [0.55, 0], [0.64, 4, 'in'], [0.8, 0, 'out'], [1.2, 0]], time));   // trykker, venter, trykker
    ctx.fillStyle = '#FFF8EC'; ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.5; rr(W / 2 + 36, hy, 20, 30, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = UI_INK; rr(W / 2 + 44, hy + 5, 4, 10, 2); ctx.fill();
    text('Trykk', W / 2, groundY * 0.42 + 80, 14, { weight: 600, stroke: true });
  }

  if (state === State.PLAY || state === State.DEAD) {
    const ds = time - scoreT, pop = ds < 0.8 && !reduceMotion ? 1 + 0.45 * Math.exp(-ds * 7) * Math.cos(ds * 22) : 1;
    ctx.save(); ctx.translate(W / 2, topY + 16); ctx.scale(pop, pop); text(String(score), 0, 0, 40, { stroke: true }); ctx.restore();
    // et nytt sted på veien hjem: navnet står kort under poengene (skiltet står i verden)
    const pk = time - placeT, showPlace = placeIdx > 0 && pk < 3 && !home;
    if (showPlace) text(ROUTE[placeIdx].name, W / 2, topY + 46, 13, { weight: 600, stroke: true, shadow: false, color: '#FFF1D6', alpha: Math.min(1, pk * 4, (3 - pk) * 2) });
    drawActiveHud(topY + 46 + (showPlace ? 18 : 0));
    if (home && home.phase === 'rest') {
      const hy = Math.max(topY + 90, groundY * 0.32);   // under månen og sola
      stitchHeading('Hjemme!', W / 2, hy, 3.4, 'gold', Math.min(1, home.t * 3));
      if (home.t > 0.9) text('Trykk for å fly videre', W / 2, hy + 34, 14, { weight: 600, stroke: true, alpha: Math.min(1, (home.t - 0.9) * 3) });
    }
    if (state === State.PLAY && !paused) drawPauseButton(W - 46, safeTop + 12, 34);
  }

  if (state === State.OVER) {
    const e = Math.min(1, overT / 0.55), ease = easeOutCubic(e), back = reduceMotion ? ease : easeOutBack(e);
    const pw = 236, ph = 172, pxx = (W - pw) / 2, py = groundY * 0.46 - ph / 2 + (1 - back) * 80;
    ctx.fillStyle = `rgba(40,28,50,${(0.22 * ease).toFixed(3)})`; ctx.fillRect(0, 0, W, H);   // demp bakgrunnen bak panelet
    const tk = Math.min(1, Math.max(0, (overT - 0.1) / 0.45)), ts = reduceMotion ? 1 : easeOutBack(tk);
    // skiltet henger i to tau og svinger litt etter at det har falt på plass (pendel rundt festet langt oppe)
    const swing = reduceMotion ? 0 : keyframes([[0.3, 0], [0.55, 0.026, 'out'], [0.85, -0.016, 'inOut'], [1.15, 0.008, 'inOut'], [1.45, 0, 'inOut']], overT);
    ctx.save(); ctx.translate(W / 2, py - 300); ctx.rotate(swing); ctx.translate(-W / 2, -(py - 300));
    rope(pxx + 14, -20, py + 4); rope(pxx + pw - 14, -20, py + 4);   // utenfor tittelen
    ctx.save(); ctx.translate(W / 2, py - 34); ctx.scale(ts, ts);
    stitchHeading(overTitle, 0, 0, 3.4, newBest ? 'gold' : 'coral', Math.min(1, tk * 2));
    ctx.restore();
    woodSign(pxx, py, pw, ph, 2024);
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
        text(`${10 - score} til bronse`, mx, py + 114, 9, { color: WOOD_TEXT, shadow: false, weight: 600, alpha: mk });
      }
      if (m) nail(mx, py + 41);   // merket er spikret fast på skiltet
      ctx.globalAlpha = 1;
    }
    const shown = overShown;
    text('Poeng', pxx + pw - 28, py + 30, 12, { align: 'right', color: WOOD_TEXT, shadow: false, weight: 600 });
    text(String(shown), pxx + pw - 28, py + 54, 28, { align: 'right', color: UI_INK, shadow: false });
    text('Beste', pxx + pw - 28, py + 84, 12, { align: 'right', color: WOOD_TEXT, shadow: false, weight: 600 });
    text(String(best), pxx + pw - 28, py + 108, 28, { align: 'right', color: UI_INK, shadow: false });
    if (newBest && shown === score) {
      ctx.fillStyle = '#FFA28C'; rr(pxx + pw - 120, py + 74, 34, 18, 9); ctx.fill(); ctx.strokeStyle = UI_INK; ctx.lineWidth = 1.4; ctx.stroke();
      text('Ny!', pxx + pw - 103, py + 83.5, 11, { shadow: false, weight: 600, color: '#FFFDF6', stroke: true });
    }
    ctx.fillStyle = D.color; ctx.strokeStyle = UI_INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(pxx + 30, py + 22, 3.6, 0, 7); ctx.fill(); ctx.stroke();   // malt prikk i nivåets farge
    text(D.label, pxx + 38, py + 22, 11, { color: UI_INK, shadow: false, weight: 600, align: 'left' });
    // reisen: hvor langt fuglen kom, og ruten hjem brodert på skiltet (fuglen flytter seg mens poengene telles)
    const wasHome = homeReached(), jl = journeyLines(score, wasHome);
    runningStitch([{ x: pxx + 18, y: py + 122 }, { x: pxx + pw - 18, y: py + 122 }], 'rgba(156,122,85,.55)', 12);
    text(jl.line, W / 2, py + 135, 12, { color: UI_INK, shadow: false, weight: 600 });
    drawRoute(pxx + 26, pxx + pw - 26, py + 154, Math.min(shown, score), wasHome && shown >= HOME);
    if (jl.next) text(jl.next, W / 2, py + 165, 9.5, { color: WOOD_TEXT, shadow: false, weight: 600 });
    ctx.restore();   // slutt på svingen
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
