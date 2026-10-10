/* Pixelfugl – Konfigurasjon: konstanter, lagring, vanskelighetsgrader, power-ups og garderobe.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ============================================================
   PIXELFUGL v11 – arkade
   – Tidsbasert fysikk (px/s, px/s²) med fast tidssteg 120 Hz,
     interpolert tegning mellom steg (jevnt på 60/90/120 Hz)
   – Flyr som et klassisk flakse-spill: ett trykk gir ett løft, tyngden drar ned
   – Arkadestil: svart bakgrunn, doble blå labyrintvegger, prikker å spise og en kraftprikk som gir skjold
   – Blåmeisen som en 8-bits arkadefigur (gult bryst, blå hette, rødt skjerf), nebbet spiser prikkene
   – Alt tegnes i koden: egen 5 × 7-pikselskrift, figurer fra rutenett, ingen bilder eller fontfiler (js/pixel.js)
   – Egen chiptune-musikk og lydeffekter (firkant, trekant og støy), ingen opptak
   – Reisen hjem: steder som blinkende bannere, og hytta med fuglebrettet ved 60 poeng
   – Garderobe med pikselplagg, medaljer og retro-skjerm (skannlinjer) som valg
   Logisk bredde 288 px, høyde følger skjermen.
   ============================================================ */

const LOGICAL_W = 288;
const STEP = 1 / 120;               // fysikk-steg (sekunder)
// hinderne er labyrintvegger («pipe» i koden): bredde og hvor runde hjørnene er (for kollisjonen)
const PIPE_W = 56, WALL_R = 8;
// prikkene i hver åpning: antall, avstand og radius; en full rad gir ett ekstra poeng
const DOTS_PER_GAP = 3, DOT_GAP = 14, DOT_R = 3, DOT_EAT = 18;   // DOT_EAT: hvor nær fuglens midte en prikk må være for å bli spist
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

// kraftprikk (skjold), snegle (sakte film) og gyllen eikenøtt (dobbel poeng)
const POWERS = {
  shield: { label: 'Skjold',  color: '#45E3FF', dur: 0 },
  slow:   { label: 'Sakte',   color: '#C78BFF', dur: 6 },
  double: { label: 'Dobbel',  color: '#FFC23D', dur: 8 }
};

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

// retro-skjerm: svake skannlinjer og mørke hjørner, som på en gammel arkadeskjerm (på som standard)
let crt = store.get('pf.crt') !== '0';
