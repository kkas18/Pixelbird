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

function hasPaintedForest() { return seasonName === 'autumn' && !!ART.night && !!ART.day; }

function drawPaintedBackdrop(groundY) {
  if (!hasPaintedForest()) return false;
  const traveling = state !== State.MENU;
  const image = traveling ? (T.night ? ART.panoramaNight : ART.panoramaDay) : (T.night ? ART.night : ART.day);
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
  const skyY = Math.min(groundY * 0.32, safeTop + 170), sx = W * 0.79;
  ctx.drawImage(scene.sun.c, sx - 18, skyY - 18, 36, 36);
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

function paintBarkSprite(g, y0, y1) {
  if (!hasPaintedForest() || !ART.birch || y1 <= y0) return false;
  const image = ART.birch;
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
  const image = ART.birch, height = 23;
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
  if (woodlandPaintCache.has(night)) return woodlandPaintCache.get(night);
  const image = ART.woodland, c = document.createElement('canvas');
  c.width = Math.min(3072, image.width); c.height = Math.round(c.width * image.height * 0.86 / image.width);
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0, image.width, image.height * 0.86, 0, 0, c.width, c.height);
  if (night) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(22,29,65,.28)'; g.fillRect(0, 0, c.width, c.height);
  }
  loopEdge(g, c.width, c.height); c.loopBlend = 0.06;
  woodlandPaintCache.set(night, c); return c;
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
  const image = ART.foreground, width = 420, height = 140;
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
