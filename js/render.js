/* Pixelfugl – Tegning: labyrinten, veggene, prikkene, arkade-blåmeisen, hytta, introen og retro-skjermen.
   Alt er pikselgrafikk fra js/pixel.js, lagt på hele skjermpiksler.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

const ip = (a, b) => (a === undefined ? b : a + (b - a) * alpha);   // interpolert mellom forrige og nåværende fysikk-steg
const wrap = (v, m) => ((v % m) + m) % m;
const blinkOn = (rate = 4) => reduceMotion || Math.floor(time * rate) % 2 === 0;

/* ---------- Labyrinten i bakgrunnen ----------
   Svake, mørkeblå blokker som i en arkadelabyrint, i en flis som går i ett i bredden. Den glir sakte forbi
   (parallakse), så man ser at fuglen flyr selv om bakgrunnen er svart. */
function bgMaze() {
  const groundY = H - GROUND_H, tw = 168, th = Math.ceil(groundY / PX);   // flisa er 168 kunstpiksler (336 px) bred
  return pixelArt(`bg|${th}`, tw, th, cell => {
    const r = rng(1983), step = 14, cols = tw / step, rowsN = Math.ceil(th / step), used = new Set();
    for (let j = 0; j < rowsN; j++) for (let i = 0; i < cols; i++) {
      if (used.has(`${i},${j}`) || r() < 0.35) continue;
      const bw = 1 + (r() < 0.4 ? 1 : 0) + (r() < 0.15 ? 1 : 0), bh = 1 + (r() < 0.3 ? 1 : 0);
      let ok = true;
      for (let a = 0; a < bw; a++) for (let b = 0; b < bh; b++) if (used.has(`${(i + a) % cols},${j + b}`)) ok = false;
      if (!ok) continue;
      for (let a = 0; a < bw; a++) for (let b = 0; b < bh; b++) used.add(`${(i + a) % cols},${j + b}`);
      const x = i * step + 3, y = j * step + 3, w = bw * step - 6, h = bh * step - 6;
      for (const ox of [0, -tw]) paintMaze(cell, x + ox, y, w, h, { color: ARC.bgMaze, inner: false, r: 3 });
    }
    // svake prikker i korridorene mellom blokkene
    for (let j = 0; j < rowsN; j++) for (let i = 0; i < cols; i++) if (r() < 0.22) cell(i * step + 13, j * step + 13, 1, 1, '#161B3C');
  });
}
function drawBackground(groundY) {
  ctx.fillStyle = ARC.bg; ctx.fillRect(-8, -8, W + 16, H + 16);
  const L = bgMaze(), off = wrap(viewScroll * 0.3, L.w);
  for (let x = -off; x < W; x += L.w) blitSprite(L, x, 0);
}
// gulvet: dobbel strek, en korridor med prikker som glir forbi i spillets fart, og en dobbel strek til
function drawFloor(groundY) {
  ctx.fillStyle = ARC.bg; ctx.fillRect(-8, groundY, W + 16, H - groundY + 8);
  for (const y of [0, 6, 34, 40]) snapRect(-4, groundY + y, W + 8, PX, ARC.wall);
  const off = wrap(viewScroll, 16);
  for (let x = -off + 6; x < W + 8; x += 16) snapRect(x, groundY + 19, 4, 4, 'rgba(255,199,161,.45)');
}

/* ---------- Veggene ----------
   Hver vegg er to doble streker med en pikselrund ende mot åpningen. Endene er ferdig tegnet; de rette
   strekene er rektangler lagt på hele skjermpiksler, så veggen kan være så høy den vil. */
const WALL_C = PIPE_W / PX;   // 28 kunstpiksler bred
function wallCap(color, bottom) {
  return pixelArt(`cap|${color}|${bottom}`, WALL_C, 6, cell => {
    const H2 = 20;   // tegnes som enden av en avrundet firkant som er 20 piksler høy
    for (let y = 0; y < 6; y++) {
      const vy = bottom ? H2 - 6 + y : y;
      for (let x = 0; x < WALL_C; x++) {
        const o = rrCell(x, vy, WALL_C, H2, 4);
        if (!o) continue;
        const i = rrCell(x - 3, vy - 3, WALL_C - 6, H2 - 6, 2);
        cell(x, y, 1, 1, o === 1 || i === 1 ? color : i === 2 ? ARC.wallFill : ARC.bg);
      }
    }
  });
}
// én vegg fra y0 til y1; capAt = 'bottom' (øvre vegg, enden nederst) eller 'top' (nedre vegg)
function drawWall(x, y0, y1, capAt, color) {
  const cap = wallCap(color, capAt === 'bottom'), ch = cap.h;
  const sy0 = capAt === 'top' ? y0 + ch : y0, sy1 = capAt === 'bottom' ? y1 - ch : y1;
  if (sy1 > sy0) {
    snapRect(x + 4 * PX, sy0, (WALL_C - 8) * PX, sy1 - sy0, ARC.wallFill);
    for (const cx of [0, 3, WALL_C - 4, WALL_C - 1]) snapRect(x + cx * PX, sy0, PX, sy1 - sy0, color);
  }
  blitSprite(cap, x, capAt === 'bottom' ? y1 - ch : y0);
}
function drawWalls(pv, groundY) {
  for (const p of pv) {
    if (p.x > W + 4 || p.x + PIPE_W < -4) continue;
    const color = p.glow > 0.4 ? ARC.wallLight : ARC.wall;
    drawWall(p.x, -40, p.top, 'bottom', color);
    drawWall(p.x, p.top + p.gap, groundY + 2, 'top', color);
  }
}

/* ---------- Prikker og ting ---------- */
const dotSprite = () => pixelArt('dot', 3, 3, cell => cell(0, 0, 3, 3, ARC.dot));
const powerDot = () => pixelArt('powerdot', 9, 9, cell => pixelDisc(cell, 4, 4, 4, ARC.dot));
// snegle (sakte) og gyllen eikenøtt (dobbel): små pikselfigurer
const SNAIL = ['....pppp..', '...pPPPPp.', '..pPpppPPp', '..pPpPPpPp', '..pPpppPpp', 'g..pPPPPp.', 'gggggggggg', '.gggggggg.'];
const ACORN = ['...kk...', '.oooooo.', 'oOOOOOOo', 'oooooooo', '.yYYYYy.', '.yYYYYy.', '..yYYy..', '...yy...'];
const itemSprite = kind => kind === 'slow'
  ? spriteCanvas('snail', SNAIL, { p: '#7A3FC8', P: '#C78BFF', g: '#9BE07A' })
  : spriteCanvas('acorn', ACORN, { k: '#7A4A20', o: '#9A6A30', O: '#C48A3E', y: '#E8A82E', Y: '#FFD25A' });
function drawDots(pv) {
  const D2 = dotSprite();
  for (const p of pv) for (const d of p.dots) {
    if (d.eaten) continue;
    const x = p.x + PIPE_W / 2 + d.dx, y = p.top + p.gap / 2;
    if (x > -6 && x < W + 6) blitSprite(D2, x - D2.w / 2, y - D2.h / 2);
  }
}
function drawPower(q) {
  if (q.kind === 'shield') {   // kraftprikken blinker
    if (!blinkOn(5)) return;
    const S = powerDot(); blitSprite(S, q.x - S.w / 2, q.y - S.h / 2); return;
  }
  const S = itemSprite(q.kind), bob = reduceMotion ? 0 : (Math.floor(q.t * 3) % 2) * PX;
  blitSprite(S, q.x - S.w / 2, q.y - S.h / 2 - bob);
}

/* ---------- Arkade-blåmeisen ----------
   Rund 8-bits blåmeis sett fra siden: blå hette, hvitt ansikt med svart øyestripe, gult bryst og det røde
   lusekofte-skjerfet som blafrer bak. Vingen har tre stillinger, nebbet åpner seg når den spiser, og øynene
   kan blunke, smile og bli svimle. Pynten fra garderoben tegnes oppå. Én kunstpiksel er 1,5 logiske px, så
   fuglen er litt større enn treffsonen (radius 11). Rutenettet er 25 × 26; kroppen (19 × 16 med nebbet)
   står med øvre venstre hjørne i (4, 8), og midten av kroppen er (13, 16). */
const BIRD_S = 1.5, BIRD_OX = 4, BIRD_OY = 8, BIRD_GW = 25, BIRD_GH = 26, BIRD_CX = 13, BIRD_CY = 16;
const BC = { b: '#1A2F8A', B: '#3D7DFF', h: '#9CC2FF', W: '#FFFFFF', K: '#0A0A16', Y: '#FFD23F', y: '#D99A1C', O: '#6A6A80', o: '#34344A', R: '#E8323A', r: '#A81E26', G: '#7FB0FF', g: '#2F55C8', m: '#5A1020' };
const BIRD_BODY = [
  '.......bbbbb.......',
  '.....bbBBBBBbb.....',
  '....bBBhhBBBBBb....',
  '...bBBhBBBBBBBBb...',
  '..bBBBBBBBBBBBBBb..',
  '..bBBBBWWWWWWWWWb..',
  '.bBBBBWWWWWKKWWWWb.',
  '.bBKKKKKKKKKKWWWWOO',
  '.bBBBBBWWWWKKWWWWOo',
  '.bBBBBBBWWWWWWWWb..',
  '.rRRRRRRRRRRRRRRr..',
  '..rrrrrrrrrrrrrr...',
  '..yYYYYYYYYYYYYy...',
  '...yYYYYYYYYYYy....',
  '....yyYYYYYYyy.....',
  '......yyyyyy.......'
];
const WING = {
  up:   [-1, 1, ['g.....', 'gg....', 'gGg...', 'gGGg..', '.gGGg.', '.gGGGg', '..gGGg', '...ggg']],
  mid:  [1, 9, ['.ggg..', 'gGGGg.', 'gGGGGg', '.gGGGg', '..gggg']],
  down: [2, 10, ['gggg..', 'gGGGg.', '.gGGg.', '.gGGg.', '..gGg.', '...g..']]
};
function paintBird(cell, { wing = 'mid', open = false, eye = 'open', wear = 'none', scarf = 0 } = {}) {
  const c = (i, j, col) => cell(BIRD_OX + i, BIRD_OY + j, 1, 1, col);
  const pat = (ox, oy, rows, pal) => rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (pal[row[i]]) c(ox + i, oy + j, pal[row[i]]); });
  pat(-3, 5, ['bbb.', 'bBBb', '.bbb'], BC);                                                    // stjerten
  pat(-3, 10, scarf ? ['..RRR', 'RRr..', 'r....'] : ['RRRRR', '.Rr..', '..r..'], BC);         // skjerfsnippen blafrer
  pat(0, 0, BIRD_BODY, BC);
  const [wx, wy, wr] = WING[wing]; pat(wx, wy, wr, BC);
  if (open) pat(16, 6, ['OOO', 'mm.', 'mm.', 'OO.'], BC);                                       // nebbet åpent når den spiser
  if (eye === 'blink') pat(11, 6, ['WW', 'KK', 'WW'], BC);
  else if (eye === 'happy') { pat(11, 6, ['WW', 'WW', 'WW'], BC); pat(10, 6, ['.KK.', 'K..K'], BC); }
  else if (eye === 'dizzy') { pat(11, 6, ['WW', 'WW', 'WW'], BC); pat(10, 6, ['K.K', '.K.', 'K.K'], BC); }
  paintWear(c, pat, wear);
}
// pynten, i kroppens koordinater (negative rader er over hodet)
function paintWear(c, pat, id) {
  const P = {
    R: '#E8323A', r: '#A81E26', W: '#FFFFFF', w: '#D8D8E8', K: '#14141C', k: '#3A3A50', Y: '#FFD23F', y: '#D9A520',
    G: '#5BC86A', g: '#2E8A3E', P: '#FF8FD0', S: '#B8BCCC', s: '#7E8296', C: '#45E3FF'
  };
  switch (id) {
    case 'bow': pat(6, -2, ['RR..RR', 'RrRRrR', 'RR..RR'], P); break;
    case 'beanie': pat(4, -2, ['.....WW.....', '...RRRRRR...', '..RRRRRRRR..', '.RRRRRRRRRR.', 'WRWRWRWRWRWR', 'RRRRRRRRRRRR'], P); break;
    case 'toadstool': pat(3, -3, ['.....RRRR.....', '...RRWRRRWR...', '..RRRRRRRRRR..', '.RWRRRRRWRRRR.', 'RRRRRRRRRRRWRR', '...wwwwwwww...'], P); break;
    case 'flower': pat(12, -2, ['.W.', 'WYW', '.W.', '.g.'], P); break;
    case 'sunglasses': pat(8, 6, ['KKKKKKK', 'KkKKKkK', '.KK..K.'], P); break;
    case 'flowercrown': pat(4, 1, ['.P.Y.W.P.Y.', 'gGgGgGgGgGg'], P); break;
    case 'glasses': pat(9, 5, ['.KKKK.', 'K....K', 'K....K', '.KKKK.'], P); break;
    case 'viking': pat(2, -3, ['W..............W', 'W....ssssss....W', '.W.SSSSSSSSSS.W.', '..WSSSSSSSSSSW..', '...ssssssssss...'], P); break;
    case 'santa': pat(3, -4, ['W...........', 'WRR.........', '.RRRRRR.....', '..RRRRRRRRR.', '.RRRRRRRRRRR', 'WWWWWWWWWWWWW'], P); break;
    case 'tophat': pat(5, -5, ['.KKKKKKK.', '.KKKKKKK.', '.KKKKKKK.', '.KKKKKKK.', '.RRRRRRR.', 'KKKKKKKKK'], P); break;
    case 'crown': pat(5, -1, ['Y..Y..Y..', 'YYRYYCYYY', 'YYYYYYYYY', 'yyyyyyyyy'], P); break;
  }
}
// fuglen som rutenett av farger (én verdi per kunstpiksel), så den kan roteres piksel for piksel
function birdGrid(o) {
  return cached(`bgrid|${o.wing}|${o.open ? 1 : 0}|${o.eye}|${o.wear}|${o.scarf ? 1 : 0}`, () => {
    const g = Array.from({ length: BIRD_GH }, () => new Array(BIRD_GW).fill(null));
    paintBird((x, y, w, h, col) => { if (y >= 0 && y < BIRD_GH && x >= 0 && x < BIRD_GW) g[y][x] = col; }, o);
    return g;
  });
}
/* Rotasjonen skjer i kunstpiksler (nærmeste piksel), ikke i skjermpiksler: da forblir pikslene firkantede og
   like store når fuglen vipper. Vinkelen rundes til trinn på 7,5 grader, og hvert trinn lages én gang. */
const ROT_STEP = Math.PI / 24, BIRD_RG = 42, BIRD_RC = 21;   // rotert lerret: 42 × 42 med kroppens midte i (21, 21)
function birdSprite(o, s = BIRD_S, rot = 0) {
  const q = Math.round(rot / ROT_STEP);
  const key = `bird|${o.wing}|${o.open ? 1 : 0}|${o.eye}|${o.wear}|${o.scarf ? 1 : 0}|${q}`;
  return pixelArt(key, BIRD_RG, BIRD_RG, cell => {
    const g = birdGrid(o), a = -q * ROT_STEP, ca = Math.cos(a), sa = Math.sin(a), cx = BIRD_CX, cy = BIRD_CY;
    for (let y = 0; y < BIRD_RG; y++) for (let x = 0; x < BIRD_RG; x++) {
      const dx = x + 0.5 - BIRD_RC, dy = y + 0.5 - BIRD_RC;
      const sx = Math.floor(cx + dx * ca - dy * sa), sy = Math.floor(cy + dx * sa + dy * ca);
      const col = sy >= 0 && sy < BIRD_GH && sx >= 0 && sx < BIRD_GW ? g[sy][sx] : null;
      if (col) cell(x, y, 1, 1, col);
    }
  }, s);
}
function birdLook(b = bird) {
  const flap = b.flapT;
  const wing = flap < 0.06 ? 'down' : flap < 0.14 ? 'mid' : flap < 0.24 ? 'up' : 'mid';
  let eye = 'open';
  if (state === State.OVER || state === State.DEAD) eye = 'dizzy';
  else if (b.happy > 0.2) eye = 'happy';
  else if (b.blink > 0.3) eye = 'blink';
  return { wing, open: b.chomp > 0, eye, wear, scarf: Math.floor(time * 6) % 2 };
}
// tegn fuglen med kroppens midtpunkt i (x, y)
function drawBirdAt(x, y, o, { rot = 0, s = BIRD_S } = {}) {
  const S = birdSprite(o, s, rot);
  blitSprite(S, x - BIRD_RC * s, y - BIRD_RC * s);
}
function drawBird() {
  const bx = ip(bird.px, bird.x), by = ip(bird.py, bird.y), br = ip(bird.pr, bird.rot);
  const shielded = active.shield || grace > 0;
  if (grace > 0 && Math.floor(time * 14) % 2) return;   // usårbar etter skjoldtreff: blinker
  if (shielded && active.shield) {   // skjoldet: en blinkende pikselring rundt fuglen
    const S = pixelArt('shieldring', 21, 21, cell => pixelDisc(cell, 10, 10, 10, ARC.cyan, true));
    if (blinkOn(6)) blitSprite(S, bx - S.w / 2, by - S.h / 2);
  }
  drawBirdAt(bx, by, birdLook(), { rot: br });
}

/* ---------- Partikler og flytende tekst ---------- */
function drawParticles() {
  for (const q of particles) {
    const a = clamp(q.life / q.max, 0, 1), x = ip(q.px, q.x), y = ip(q.py, q.y);
    ctx.globalAlpha = a > 0.3 ? 1 : a / 0.3;
    if (q.shape === 'spark') { const r = Math.max(1, q.r); snapRect(x - r, y - r / 3, r * 2, r * 0.7, q.c); snapRect(x - r / 3, y - r, r * 0.7, r * 2, q.c); }
    else snapRect(x - q.r / 2, y - q.r / 2, q.r, q.r, q.c);
  }
  ctx.globalAlpha = 1;
}
function drawFloats() {
  for (const f of floats) {
    if (f.blink && !blinkOn(8)) continue;
    const a = clamp(f.life / f.max * 3, 0, 1);
    pixelText(f.txt, f.x, f.y, { s: f.s, color: f.color, shadow: ARC.dark, alpha: a });
  }
}

/* ---------- Hytta og fuglebrettet (hjemkomsten) ----------
   Rød tømmerhytte med torvtak, lyse vinduer og pipe, og fuglebrettet foran. 64 × 44 kunstpiksler. */
const HOME_C = { w: 64, h: 44, feeder: 12 };   // fuglebrettets midte (kunstpiksler fra venstre)
function homeSprite() {
  return pixelArt('home', HOME_C.w, HOME_C.h, cell => {
    const C = { wall: '#C8382E', log: '#8E2420', white: '#F2EEE6', door: '#6A3A22', win: '#FFD860', winD: '#E8A82E', roof: '#3A2A2E', roofD: '#24181C', grass: '#5BC86A', grassD: '#2E8A3E', stone: '#9A9AB0', wood: '#B07A40', woodD: '#7A4A20', seed: '#FFE7A0' };
    // pipe
    cell(50, 6, 5, 7, C.stone); cell(50, 6, 5, 1, '#C8C8DA');
    // tak (trapes) med torv og blomster
    for (let y = 12; y < 22; y++) { const k = (y - 12) / 9, x0 = Math.round(26 - k * 6), x1 = Math.round(58 + k * 5); cell(x0, y, x1 - x0, 1, y % 3 === 0 ? C.roofD : C.roof); }
    cell(25, 11, 34, 2, C.grass); for (let x = 26; x < 58; x += 3) cell(x, 10, 1, 1, C.grassD);
    cell(31, 10, 1, 1, C.white); cell(41, 10, 1, 1, '#FF8FD0'); cell(52, 10, 1, 1, C.win);
    // vegger med tømmer og hvite hjørnebord
    cell(22, 22, 39, 22, C.wall); for (let y = 24; y < 44; y += 3) cell(22, y, 39, 1, C.log);
    cell(21, 22, 2, 22, C.white); cell(60, 22, 2, 22, C.white);
    // dør og vinduer (lyse)
    cell(39, 30, 7, 14, C.door); cell(44, 37, 1, 1, C.win);
    for (const wx of [26, 49]) { cell(wx - 1, 26, 9, 9, C.white); cell(wx, 27, 7, 7, C.win); cell(wx + 3, 27, 1, 7, C.white); cell(wx, 30, 7, 1, C.white); cell(wx, 27, 3, 3, '#FFF2B0'); }
    // fuglebrettet: tak, brett med frø, stolpe og stivere
    for (let y = 6; y < 11; y++) { const k = y - 6; cell(HOME_C.feeder - 1 - k * 2, y, 2 + k * 4, 1, y === 10 ? C.log : C.wall); }
    cell(HOME_C.feeder - 7, 11, 1, 5, C.woodD); cell(HOME_C.feeder + 6, 11, 1, 5, C.woodD);
    cell(HOME_C.feeder - 8, 16, 16, 2, C.wood); cell(HOME_C.feeder - 8, 17, 16, 1, C.woodD);
    for (const x of [-5, -2, 2, 5]) cell(HOME_C.feeder + x, 15, 1, 1, C.seed);
    cell(HOME_C.feeder - 1, 18, 2, 26, C.woodD);
    cell(HOME_C.feeder - 4, 20, 1, 1, C.woodD); cell(HOME_C.feeder + 3, 20, 1, 1, C.woodD);
  });
}
function drawHome(groundY) {
  if (!home) return;
  const x = ip(home.px, home.x), S = homeSprite(), left = x - HOME_C.feeder * PX;
  if (left > W + 10 || left + S.w < -10) return;
  blitSprite(S, left, groundY - S.h);
  // røyk fra pipa: små firkanter som stiger og blir borte
  if (!reduceMotion) for (let i = 0; i < 3; i++) {
    const k = (time * 0.4 + i / 3) % 1, sx = left + 52 * PX + k * 8, sy = groundY - S.h + 4 * PX - k * 30, sz = 2 + Math.round(k * 2) * 2;
    ctx.globalAlpha = 0.6 * (1 - k); snapRect(sx - sz / 2, sy - sz / 2, sz, sz, ARC.grey); ctx.globalAlpha = 1;
  }
}

/* ---------- Logoen ----------
   «PIXELFUGL» som på skiltet til en arkademaskin: pikselskriften i dobbel tykkelse (hver piksel blir 2 × 2),
   gul over og oransje under, med en blå kontur og to piksler blå dybde under. Introen viser én bokstav om
   gangen; menyen bruker det samme bildet. */
const LOGO_WORD = 'PIXELFUGL';
const LOGO = (() => {
  let x = 1; const letters = [];
  for (const ch of LOGO_WORD) { const gl = glyphOf(ch); letters.push({ gl, x }); x += glyphW(gl) * 2 + 2; }
  return { letters, w: x, h: 7 * 2 + 4 };
})();
// størrelsen på en logopiksel: så stor som får plass innenfor rammen, i kvarte logiske px
const logoS = () => Math.min(3, Math.floor((W - 44) / LOGO.w * 4) / 4);
function logoSprite(letters = 9) {
  return pixelArt(`logo|${letters}`, LOGO.w, LOGO.h, cell => {
    const on = Array.from({ length: LOGO.h }, () => new Array(LOGO.w).fill(0));
    LOGO.letters.slice(0, letters).forEach(({ gl, x }) => gl.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === 'X') for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) on[1 + j * 2 + b][x + i * 2 + a] = 1;
    }));
    const at = (x, y) => y >= 0 && y < LOGO.h && x >= 0 && x < LOGO.w && on[y][x];
    for (let y = 0; y < LOGO.h; y++) for (let x = 0; x < LOGO.w; x++) {
      if (on[y][x]) {
        const col = !at(x, y - 1) ? '#FFF4A8' : y <= 5 ? ARC.yellow : y <= 9 ? '#FFC23D' : y <= 12 ? ARC.orange : '#FF7A3A';
        cell(x, y, 1, 1, col); continue;
      }
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy)) { edge = true; break; }
      if (edge) cell(x, y, 1, 1, ARC.wall);
      else if (at(x, y - 2) || at(x, y - 3) || at(x - 1, y - 2) || at(x + 1, y - 2)) cell(x, y, 1, 1, '#141C7A');   // dybden under
    }
  }, logoS());
}
function drawLogo(cx, cy, letters = 9) {
  const L = logoSprite(letters);
  blitSprite(L, cx - L.w / 2, cy - L.h / 2);
}

/* ---------- Skjermrammen (meny og «Klar?») ----------
   En dobbel labyrintramme rundt hele skjermen; i introen tegnes den fra midten øverst og rundt (k = 0–1). */
function drawScreenFrame(k = 1) {
  const m = 6, x0 = m, y0 = safeTop + m, x1 = W - m, y1 = H - safeBottom - m;
  if (k >= 1) { frameBox(x0, y0, x1 - x0, y1 - y0, { key: 'screen', r: 6 }); return; }
  // under introen: strekene vokser fra midten øverst, ned sidene og inn langs bunnen
  const w = x1 - x0, h = y1 - y0, total = w / 2 + h + w / 2;
  let left = k * total;
  const seg = (len, draw) => { const d = Math.min(len, Math.max(0, left)); if (d > 0) draw(d); left -= len; };
  for (const inset of [0, 3 * PX]) {
    left = k * total;
    const ax0 = x0 + inset, ax1 = x1 - inset - PX, ay0 = y0 + inset, ay1 = y1 - inset - PX, cx = W / 2;
    seg(w / 2, d => { snapRect(cx, ay0, Math.min(d, ax1 - cx + PX), PX, ARC.wall); snapRect(cx - Math.min(d, cx - ax0), ay0, Math.min(d, cx - ax0), PX, ARC.wall); });
    seg(h, d => { snapRect(ax0, ay0, PX, Math.min(d, ay1 - ay0 + PX), ARC.wall); snapRect(ax1, ay0, PX, Math.min(d, ay1 - ay0 + PX), ARC.wall); });
    seg(w / 2, d => { snapRect(ax0, ay1, Math.min(d, cx - ax0), PX, ARC.wall); snapRect(ax1 + PX - Math.min(d, ax1 + PX - cx), ay1, Math.min(d, ax1 + PX - cx), PX, ARC.wall); });
  }
}

/* ---------- Introen ---------- */
function drawIntro() {
  const I = intro, rm = I.rm;
  if (rm) return;   // redusert bevegelse: menyen toner fram (se render)
  drawScreenFrame(EASE.out(introPhase(INTRO.frame)));
  const n = Math.floor(introPhase(INTRO.letters) * 9 + 1e-6);
  if (n > 0 && introPhase(INTRO.menu) <= 0) drawLogo(W / 2, menuLogoY(), n);
  if (I.t > INTRO.letters[1] - 0.1) {   // prikkraden under logoen, som blåmeisen spiser
    const D2 = dotSprite();
    for (let i = I.eaten; i < INTRO_DOTS; i++) blitSprite(D2, introDotX(i) - D2.w / 2, introDotY() - D2.h / 2);
  }
}

/* ---------- Retro-skjerm ----------
   Svake skannlinjer (hver tredje skjermpikselrad) og mørke hjørner. Ferdig tegnet, så det koster lite. */
let crtLayer = null;
function crtOverlay() {
  const key = `${canvas.width}x${canvas.height}`;
  if (crtLayer && crtLayer.key === key) return crtLayer.c;
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 2; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
  const v = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.45, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = v; g.fillRect(0, 0, c.width, c.height);
  crtLayer = { key, c }; return c;
}

/* ---------- Bildet ---------- */
function drawWorld(groundY, pv, qv) {
  drawBackground(groundY);
  drawWalls(pv, groundY);
  drawDots(pv);
  for (const q of qv) drawPower(q);
  drawHome(groundY);
  drawFloor(groundY);
}
function render() {
  const groundY = H - GROUND_H;
  ctx.save();
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const env = shakeEnv();
  if (env > 0.05) {
    const w = fx.t * Math.PI * 2, o = Math.sin(w * 13) * env, q = Math.sin(w * 9.3 + 1) * env * 0.35;
    ctx.translate(Math.round((fx.dx * o - fx.dy * q) * 2) / 2, Math.round((fx.dy * o + fx.dx * q) * 2) / 2);
  }
  viewScroll = ip(prevScroll, scroll);
  const pv = pipes.map(p => ({ ...p, x: ip(p.px, p.x), top: ip(p.ptop, p.top) }));
  const qv = powers.map(q => ({ ...q, x: ip(q.px, q.x), y: ip(q.py, q.y) }));
  drawWorld(groundY, pv, qv);
  drawParticles();
  const introHidesBird = intro && !intro.rm && intro.t < INTRO.fly[0];
  if (!introHidesBird) drawBird();
  drawFloats();
  for (const k in hud) delete hud[k];
  if (intro) drawIntro();
  const uiA = intro ? (intro.rm ? introPhase(INTRO_RM.menu) : introPhase(INTRO.menu)) : 1;
  if (uiA > 0) {
    ctx.globalAlpha = uiA;
    if (state === State.MENU) drawMenuScreen();
    else if (state === State.READY) drawReadyScreen();
    else if (state === State.PLAY || state === State.DEAD) drawGameHud(groundY);
    else if (state === State.OVER) drawResultsScreen();
    ctx.globalAlpha = 1;
  }
  if (intro && uiA < 1) for (const k in hud) delete hud[k];   // ingen knapper før menyen er framme
  finishFrame(groundY);
}
function finishFrame(groundY) {
  if (fx.tint > 0.01) { ctx.fillStyle = `rgba(${fx.rgb},${(fx.tint * 0.3).toFixed(3)})`; ctx.fillRect(-8, -8, W + 16, H + 16); }
  if (paused) drawPauseScreen();
  // overgang: svarte persienner som åpner seg
  if (transitionT > 0 && !intro) {
    const k = reduceMotion ? transitionT : EASE.in(transitionT), n = 12, bh = H / n;
    ctx.fillStyle = ARC.bg;
    for (let i = 0; i < n; i++) snapRect(0, i * bh, W, bh * k, ARC.bg);
  }
  ctx.restore();
  if (crt) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(crtOverlay(), 0, 0); ctx.restore(); }
  syncControls();
}
