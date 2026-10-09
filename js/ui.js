/* Pixelfugl – rolig eventyrbok-UI. Samme Canvas-mål som verden og DOM-knapper
   med identiske treffområder, slik at menyene også kan brukes med tastatur. */
'use strict';

const UI = { paper: '#F6EBD6', ink: '#49392E', muted: '#7E6A55', red: '#AC4C35', gold: '#EFC579', edge: '#C8AE88' };
let settingsOpen = false;

function uiText(label, x, y, size, options = {}) {
  const { serif = false, color = UI.ink, weight = 500, align = 'center', maxWidth = W - 40 } = options;
  ctx.save();
  ctx.font = `${serif ? 700 : weight} ${size}px ${serif ? 'Storybook, Georgia, serif' : 'Fredoka, system-ui, sans-serif'}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(label, x, y, maxWidth); ctx.restore();
}

function uiCard(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(22,22,35,.17)'; rr(x, y + 4, w, h, 12); ctx.fill();
  ctx.fillStyle = UI.paper; rr(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = UI.edge; ctx.lineWidth = 0.8; rr(x + 3, y + 3, w - 6, h - 6, 10); ctx.stroke();
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
  uiText(label, x + w / 2, y + h / 2 + dy, options.size || 16, { color: primary ? UI.paper : UI.ink, weight: 600 });
  ctx.restore();
}

function uiIconButton(key, cx, cy, r, icon, fn, on = true, label = key) {
  uiControl(key, cx - r, cy - r, r * 2, r * 2, label, fn);
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = UI.paper; circle(ctx, 0, 0, r);
  ctx.strokeStyle = UI.edge; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = UI.ink; ctx.fillStyle = UI.ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  icon(r * 0.45);
  if (!on) { ctx.strokeStyle = UI.red; ctx.beginPath(); ctx.moveTo(-r * 0.45, r * 0.45); ctx.lineTo(r * 0.45, -r * 0.45); ctx.stroke(); }
  ctx.restore();
}

function uiDim(alpha = 0.48) { ctx.fillStyle = `rgba(18,23,37,${alpha})`; ctx.fillRect(0, 0, W, H); }

const settingsIcon = k => {
  ctx.beginPath();
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r = k * (i % 2 ? 0.7 : 1); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, k * 0.3, 0, Math.PI * 2); ctx.stroke();
};

function drawMenuScreen() {
  // Heading and controls have separate quiet areas; the landscape remains visible.
  const headY = safeTop + Math.min(84, H * 0.14), width = Math.min(236, W - 40), x = (W - width) / 2;
  uiText('Pixelfugl', W / 2, headY, 38, { serif: true, color: T.night ? UI.paper : UI.ink, maxWidth: width + 12 });
  uiText(`${SEASONS[seasonName].label} i bjørkeskogen`, W / 2, headY + 32, 12, { color: T.night ? '#E1D5C1' : UI.ink });
  const bottom = H - safeBottom - 22, playY = bottom - 140;
  const selectY = playY - 50, cellW = (width - 8) / 4;
  ctx.fillStyle = T.night ? 'rgba(26,29,46,.88)' : 'rgba(246,235,214,.92)'; rr(x, selectY, width, 36, 9); ctx.fill();
  Object.entries(DIFFS).forEach(([key, value], i) => {
    const bx = x + 4 + i * cellW, selected = diffName === key;
    if (selected) { ctx.fillStyle = UI.gold; rr(bx, selectY + 4, cellW, 28, 6); ctx.fill(); }
    uiText(value.label, bx + cellW / 2, selectY + 18, 12, { color: selected || !T.night ? UI.ink : UI.paper, weight: selected ? 600 : 400 });
    uiControl('diff_' + key, bx, selectY, cellW, 36, value.label, () => setDiff(key), selected);
  });
  uiButton('start', x + 16, playY, width - 32, 44, 'Spill', goReady, { size: 20 });
  // These labels sit on one understated strip, readable in every time/season palette.
  ctx.fillStyle = T.night ? 'rgba(26,29,46,.84)' : 'rgba(246,235,214,.9)'; rr(W / 2 - 91, playY + 56, 182, 44, 7); ctx.fill();
  const ink = T.night ? UI.paper : UI.ink;
  uiText('Trykk for å flakse', W / 2, playY + 70, 11, { color: ink });
  uiText(D.zen ? 'Zen · fly i ditt eget tempo' : `Beste: ${best} · ${D.label}`, W / 2, playY + 87, 10, { color: ink, weight: 400 });
  uiIconButton('sound', W / 2 - 28, bottom - 1, 17, ICONS.sound, () => Sound.toggleSfx(), !Sound.sfxMuted, 'Lydeffekter av/på');
  uiIconButton('settings', W / 2 + 28, bottom - 1, 17, settingsIcon, () => { settingsOpen = true; }, true, 'Innstillinger');
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
    ctx.fillStyle = on ? '#607965' : '#C5B59D'; rr(x + w - 55, yy + 8, 35, 20, 10); ctx.fill();
    ctx.fillStyle = UI.paper; circle(ctx, x + w - (on ? 30 : 45), yy + 18, 7);
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
  uiText('Klar for en flytur?', W / 2, safeTop + 70, 23, { serif: true, color: T.night ? UI.paper : UI.ink });
  uiText(`${D.label} · fra fjellet til hytta`, W / 2, safeTop + 99, 12, { color: T.night ? UI.paper : UI.ink });
  const y = Math.min(H - GROUND_H - 64, (H - GROUND_H) * 0.42 + 85);
  uiCard(W / 2 - 86, y - 18, 172, 36); uiText('Trykk hvor som helst', W / 2, y, 12);
  uiIconButton('ready_menu', W - 30, safeTop + 25, 16, ICONS.left, goMenu, true, 'Tilbake til menyen');
}

function drawGameHud(groundY) {
  const y = safeTop + 31, ink = T.night ? UI.paper : UI.ink;
  ctx.fillStyle = T.night ? 'rgba(24,28,45,.8)' : 'rgba(246,235,214,.9)'; rr(W / 2 - 44, y - 20, 88, 65, 10); ctx.fill();
  const pop = reduceMotion ? 1 : keyframes([[0, 1.1], [0.2, 1, 'out']], time - scoreT);
  uiText(D.zen ? 'Zen' : String(score), W / 2, y + 2, D.zen ? 24 : 32 * pop, { serif: true, color: ink });
  uiText(D.zen ? 'Bare fly' : `Beste ${best}`, W / 2, y + 30, 9, { color: ink, weight: 400 });
  let yy = y + 66;
  if (placeIdx > 0 && time - placeT < 3 && !home) { uiCard(W / 2 - 65, yy - 12, 130, 24); uiText(ROUTE[placeIdx].name, W / 2, yy, 11); yy += 32; }
  for (const [key, value] of Object.entries(active)) {
    if (!value) continue;
    const fraction = key === 'shield' ? 1 : value / POWERS[key].dur;
    ctx.fillStyle = UI.paper; rr(W / 2 - 60, yy - 11, 120, 24, 6); ctx.fill();
    uiText(POWERS[key].label, W / 2, yy, 10);
    ctx.fillStyle = UI.red; rr(W / 2 - 50, yy + 8, Math.max(1, 100 * fraction), 2, 1); ctx.fill(); yy += 31;
  }
  if (home && home.phase === 'rest') {
    uiCard(W / 2 - 107, Math.max(yy, groundY * 0.3), 214, 61);
    const hy = Math.max(yy, groundY * 0.3);
    uiText('Hjemme!', W / 2, hy + 20, 22, { serif: true }); uiText('Trykk for å fly videre', W / 2, hy + 44, 11);
  }
  if (state === State.PLAY && !paused) uiIconButton('pause', W - 30, safeTop + 27, 16, ICONS.pause, pauseGame, true, 'Pause');
}

function drawResultsScreen() {
  const w = 236, h = 338, x = (W - w) / 2;
  const enter = reduceMotion ? 1 : easeOutCubic(Math.min(1, overT / 0.4));
  const y = Math.max(safeTop + 14, (H - safeTop - safeBottom - h) / 2 + safeTop) + (1 - enter) * 14;
  uiDim(0.48 * enter); uiCard(x, y, w, h);
  uiText(newBest ? 'Ny rekord!' : 'Fin flytur!', W / 2, y + 32, 23, { serif: true });
  uiText(D.label, W / 2, y + 59, 11, { color: UI.muted });
  uiText(String(overShown), W / 2, y + 99, 48, { serif: true });
  uiText('POENG', W / 2, y + 131, 10, { color: UI.muted });
  const medal = medalFor(score);
  uiText(`Beste: ${best}${medal ? ' · ' + medal[2] : ''}`, W / 2, y + 153, 12);
  ctx.strokeStyle = '#DCC8A8'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x + 24, y + 176); ctx.lineTo(x + w - 24, y + 176); ctx.stroke();
  const journey = journeyLines(score, homeReached());
  uiText(journey.line, W / 2, y + 193, 11, { maxWidth: w - 30 });
  drawRoute(x + 27, x + w - 27, y + 218, Math.min(overShown, score), homeReached() && overShown >= HOME);
  uiText(unlocked.length ? `Ny pynt: ${unlocked[0].label}` : journey.next || 'Velkommen hjem!', W / 2, y + 237, 10, { color: UI.muted, maxWidth: w - 28 });
  if (overT > 0.7) {
    uiButton('again', x + 20, y + 258, w - 40, 38, 'Spill igjen', goReady);
    uiButton('menu', x + 20, y + 306, w - 40, 24, 'Meny', goMenu, { fill: UI.paper, size: 12 });
  }
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
  document.body.dataset.screen = state === State.MENU && !settingsOpen && !wardrobe ? 'menu' : 'game';
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
