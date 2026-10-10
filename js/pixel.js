/* Pixelfugl – pikselgrunnlaget: arkadepaletten, en egen 5 × 7-pikselskrift og sprites fra rutenett.
   Alt tegnes i koden (ingen fontfiler eller bilder). Hver kunstpiksel tegnes som et rektangel med kantene lagt
   på hele skjermpiksler, så pikslene blir like store og skarpe også når skjermen har en skjev skalering.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

const ARC = {
  bg: '#000000', wall: '#2B3CFF', wallLight: '#6F7BFF', wallFill: '#03082A', wallDim: '#0B1350', bgMaze: '#09103C',
  dot: '#FFC7A1', white: '#FFFFFF', yellow: '#FFE042', red: '#FF4E4E', cyan: '#45E3FF', pink: '#FF8FD0',
  orange: '#FFA640', green: '#5BEA7A', grey: '#8A90B8', dark: '#14183A'
};
const PX = 2;   // én kunstpiksel = 2 logiske px (figurer, rammer og vanlig tekst)

/* ---------- Skrift ----------
   Store bokstaver, 7 piksler høye (Å har ringen én rad over, komma går én rad under). Små bokstaver tegnes
   som store. Bredden varierer (smalt for I, punktum og kolon), med én piksel luft mellom tegnene. */
const GLYPHS = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  B: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
  C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
  G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXXX'],
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  I: ['XXX', '.X.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
  J: ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  N: ['X...X', 'X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
  Q: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  V: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
  W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'X.X.X', '.X.X.'],
  X: ['X...X', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', 'X...X'],
  Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
  Z: ['XXXXX', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],
  'Æ': ['.XXXX', 'X.X..', 'X.X..', 'XXXXX', 'X.X..', 'X.X..', 'X.XXX'],
  'Ø': ['.XXX.', 'X..XX', 'X.X.X', 'X.X.X', 'X.X.X', 'XX..X', '.XXX.'],
  'Å': ['..X..', '.X.X.', '.XXX.', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],   // ringen én rad over
  'É': ['...X.', 'XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],   // aksenten én rad over
  '0': ['.XXX.', 'X...X', 'X...X', 'X.X.X', 'X...X', 'X...X', '.XXX.'],               // null med prikk (ulik O og Ø)
  '1': ['.X.', 'XX.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
  '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  '3': ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['.XXX.', 'X....', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '....X', '.XXX.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', 'X'],
  ',': ['..', '..', '..', '..', '..', '.X', '.X', 'X.'],                                  // halen én rad under
  '!': ['X', 'X', 'X', 'X', 'X', '.', 'X'],
  '?': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.....', '..X..'],
  ':': ['.', 'X', '.', '.', '.', 'X', '.'],
  '-': ['...', '...', '...', 'XXX', '...', '...', '...'],
  '+': ['.....', '..X..', '..X..', 'XXXXX', '..X..', '..X..', '.....'],
  '/': ['....X', '...X.', '...X.', '..X..', '.X...', '.X...', 'X....'],
  '·': ['.', '.', '.', 'X', '.', '.', '.'],
  '×': ['.....', '.....', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X'],
  "'": ['X', 'X', '.', '.', '.', '.', '.'],
  '(': ['..X', '.X.', 'X..', 'X..', 'X..', '.X.', '..X'],
  ')': ['X..', '.X.', '..X', '..X', '..X', '.X.', 'X..'],
  '<': ['...X', '..X.', '.X..', 'X...', '.X..', '..X.', '...X'],
  '>': ['X...', '.X..', '..X.', '...X', '..X.', '.X..', 'X...'],
  '=': ['....', '....', 'XXXX', '....', 'XXXX', '....', '....'],
  '%': ['XX..X', 'XX..X', '...X.', '..X..', '.X...', 'X..XX', 'X..XX']
};
const glyphOf = ch => GLYPHS[ch] || GLYPHS[ch.toUpperCase()] || GLYPHS['?'];
const glyphTop = g => g.length === 8 && g[7].includes('X') && !g[0].includes('X') ? 0 : g.length === 8 ? -1 : 0;   // Å og É: tegnet over, komma: halen under
const glyphW = g => g[0].length;
// bredden på en tekst i kunstpiksler
function pixelTextCells(str) {
  let w = 0;
  for (const ch of str) w += glyphW(glyphOf(ch)) + 1;
  return Math.max(0, w - 1);
}
const pixelTextW = (str, s = PX) => pixelTextCells(str) * s;

/* ---------- Tegning på hele skjermpiksler ----------
   cell(g, x, y, s, R): fyller kunstpikselen (x, y) i et lerret der én kunstpiksel er s logiske px, med kantene
   rundet til skjermpiksler. Da blir pikselrader like brede selv om s × R ikke er et heltall. */
const devEdge = (v, R) => Math.round(v * R);
function cellRect(g, x, y, w, h, s, R) {
  const x0 = devEdge(x * s, R), y0 = devEdge(y * s, R);
  g.fillRect(x0, y0, devEdge((x + w) * s, R) - x0, devEdge((y + h) * s, R) - y0);
}
// ferdige bilder, sist brukt bakerst: når det blir for mange, kastes de som ikke er brukt på lengst
// (bakgrunnen, rammene og logoen brukes hvert bilde og blir aldri kastet midt i spillet)
const pixelCache = new Map(), PIXEL_CACHE_MAX = 700;
function cached(key, make) {
  let c = pixelCache.get(key);
  if (c) { pixelCache.delete(key); pixelCache.set(key, c); return c; }
  c = make(); pixelCache.set(key, c);
  if (pixelCache.size > PIXEL_CACHE_MAX) for (const k of [...pixelCache.keys()].slice(0, 100)) pixelCache.delete(k);
  return c;
}
// et ferdig lerret (i skjermpiksler) med en tekst; skygge = én kunstpiksel ned og til høyre
function pixelTextCanvas(str, s, color, shadow) {
  const R = dpr * scale, up = str.toUpperCase();
  return cached(`t|${up}|${s}|${color}|${shadow || ''}|${R}`, () => {
    const cw = pixelTextCells(up) + (shadow ? 1 : 0), ch = 9 + (shadow ? 1 : 0);   // én rad over (Å) og én under (komma)
    const c = document.createElement('canvas'); c.width = Math.max(1, devEdge(cw * s, R)); c.height = devEdge(ch * s, R);
    const g = c.getContext('2d');
    const paint = (dx, dy, col) => {
      g.fillStyle = col; let x = 0;
      for (const chr of up) {
        const gl = glyphOf(chr), top = glyphTop(gl);
        gl.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'X') cellRect(g, x + i + dx, 1 + top + j + dy, 1, 1, s, R); });
        x += glyphW(gl) + 1;
      }
    };
    if (shadow) paint(1, 1, shadow);
    paint(0, 0, color);
    return { c, w: c.width / R, h: c.height / R, cells: cw };
  });
}
// tekst med pikselskriften; (x, y) = midten av linja (align: center), venstre kant (left) eller høyre kant (right)
function pixelText(str, x, y, { s = PX, color = ARC.white, align = 'center', shadow = null, alpha = 1 } = {}) {
  const T = pixelTextCanvas(String(str), s, color, shadow), R = dpr * scale;
  const w = pixelTextW(String(str).toUpperCase(), s);
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const top = y - 4.5 * s;   // linja er 7 piksler høy, med én rad luft over: midten er 4,5 piksler ned
  const a = ctx.globalAlpha; if (alpha !== 1) ctx.globalAlpha = a * alpha;
  ctx.drawImage(T.c, Math.round(left * R) / R, Math.round(top * R) / R, T.w, T.h);
  if (alpha !== 1) ctx.globalAlpha = a;
  return w;
}

/* ---------- Sprites fra rutenett ----------
   rows: strenger der hvert tegn er en farge i pal ('.' = gjennomsiktig). Lages én gang per størrelse. */
function spriteCanvas(key, rows, pal, s = PX) {
  const R = dpr * scale;
  return cached(`s|${key}|${s}|${R}`, () => {
    const w = rows[0].length, h = rows.length, c = document.createElement('canvas');
    c.width = devEdge(w * s, R); c.height = devEdge(h * s, R);
    const g = c.getContext('2d');
    rows.forEach((row, j) => { for (let i = 0; i < w; i++) { const col = pal[row[i]]; if (col) { g.fillStyle = col; cellRect(g, i, j, 1, 1, s, R); } } });
    return { c, w: c.width / R, h: c.height / R, cw: w, ch: h };
  });
}
// tegn en sprite med øvre venstre hjørne i (x, y), lagt på hele skjermpiksler
function blitSprite(S, x, y) {
  const R = dpr * scale;
  ctx.drawImage(S.c, Math.round(x * R) / R, Math.round(y * R) / R, S.w, S.h);
}
// et lerret der man tegner med kunstpiksler: draw(cell) der cell(x, y, w, h, farge) fyller piksler
function pixelArt(key, cw, ch, draw, s = PX) {
  const R = dpr * scale;
  return cached(`a|${key}|${s}|${R}`, () => {
    const c = document.createElement('canvas'); c.width = devEdge(cw * s, R); c.height = devEdge(ch * s, R);
    const g = c.getContext('2d');
    draw((x, y, w, h, col) => { g.fillStyle = col; cellRect(g, x, y, w, h, s, R); }, g);
    return { c, w: c.width / R, h: c.height / R, cw, ch };
  });
}
// en piksel-sirkel (midtpunktsmetoden): fylt eller som ring, til prikker, kraftprikk og runde hjørner
function pixelDisc(cell, cx, cy, r, col, ring = false) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = x * x + y * y, inside = d <= r * r + r * 0.6;
    if (inside && (!ring || d >= (r - 1) * (r - 1) + (r - 1) * 0.6 + 0.5)) cell(cx + x, cy + y, 1, 1, col);
  }
}

/* ---------- Doble labyrintrammer ----------
   To streker (én kunstpiksel tykke) med to piksler mellomrom og pikselrunde hjørner, som veggene i en
   arkadelabyrint. Brukes til kort, knapper og selve veggene. Lages én gang per størrelse.
   rrCell: 0 = utenfor, 1 = på streken, 2 = innenfor (for en avrundet firkant med øvre venstre hjørne i 0, 0) */
function rrCell(x, y, w, h, rad) {
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const dx = x < rad ? rad - x - 0.5 : x >= w - rad ? x - (w - rad) + 0.5 : 0;
  const dy = y < rad ? rad - y - 0.5 : y >= h - rad ? y - (h - rad) + 0.5 : 0;
  if (dx > 0 && dy > 0) { const d = Math.hypot(dx, dy); return d > rad ? 0 : d > rad - 1.05 ? 1 : 2; }
  return x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 1 : 2;
}
// én dobbel ramme (ytre strek, to piksler luft, indre strek); fill fyller innenfor den indre streken
function paintMaze(cell, x0, y0, w, h, { color = ARC.wall, fill = null, inner = true, r = 4, rows = null } = {}) {
  const ir = Math.max(1, r - 2);
  for (let y = 0; y < h; y++) {
    if (rows && (y < rows[0] || y >= rows[1])) continue;
    for (let x = 0; x < w; x++) {
      const o = rrCell(x, y, w, h, r);
      if (!o) continue;
      if (o === 1) { cell(x0 + x, y0 + y, 1, 1, color); continue; }
      const i = inner && w > 8 && h > 8 ? rrCell(x - 3, y - 3, w - 6, h - 6, ir) : 2;
      if (i === 1) cell(x0 + x, y0 + y, 1, 1, color);
      else if (i === 2 && fill && (inner ? true : true)) cell(x0 + x, y0 + y, 1, 1, fill);
    }
  }
}
function mazeFrame(key, wCells, hCells, opts = {}) {
  const { color = ARC.wall, fill = null, inner = true, r = 4 } = opts;
  return pixelArt(`f|${key}|${wCells}|${hCells}|${color}|${fill}|${inner}|${r}`, wCells, hCells, cell => paintMaze(cell, 0, 0, wCells, hCells, { color, fill, inner, r }));
}
// tegn en dobbel ramme med øvre venstre hjørne i (x, y) og størrelse (w, h) i logiske px (rundet til kunstpiksler)
function frameBox(x, y, w, h, opts = {}) {
  const wc = Math.max(4, Math.round(w / PX)), hc = Math.max(4, Math.round(h / PX));
  blitSprite(mazeFrame(opts.key || 'box', wc, hc, opts), x, y);
}
// et rektangel lagt på hele skjermpiksler (rette streker i veggene og gulvet)
function snapRect(x, y, w, h, color) {
  const R = dpr * scale, x0 = Math.round(x * R), y0 = Math.round(y * R);
  ctx.fillStyle = color; ctx.fillRect(x0 / R, y0 / R, (Math.round((x + w) * R) - x0) / R, (Math.round((y + h) * R) - y0) / R);
}
