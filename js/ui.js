/* Pixelfugl – arkade-UI: meny, «KLAR!», poengtavle, pause, innstillinger, garderobe og resultat.
   Alt er pikselgrafikk fra js/pixel.js: doble labyrintrammer, pikselskrift og pikselikoner. Hver knapp på
   lerretet har en HTML-knapp med samme treffområde og et norsk navn, så menyene også kan brukes med tastatur
   og skjermleser.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

const S_SMALL = 1.5;   // liten tekst (etiketter og hint)
const usableH = () => H - safeTop - safeBottom;
const homeReached = () => !!home && (home.phase === 'rest' || home.phase === 'done');
// største tekststørrelse (opptil s) som får plass i bredden w
const fitS = (str, w, s = PX) => Math.min(s, w / Math.max(1, pixelTextCells(String(str).toUpperCase())));

/* ---------- Pikselikoner ---------- */
const ICON_ROWS = {
  sound: ['...X.....', '..XX..X..', 'XXXX...X.', 'XXXX.X.X.', 'XXXX.X.X.', 'XXXX...X.', '..XX..X..', '...X.....'],
  mute: ['...X.....', '..XX.....', 'XXXX.X..X', 'XXXX..XX.', 'XXXX..XX.', 'XXXX.X..X', '..XX.....', '...X.....'],
  gear: ['....X....', '.X.XXX.X.', '..XXXXX..', '.XXX.XXX.', 'XXX...XXX', '.XXX.XXX.', '..XXXXX..', '.X.XXX.X.', '....X....'],
  pause: ['XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX'],
  left: ['...X....', '..XX....', '.XXXXXXX', 'XXXXXXXX', '.XXXXXXX', '..XX....', '...X....'],
  right: ['....X...', '....XX..', 'XXXXXXX.', 'XXXXXXXX', 'XXXXXXX.', '....XX..', '....X...']
};
const icon = (name, color) => spriteCanvas(`icon-${name}-${color}`, ICON_ROWS[name], { X: color });
// hytta (målet for reisen) og en liten fugl, til reiselinja
const CABIN = ['...ggg...', '..ggggg..', '.ggggggg.', '.RRRRRRR.', '.RYRRRYR.', '.RRRRRRR.', '.RRRDRRR.', '.RRRDRRR.'];
const cabinIcon = () => spriteCanvas('cabin', CABIN, { g: '#5BC86A', R: '#C8382E', Y: '#FFD860', D: '#6A3A22' });

/* ---------- Byggeklosser ---------- */
function uiControl(key, x, y, w, h, label, fn, pressed) {
  hud[key] = { x, y, w, h, label, fn, pressed };
}
const isDown = key => !reduceMotion && press.key === key && time - press.t < 0.18;
// tekst med en svart flate bak (når den står oppå gulvet eller prikker)
function plate(str, x, y, opts = {}) {
  const s = opts.s || PX, w = pixelTextW(String(str).toUpperCase(), s);
  snapRect(x - w / 2 - 3 * s, y - 5.5 * s, w + 6 * s, 10 * s, ARC.bg);
  pixelText(str, x, y, opts);
}
// knapp: dobbel labyrintramme med mørk fylling; hovedknappen har gul tekst
function arcButton(key, x, y, w, h, label, fn, { primary = true, s = PX, text = label } = {}) {
  uiControl(key, x, y, w, h, label, fn);
  const down = isDown(key);
  frameBox(x, y, w, h, { key: 'btn', color: down ? ARC.wallLight : ARC.wall, fill: down ? ARC.wallDim : ARC.wallFill, r: 4 });
  pixelText(text, x + w / 2, y + h / 2 + (down ? 1 : 0), { s: fitS(text, w - 20, s), color: primary ? ARC.yellow : ARC.white });
}
// kvadratisk ikonknapp
function iconButton(key, cx, cy, size, name, fn, label, color = ARC.white) {
  const x = cx - size / 2, y = cy - size / 2, down = isDown(key);
  uiControl(key, x, y, size, size, label, fn);
  frameBox(x, y, size, size, { key: 'ibtn', color: down ? ARC.wallLight : ARC.wall, fill: down ? ARC.wallDim : ARC.wallFill, r: 3 });
  const I = icon(name, color);
  blitSprite(I, cx - I.w / 2, cy - I.h / 2 + (down ? 1 : 0));
}
function panel(x, y, w, h) { frameBox(x, y, w, h, { key: 'panel', color: ARC.wall, fill: ARC.bg, r: 6 }); }
function uiDim(a = 0.8) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(-8, -8, W + 16, H + 16); }
const panelY = h => Math.max(safeTop + 10, safeTop + (usableH() - h) / 2);

/* ---------- Reiselinja ----------
   Veien hjem som en rad med prikker: de som er passert er spist, fuglen står der den har kommet, stedene er
   litt større prikker, og hytta står i enden. */
function drawRouteTrail(x0, x1, y, reached, homeNow) {
  const map = at => x0 + (x1 - x0) * clamp(at, 0, HOME) / HOME, bx = map(homeNow ? HOME : reached);
  for (let x = x0; x <= x1 - 10; x += 6) if (x > bx + 4) snapRect(x - 1, y - 1, 2, 2, ARC.dot);
  for (const p of ROUTE.slice(1, -1)) {
    const px = map(p.at);
    if (px > bx + 4) snapRect(px - 2, y - 2, 4, 4, ARC.dot);
  }
  const C = cabinIcon(); blitSprite(C, x1 - C.w / 2 + 2, y - C.h + 4);
  const look = { wing: Math.floor(time * 8) % 2 ? 'up' : 'down', open: false, eye: 'open', wear, scarf: 0 };
  drawBirdAt(bx, y - 1, look, { s: 1 });
}

/* ---------- Menyen ---------- */
const logoH = () => LOGO.h * logoS();
function menuLogoY() { return Math.round(safeTop + Math.max(logoH() / 2 + 38, usableH() * 0.14)); }
// knappene står mellom fuglen og gulvet; er det for lite plass, står ikonene på hver side av «Spill»
function menuLayout() {
  const groundY = H - GROUND_H, idleY = groundY * 0.42, birdBottom = idleY + 32, floor = groundY - 6;
  const full = 30 + 12 + 46 + 30 + 24 + 34, compact = 30 + 12 + 46 + 30;
  const side = floor - birdBottom < full;
  const top = Math.max(birdBottom, lerp(birdBottom, floor - (side ? compact : full), 0.5));
  const diffY = top, playY = diffY + 42, hintY = playY + 46 + 22;
  return { diffY, playY, hintY, iconY: side ? playY + 23 : hintY + 26 + 17, side };
}
function drawMenuScreen() {
  drawScreenFrame(1);
  const L = menuLayout(), ly = menuLogoY();
  // rekorden øverst, mellom rammen og logoen
  const recY = Math.round((safeTop + 14 + ly - logoH() / 2) / 2) + 1;
  if (D.zen) pixelText('ZEN · BARE FLY', W / 2, recY, { s: S_SMALL, color: ARC.green });
  else {
    const lbl = 'REKORD ', val = String(best), lw = pixelTextW(lbl, S_SMALL), tw = lw + pixelTextW(val, S_SMALL);
    pixelText(lbl, W / 2 - tw / 2, recY, { s: S_SMALL, color: ARC.red, align: 'left' });
    pixelText(val, W / 2 - tw / 2 + lw, recY, { s: S_SMALL, color: ARC.white, align: 'left' });
  }
  if (!intro || introPhase(INTRO.menu) > 0) drawLogo(W / 2, ly);
  // undertittelen står der blåmeisen spiste prikkraden i introen (når fuglen ikke er i veien)
  const subY = introDotY(), idleY = (H - GROUND_H) * 0.42;
  if (idleY - 50 > subY + 8) pixelText('FLY HJEM TIL HYTTA', W / 2, subY, { s: S_SMALL, color: ARC.cyan });

  // nivåvalget: fire valg i én ramme; det valgte har gul tekst på blå flate
  const diffs = Object.entries(DIFFS), dw = Math.min(256, W - 40), dx = (W - dw) / 2, cw = (dw - 12) / diffs.length;
  frameBox(dx, L.diffY, dw, 30, { key: 'diff', color: ARC.wall, fill: ARC.bg, r: 4 });
  diffs.forEach(([key, v], i) => {
    const cx = dx + 6 + i * cw, on = key === diffName;
    if (on) snapRect(cx + 2, L.diffY + 6, cw - 4, 18, '#18208A');
    pixelText(v.label, cx + cw / 2, L.diffY + 15, { s: fitS(v.label, cw - 8, S_SMALL), color: on ? ARC.yellow : ARC.grey });
    uiControl('diff_' + key, cx, L.diffY, cw, 30, v.label, () => setDiff(key), on);
  });
  const pw = L.side ? Math.min(176, W - 140) : Math.min(176, W - 80);
  arcButton('start', (W - pw) / 2, L.playY, pw, 46, 'Spill', goReady, { s: 3 });
  if (blinkOn(1.6)) plate('TRYKK FOR Å STARTE', W / 2, L.hintY, { s: S_SMALL, color: ARC.white });
  const ix = L.side ? pw / 2 + 32 : 24;
  iconButton('sound', W / 2 - ix, L.iconY, 34, Sound.sfxMuted ? 'mute' : 'sound', () => Sound.toggleSfx(), 'Lydeffekter av/på', Sound.sfxMuted ? ARC.grey : ARC.white);
  iconButton('settings', W / 2 + ix, L.iconY, 34, 'gear', () => { settingsOpen = true; }, 'Innstillinger');
  if (wardrobe) drawWardrobeScreen();
  else if (settingsOpen) drawSettingsScreen();
}

/* ---------- Innstillinger ---------- */
function toggleBox(x, y, on) {
  frameBox(x, y, 44, 22, { key: 'tgl', color: on ? ARC.green : ARC.wallDim, fill: ARC.bg, r: 3, inner: false });
  pixelText(on ? 'PÅ' : 'AV', x + 22, y + 11, { s: S_SMALL, color: on ? ARC.green : ARC.grey });
}
function drawSettingsScreen() {
  for (const key in hud) delete hud[key];
  uiDim();
  const w = Math.min(244, W - 32), h = 270, x = (W - w) / 2, y = panelY(h);
  panel(x, y, w, h);
  pixelText('INNSTILLINGER', W / 2, y + 28, { s: fitS('INNSTILLINGER', w - 32), color: ARC.yellow });
  const rows = [
    ['s_sound', 'Lydeffekter', !Sound.sfxMuted, () => Sound.toggleSfx()],
    ['s_music', 'Musikk', !Sound.musMuted, () => Sound.toggleMusic()],
    ['s_crt', 'Retro-skjerm', crt, toggleCrt]
  ];
  rows.forEach(([key, label, on, fn], i) => {
    const yy = y + 52 + i * 38;
    pixelText(label, x + 22, yy + 17, { s: S_SMALL, color: ARC.white, align: 'left' });
    toggleBox(x + w - 22 - 44, yy + 6, on);
    uiControl(key, x + 12, yy, w - 24, 34, label, fn, on);
  });
  arcButton('s_wardrobe', x + 20, y + 174, w - 40, 36, 'Garderobe', () => { settingsOpen = false; wardrobe = true; wardrobePage = Math.floor(COSMETICS.findIndex(c => c.id === wear) / WARDROBE_PAGE); }, { primary: false, s: S_SMALL });
  arcButton('s_done', x + 20, y + 220, w - 40, 36, 'Ferdig', () => { settingsOpen = false; }, { s: S_SMALL });
}

/* ---------- Garderoben ---------- */
function drawWardrobeScreen() {
  for (const key in hud) delete hud[key];
  uiDim();
  const pages = Math.ceil(COSMETICS.length / WARDROBE_PAGE), page = Math.min(wardrobePage, pages - 1);
  const w = Math.min(264, W - 24), h = 384, x = (W - w) / 2, y = panelY(h);
  panel(x, y, w, h);
  pixelText('GARDEROBE', W / 2, y + 26, { s: 2.5, color: ARC.yellow });
  pixelText(`${totalPoints} POENG · ${COSMETICS.filter(isUnlocked).length} AV ${COSMETICS.length}`, W / 2, y + 48, { s: S_SMALL, color: ARC.grey });
  const tw = (w - 36) / 2, th = 76;
  COSMETICS.slice(page * WARDROBE_PAGE, (page + 1) * WARDROBE_PAGE).forEach((c, i) => {
    const tx = x + 14 + (i % 2) * (tw + 8), ty = y + 62 + Math.floor(i / 2) * (th + 6), ok = isUnlocked(c), on = wear === c.id;
    frameBox(tx, ty, tw, th, { key: 'tile', color: on ? ARC.yellow : ARC.wallDim, fill: on ? ARC.dark : ARC.bg, r: 3, inner: false });
    ctx.globalAlpha *= ok ? 1 : 0.3;
    drawBirdAt(tx + tw / 2, ty + 38, { wing: 'mid', open: false, eye: on ? 'happy' : 'open', wear: c.id, scarf: 0 }, { s: 2 });
    ctx.globalAlpha /= ok ? 1 : 0.3;
    const txt = ok ? c.label : c.gold ? 'Gull i én runde' : `${c.need} poeng`;
    pixelText(txt, tx + tw / 2, ty + th - 11, { s: fitS(txt, tw - 10, S_SMALL), color: on ? ARC.yellow : ok ? ARC.white : ARC.grey });
    if (ok) uiControl('w_' + c.id, tx, ty, tw, th, c.label, () => setWear(c.id), on);
  });
  const ay = y + h - 66;
  iconButton('w_prev', x + 36, ay, 30, 'left', () => { wardrobePage = (page + pages - 1) % pages; }, 'Forrige side');
  iconButton('w_next', x + w - 36, ay, 30, 'right', () => { wardrobePage = (page + 1) % pages; }, 'Neste side');
  pixelText(`${page + 1} / ${pages}`, W / 2, ay, { s: S_SMALL, color: ARC.grey });
  arcButton('w_done', x + 20, y + h - 46, w - 40, 34, 'Ferdig', () => { wardrobe = false; }, { s: S_SMALL });
}

/* ---------- «KLAR!» ---------- */
const LEGEND = [
  ['dots', 'PRIKKRAD', '+1', ARC.dot],
  ['shield', 'KRAFTPRIKK', 'SKJOLD', ARC.cyan],
  ['slow', 'SNEGLE', 'SAKTE', '#C78BFF'],
  ['double', 'EIKENØTT', 'DOBBEL', '#FFC23D']
];
function drawLegendIcon(kind, cx, cy) {
  if (kind === 'dots') { const D2 = dotSprite(); for (const dx of [-8, 0, 8]) blitSprite(D2, cx + dx - D2.w / 2, cy - D2.h / 2); return; }
  const S = kind === 'shield' ? powerDot() : itemSprite(kind);
  blitSprite(S, cx - S.w / 2, cy - S.h / 2);
}
function drawReadyScreen() {
  drawScreenFrame(1);
  const groundY = H - GROUND_H, idleY = groundY * 0.42;
  const ky = Math.round(Math.min(safeTop + 62, idleY - 70));
  pixelText('KLAR!', W / 2, ky, { s: 4, color: ARC.yellow, shadow: ARC.wallDim });
  pixelText(D.zen ? 'ZEN · BARE FLY' : `${D.label} · FRA FJELLET TIL HYTTA`, W / 2, ky + 30, { s: fitS(`${D.label} · FRA FJELLET TIL HYTTA`, W - 48, S_SMALL), color: ARC.grey });
  // forklaring på det man kan spise, mellom fuglen og bakken
  const rowH = 20, ly0 = idleY + 46, rows = Math.max(0, Math.min(LEGEND.length, Math.floor((groundY - 40 - ly0) / rowH)));
  const lx = Math.round(W / 2 - 100);
  LEGEND.slice(0, rows).forEach(([kind, name, gain, color], i) => {
    const yy = ly0 + i * rowH;
    drawLegendIcon(kind, lx + 12, yy);
    pixelText(name, lx + 34, yy, { s: S_SMALL, color: ARC.white, align: 'left' });
    pixelText(gain, lx + 200, yy, { s: S_SMALL, color, align: 'right' });
  });
  if (blinkOn(1.6)) plate('TRYKK FOR Å FLAKSE', W / 2, groundY - 22, { s: S_SMALL, color: ARC.white });
  iconButton('ready_menu', 36, safeTop + 36, 30, 'left', goMenu, 'Tilbake til menyen');
}

/* ---------- Poengtavla i spill ---------- */
function powerIcon(kind) {
  if (kind === 'shield') return pixelArt('shieldicon', 9, 9, cell => pixelDisc(cell, 4, 4, 4, ARC.cyan, true));
  return itemSprite(kind);
}
function drawGameHud(groundY) {
  const flash = !reduceMotion && time - scoreT < 0.15;
  pixelText(D.zen ? 'ZEN' : String(score), W / 2, safeTop + 34, { s: 4, color: flash ? ARC.yellow : ARC.white, shadow: ARC.wallDim });
  // rekorden øverst til venstre, som på en arkademaskin
  if (D.zen) pixelText('BARE FLY', 16, safeTop + 22, { s: S_SMALL, color: ARC.green, align: 'left' });
  else {
    pixelText('REKORD', 16, safeTop + 22, { s: S_SMALL, color: ARC.red, align: 'left' });
    pixelText(String(best), 16, safeTop + 38, { s: S_SMALL, color: ARC.white, align: 'left' });
  }
  if (state === State.PLAY && !paused) iconButton('pause', W - 32, safeTop + 30, 32, 'pause', pauseGame, 'Pause');
  // aktive ting: ikon og en stolpe med tiden som er igjen
  let yy = safeTop + 66;
  for (const [key, value] of Object.entries(active)) {
    if (!value) continue;
    const P = POWERS[key], I = powerIcon(key), segs = 10, left = key === 'shield' ? segs : Math.ceil(value / P.dur * segs);
    const x0 = W / 2 - 46;
    blitSprite(I, x0 - I.w / 2, yy - I.h / 2);
    if (key === 'shield') pixelText('SKJOLD', x0 + 14, yy, { s: S_SMALL, color: P.color, align: 'left' });
    else for (let i = 0; i < segs; i++) snapRect(x0 + 14 + i * 8, yy - 4, 6, 8, i < left ? P.color : ARC.dark);
    yy += 20;
  }
  // nytt sted på veien hjem: et banner som blinker litt før det blir stående
  if (placeIdx > 0 && time - placeT < 3 && !home) {
    const name = ROUTE[placeIdx].name.toUpperCase(), bw = Math.max(150, pixelTextW(name) + 40), by = Math.max(yy + 6, safeTop + 92);
    if (time - placeT > 0.9 || blinkOn(6)) {
      frameBox(W / 2 - bw / 2, by, bw, 38, { key: 'banner', color: ARC.wall, fill: ARC.bg, r: 4 });
      pixelText(name, W / 2, by + 19, { color: ARC.yellow });
    }
  }
  if (home && home.phase === 'rest') {
    const bw = Math.min(232, W - 40), by = Math.max(yy, groundY * 0.24);
    frameBox(W / 2 - bw / 2, by, bw, 64, { key: 'homecard', color: ARC.wall, fill: ARC.bg, r: 5 });
    pixelText('HJEMME!', W / 2, by + 24, { s: 3, color: ARC.yellow });
    if (blinkOn(1.6)) pixelText('TRYKK FOR Å FLY VIDERE', W / 2, by + 48, { s: fitS('TRYKK FOR Å FLY VIDERE', bw - 20, S_SMALL), color: ARC.white });
  }
  // på gulvet: neste sted og reiselinja
  if (!home) {
    const ty = Math.min(groundY + 56, H - safeBottom - 30), place = ROUTE[Math.min(placeAt(score) + 1, ROUTE.length - 1)];
    pixelText('MOT ' + place.name, W / 2, ty, { s: S_SMALL, color: ARC.cyan });
    drawRouteTrail(W / 2 - 80, W / 2 + 80, ty + 20, score, false);
  }
}

/* ---------- Pause ---------- */
function drawPauseScreen() {
  for (const key in hud) delete hud[key];
  uiDim();
  if (resumeT > 0) { pixelText(String(Math.ceil(resumeT / 0.5)), W / 2, H * 0.42, { s: 8, color: ARC.yellow, shadow: ARC.wallDim }); return; }
  const w = Math.min(232, W - 40), h = 214, x = (W - w) / 2, y = panelY(h);
  panel(x, y, w, h);
  pixelText('PAUSE', W / 2, y + 30, { s: 3, color: ARC.yellow });
  pixelText(`${D.label} · ${score} POENG`, W / 2, y + 58, { s: S_SMALL, color: ARC.grey });
  arcButton('resume', x + 20, y + 78, w - 40, 42, 'Fortsett', resumeGame, { s: 2 });
  arcButton('pmenu', x + 20, y + 130, w - 40, 34, 'Meny', goMenu, { primary: false, s: S_SMALL });
  const j = journeyLines(score, homeReached()), line = j.next || j.line;
  pixelText(line, W / 2, y + 188, { s: fitS(line, w - 28, S_SMALL), color: ARC.cyan });
}

/* ---------- Resultatet ---------- */
const MEDALS = [
  { at: 40, name: 'PLATINA', c: '#9FF3FF', d: '#3FA7C8' },
  { at: 30, name: 'GULL', c: '#FFD23F', d: '#C8901A' },
  { at: 20, name: 'SØLV', c: '#D8DCEC', d: '#8A90B8' },
  { at: 10, name: 'BRONSE', c: '#E59A5E', d: '#9A5A2A' }
];
const medalFor = s => D.zen ? null : MEDALS.find(m => s >= m.at) || null;
function medalSprite(m) {
  return pixelArt(`medal-${m.name}`, 13, 19, cell => {
    for (let i = 0; i < 6; i++) { cell(2 + i, i, 2, 1, ARC.red); cell(9 - i, i, 2, 1, ARC.wall); }   // båndet
    pixelDisc(cell, 6, 12, 6, m.d); pixelDisc(cell, 6, 12, 5, m.c);
    const star = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'];
    star.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === 'X') cell(4 + i, 10 + j, 1, 1, m.d); });
    cell(3, 9, 1, 2, ARC.white);   // glimt
  });
}
function drawResultsScreen() {
  const enter = reduceMotion ? 1 : EASE.out(Math.min(1, overT / 0.35));
  uiDim(0.6 * enter);
  const w = Math.min(260, W - 28), h = Math.min(404, usableH() - 20), k = h / 404, x = (W - w) / 2;
  const y = Math.round(panelY(h) + (1 - enter) * 16), Y = v => y + Math.round(v * k);
  panel(x, y, w, h);
  const title = newBest ? 'NY REKORD!' : D.zen ? 'FIN FLYTUR!' : 'SPILLET ER OVER';
  if (!newBest || overT > 1.6 || blinkOn(5)) pixelText(title, W / 2, Y(30), { s: fitS(title, w - 32, 2.5), color: newBest ? ARC.yellow : D.zen ? ARC.green : ARC.red });
  pixelText(String(overShown), W / 2, Y(78), { s: 5, color: ARC.white, shadow: ARC.wallDim });
  pixelText('POENG', W / 2, Y(110), { s: S_SMALL, color: ARC.grey });
  // rekord og prikker til venstre, medaljen til høyre
  const m = medalFor(overShown), sx0 = x + 22, sx1 = m ? x + w - 82 : x + w - 22;
  [['REKORD', D.zen ? '-' : String(best), ARC.red], ['PRIKKER', String(dotsEaten), ARC.dot]].forEach(([lbl, val, col], i) => {
    const yy = Y(140 + i * 22);
    pixelText(lbl, sx0, yy, { s: S_SMALL, color: col, align: 'left' });
    pixelText(val, sx1, yy, { s: S_SMALL, color: ARC.white, align: 'right' });
  });
  if (m) {
    const M = medalSprite(m), mx = x + w - 46;
    blitSprite(M, mx - M.w / 2, Y(126));
    pixelText(m.name, mx, Y(176), { s: fitS(m.name, 60, S_SMALL), color: m.c });
  }
  const target = ROUTE[Math.min(placeAt(score) + 1, ROUTE.length - 1)].name, line = homeReached() ? 'VELKOMMEN HJEM!' : 'PÅ VEI TIL ' + target;
  pixelText(line, W / 2, Y(204), { s: fitS(line, w - 28, S_SMALL), color: ARC.cyan });
  drawRouteTrail(x + 30, x + w - 30, Y(228), Math.min(overShown, score), homeReached() && overShown >= HOME);
  if (unlocked.length) {
    const t = `NY PYNT: ${unlocked[0].label}`;
    if (overT > 1) pixelText(t, W / 2, Y(254), { s: fitS(t, w - 28, S_SMALL), color: ARC.green });
  }
  if (overT > 0.7) {
    arcButton('again', x + 22, Y(278), w - 44, Math.round(46 * k), 'Spill igjen', goReady, { s: 2 });
    arcButton('menu', x + 22, Y(336), w - 44, Math.round(36 * k), 'Meny', goMenu, { primary: false, s: S_SMALL });
  }
}

/* ---------- HTML-knappene ----------
   Gjenbruker nodene så lenge navn og tilstand er de samme: ingen nye DOM-noder per bilde, og de native
   knappene får nøyaktig samme plass som knappene på lerretet. */
const controlNodes = new Map(), controlRoot = document.getElementById('controls');
function syncControls() {
  // under introen finnes ingen knapper: et trykk hopper over introen (og treffer ikke en usynlig «Spill»)
  // (skrives bare når noe endres: ellers ugyldiggjør hvert bilde stilen til siden)
  if (controlRoot.hidden !== !!intro) controlRoot.hidden = !!intro;
  const screen = intro ? 'intro' : state === State.MENU && !settingsOpen && !wardrobe ? 'menu' : 'game';
  if (document.body.dataset.screen !== screen) document.body.dataset.screen = screen;
  for (const [key, node] of controlNodes) if (!hud[key]) { node.remove(); controlNodes.delete(key); }
  for (const [key, b] of Object.entries(hud)) {
    let node = controlNodes.get(key);
    if (!node) {
      node = document.createElement('button'); node.type = 'button'; node.dataset.control = key;
      node.addEventListener('click', () => {
        const current = hud[key]; if (!current) return;
        Sound.unlock(); press = { key, t: time }; current.fn(); Sound.tick(); buzz(6);
        // oppdater treffområdene med en gang, før et nytt trykk kan treffe en gammel knapp
        render();
      });
      controlNodes.set(key, node); controlRoot.appendChild(node);
    }
    const label = b.label || key;
    if (node.getAttribute('aria-label') !== label) { node.setAttribute('aria-label', label); node.textContent = label; }
    if (b.pressed === undefined) node.removeAttribute('aria-pressed');
    else if (node.getAttribute('aria-pressed') !== String(b.pressed)) node.setAttribute('aria-pressed', String(b.pressed));
    const position = `left:${b.x * scale}px;top:${b.y * scale}px;width:${b.w * scale}px;height:${b.h * scale}px;`;
    if (node._position !== position) { node.style.cssText = position; node._position = position; }
  }
}
