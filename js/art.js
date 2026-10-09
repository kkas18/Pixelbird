/* Production paintings derived from the approved reference. These are scenery
   and bark sprites, never a flattened screenshot of the UI. */
'use strict';
const ART = { night: null, day: null, birch: null, foreground: null, panoramaNight: null, panoramaDay: null, woodland: null };
function loadArtwork() {
  return Promise.all(Object.entries({ night: 'forest-night.webp', day: 'forest-day.webp', birch: 'birch.webp', foreground: 'foreground-depth.webp', panoramaNight: 'panorama-night.webp', panoramaDay: 'panorama-day.webp', woodland: 'woodland-scroll.webp' }).map(([key, file]) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => { ART[key] = image; resolve(); };
    // A failed asset must not stop the game: procedural art remains a fallback.
    image.onerror = () => resolve(); image.src = 'art/' + file;
  })));
}

/* ---------- Årstider og lesbarhet ----------
   Maleriene er høst. For de andre årstidene fargelegges de i en egen tråd (Web Worker), så telefonen ikke hakker:
   sommer og vår flytter høstløvet mot grønt (jorda og de røde bærene holdes utenfor), vinter blir kald og blek med
   rimfrost på flatene som vender opp. Bildene bak selve spillet (panorama og skogslag) dempes i tillegg i alle
   årstider (lavere metning og kontrast, et tynt dislag), så fuglen og stammene leses tydelig. Menymaleriet beholder
   full styrke. Bjørka beholder barken (ellers ville kjukene blitt grønne) og får bare et kaldt skjær om vinteren. */
const SEASON_ART = {};   // ferdig fargelagte lerreter for årstiden (og spillgraderingen)
const ART_JOB = {        // rolle: scene (landskap med jord nederst), props (forgrunn), bark; play = dempes bak spillet
  day: { role: 'scene' }, night: { role: 'scene' },
  panoramaDay: { role: 'scene', play: true }, panoramaNight: { role: 'scene', play: true },
  woodland: { role: 'scene', play: true }, foreground: { role: 'props' }, birch: { role: 'bark' }
};
const RECOLOR_WORKER = `onmessage = e => { const m = e.data; recolor(m.data, m.w, m.h, m.season, m.role, m.play, m.night); postMessage({ id: m.id, data: m.data }, [m.data.buffer]); };
${recolor.toString()}`;
// én piksel om gangen, i ren JS (kjører i tråden); d er RGBA 0–255
function recolor(d, w, h, season, role, play, night) {
  const green = season === 'summer' ? [92, 0.62, 0.86] : season === 'spring' ? [70, 0.55, 1] : null, winter = season === 'winter';
  const haze = night ? [64, 70, 104] : [222, 226, 232];
  for (let y = 0; y < h; y++) {
    const yf = y / h, soil = role === 'scene' && yf > 0.87, land = role !== 'scene' || yf > 0.42;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (d[i + 3] === 0) continue;
      if (green && role !== 'bark' && !soil) {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
        if (s > 0.38 && v > 0.35 && mx !== mn) {
          let hu = mx === r ? 60 * (((g - b) / (mx - mn)) % 6) : mx === g ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - g) / (mx - mn) + 4);
          if (hu < 0) hu += 360;
          if (hu > 14 && hu < 58) {   // høstløv: gult til oransje
            const k = Math.min(1, (s - 0.38) / 0.25), h2 = hu + k * (green[0] + (hu - 35) * 0.35 - hu), s2 = s * (1 - k * (1 - green[1])), v2 = v * (1 - k * (1 - green[2]));
            const c = v2 * s2, hp = h2 / 60, xx = c * (1 - Math.abs(hp % 2 - 1)), m = v2 - c;
            const [r1, g1, b1] = hp < 1 ? [c, xx, 0] : hp < 2 ? [xx, c, 0] : hp < 3 ? [0, c, xx] : hp < 4 ? [0, xx, c] : hp < 5 ? [xx, 0, c] : [c, 0, xx];
            r = (r1 + m) * 255; g = (g1 + m) * 255; b = (b1 + m) * 255;
          }
        }
      } else if (winter) {
        const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
        if (role === 'bark') { r = r * 0.86 + lum * 255 * 0.1; g = g * 0.9 + lum * 255 * 0.08; b = Math.min(255, b * 0.96 + lum * 255 * 0.12); }
        else {
          const j = i + 8 * w < d.length ? i + 8 * w : i, below = (0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2]) / 255;
          const up = Math.min(1, Math.max(0, (lum - below) * 8));
          const snow = land ? Math.min(1, up * 1.1 + Math.min(1, Math.max(0, (lum - 0.45) * 2.2)) * 0.8) * 0.85 : 0;
          const cr = ((lum * 0.75 + r / 255 * 0.25) * 0.88 + 0.04), cg = ((lum * 0.75 + g / 255 * 0.25) * 0.95 + 0.04), cb = ((lum * 0.75 + b / 255 * 0.25) * 1.1 + 0.04);
          r = (cr * (1 - snow) + 0.94 * snow) * 255; g = (cg * (1 - snow) + 0.96 * snow) * 255; b = (cb * (1 - snow) + 1.0 * snow) * 255;
        }
      }
      if (play) {   // bak spillet: lavere metning og kontrast, og et tynt dislag
        const l = 0.3 * r + 0.59 * g + 0.11 * b;
        r = l + (r - l) * 0.74; g = l + (g - l) * 0.74; b = l + (b - l) * 0.74;
        r = 140 + (r - 140) * 0.8; g = 140 + (g - 140) * 0.8; b = 140 + (b - 140) * 0.8;
        r = r * 0.9 + haze[0] * 0.1; g = g * 0.9 + haze[1] * 0.1; b = b * 0.9 + haze[2] * 0.1;
      }
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }
}
let artWorker = null, artJobs = new Map(), artJobId = 0;
function recolorImage(key) {
  const image = ART[key], job = ART_JOB[key];
  if (!image || !job || (seasonName === 'autumn' && !job.play)) return Promise.resolve();   // høst uten demping: originalen
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const msg = { id: ++artJobId, data: img.data, w: c.width, h: c.height, season: seasonName, role: job.role, play: !!job.play, night: /Night$|^night$/.test(key) };
  return new Promise(resolve => {
    // dataene ble overført til tråden (bufferen her er tom), så det fargelagte bildet bygges av svaret
    const done = data => { try { g.putImageData(new ImageData(data, msg.w, msg.h), 0, 0); SEASON_ART[key] = c; } catch (e) {} resolve(); };
    try {
      if (!artWorker) {
        artWorker = new Worker(URL.createObjectURL(new Blob([RECOLOR_WORKER], { type: 'text/javascript' })));
        artWorker.onmessage = e => { const f = artJobs.get(e.data.id); artJobs.delete(e.data.id); if (f) f(e.data.data); };
        artWorker.onerror = () => { for (const f of artJobs.values()) f(null); artJobs.clear(); };   // feil i tråden: originalbildene brukes
      }
      artJobs.set(msg.id, done); artWorker.postMessage(msg, [msg.data.buffer]);
    } catch (e) { recolor(msg.data, msg.w, msg.h, msg.season, msg.role, msg.play, msg.night); done(msg.data); }   // uten tråd: her og nå
  });
}
// menymaleriene først (introen venter på dem), resten i bakgrunnen; returnerer når menyen er klar
let seasonArtAll = Promise.resolve();
function prepareSeasonArt() {
  const menu = Promise.all(['day', 'night'].map(recolorImage));
  seasonArtAll = menu.then(() => Promise.all(['panoramaDay', 'panoramaNight', 'woodland', 'foreground', 'birch'].map(recolorImage)));
  return menu;
}
// bildet for årstiden (eller originalen, så lenge fargeleggingen ikke er ferdig)
function seasonImage(key) { return SEASON_ART[key] || ART[key]; }
function hasPaintedForest() { return !!ART.night && !!ART.day && (seasonName === 'autumn' || (!!SEASON_ART.night && !!SEASON_ART.day)); }

function drawPaintedBackdrop(groundY) {
  if (!hasPaintedForest()) return false;
  const traveling = state !== State.MENU;
  const image = seasonImage(traveling ? (T.night ? 'panoramaNight' : 'panoramaDay') : (T.night ? 'night' : 'day'));
  if (!image || (traveling && !ART.woodland)) return false;
  ctx.save();
  const layers = paintedDepthLayers(image);
  const tileW = traveling ? groundY * image.width / (image.height * 0.86) : Math.max(W + 64, groundY * 0.6);
  const camera = reduceMotion ? 0 : camShift(0.1);
  // Back-to-front compositing: the world is 2D, its scenery has independent
  // depth planes. Menus remain composed around the original artwork.
  const distance = depthScroll(), offsets = depthOffsets(distance);
  drawDepthPlane(layers.sky, tileW, groundY, offsets.sky, camera * 0.35);
  drawDepthPlane(layers.mountains, tileW, groundY, offsets.mountains, camera * 0.6);
  drawDepthMist(groundY * 0.56, groundY * 0.13, 0.10);
  const woodland = traveling ? paintedWoodlandLayer(T.night) : layers.woodland;
  drawDepthPlane(woodland, tileW, groundY, offsets.woodland, camera * 0.85);
  drawDepthMist(groundY * 0.75, groundY * 0.10, 0.06);
  // Soil is the gameplay plane: its edge stays at the collision floor.
  drawDepthTiles(layers.soil, tileW, GROUND_H, distance, groundY);
  if (T.sunLow) {
    const tint = ctx.createLinearGradient(0, 0, 0, groundY);
    tint.addColorStop(0, 'rgba(168,89,100,.26)'); tint.addColorStop(1, 'rgba(232,159,105,.3)');
    ctx.fillStyle = tint; ctx.fillRect(0, 0, W, groundY);
  }
  // The moon/sun and falling leaves remain live, separate from the painting.
  const skyY = Math.min(groundY * 0.32, safeTop + 170), sx = W * 0.79, body = paintedSkyBody();
  ctx.drawImage(body.c, sx - 70, skyY - 70, body.w, body.h);
  if (T.night && !reduceMotion) {
    ctx.fillStyle = '#FFF1D1';
    for (const star of stars.slice(0, 12)) {
      if (star.y > groundY * 0.45) continue;
      ctx.globalAlpha = 0.12 + 0.16 * Math.max(0, Math.sin(time * 0.7 + star.p));
      circle(ctx, star.x, star.y, 0.7);
    }
  }
  ctx.restore(); return true;
}

// sola og månen malt som maleriet: myk glød som smelter inn i himmelen, varm kjerne og penselstrøk, uten blekk-kant
const skyBodyCache = new Map();
function paintedSkyBody() {
  const key = `${T.night ? 'mane' : T.sunLow ? 'kveld' : 'sol'}|${dpr * scale}`;
  if (skyBodyCache.has(key)) return skyBodyCache.get(key);
  const L = makeSprite(140, 140, g => {
    const c = 70, r = rng(31);
    const glow = (rad, col, a) => { const gr = g.createRadialGradient(c, c, 4, c, c, rad); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 140, 140); };
    if (T.night) {   // månesigd: kald glød, blek kjerne og mørkere hav (maria)
      glow(66, '214,222,255', 0.22); glow(30, '240,236,215', 0.25);
      g.save(); g.beginPath(); g.arc(c, c, 14, 0, 7); g.clip();
      const body = g.createRadialGradient(c + 4, c - 5, 2, c, c, 15); body.addColorStop(0, '#FFF8E6'); body.addColorStop(1, '#E8D9B0');
      g.fillStyle = body; g.fillRect(c - 15, c - 15, 30, 30);
      g.fillStyle = 'rgba(160,150,130,.28)'; for (const [x, y, s] of [[-4, 3, 3.2], [3, -4, 2.2], [-1, -6, 1.6]]) { g.beginPath(); g.arc(c + x, c + y, s, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(c + 7, c - 4, 12.5, 0, 7); g.fill();
      g.restore();
    } else {
      const warm = T.sunLow ? '255,170,110' : '255,232,170';
      glow(68, warm, T.sunLow ? 0.32 : 0.26); glow(34, T.sunLow ? '255,200,140' : '255,246,214', 0.35);
      g.save(); g.beginPath(); g.arc(c, c, 15, 0, 7); g.clip();
      const body = g.createRadialGradient(c + 4, c - 5, 2, c, c, 16);
      body.addColorStop(0, T.sunLow ? '#FFE7C4' : '#FFFBEA'); body.addColorStop(0.7, T.sunLow ? '#F7B576' : '#FBE3A0'); body.addColorStop(1, T.sunLow ? '#E9925E' : '#F2CB78');
      g.fillStyle = body; g.fillRect(c - 16, c - 16, 32, 32);
      g.lineCap = 'round';   // penselstrøk på skrå
      for (let k = 0; k < 9; k++) { const y = c - 13 + k * 3.2 + r() * 1.5; g.strokeStyle = `rgba(255,255,255,${(0.08 + r() * 0.1).toFixed(2)})`; g.lineWidth = 1 + r() * 1.4; g.beginPath(); g.moveTo(c - 16, y + 4); g.lineTo(c + 16, y - 4); g.stroke(); }
      g.restore();
    }
  }, 0.5);
  skyBodyCache.set(key, L); return L;
}

function paintBarkSprite(g, y0, y1) {
  if (!hasPaintedForest() || !ART.birch || y1 <= y0) return false;
  const image = seasonImage('birch');
  // The interior bark slice stays within the exact physical trunk width. Caps
  // are rendered separately, so rings/moss are never stretched with the body.
  g.drawImage(image, image.width * 0.375, 0, image.width * 0.245, image.height * 0.78, 0, y0, PIPE_W, y1 - y0);
  // Continuous light across the cylinder, not a flat rectangular colour.
  const light = g.createLinearGradient(0, 0, PIPE_W, 0);
  light.addColorStop(0, 'rgba(15,20,36,.52)');
  light.addColorStop(0.23, 'rgba(24,27,40,.22)');
  light.addColorStop(0.60, 'rgba(255,244,206,.07)');
  light.addColorStop(0.82, 'rgba(255,245,215,.28)');
  light.addColorStop(1, 'rgba(24,23,32,.30)');
  g.fillStyle = light; g.fillRect(0, y0, PIPE_W, y1 - y0);
  g.fillStyle = 'rgba(255,242,202,.34)'; g.fillRect(PIPE_W - 3, y0, 0.7, y1 - y0);
  return true;
}

function paintBirchCap(y, upper) {
  if (!hasPaintedForest() || !ART.birch) return false;
  const image = seasonImage('birch'), height = 23;
  ctx.save(); ctx.translate(PIPE_W / 2, y);
  if (upper) ctx.scale(1, -1);
  ctx.drawImage(image, image.width * 0.30, image.height * 0.80, image.width * 0.40, image.height * 0.15,
    -PIPE_W / 2 - TRUNK_LIP, -12, PIPE_W + TRUNK_LIP * 2, height);
  ctx.restore(); return true;
}


const DEPTH_SPEED = Object.freeze({ sky: 0.035, mountains: 0.14, woodland: 0.45, foreground: 1.35 });
const depthPaintCache = new WeakMap();
function depthScroll() {
  return reduceMotion || state === State.MENU || state === State.READY ? 0 : viewScroll;
}
function depthOffsets(distance) {
  // World travel is monotonic: no sine sway, clamp or reversal. Different
  // depths move at different speeds for as long as the bird flies.
  return { sky: distance * DEPTH_SPEED.sky, mountains: distance * DEPTH_SPEED.mountains,
    woodland: distance * DEPTH_SPEED.woodland, foreground: distance * DEPTH_SPEED.foreground };
}
function loopEdge(g, w, h) {
  // Incoming tiles fade over the outgoing edge, keeping the scene continuous
  // without mirrored cabins or trees. This runs only during cache creation.
  g.globalCompositeOperation = 'destination-in';
  const edge = g.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, 'transparent'); edge.addColorStop(0.06, '#000'); edge.addColorStop(1, '#000');
  g.fillStyle = edge; g.fillRect(0, 0, w, h);
}
function paintedDepthLayers(image) {
  if (depthPaintCache.has(image)) return depthPaintCache.get(image);
  const wide = image.width > image.height;
  const w = Math.min(wide ? 3072 : 640, image.width), soil = Math.round(image.height * 0.86);
  const h = Math.round(w * soil / image.width);
  const make = (start, soilOnly = false) => {
    const c = document.createElement('canvas'); c.width = w;
    c.height = soilOnly ? Math.round(w * (image.height - soil) / image.width) : h;
    const g = c.getContext('2d');
    g.drawImage(image, 0, soilOnly ? soil : 0, image.width, soilOnly ? image.height - soil : soil, 0, 0, w, c.height);
    if (start > 0) {
      g.globalCompositeOperation = 'destination-in';
      const mask = g.createLinearGradient(0, 0, 0, h);
      mask.addColorStop(0, 'transparent'); mask.addColorStop(start, 'transparent');
      mask.addColorStop(start + 0.035, '#000'); mask.addColorStop(1, '#000');
      g.fillStyle = mask; g.fillRect(0, 0, w, h);
    }
    if (wide) loopEdge(g, w, c.height);
    c.loopBlend = wide ? 0.06 : 0; return c;
  };
  const layers = { sky: make(0), mountains: make(wide ? 0.25 : 0.29), woodland: wide ? null : make(0.48), soil: make(0, true) };
  depthPaintCache.set(image, layers); return layers;
}
const woodlandPaintCache = new Map();
function paintedWoodlandLayer(night) {
  const image = seasonImage('woodland'), key = `${night}|${image === ART.woodland ? 'org' : 'season'}`;
  if (woodlandPaintCache.has(key)) return woodlandPaintCache.get(key);
  const c = document.createElement('canvas');
  c.width = Math.min(3072, image.width); c.height = Math.round(c.width * image.height * 0.86 / image.width);
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0, image.width, image.height * 0.86, 0, 0, c.width, c.height);
  if (night) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(22,29,65,.28)'; g.fillRect(0, 0, c.width, c.height);
  }
  loopEdge(g, c.width, c.height); c.loopBlend = 0.06;
  woodlandPaintCache.set(key, c); return c;
}
function drawDepthPlane(image, tileW, groundY, offset, cameraY = 0) {
  const top = cameraY - 4;
  // Every landscape plane terminates at the same physical floor; camera
  // following cannot open a gap under the trees.
  drawDepthTiles(image, tileW, groundY - top, offset, top);
}
function drawDepthTiles(image, tileW, height, offset, y) {
  const step = tileW * (1 - (image.loopBlend || 0)), phase = offset + 32;
  const first = Math.floor((phase - tileW) / step);
  for (let k = first, x = first * step - phase; x < W; k++, x += step) {
    if (x + tileW < 0) continue;
    ctx.drawImage(image, x, y, tileW + 0.5, height);
  }
}
function drawDepthMist(y, h, opacity) {
  const mist = ctx.createLinearGradient(0, y - h, 0, y + h);
  const color = T.night ? '167,176,222' : '237,225,194';
  mist.addColorStop(0, 'rgba(' + color + ',0)');
  mist.addColorStop(0.5, 'rgba(' + color + ',' + opacity + ')');
  mist.addColorStop(1, 'rgba(' + color + ',0)');
  ctx.fillStyle = mist; ctx.fillRect(0, y - h, W, h * 2);
}
function drawDepthForeground() {
  if (!hasPaintedForest() || !ART.foreground) return;
  const image = seasonImage('foreground'), width = 420, height = 140;
  const phase = wrap(depthScroll() * DEPTH_SPEED.foreground, width * 2);
  // The transparent prop layer is in front of the gameplay plane, entirely
  // below the bird's flight corridor. UI is composed afterward, in screen space.
  ctx.save();
  ctx.globalAlpha = T.night ? 0.72 : 0.80;
  const y = H - height + 11;
  for (let k = -1; k < Math.ceil(W / width) + 2; k++) {
    const x = k * width - phase;
    ctx.save(); ctx.translate(x + (k % 2 ? width : 0), y);
    if (k % 2) ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0, width + 1, height); ctx.restore();
  }
  ctx.restore();
}
