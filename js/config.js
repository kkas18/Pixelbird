/* Pixelfugl – Konfigurasjon: konstanter, lagring, vanskelighetsgrader, power-ups og tema.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ============================================================
   PIXELFUGL v3.8 – koselig bjørkeskog med blåmeis
   – Tidsbasert fysikk (px/s, px/s²) med fast tidssteg 120 Hz,
     interpolert tegning mellom steg (jevnt på 60/90/120 Hz)
   – Forhåndstegnede parallakse-lag (fjell, fjord, hytter, bjørkeskog), bjørkestammer som hinder,
     blåmeis med lusekofte-skjerf (Verlet-fysikk), ansiktsuttrykk og myke partikler
   – Håndlaget preg: korssting-logo, rosemaling, ujevn strek, papirkorn og flate tonetrinn
   – Landskap uten gjentakelse: bakkestykker i tilfeldig rekkefølge, unike hus, fjell med karakter, sjeldne landemerker
   – Dybde som et kamerabilde: dybdeskarphet, dis, forgrunn, kamera som følger fuglen og fokustrekk
   – Generert koselig musikk (spilledåse, pad, F-dur 88 BPM), myke lydeffekter og naturlyder (Web Audio)
   Logisk bredde 288 px, høyde følger skjermen.
   ============================================================ */

const LOGICAL_W = 288;
const STEP = 1 / 120;               // fysikk-steg (sekunder)
// hinderne er bjørkestammer («pipe» i koden): bredde, endeflate (snitt + mosekant) og hvor langt mosen stikker ut
const PIPE_W = 56, END_H = 12, TRUNK_LIP = 4;
const GROUND_H = 92;
const BIRD_X = 78, BIRD_R = 11, POWER_R = 13;
const TERMINAL = 560;               // px/s
const AIR_DRAG = 0.35;              // 1/s
const ZONE_H = 400;                 // fast høyde på sonen der gapene kan ligge – lik på alle skjermer
const MIN_GAP = 92;                 // absolutt minste åpning (px), uansett nivå og variant
const SHIELD_GRACE = 0.8;           // sekunder uten kollisjon etter at skjoldet tar et treff
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* localStorage kan kaste (privat modus, blokkerte data) – spillet skal starte uansett */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

/* ---------- Vanskelighetsgrader (alle hastigheter i px/s) ----------
   shift = maks forskjell i gap-midtpunkt mellom to rør på rad */
const DIFFS = {
  lett:   { label: 'Lett',   gap: 152, speed: 118, spacing: 192, gravity: 1050, flap: -330, shift: 150, variantsFrom: 14, color: '#9BD883', ink: '#4E8F3E' },
  normal: { label: 'Normal', gap: 130, speed: 136, spacing: 172, gravity: 1180, flap: -345, shift: 135, variantsFrom: 8,  color: '#FFD27A', ink: '#B97C12' },
  hard:   { label: 'Hard',   gap: 112, speed: 160, spacing: 156, gravity: 1320, flap: -362, shift: 120, variantsFrom: 4,  color: '#FFA28C', ink: '#CC5238' },
  // Zen: ingen død og ingen poengjag – fuglen spretter mykt videre når den treffer noe
  zen:    { label: 'Zen',    gap: 165, speed: 108, spacing: 200, gravity: 980,  flap: -320, shift: 140, variantsFrom: Infinity, color: '#BFE6D9', ink: '#3E8F78', zen: true }
};
let diffName = store.get('pf.diff') || 'normal';
if (!DIFFS[diffName]) diffName = 'normal';
let D = DIFFS[diffName];
const bestKey = () => 'pf.best.' + diffName;
let best = +store.get(bestKey()) || 0;

// såpeboble (skjold), snegl (sakte film) og gyllen eikenøtt (dobbel poeng)
const POWERS = {
  shield: { label: 'Såpeboble',   color: '#7FD0F2', glow: 'rgba(127,208,242,.5)', dur: 0 },
  slow:   { label: 'Sneglefart',  color: '#B49BE8', glow: 'rgba(180,155,232,.5)', dur: 6 },
  double: { label: 'Dobbel eikenøtt', color: '#F2B544', glow: 'rgba(242,181,68,.5)',  dur: 8 }
};

/* ---------- Tema: varm pastell (dag) og koselig kveld (natt) ----------
   ink = varm kontur som brukes på tegningene i stedet for svarte skygger */
const THEMES = {
  day: {
    skyTop: '#8FD3F4', skyMid: '#C4E8F4', skyBot: '#FFE4C8', sun: '#FFF1C4', sunGlow: 'rgba(255,214,150,.55)',
    cloud: '#FFFFFF', cloudShade: '#F6DCD3',
    mountainFar: '#BCCBEA', mountainNear: '#A3B7DE', snow: '#FBF8FF', fjord: '#A6D9EC', fjordLight: '#E3F6FC',
    hillFar: '#AEDB9F', hillNear: '#8CCB86', forest: '#86C08A', crown: '#A6D68E', crownWarm: '#F4C95D',
    cabin: '#D0583F', cabinDark: '#A8432F', roof: '#5B4636', window: '#CFEFF7', windowLit: false,
    grass: '#94D46C', grassDark: '#72B955', soil: '#D3AE84', soilDark: '#B48C64', stone: '#E6DACA',
    trunk: '#FBF8F1', trunkShade: '#D8CFC2', bark: '#3F3936', cut: '#F4DCA8', cutRing: '#D7B27A', moss: '#86C35C',
    ink: '#5B4636', text: '#FFFDF6', textShadow: 'rgba(91,70,54,.45)', vignette: 'rgba(255,178,140,.16)', night: false
  },
  night: {
    skyTop: '#23264F', skyMid: '#45457F', skyBot: '#8C77B2', sun: '#FFF3C8', sunGlow: 'rgba(255,236,190,.28)',
    cloud: '#8581BA', cloudShade: '#66629A',
    mountainFar: '#4D4F86', mountainNear: '#414379', snow: '#BDB9E6', fjord: '#3D4F88', fjordLight: '#7488C4',
    hillFar: '#3F6A6B', hillNear: '#365E5A', forest: '#2F5A56', crown: '#3F7262', crownWarm: '#8F7A45',
    cabin: '#A0473A', cabinDark: '#7E372D', roof: '#2E2438', window: '#FFD47E', windowLit: true,
    grass: '#55935D', grassDark: '#447A4B', soil: '#8C705E', soilDark: '#71594B', stone: '#A39790',
    trunk: '#D6D1E3', trunkShade: '#9C95B8', bark: '#2C2834', cut: '#DCC7A2', cutRing: '#B69C76', moss: '#5B9A5E',
    ink: '#2C2442', text: '#FFF7E8', textShadow: 'rgba(20,14,40,.55)', vignette: 'rgba(14,10,44,.38)', night: true
  },
  // gyllen solnedgang (brukes også som soloppgang): lav sol bak fjellene, rosa himmel
  sunset: {
    skyTop: '#7C8BD3', skyMid: '#F0A9A4', skyBot: '#FFD3A0', sun: '#FFD98A', sunGlow: 'rgba(255,170,110,.6)', sunLow: true,
    cloud: '#FFE9DE', cloudShade: '#F2B4A8',
    mountainFar: '#B9A6D1', mountainNear: '#9F8DC3', snow: '#FFE9E8', fjord: '#E6AAB6', fjordLight: '#FFE1D8',
    hillFar: '#B7C98E', hillNear: '#97B67D', forest: '#879F75', crown: '#B6CF87', crownWarm: '#F4B15D',
    cabin: '#C9533B', cabinDark: '#9E3F2C', roof: '#4F3B33', window: '#FFD47E', windowLit: true,
    grass: '#A5C86B', grassDark: '#85AD56', soil: '#C99C78', soilDark: '#A97E5C', stone: '#E2CFC0',
    trunk: '#FBF0E8', trunkShade: '#D6C0B6', bark: '#3F3336', cut: '#F4D3A0', cutRing: '#D3A473', moss: '#93B85A',
    ink: '#5B4040', text: '#FFF8EE', textShadow: 'rgba(91,60,60,.5)', vignette: 'rgba(255,140,120,.2)', night: false
  }
};

/* ---------- Tid på døgnet i løpet av en runde ----------
   Hvert 10. poeng glir tiden videre: dag, solnedgang, kveld, soloppgang, dag … (krysstoning 1,8 s) */
const CYCLE = ['day', 'sunset', 'night', 'sunset'];

/* ---------- Årstider (etter dato; kan overstyres med localStorage «pf.season») ----------
   Overstyringene gjelder dagpaletten; om kvelden og i solnedgang blandes de mot tidens toning. */
const SEASONS = {
  spring: { label: 'Vår', mote: 'petal', colors: { crown: '#B4E39C', crownWarm: '#FFC2D4', grass: '#9FDB78', moss: '#8FD068' } },
  summer: { label: 'Sommer', mote: 'pollen', colors: {} },
  autumn: { label: 'Høst', mote: 'leaf', colors: { crown: '#F2B65A', crownWarm: '#E2703F', forest: '#D3A55E', grass: '#B5C96A', grassDark: '#94AE55', hillFar: '#C3D69A', hillNear: '#A9C682', moss: '#9DB85A' } },
  winter: { label: 'Vinter', mote: 'snow', colors: { crown: '#EEF3F8', crownWarm: '#DCE6F0', forest: '#C9D7E3', grass: '#F4F7FB', grassDark: '#D5E0EA', hillFar: '#E6EEF5', hillNear: '#D8E4EE', moss: '#EEF3F8' } }
};
const seasonFor = d => ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][d.getMonth()];
let seasonName = store.get('pf.season');
if (!SEASONS[seasonName]) seasonName = seasonFor(new Date());
const TINTS = { day: null, sunset: ['#F2A07A', 0.18], night: ['#2A2C5A', 0.55] };
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1).toUpperCase();
}
// palett for en tid på døgnet, med årstidens farger blandet inn
function paletteFor(name) {
  const base = THEMES[name], tint = TINTS[name], over = SEASONS[seasonName].colors, pal = { ...base };
  for (const k in over) pal[k] = tint ? mixHex(over[k], tint[0], tint[1]) : over[k];
  pal.tint = tint;   // brukes til å tone faste farger (hus, landemerker) etter tiden på døgnet
  return pal;
}

/* ---------- Garderobe: pynt som låses opp med poeng (sum av alle runder) ---------- */
const COSMETICS = [
  { id: 'none',        label: 'Bare skjerf',    need: 0 },
  { id: 'bow',         label: 'Sløyfe',         need: 10 },
  { id: 'beanie',      label: 'Strikkelue',     need: 25 },
  { id: 'toadstool',   label: 'Fluesopphatt',   need: 45 },
  { id: 'flower',      label: 'Blomst',         need: 60 },
  { id: 'sunglasses',  label: 'Solbriller',     need: 80 },
  { id: 'flowercrown', label: 'Blomsterkrans',  need: 100 },
  { id: 'glasses',     label: 'Briller',        need: 120 },
  { id: 'viking',      label: 'Vikinghjelm',    need: 150 },
  { id: 'santa',       label: 'Nisselue',       need: 200 },
  { id: 'tophat',      label: 'Flosshatt',      need: 300 },
  { id: 'crown',       label: 'Krone',          need: 0, gold: true }   // gull (30 poeng) i én runde
];
const WARDROBE_PAGE = 6;   // ruter per side i garderoben
let totalPoints = +store.get('pf.total') || 0, hasGold = store.get('pf.gold') === '1';
let wear = store.get('pf.wear') || 'none';
const isUnlocked = c => c.gold ? hasGold : totalPoints >= c.need;
if (!COSMETICS.some(c => c.id === wear && isUnlocked(c))) wear = 'none';

const hr = new Date().getHours();
// themeName = tiden runden starter på (velges i menyen); curTheme = tiden akkurat nå
let themeName = store.get('pf.theme') || ((hr >= 20 || hr < 6) ? 'night' : 'day');
if (themeName !== 'day' && themeName !== 'night') themeName = 'day';
let curTheme = themeName;
let T = paletteFor(curTheme);
