/* Pixelfugl – Konfigurasjon: konstanter, lagring, vanskelighetsgrader, power-ups og tema.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ============================================================
   PIXELFUGL v3.3 – koselig bjørkeskog
   – Tidsbasert fysikk (px/s, px/s²) med fast tidssteg 120 Hz,
     interpolert tegning mellom steg (jevnt på 60/90/120 Hz)
   – Forhåndstegnede parallakse-lag (fjell, fjord, hytter, bjørkeskog), bjørkestammer som hinder,
     fugl med strikket skjerf (Verlet-fysikk), ansiktsuttrykk og myke partikler
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
  hard:   { label: 'Hard',   gap: 112, speed: 160, spacing: 156, gravity: 1320, flap: -362, shift: 120, variantsFrom: 4,  color: '#FFA28C', ink: '#CC5238' }
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
  double: { label: 'Eikenøtt ×2', color: '#F2B544', glow: 'rgba(242,181,68,.5)',  dur: 8 }
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
  }
};
const hr = new Date().getHours();
let themeName = store.get('pf.theme') || ((hr >= 20 || hr < 6) ? 'night' : 'day');
if (!THEMES[themeName]) themeName = 'day';
let T = THEMES[themeName];
