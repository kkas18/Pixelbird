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
// i tråden: helst hele jobben der (bildet inn som ImageBitmap, tegnes, fargelegges og sendes tilbake som ImageBitmap),
// så hovedtråden ikke må hente ut eller legge tilbake pikslene; ellers bare pikselberegningen
const RECOLOR_WORKER = `onmessage = async e => {
  const m = e.data;
  if (m.url) { try { m.bitmap = await createImageBitmap(await (await fetch(m.url)).blob()); } catch (err) { postMessage({ id: m.id }); return; } }   // hentes og dekodes her, ikke på hovedtråden
  if (m.bitmap) {
    const c = new OffscreenCanvas(m.bitmap.width, m.bitmap.height), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(m.bitmap, 0, 0); m.bitmap.close();
    const img = g.getImageData(0, 0, c.width, c.height);
    if (!m.plain) { recolor(img.data, c.width, c.height, m.season, m.role, m.play, m.night); g.putImageData(img, 0, 0); }
    const out = c.transferToImageBitmap(); postMessage({ id: m.id, bitmap: out }, [out]);
  } else { recolor(m.data, m.w, m.h, m.season, m.role, m.play, m.night); postMessage({ id: m.id, data: m.data }, [m.data.buffer]); }
};
${recolor.toString()}`;
// én piksel om gangen, i ren JS (kjører i tråden); d er RGBA 0–255
function recolor(d, w, h, season, role, play, night) {
  const green = season === 'summer' ? [92, 0.62, 0.86] : season === 'spring' ? [70, 0.55, 1] : null, winter = season === 'winter';
  const haze = night ? [64, 70, 104] : [222, 226, 232];
  // vinter: lysstyrken jevnet ut i ruter på 4 px (rimfrosten legger seg på flater som vender opp, ikke som støy på
  // hver kant) og på 16 px (et lys er mye lysere enn det som er rundt det, et lyst løvfelt er det ikke)
  let ls = null, lc = null, sw = 0, sh = 0, cw = 0;
  if (winter && role !== 'bark') {
    sw = Math.max(2, Math.ceil(w / 4)); sh = Math.max(2, Math.ceil(h / 4)); cw = Math.ceil(sw / 4);
    ls = new Float32Array(sw * sh); lc = new Float32Array(cw * Math.ceil(sh / 4));
    const n = new Float32Array(sw * sh), nc = new Float32Array(lc.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, k = (y >> 2) * sw + (x >> 2); ls[k] += (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255; n[k]++; }
    for (let k = 0; k < ls.length; k++) { ls[k] /= n[k] || 1; const kc = ((k / sw | 0) >> 2) * cw + ((k % sw) >> 2); lc[kc] += ls[k]; nc[kc]++; }
    for (let k = 0; k < lc.length; k++) lc[k] /= nc[k] || 1;
  }
  // utjevnet lysstyrke mellom rutene (bilineært), så rimfrosten får myke kanter og ingen firkanter
  const lsAt = (fx, fy) => {
    const x0 = Math.min(sw - 2, Math.max(0, Math.floor(fx))), y0 = Math.min(sh - 2, Math.max(0, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0)), k = y0 * sw + x0;
    return (ls[k] * (1 - tx) + ls[k + 1] * tx) * (1 - ty) + (ls[k + sw] * (1 - tx) + ls[k + sw + 1] * tx) * ty;
  };
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
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
          let hu = mx === mn ? 0 : mx === r ? 60 * (((g - b) / (mx - mn)) % 6) : mx === g ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - g) / (mx - mn) + 4);
          if (hu < 0) hu += 360;
          const cx = x >> 2, cy = y >> 2, fx = x / 4 - 0.5, fy = y / 4 - 0.5;
          const up = Math.min(1, Math.max(0, (lsAt(fx, fy) - lsAt(fx, fy + 1) - 0.015) * 9));
          const water = hu > 185 && hu < 255 && s > 0.16;   // vann (og himmel i speilingen) får ikke rim
          let snow = land && !water ? Math.min(1, up + Math.min(1, Math.max(0, (lum - 0.5) * 2)) * 0.55) * 0.8 : 0;
          // varme lys om kvelden (vinduer, lykter) og falurødt beholder fargen; resten blir kaldt og blekt
          const around = lc[(cy >> 2) * cw + (cx >> 2)];
          const lamp = night && land && s > 0.3 && hu > 18 && hu < 66 ? Math.min(1, Math.max(0, (v - 0.72) * 5)) * Math.min(1, Math.max(0, (lum - around - 0.12) * 6)) : 0;
          const red = s > 0.42 && (hu < 16 || hu > 342) ? 0.55 : 0, keep = Math.max(lamp, red);
          snow *= 1 - keep;
          const cr = ((lum * 0.75 + r / 255 * 0.25) * 0.88 + 0.04), cg = ((lum * 0.75 + g / 255 * 0.25) * 0.95 + 0.04), cb = ((lum * 0.75 + b / 255 * 0.25) * 1.1 + 0.04);
          r = (cr * (1 - snow) + 0.94 * snow) * 255 * (1 - keep) + r * keep;
          g = (cg * (1 - snow) + 0.96 * snow) * 255 * (1 - keep) + g * keep;
          b = (cb * (1 - snow) + 1.0 * snow) * 255 * (1 - keep) + b * keep;
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
function ensureArtWorker() {
  if (artWorker) return artWorker;
  artWorker = new Worker(URL.createObjectURL(new Blob([RECOLOR_WORKER], { type: 'text/javascript' })));
  artWorker.onmessage = e => { const f = artJobs.get(e.data.id); artJobs.delete(e.data.id); if (f) f(e.data); };
  artWorker.onerror = () => { for (const f of artJobs.values()) f(null); artJobs.clear(); };   // feil i tråden: originalbildene brukes
  return artWorker;
}
function recolorImage(key) {
  const image = ART[key], job = ART_JOB[key];
  if (!image || !job) return Promise.resolve();
  // høst uten demping: ingen fargelegging, men bildet dekodes én gang i tråden (ellers kan nettleseren dekode det
  // store bildet på nytt mens det tegnes, og det gir hakk)
  const plain = seasonName === 'autumn' && !job.play;
  const base = { season: seasonName, role: job.role, play: !!job.play, night: /Night$|^night$/.test(key), plain };
  // hele jobben i tråden når nettleseren kan: tråden henter og dekoder bildet selv (fra hurtigbufferen), fargelegger det
  // og sender det tilbake som ImageBitmap, så hovedtråden verken dekoder eller flytter piksler
  if (typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function') {
    return new Promise(resolve => {
      const id = ++artJobId;
      artJobs.set(id, reply => { if (reply && reply.bitmap) SEASON_ART[key] = reply.bitmap; resolve(); });
      try { ensureArtWorker().postMessage({ id, url: new URL(image.src, location.href).href, ...base }); } catch (e) { artJobs.delete(id); resolve(); }
    });
  }
  if (plain) return Promise.resolve();   // uten tråd: originalbildet brukes som det er
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const msg = { id: ++artJobId, data: img.data, w: c.width, h: c.height, ...base };
  return new Promise(resolve => {
    // dataene ble overført til tråden (bufferen her er tom), så det fargelagte bildet bygges av svaret
    const done = data => { try { g.putImageData(new ImageData(data, msg.w, msg.h), 0, 0); SEASON_ART[key] = c; } catch (e) {} resolve(); };
    try { if (typeof Worker !== 'function') throw 0; artJobs.set(msg.id, reply => done(reply && reply.data)); ensureArtWorker().postMessage(msg, [msg.data.buffer]); }
    catch (e) { artJobs.delete(msg.id); recolor(msg.data, msg.w, msg.h, msg.season, msg.role, msg.play, msg.night); done(msg.data); }   // uten tråd: her og nå
  });
}
// menymaleriene først (introen venter på dem), resten i bakgrunnen; returnerer når menyen er klar
let seasonArtAll = Promise.resolve();
function prepareSeasonArt() {
  const menu = Promise.all(['day', 'night', 'foreground'].map(recolorImage));   // alt som vises i menyen
  // bildene bak spillet lages når introen er ferdig, så ingenting kommer i veien mens rammen åpner seg
  const afterIntro = () => new Promise(resolve => { const wait = () => (typeof intro !== 'undefined' && intro) ? requestAnimationFrame(wait) : resolve(); wait(); });
  seasonArtAll = menu.then(afterIntro).then(() => Promise.all(['panoramaDay', 'panoramaNight', 'woodland', 'birch'].map(recolorImage)));
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
  if (traveling) drawPaintedSkyLife();
  drawDepthPlane(layers.mountains, tileW, groundY, offsets.mountains, camera * 0.6);
  drawDepthMist(groundY * 0.56, groundY * 0.13, 0.10);
  const woodland = traveling ? paintedWoodlandLayer(T.night) : layers.woodland;
  drawDepthPlane(woodland, tileW, groundY, offsets.woodland, camera * 0.85);
  if (traveling) drawPaintedMarks(false, groundY);
  drawDepthMist(groundY * 0.75, groundY * 0.10, 0.06);
  // Soil is the gameplay plane: its edge stays at the collision floor.
  drawDepthTiles(layers.soil, tileW, GROUND_H, distance, groundY);
  if (traveling) drawPaintedMarks(true, groundY);
  if (T.sunLow) {
    const tint = ctx.createLinearGradient(0, 0, 0, groundY);
    tint.addColorStop(0, 'rgba(168,89,100,.26)'); tint.addColorStop(1, 'rgba(232,159,105,.3)');
    ctx.fillStyle = tint; ctx.fillRect(0, 0, W, groundY);
  }
  // The moon/sun and falling leaves remain live, separate from the painting.
  const skyY = Math.min(groundY * 0.32, safeTop + 170), sx = W * 0.79, body = paintedSkyBody();
  blitSurface(body, sx - 60, skyY - 60);   // på hele skjermpiksler: kopieres rett over, uten filtrering
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
  const L = makeSprite(120, 120, g => {
    const c = 60, r = rng(31);
    const glow = (rad, col, a) => { const gr = g.createRadialGradient(c, c, 4, c, c, rad); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 120, 120); };
    if (T.night) {   // månesigd: kald glød, blek kjerne og mørkere hav (maria)
      glow(58, '214,222,255', 0.22); glow(30, '240,236,215', 0.25);
      g.save(); g.beginPath(); g.arc(c, c, 14, 0, 7); g.clip();
      const body = g.createRadialGradient(c + 4, c - 5, 2, c, c, 15); body.addColorStop(0, '#FFF8E6'); body.addColorStop(1, '#E8D9B0');
      g.fillStyle = body; g.fillRect(c - 15, c - 15, 30, 30);
      g.fillStyle = 'rgba(160,150,130,.28)'; for (const [x, y, s] of [[-4, 3, 3.2], [3, -4, 2.2], [-1, -6, 1.6]]) { g.beginPath(); g.arc(c + x, c + y, s, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(c + 7, c - 4, 12.5, 0, 7); g.fill();
      g.restore();
    } else {
      const warm = T.sunLow ? '255,170,110' : '255,232,170';
      glow(58, warm, T.sunLow ? 0.32 : 0.26); glow(32, T.sunLow ? '255,200,140' : '255,246,214', 0.35);
      g.save(); g.beginPath(); g.arc(c, c, 15, 0, 7); g.clip();
      const body = g.createRadialGradient(c + 4, c - 5, 2, c, c, 16);
      body.addColorStop(0, T.sunLow ? '#FFE7C4' : '#FFFBEA'); body.addColorStop(0.7, T.sunLow ? '#F7B576' : '#FBE3A0'); body.addColorStop(1, T.sunLow ? '#E9925E' : '#F2CB78');
      g.fillStyle = body; g.fillRect(c - 16, c - 16, 32, 32);
      g.lineCap = 'round';   // penselstrøk på skrå
      for (let k = 0; k < 9; k++) { const y = c - 13 + k * 3.2 + r() * 1.5; g.strokeStyle = `rgba(255,255,255,${(0.08 + r() * 0.1).toFixed(2)})`; g.lineWidth = 1 + r() * 1.4; g.beginPath(); g.moveTo(c - 16, y + 4); g.lineTo(c + 16, y - 4); g.stroke(); }
      g.restore();
    }
  }, 0.5);
  L.pad = 0; skyBodyCache.set(key, L); return L;
}

// bjørka i lyset fra tiden på døgnet: kjølig og mørkere om kvelden, varm i solnedgangen (samme toner som
// stammene i det tegnede landskapet). Tonet én gang per bilde og tid; forhåndslages mens fuglen venter.
const BIRCH_LIGHT = { sunset: ['#F2A07A', 0.18], night: ['#2A2C5A', 0.46] };
const birchToneCache = new Map();
function birchFor(tod) {
  const image = seasonImage('birch'), tone = BIRCH_LIGHT[tod];
  if (!image || !tone) return image;
  let e = birchToneCache.get(tod);
  if (!e || e.src !== image) {
    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
    const g = c.getContext('2d'); g.drawImage(image, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tone[1]; g.fillStyle = tone[0]; g.fillRect(0, 0, c.width, c.height);
    birchToneCache.set(tod, e = { src: image, c });
  }
  return e.c;
}
const birchImage = () => birchFor(T.night ? 'night' : T.sunLow ? 'sunset' : 'day');
// lag det som hører til en tid på døgnet ferdig på forhånd (mens fuglen venter på «Klar?»), så byttet midt i
// runden ikke hakker
function prewarmPainted(name) {
  if (!hasPaintedForest()) return;
  birchFor(name === 'night' ? 'night' : name === 'sunset' ? 'sunset' : 'day');
  // lagene i panoramaet og skogslaget for denne tiden (ellers lages de i bildet der kvelden kommer)
  const pano = seasonImage(name === 'night' ? 'panoramaNight' : 'panoramaDay');
  if (pano) paintedDepthLayers(pano);
  if (ART.woodland) paintedWoodlandLayer(name === 'night');
  const entry = sceneCache[name];
  if (!entry || entry.scene.painted) return;
  const pT = T, pS = scene; T = entry.T; scene = entry.scene;
  try { paintedProps(); } finally { T = pT; scene = pS; }
}

/* ---------- Det tegnede inn i maleriet ----------
   Landemerkene, ballongen og hytta er tegnet i koden. På maleriet får de samme behandling som bildene bak
   spillet: myke kanter i stedet for tusj, samme demping (lavere metning og kontrast, et tynt dislag) og malt
   korn, og en målestokk som passer til trærne i maleriet. Fjorden er skjult bak skogen mens man flyr, så
   landemerkene står på enga foran skogen og følger den (postkassa står ved stien, i spilleplanet).
   s = forstørrelse, lift = hvor høyt opp i enga foten står */
const PAINTED_LM = {
  stavkirke: { s: 1.45, lift: 6 }, seter: { s: 1.6, lift: 4 }, fyr: { s: 1.5, lift: 6 },
  elg: { s: 1.55, lift: 3 }, sau: { s: 1.5, lift: 3 }, postkasse: { s: 1.35, path: true }
};   // (tjernet står ikke på maleriet: der er det vann fra før, og et tjern sett fra siden blir en flat skive)
const paintedSpeed = kind => PAINTED_LM[kind].path ? 1 : DEPTH_SPEED.woodland;
// grade: metning og kontrast som foran skogen (mindre dempet enn bildene bak spillet, for det står nærmere);
// light: malt lys fra sola oppe til høyre og skygge nede til venstre (kjølig månelys om kvelden)
// strokes: korte penselstrøk i lyst og mørkt over flatene, så de ikke står glatte som i en vektortegning
function paintify(L, { soft = 0.6, haze = 0.05, sat = 0.86, contrast = 0.9, light = 1, strokes = true, seed = 11 } = {}) {
  const c = L.c, R = dpr * scale, w = c.width, h = c.height, g = c.getContext('2d', { willReadFrequently: true });
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (soft && canFilter) {   // en uskarp kopi over originalen: kantene blir penselstrøk, ikke tusj
    const b = document.createElement('canvas'); b.width = w; b.height = h;
    const bg = b.getContext('2d'); bg.filter = `blur(${(0.5 * R).toFixed(2)}px)`; bg.drawImage(c, 0, 0);
    g.globalAlpha = soft; g.drawImage(b, 0, 0); g.globalAlpha = 1;
  }
  const img = g.getImageData(0, 0, w, h), d = img.data, hz = T.night ? [64, 70, 104] : [222, 226, 232];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i], gg = d[i + 1], b = d[i + 2];
    const l = 0.3 * r + 0.59 * gg + 0.11 * b;
    r = l + (r - l) * sat; gg = l + (gg - l) * sat; b = l + (b - l) * sat;
    r = 140 + (r - 140) * contrast; gg = 140 + (gg - 140) * contrast; b = 140 + (b - 140) * contrast;
    d[i] = r * (1 - haze) + hz[0] * haze; d[i + 1] = gg * (1 - haze) + hz[1] * haze; d[i + 2] = b * (1 - haze) + hz[2] * haze;
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  if (light) {
    const lg = g.createLinearGradient(w, 0, 0, h), k = v => (v * light).toFixed(3);
    lg.addColorStop(0, T.night ? `rgba(178,192,255,${k(0.16)})` : T.sunLow ? `rgba(255,190,140,${k(0.24)})` : `rgba(255,240,200,${k(0.22)})`);
    lg.addColorStop(0.55, 'rgba(0,0,0,0)'); lg.addColorStop(1, T.night ? `rgba(14,16,40,${k(0.26)})` : `rgba(40,26,40,${k(0.2)})`);
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
  }
  if (strokes) {
    const r = rng(seed), n = Math.round(w * h / (16 * R * R));
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, len = (1.4 + r() * 2.4) * R, a = r() * Math.PI, lightStroke = r() < 0.5;
      g.strokeStyle = lightStroke ? 'rgba(255,248,230,.05)' : 'rgba(30,20,30,.06)'; g.lineWidth = (0.8 + r() * 0.9) * R;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
  }
  g.restore();
  g.save(); g.globalCompositeOperation = 'source-atop'; paperOn(g, 1.2); g.restore();
  return L;
}
// for scenen (tiden på døgnet) som tegnes nå; lages én gang og legges på scenen
function paintedProps() {
  if (scene.painted) return scene.painted;
  const pT = T, sizes = {};
  for (const k in PAINTED_LM) sizes[k] = PAINTED_LM[k].s;
  T = { ...T, ink: mixHex(T.ink, T.night ? '#6A6E92' : '#9A8670', 0.25) };   // mykere strek
  let marks, home;
  try {
    marks = buildLandmarks(false, true, sizes);
    // hytta og fuglebrettet (spilleplanet: nesten full styrke, men samme strek, lys og korn)
    const pad = 12, oc = ctx;
    home = makeSprite(HOME_W + pad * 2, HOME_H + pad * 2, g => { ctx = g; try { paintHome(pad, pad); } finally { ctx = oc; } });
    home.pad = pad;
  } finally { T = pT; }
  for (const k in PAINTED_LM) paintify(marks[k], PAINTED_LM[k].path ? { haze: 0, sat: 0.95, contrast: 0.96 } : {});
  paintify(home, { haze: 0, sat: 0.95, contrast: 0.95, light: 1.6, seed: 60 });
  // varmt lys fra vinduene om kvelden: en myk glorie (ferdig tegnet, legges over hytta)
  const glow = makeSprite(72, 72, g => {
    const gr = g.createRadialGradient(36, 36, 2, 36, 36, 36);
    gr.addColorStop(0, 'rgba(255,214,140,.7)'); gr.addColorStop(0.35, 'rgba(255,190,110,.3)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 72, 72);
  });
  // lysskjæret fra vinduene på bakken foran hytta
  const spill = makeSprite(200, 24, g => {
    const gr = g.createRadialGradient(100, 12, 4, 100, 12, 100);
    gr.addColorStop(0, 'rgba(255,200,120,.3)'); gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.save(); g.translate(0, 12); g.scale(1, 0.12); g.translate(0, -12); g.fillStyle = gr; g.fillRect(0, -88, 200, 200); g.restore();
  });
  const B = scene.balloon, bc = document.createElement('canvas'); bc.width = B.c.width; bc.height = B.c.height; bc.getContext('2d').drawImage(B.c, 0, 0);
  const balloon = paintify({ c: bc, w: B.w, h: B.h }, { haze: 0.14, sat: 0.8, contrast: 0.85 });
  return (scene.painted = { marks, balloon, home, glow, spill });
}
// landemerkene på enga (path = false) eller ved stien (path = true); bare i spill, for i menyen og på «Klar?»
// står maleriet stille
function drawPaintedMarks(path, groundY) {
  if (state !== State.PLAY && state !== State.DEAD && state !== State.OVER) return;
  let P = null;
  const R = dpr * scale;
  for (const m of landmarks) {
    const o = PAINTED_LM[m.kind];
    if (!o || !!o.path !== path) continue;
    const x = lmX(m, viewScroll);
    if (x < -80 || x > W + 80) continue;
    P = P || paintedProps();
    const S = P.marks[m.kind], y = path ? groundY + 3 : groundY - o.lift;   // engas nedre kant står fast ved bakken (planet strekkes, foten flytter seg ikke)
    ctx.drawImage(S.c, Math.round((x - S.w / 2) * R) / R, Math.round((y - S.h + 2 * o.s) * R) / R, S.w, S.h);
    if (m.kind === 'sau' || (m.kind === 'fyr' && T.windowLit)) {   // levende deler, i samme målestokk
      ctx.save(); ctx.translate(x, y); ctx.scale(o.s, o.s);
      if (m.kind === 'sau') sheepHead(0, 0, m.seed); else lighthouseBeam(0, -26);
      ctx.restore();
    }
  }
}
// ballongen og fugleflokken på den malte himmelen (bare på reisen; i menyen står logoen der)
function drawPaintedSkyLife() {
  if (state === State.MENU) return;
  const bp = balloonPos();
  if (bp) { const B = paintedProps().balloon; ctx.drawImage(B.c, bp.x, bp.y + camShift(0.02), B.w, B.h); }
  const fp = flockPos();
  if (!fp) return;
  const x0 = fp.x, y0 = fp.y + camShift(0.05);
  ctx.strokeStyle = 'rgba(58,52,64,.5)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  [[0, 0], [12, -6], [22, 4]].forEach(([dx, dy], i) => {
    const ph2 = (time * 0.8 + i * 0.23) % 1.7, flapping = ph2 < 0.65 && !reduceMotion;
    const f = flapping ? Math.sin(ph2 * 30) * 2.4 : 0.5, x = x0 + dx, y = y0 + dy + (flapping ? 0 : (ph2 - 0.65) * 1.6);
    ctx.beginPath(); ctx.moveTo(x - 4, y - f); ctx.quadraticCurveTo(x - 2, y - 1, x, y); ctx.quadraticCurveTo(x + 2, y - 1, x + 4, y - f); ctx.stroke();
  });
}

function paintBarkSprite(g, y0, y1) {
  if (!hasPaintedForest() || !ART.birch || y1 <= y0) return false;
  const image = birchImage();
  // The interior bark slice stays within the exact physical trunk width. Caps
  // are rendered separately, so rings/moss are never stretched with the body.
  g.drawImage(image, image.width * 0.375, 0, image.width * 0.245, image.height * 0.78, 0, y0, PIPE_W, y1 - y0);
  // Continuous light across the cylinder, not a flat rectangular colour (om kvelden: kjølig månelys)
  const hi = T.night ? '196,208,255' : '255,245,215';
  const light = g.createLinearGradient(0, 0, PIPE_W, 0);
  light.addColorStop(0, 'rgba(15,20,36,.52)');
  light.addColorStop(0.23, 'rgba(24,27,40,.22)');
  light.addColorStop(0.60, `rgba(${hi},.07)`);
  light.addColorStop(0.82, `rgba(${hi},${T.night ? '.16' : '.28'})`);
  light.addColorStop(1, 'rgba(24,23,32,.30)');
  g.fillStyle = light; g.fillRect(0, y0, PIPE_W, y1 - y0);
  g.fillStyle = `rgba(${hi},${T.night ? '.22' : '.34'})`; g.fillRect(PIPE_W - 3, y0, 0.7, y1 - y0);
  return true;
}

function paintBirchCap(y, upper) {
  if (!hasPaintedForest() || !ART.birch) return false;
  const image = birchImage(), height = 23;
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
