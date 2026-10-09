/* Production paintings derived from the approved reference. These are scenery
   and bark sprites, never a flattened screenshot of the UI. */
'use strict';
const ART = { night: null, day: null, birch: null, foreground: null };
function loadArtwork() {
  return Promise.all(Object.entries({ night: 'forest-night.webp', day: 'forest-day.webp', birch: 'birch.webp', foreground: 'foreground-depth.webp' }).map(([key, file]) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => { ART[key] = image; resolve(); };
    // A failed asset must not stop the game: procedural art remains a fallback.
    image.onerror = () => resolve(); image.src = 'art/' + file;
  })));
}

function hasPaintedForest() { return seasonName === 'autumn' && !!ART.night && !!ART.day; }

function drawPaintedBackdrop(groundY) {
  if (!hasPaintedForest()) return false;
  const image = T.night ? ART.night : ART.day;
  ctx.save();
  const layers = paintedDepthLayers(image);
  const tileW = Math.max(W + 64, groundY * 0.6);
  const camera = reduceMotion ? 0 : camShift(0.1);
  // Back-to-front compositing: the world is 2D, its scenery has independent
  // depth planes. Menus remain composed around the original artwork.
  const distance = depthScroll(), offsets = depthOffsets(distance);
  drawDepthPlane(layers.sky, tileW, groundY, offsets.sky, camera * 0.35);
  drawDepthPlane(layers.mountains, tileW, groundY, offsets.mountains, camera * 0.6);
  drawDepthMist(groundY * 0.56, groundY * 0.13, 0.10);
  drawDepthPlane(layers.woodland, tileW, groundY, offsets.woodland, camera * 0.85);
  drawDepthMist(groundY * 0.75, groundY * 0.10, 0.06);
  // Soil is the gameplay plane: its edge stays at the collision floor.
  const soil = Math.round(image.height * 0.86);
  drawDepthSoil(image, soil, tileW, groundY, distance);
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


const DEPTH_SPEED = Object.freeze({ sky: 0.012, mountains: 0.065, woodland: 0.22, foreground: 1.35 });
const depthPaintCache = new WeakMap();
function depthScroll() {
  return reduceMotion || state === State.MENU || state === State.READY ? 0 : viewScroll;
}
function depthOffsets(distance) {
  // A bounded camera pan keeps the approved narrow painting intact: distant
  // features never repeat as mirrored cabins. The near prop strip scrolls
  // continuously. Each scenery plane responds according to its depth.
  const pan = Math.sin(distance * 0.0012) * 22;
  return { sky: pan * DEPTH_SPEED.sky / DEPTH_SPEED.woodland,
    mountains: pan * DEPTH_SPEED.mountains / DEPTH_SPEED.woodland,
    woodland: pan, foreground: distance * DEPTH_SPEED.foreground };
}
function paintedDepthLayers(image) {
  if (depthPaintCache.has(image)) return depthPaintCache.get(image);
  // Pre-render masks once at bounded resolution; no full-screen filters or
  // per-frame pixel reads. Cached canvases are shared across resizes.
  const w = Math.min(640, image.width), h = Math.round(w * image.height * 0.86 / image.width);
  const make = start => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(image, 0, 0, image.width, image.height * 0.86, 0, 0, w, h);
    if (start > 0) {
      g.globalCompositeOperation = 'destination-in';
      const mask = g.createLinearGradient(0, 0, 0, h);
      mask.addColorStop(0, 'transparent'); mask.addColorStop(start, 'transparent');
      mask.addColorStop(start + 0.035, '#000'); mask.addColorStop(1, '#000');
      g.fillStyle = mask; g.fillRect(0, 0, w, h);
    }
    return c;
  };
  const layers = { sky: make(0), mountains: make(0.29), woodland: make(0.48) };
  depthPaintCache.set(image, layers); return layers;
}
function drawDepthPlane(image, tileW, height, offset, cameraY = 0) {
  const phase = offset + 32, first = Math.floor(phase / tileW);
  for (let k = first, x = first * tileW - phase; x < W; k++, x += tileW) {
    ctx.save(); ctx.translate(x + (k % 2 ? tileW : 0), cameraY - 4);
    if (k % 2) ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0, tileW + 0.5, height + 8);
    ctx.restore();
  }
}
function drawDepthSoil(image, soil, tileW, groundY, distance) {
  const phase = distance + 32, first = Math.floor(phase / tileW);
  for (let k = first, x = first * tileW - phase; x < W; k++, x += tileW) {
    ctx.save(); ctx.translate(x + (k % 2 ? tileW : 0), groundY);
    if (k % 2) ctx.scale(-1, 1);
    ctx.drawImage(image, 0, soil, image.width, image.height - soil, 0, 0, tileW + 0.5, GROUND_H);
    ctx.restore();
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
