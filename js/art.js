/* Production paintings derived from the approved reference. These are scenery
   and bark sprites, never a flattened screenshot of the UI. */
'use strict';
const ART = { night: null, day: null, birch: null };
function loadArtwork() {
  return Promise.all(Object.entries({ night: 'forest-night.webp', day: 'forest-day.webp', birch: 'birch.webp' }).map(([key, file]) => new Promise(resolve => {
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
  // Crop a gently drifting window through the painting, keeping its ground
  // boundary aligned with the physical floor on every portrait aspect ratio.
  const drift = reduceMotion || state === State.MENU ? 0 : Math.sin(viewScroll * 0.002) * 4;
  const tileW = W > 440 ? groundY * 0.6 : W;
  const soil = Math.round(image.height * 0.86), soilH = image.height - soil;
  for (let x = -8 - drift; x < W; x += tileW + 16) {
    ctx.drawImage(image, 0, 0, image.width, soil, x, 0, tileW + 16, groundY);
    ctx.drawImage(image, 0, soil, image.width, soilH, x, groundY, tileW + 16, GROUND_H);
  }
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
