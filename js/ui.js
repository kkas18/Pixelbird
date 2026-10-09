/* Pixelfugl – rolig eventyrbok-UI. Samme Canvas-mål som verden og DOM-knapper
   med identiske treffområder, slik at menyene også kan brukes med tastatur. */
'use strict';

const UI = { paper: '#F8EBD3', ink: '#4A3224', muted: '#7E6147', red: '#AC452D', gold: '#F3C572', edge: '#B39367' };
let settingsOpen = false;

function uiText(label, x, y, size, options = {}) {
  const { serif = true, color = UI.ink, weight = 500, align = 'center', maxWidth = W - 40, shadow = false, outline = false } = options;
  ctx.save();
  ctx.font = `${serif ? 700 : weight} ${size}px ${serif ? 'Storybook, Georgia, serif' : 'Fredoka, system-ui, sans-serif'}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  if (shadow) { ctx.shadowColor = 'rgba(28,19,30,.45)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1; }
  if (outline) { ctx.strokeStyle = T.night ? 'rgba(16,23,39,.72)' : 'rgba(255,245,218,.75)'; ctx.lineWidth = 1; ctx.strokeText(label, x, y, maxWidth); }
  ctx.fillText(label, x, y, maxWidth); ctx.restore();
}

// kortet (papir, sydd kant og kvister) tegnes én gang per størrelse og legges på hele skjermpiksler
function uiCard(x, y, w, h, decorate = false) {
  blitSurface(cachedSurface('kort', w, h, 0, decorate, (px, py) => paintCard(px, py, w, h, decorate)), x, y);
}
function paintCard(x, y, w, h, decorate) {
  ctx.save();
  ctx.fillStyle = 'rgba(22,22,35,.17)'; rr(x, y + 4, w, h, 12); ctx.fill();
  ctx.fillStyle = UI.paper; rr(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#967343'; ctx.lineWidth = 1.2; rr(x, y, w, h, 12); ctx.stroke();
  ctx.save(); rr(x + 2, y + 2, w - 4, h - 4, 10); ctx.clip(); paperOn(ctx, 0.7); ctx.restore();
  runningStitch(rrPoints(x + 6, y + 6, w - 12, h - 12, 8, 1), '#C9A877', Math.round(w * 3 + h));   // sydd kant, som broderiet i logoen
  if (decorate) {
    uiSprig(x + 14, y + 29, 0.7, 0.2); uiSprig(x + w - 14, y + 30, 0.7, -0.2, true);
    uiSprig(x + 16, y + h - 15, 0.8, -0.3); uiSprig(x + w - 16, y + h - 15, 0.8, 0.3, true);
  }
  ctx.restore();
}

// Small botanical details use the same warm leaf/ink palette as the paintings.
function uiSprig(x, y, scale, angle = 0, mirror = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(mirror ? -scale : scale, scale);
  ctx.strokeStyle = '#8C794C'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -16, 1, -33); ctx.stroke();
  for (const [lx, ly, a, color] of [[-2,-6,-1.05,'#85905A'],[7,-12,1.1,'#B78043'],[0,-20,-1.1,'#C99A50'],[5,-27,0.65,'#9C7C40']]) {
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(a); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-5, -2, -4, -9, 0, -12); ctx.bezierCurveTo(5, -8, 4, -2, 0, 0); ctx.fill();
    ctx.strokeStyle = '#816A3C'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -10); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

function uiControl(key, x, y, w, h, label, fn, pressed) {
  hud[key] = { x, y, w, h, label, fn, pressed };
}

function uiButton(key, x, y, w, h, label, fn, options = {}) {
  const primary = options.fill == null;
  uiControl(key, x, y, w, h, label, fn);
  const age = time - press.t, down = !reduceMotion && press.key === key && age < 0.18;
  ctx.save();
  const dy = down ? 1.5 : 0;
  ctx.fillStyle = primary ? '#823E2E' : UI.edge; rr(x, y + 2.5, w, h, 9); ctx.fill();
  ctx.fillStyle = primary ? UI.red : '#EEE0C8'; rr(x, y + dy, w, h, 9); ctx.fill();
  ctx.strokeStyle = primary ? '#CB7960' : '#D4BC98'; ctx.lineWidth = 0.8;
  rr(x + 2.5, y + 2.5 + dy, w - 5, h - 5, 7); ctx.stroke();
  if (primary) {
    ctx.fillStyle = '#D79B52';
    for (const side of [x + 9, x + w - 9]) for (const offset of [-6, 6]) { ctx.beginPath(); ctx.ellipse(side, y + h / 2 + offset, 1.1, 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  uiText(label, x + w / 2, y + h / 2 + dy, options.size || 18, { color: primary ? UI.paper : UI.ink, weight: 600 });
  ctx.restore();
}

function uiIconButton(key, cx, cy, r, icon, fn, on = true, label = key) {
  uiControl(key, cx - r, cy - r, r * 2, r * 2, label, fn);
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#69482E'; circle(ctx, 0, 1.5, r + 1.5);
  ctx.fillStyle = '#D5AD70'; circle(ctx, 0, 0, r);
  ctx.fillStyle = UI.paper; circle(ctx, 0, 0, r - 3);
  ctx.strokeStyle = UI.edge; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = UI.ink; ctx.fillStyle = UI.ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  icon(r * 0.45);
  if (!on) { ctx.strokeStyle = UI.red; ctx.beginPath(); ctx.moveTo(-r * 0.45, r * 0.45); ctx.lineTo(r * 0.45, -r * 0.45); ctx.stroke(); }
  ctx.restore();
}

// nivåvelgeren: en mørk tresprosse med skårne skiller; det valgte nivået er en rødmalt innfelling
function uiWoodBar(x, y, w, h, labels, sel) {
  const L = cachedSurface('sprosse', Math.ceil(w), Math.ceil(h), 7, `${labels.join(',')}|${sel}`, (px, py) => paintWoodBar(px, py, w, h, labels, sel));
  blitSurface(L, x, y);
}
function paintWoodBar(x, y, w, h, labels, sel) {
  const r = rng(77), cw = (w - 8) / labels.length;
  ctx.fillStyle = 'rgba(30,18,10,.32)'; rr(x, y + 2.5, w, h, 8); ctx.fill();
  ctx.fillStyle = '#5A3F2B'; rr(x, y, w, h, 8); ctx.fill();
  ctx.save(); rr(x, y, w, h, 8); ctx.clip();
  ctx.strokeStyle = 'rgba(25,14,8,.28)'; ctx.lineWidth = 0.7;   // årer i valnøtten
  for (let k = 0; k < 5; k++) { const gy = y + 4 + r() * (h - 8), f = 0.03 + r() * 0.03, p0 = r() * 6; ctx.beginPath(); for (let xx = x; xx <= x + w; xx += 6) ctx.lineTo(xx, gy + Math.sin(xx * f + p0) * 1.2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,230,190,.16)'; ctx.fillRect(x, y, w, 1.4);   // fas: lys overkant, mørk underkant
  ctx.fillStyle = 'rgba(20,10,5,.3)'; ctx.fillRect(x, y + h - 2, w, 2);
  paperOn(ctx, 0.25); ctx.restore();
  ctx.strokeStyle = '#2E1F15'; ctx.lineWidth = 1.2; rr(x, y, w, h, 8); ctx.stroke();
  labels.forEach((label, i) => {
    const bx = x + 4 + i * cw;
    if (i) { ctx.fillStyle = 'rgba(20,10,5,.55)'; ctx.fillRect(bx - 0.6, y + 7, 1.2, h - 14); ctx.fillStyle = 'rgba(255,225,180,.18)'; ctx.fillRect(bx + 0.6, y + 7, 0.8, h - 14); }   // skåret skille
    if (i === sel) {   // rødmalt innfelling, litt slitt på kantene
      ctx.fillStyle = 'rgba(20,10,5,.4)'; rr(bx + 1, y + 4.5, cw - 2, h - 8, 5); ctx.fill();
      ctx.fillStyle = PAINT_RED.body; rr(bx + 1, y + 3.5, cw - 2, h - 8, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,205,.22)'; ctx.fillRect(bx + 4, y + 4.5, cw - 8, 1);
      ctx.fillStyle = hexA(WOOD.a, 0.35); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(bx + 3 + r() * (cw - 6), y + 4 + (r() < 0.5 ? 1 : h - 10), 1.4, 0.6, 0, 0, 7); ctx.fill(); }
    }
    ctx.font = `700 11.5px Storybook, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = i === sel ? PAINT_RED.text : '#EAD7B4'; ctx.fillText(label, bx + cw / 2, y + h / 2 - 0.5);
  });
}
// avkrysning: en rute aida med sydd kant; på = et rødt korssting
function uiCheck(cx, cy, on) {
  const s = 18, x = cx - s / 2, y = cy - s / 2;
  ctx.fillStyle = 'rgba(70,45,25,.18)'; ctx.fillRect(x + 1, y + 2, s, s);
  ctx.fillStyle = '#F6EAD3'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(110,84,62,.22)';   // aida-hull
  for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) ctx.fillRect(x + i * 3 - 0.35, y + j * 3 - 0.35, 0.7, 0.7);
  ctx.strokeStyle = '#8E6C46'; ctx.lineWidth = 1; ctx.setLineDash([2.2, 1.6]); ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1); ctx.setLineDash([]);
  if (on) { ctx.fillStyle = 'rgba(70,30,20,.3)'; ctx.fillRect(x + 3, y + 4, 12, 12); stitch(ctx, x + 3, y + 3, 12, '#8E3324', '#C9523A'); }
}
// tekst rett på maleriet står på en papirlapp (lyse tekster på løv er vanskelige å lese)
const uiPaper = (txt, x, y, size = 12) => paperLabel(txt, x, y, { size, serif: true });

function uiDim(alpha = 0.48) { ctx.fillStyle = `rgba(18,23,37,${alpha})`; ctx.fillRect(0, 0, W, H); }

const settingsIcon = k => {
  ctx.beginPath();
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r = k * (i % 2 ? 0.7 : 1); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, k * 0.3, 0, Math.PI * 2); ctx.stroke();
};

// logoen er «Pixelfugl» brodert i korssting, som et merke på maleriet (samme bilde som introen syr)
const menuHeadY = () => safeTop + (H - safeTop - safeBottom) * 0.145;
const menuLogoTop = () => Math.round(menuHeadY() - scene.logo.h / 2);
function drawMenuScreen() {
  // Heading and controls have separate quiet areas; the landscape remains visible.
  const usable = H - safeTop - safeBottom, headY = menuHeadY(), width = Math.min(246, W - 32), x = (W - width) / 2;
  const LG = scene.logo;
  if (!intro) blitLogo(LG.c, Math.round(W / 2 - LG.w / 2), menuLogoTop());   // under introen tegner drawIntro logoen
  ctx.save(); ctx.globalAlpha *= intro ? clamp((intro.t - introOpen()[1] + 0.2) / 0.25, 0, 1) : 1;   // undertittelen kommer når logoen er på plass
  uiText(`${SEASONS[seasonName].label} i bjørkeskogen`, W / 2, headY + 38, 13, { color: T.night ? UI.paper : UI.ink, shadow: T.night });
  ctx.restore();
  // under «Spill»: hintet, rekorden og ikonene står i forhold til knappen, så de aldri havner oppå hverandre på en lav skjerm
  // (på en lav skjerm løftes hele blokken, så ikonene får luft mot kanten)
  const playY = Math.min(safeTop + usable * 0.704, H - safeBottom - 166), hintY = Math.max(safeTop + usable * 0.807, playY + 67);
  const bestY = Math.max(safeTop + usable * 0.853, hintY + 27), bottom = Math.max(safeTop + usable * 0.93, bestY + 36);
  const selectY = playY - 49, cellW = (width - 8) / 4;
  const diffs = Object.entries(DIFFS);
  uiWoodBar(x, selectY, width, 35, diffs.map(([, value]) => value.label), diffs.findIndex(([key]) => key === diffName));
  diffs.forEach(([key, value], i) => uiControl('diff_' + key, x + 4 + i * cellW, selectY, cellW, 36, value.label, () => setDiff(key), diffName === key));
  uiButton('start', x + 28, playY, width - 56, 49, 'Spill', goReady, { size: 27 });
  uiPaper('Trykk for å flakse', W / 2, hintY, 12);
  tag(D.zen ? 'Fly i ditt eget tempo' : best > 0 ? `Beste: ${best}` : 'Ingen rekord ennå', W / 2, bestY, { size: 10.5, serif: true });
  uiIconButton('sound', W / 2 - 29, bottom, 19, ICONS.sound, () => Sound.toggleSfx(), !Sound.sfxMuted, 'Lydeffekter av/på');
  uiIconButton('settings', W / 2 + 29, bottom, 19, settingsIcon, () => { settingsOpen = true; }, true, 'Innstillinger');
  if (wardrobe) drawWardrobeScreen();
  else if (settingsOpen) drawSettingsScreen();
}

function drawSettingsScreen() {
  for (const key in hud) delete hud[key];
  uiDim();
  const w = 236, h = 290, x = (W - w) / 2, y = Math.max(safeTop + 12, (H - safeTop - safeBottom - h) / 2 + safeTop);
  uiCard(x, y, w, h); uiText('Innstillinger', W / 2, y + 33, 21, { serif: true });
  const rows = [
    ['s_sound', 'Lydeffekter', !Sound.sfxMuted, () => Sound.toggleSfx()],
    ['s_music', 'Musikk', !Sound.musMuted, () => Sound.toggleMusic()],
    ['s_theme', 'Kveldsstemning', themeName === 'night', toggleTheme]
  ];
  rows.forEach(([key, label, on, fn], i) => {
    const yy = y + 59 + i * 40;
    uiText(label, x + 20, yy + 18, 13, { align: 'left' });
    uiCheck(x + w - 32, yy + 18, on);
    uiControl(key, x + 14, yy, w - 28, 36, label, fn, on);
  });
  uiButton('s_wardrobe', x + 20, y + 191, w - 40, 35, 'Garderobe', () => { settingsOpen = false; wardrobe = true; wardrobePage = Math.floor(COSMETICS.findIndex(c => c.id === wear) / WARDROBE_PAGE); }, { fill: UI.paper, size: 14 });
  uiButton('s_done', x + 20, y + 241, w - 40, 35, 'Ferdig', () => { settingsOpen = false; }, { size: 14 });
}

function drawWardrobeScreen() {
  for (const key in hud) delete hud[key];
  uiDim();
  const pages = Math.ceil(COSMETICS.length / WARDROBE_PAGE), page = Math.min(wardrobePage, pages - 1);
  const w = 252, h = 333, x = (W - w) / 2, y = Math.max(safeTop + 12, (H - safeTop - safeBottom - h) / 2 + safeTop);
  uiCard(x, y, w, h); uiText('Garderobe', W / 2, y + 27, 23, { serif: true });
  uiText(`${totalPoints} poeng · ${COSMETICS.filter(isUnlocked).length} av ${COSMETICS.length} låst opp`, W / 2, y + 51, 10, { color: UI.muted });
  COSMETICS.slice(page * WARDROBE_PAGE, (page + 1) * WARDROBE_PAGE).forEach((c, i) => {
    const cx = x + 12 + (i % 3) * 78, cy = y + 69 + Math.floor(i / 3) * 91, ok = isUnlocked(c), on = wear === c.id;
    ctx.fillStyle = on ? '#EAD3A2' : '#EDDFC9'; rr(cx, cy, 72, 84, 7); ctx.fill();
    ctx.save(); ctx.globalAlpha = ok ? 1 : 0.35; ctx.translate(cx + 36, cy + 37); ctx.scale(1.12, 1.12); birdShape('normal', c.id); ctx.restore();
    uiText(ok ? c.label : c.gold ? 'Gull i én runde' : `${c.need} poeng`, cx + 36, cy + 71, 9, { color: ok ? UI.ink : UI.muted, maxWidth: 66 });
    if (ok) uiControl('w_' + c.id, cx, cy, 72, 84, c.label, () => setWear(c.id), on);
  });
  uiIconButton('w_prev', x + 32, y + 268, 14, ICONS.left, () => { wardrobePage = (page + pages - 1) % pages; }, true, 'Forrige side');
  uiIconButton('w_next', x + w - 32, y + 268, 14, ICONS.right, () => { wardrobePage = (page + 1) % pages; }, true, 'Neste side');
  uiText(`${page + 1} / ${pages}`, W / 2, y + 268, 11, { color: UI.muted });
  uiButton('w_done', x + 20, y + 289, w - 40, 32, 'Ferdig', () => { wardrobe = false; }, { size: 14 });
}

function drawReadyScreen() {
  // overskriften står på et kort med sydd kant (ingen tekst rett på maleriet)
  uiCard(W / 2 - 110, safeTop + 48, 220, 74);
  uiText('Klar for en flytur?', W / 2, safeTop + 76, 22, { serif: true });
  uiText(`${D.label} · fra fjellet til hytta`, W / 2, safeTop + 103, 12, { color: UI.muted });
  const y = Math.min(H - GROUND_H - 64, (H - GROUND_H) * 0.42 + 85);
  uiPaper('Trykk hvor som helst', W / 2, y, 13);
  uiIconButton('ready_menu', W - 30, safeTop + 25, 16, ICONS.left, goMenu, true, 'Tilbake til menyen');
}

function drawGameHud(groundY) {
  const y = safeTop + 50, ink = T.night ? UI.paper : UI.ink;
  const pop = reduceMotion ? 1 : keyframes([[0, 1.1], [0.2, 1, 'out']], time - scoreT);
  uiText(D.zen ? 'Zen' : String(score), W / 2, y + 2, D.zen ? 28 : 47 * pop, { color: ink, shadow: T.night, outline: true });
  uiText(D.zen ? 'Bare fly' : `Beste: ${best}`, W / 2, y + 35, 14, { color: ink, shadow: T.night, outline: true });
  let yy = y + 66;
  if (placeIdx > 0 && time - placeT < 3 && !home) { uiPaper(ROUTE[placeIdx].name, W / 2, yy, 11); yy += 30; }
  for (const [key, value] of Object.entries(active)) {
    if (!value) continue;
    const fraction = key === 'shield' ? 1 : value / POWERS[key].dur;
    tag(POWERS[key].label, W / 2, yy, { size: 10, serif: true, tilt: 0 });
    if (fraction < 1) { const tw = tagSize(POWERS[key].label, 10, true).w, pts = []; for (let px = W / 2 - tw / 2 + 14; px <= W / 2 - tw / 2 + 14 + (tw - 20) * fraction; px += 2) pts.push({ x: px, y: yy + 6.5 }); if (pts.length > 1) runningStitch(pts, '#C0392B', 41); }   // tiden som er igjen: en rød tråd
    yy += 28;
  }
  if (home && home.phase === 'rest') {
    uiCard(W / 2 - 107, Math.max(yy, groundY * 0.3), 214, 61);
    const hy = Math.max(yy, groundY * 0.3);
    uiText('Hjemme!', W / 2, hy + 20, 22, { serif: true }); uiText('Trykk for å fly videre', W / 2, hy + 44, 11);
  }
  if (state === State.PLAY && !paused) uiIconButton('pause', W - 27, safeTop + 32, 16, ICONS.pause, pauseGame, true, 'Pause');
  if (!home) {
    const place = ROUTE[Math.min(placeAt(score) + 1, ROUTE.length - 1)];
    uiPaper('Mot ' + place.name, W / 2, H - safeBottom - 46, 9.5);
    drawIllustratedRoute(W / 2 - 70, W / 2 + 70, H - safeBottom - 24, score, false, true);
  }
}

function drawResultsScreen() {
  // (kortet har luft under knappene, så den sydde kanten og kvistene ikke havner under «Meny»)
  const w = 244, h = Math.min(420, H - safeTop - safeBottom - 28), x = (W - w) / 2, k = h / 420;
  const enter = reduceMotion ? 1 : easeOutCubic(Math.min(1, overT / 0.4));
  const y = Math.max(safeTop + 14, (H - safeTop - safeBottom - h) / 2 + safeTop) + (1 - enter) * 14;
  uiDim(0.52 * enter); uiCard(x, y, w, h, true);
  uiSprig(W / 2 - 15, y + 59 * k, k, -1.1); uiSprig(W / 2 + 15, y + 59 * k, k, 1.1, true);
  ctx.save(); ctx.translate(W / 2, y + 48 * k); ctx.scale(1.18 * k, 1.18 * k); birdShape('happy', wear); ctx.restore();
  uiText(newBest ? 'Ny rekord!' : 'Fin flytur!', W / 2, y + 96 * k, 27 * k);
  uiText(String(overShown), W / 2, y + 155 * k, 57 * k);
  uiText('P O E N G', W / 2, y + 190 * k, 10 * k, { color: UI.muted });
  uiText(`Beste: ${best}`, W / 2, y + 218 * k, 14 * k);
  uiMountainStamp(x + 18, y + 199 * k, 0.65 * k); uiMountainStamp(x + w - 52, y + 199 * k, 0.65 * k);
  ctx.strokeStyle = '#BDA57F'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x + 24, y + 204 * k); ctx.lineTo(x + w - 24, y + 204 * k); ctx.stroke();
  const target = ROUTE[Math.min(placeAt(score) + 1, ROUTE.length - 1)].name;
  uiText(homeReached() ? 'Velkommen hjem!' : 'På vei til ' + target, W / 2, y + 251 * k, 12 * k, { maxWidth: w - 30 });
  drawIllustratedRoute(x + 28, x + w - 28, y + 280 * k, Math.min(overShown, score), homeReached() && overShown >= HOME);
  if (unlocked.length) uiText(`Ny pynt: ${unlocked[0].label}`, W / 2, y + 300 * k, 9 * k, { color: UI.muted, maxWidth: w - 28 });
  if (overT > 0.7) {
    uiButton('again', x + 24, y + 314 * k, w - 48, 45 * k, 'Spill igjen', goReady, { size: 23 * k });
    uiButton('menu', x + 24, y + 369 * k, w - 48, 29 * k, 'Meny', goMenu, { fill: UI.paper, size: 17 * k });
  }
}

function uiMountainStamp(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.fillStyle = '#D6C6A6';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(15,-22); ctx.lineTo(23,-11); ctx.lineTo(32,-28); ctx.lineTo(51,0); ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawIllustratedRoute(x0, x1, y, reached, homeNow, onSoil = false) {
  const ink = onSoil ? '#EBD8B5' : '#92704E', map = at => x0 + (x1 - x0) * at / HOME;
  ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  for (const place of ROUTE.slice(0, -1)) {
    ctx.fillStyle = place.at <= reached ? '#D5A352' : UI.paper;
    ctx.beginPath(); ctx.arc(map(place.at), y, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  const bx = map(homeNow ? HOME : Math.min(reached, HOME));
  ctx.save(); ctx.translate(bx, y - 10); ctx.scale(0.3, 0.3); birdShape('normal', wear); ctx.restore();
  ctx.fillStyle = '#785239'; rr(x1 - 6, y - 10, 15, 12, 1); ctx.fill();
  ctx.fillStyle = '#E7BF69'; ctx.fillRect(x1 - 3, y - 7, 3, 4); ctx.fillRect(x1 + 3, y - 7, 3, 4);
  ctx.fillStyle = '#405444'; ctx.beginPath(); ctx.moveTo(x1 - 9, y - 10); ctx.lineTo(x1 + 1.5, y - 17); ctx.lineTo(x1 + 12, y - 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x1 + 1, y - 17); ctx.lineTo(x1 + 1, y - 24); ctx.stroke();
  ctx.fillStyle = '#A64B35'; ctx.fillRect(x1 + 1, y - 24, 6, 3); ctx.restore();
}

function drawPauseScreen() {
  for (const key in hud) delete hud[key];
  uiDim();
  if (resumeT > 0) {
    uiText(String(Math.ceil(resumeT / 0.5)), W / 2, H * 0.42, 64, { serif: true, color: UI.paper }); return;
  }
  const w = 222, h = 220, x = (W - w) / 2, y = (H - safeTop - safeBottom - h) / 2 + safeTop;
  uiCard(x, y, w, h); uiText('En liten pause', W / 2, y + 34, 20, { serif: true });
  uiText(`${D.label} · ${score} poeng`, W / 2, y + 63, 11, { color: UI.muted });
  uiButton('resume', x + 20, y + 88, w - 40, 39, 'Fortsett', resumeGame);
  uiButton('pmenu', x + 20, y + 139, w - 40, 34, 'Meny', goMenu, { fill: UI.paper, size: 14 });
  const j = journeyLines(score, homeReached()); uiText(j.next || j.line, W / 2, y + 195, 10, { color: UI.muted, maxWidth: w - 28 });
}

/* Reuse nodes while their labels/states stay the same. No DOM allocation per
   frame; native controls get the exact same positions as the painted controls. */
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
        // Update hit areas immediately, before a second input can hit an old control.
        render();
      });
      controlNodes.set(key, node); controlRoot.appendChild(node);
    }
    const label = b.label || key;
    if (node.getAttribute('aria-label') !== label) { node.setAttribute('aria-label', label); node.textContent = label; }
    if (b.pressed === undefined) node.removeAttribute('aria-pressed');
    else node.setAttribute('aria-pressed', String(b.pressed));
    const position = `left:${b.x * scale}px;top:${b.y * scale}px;width:${b.w * scale}px;height:${b.h * scale}px;`;
    if (node._position !== position) { node.style.cssText = position; node._position = position; }
  }
}
