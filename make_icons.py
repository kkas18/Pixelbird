"""Genererer app-ikoner i samme koselige stil som spillet (krever Pillow):
fuglen med strikket skjerf foran en bjørkestamme med mose, varm pastellhimmel."""
from PIL import Image, ImageDraw

INK = '#5B4636'        # varm kontur (verden)
BIRD_INK = '#2E4467'   # kontur på fuglen


def icon(size, maskable=False):
    S = 8  # supersampling for glatte kanter
    n = size * S
    img = Image.new('RGBA', (n, n))
    d = ImageDraw.Draw(img)
    top, bot = (0x8F, 0xD3, 0xF4), (0xFF, 0xE4, 0xC8)
    for y in range(n):
        t = y / n
        d.line([(0, y), (n, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bot)))
    # maskable: motivet skaleres inn mot midten slik at fuglen har god margin innenfor
    # sikker sone (sirkel med diameter 80 %); himmel og bakke fyller fortsatt hele flaten
    k = 0.82 if maskable else 1.0
    u = n / 64 * k
    o = n * (1 - k) / 2

    def P(x, y): return (o + x * u, o + y * u)

    def soft(cx, cy, rx, ry, rgba):   # halvgjennomsiktig ellipse, blandet inn med alfa
        layer = Image.new('RGBA', (n, n))
        ImageDraw.Draw(layer).ellipse([*P(cx - rx, cy - ry), *P(cx + rx, cy + ry)], fill=rgba)
        img.alpha_composite(layer)
    def E(cx, cy, rx, ry, c, outline=None, w=0): d.ellipse([*P(cx - rx, cy - ry), *P(cx + rx, cy + ry)], fill=c, outline=outline, width=int(w * u))
    def R(x, y, w, h, r, c, outline=None, lw=0): d.rounded_rectangle([*P(x, y), *P(x + w, y + h)], radius=r * u, fill=c, outline=outline, width=int(lw * u))
    def L(pts, c, w): d.line([P(x, y) for x, y in pts], fill=c, width=max(1, int(w * u)), joint='curve')
    def quad(p0, p1, p2, steps=24):
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
                for t in (i / steps for i in range(steps + 1))]

    # sol og skyer
    soft(52, 11, 8, 8, (255, 236, 190, 60)); E(52, 11, 5, 5, '#FFF1C4')
    for dx, dy, r in [(0, 0, 3.5), (4.5, -1.5, 4.5), (9, 0, 3.5)]: E(6 + dx, 14 + dy, r, r, '#FFFFFF')
    # åser og bakke (bakken strekkes til nederste kant når motivet er skalert ned)
    E(12, 62, 26, 12, '#AEDB9F'); E(50, 64, 30, 13, '#8CCB86')
    if maskable: d.rectangle([0, P(0, 60)[1], n, n], fill='#D3AE84')
    gx, gw = (-20, 104) if maskable else (0, 64)
    R(gx, 57, gw, 9, 0, '#D3AE84'); R(gx, 56, gw, 3, 0, '#94D46C')
    # bjørkestamme med snittflate og mose
    R(45, 25, 13, 34, 0, '#FBF8F1', INK, 0.8)
    for x, y, w in [(47, 32, 5), (51, 38, 5), (47, 45, 6), (52, 51, 4)]: R(x, y, w, 1.1, 0.5, '#3F3936')
    E(51.5, 25, 7.4, 2.4, '#F4DCA8', INK, 0.7)
    for i in range(8):
        x = 44.5 + i * 2
        E(x, 26 + (0.6 if i % 2 else 0), 1.4, 1.4, '#86C35C', '#5E9E45', 0.3)
    # skjerfsnipp (bak fuglen)
    L(quad((17, 35), (12, 39), (10, 45)), BIRD_INK, 4.2)
    L(quad((17, 35), (12, 39), (10, 45)), '#E5574A', 2.8)
    # fugl: rund kropp, kremhvit mage, kontur
    cx, cy = 26, 31
    soft(cx + 0.8, cy + 2.4, 13, 13, (91, 70, 54, 45))
    E(cx, cy, 13, 13, '#7CC7F0', BIRD_INK, 1.1)
    E(cx - 4, cy - 5, 6, 4.5, '#B4E2F8')
    E(cx + 3, cy + 7, 8.6, 5.2, '#FFF5E2')
    d.ellipse([*P(cx - 13, cy - 13), *P(cx + 13, cy + 13)], outline=BIRD_INK, width=int(1.1 * u))
    # fjærtopp
    L(quad((cx - 1, cy - 12), (cx - 2, cy - 18), (cx - 6, cy - 18.5)), '#4FA6DB', 2.2)
    L(quad((cx + 0.8, cy - 12), (cx + 2, cy - 18.5), (cx - 1.2, cy - 20)), '#4FA6DB', 2.2)
    # skjerf rundt halsen med hvite striper
    band = quad((cx - 11, cy + 5), (cx, cy + 11.5), (cx + 11.5, cy + 5.5))
    L(band, BIRD_INK, 5.6); L(band, '#E5574A', 3.8)
    for i in range(3, len(band) - 2, 4):   # smale strikkestriper
        x, y = band[i]
        R(x - 0.3, y - 1.4, 0.6, 2.8, 0.3, '#FFFFFF')
    E(cx - 9, cy + 5, 2.4, 2.4, '#E5574A', BIRD_INK, 0.6)
    # vinge
    E(cx - 7.5, cy + 2.5, 5.2, 3.3, '#4FA6DB', BIRD_INK, 0.6)
    # øyne (3/4-vinkel), kinn og nebb
    for ex, ey, s in [(cx + 3, cy - 3.4, 1.0), (cx + 9.6, cy - 3.6, 0.85)]:
        E(ex, ey, 2.2 * s, 2.8 * s, BIRD_INK)
        E(ex + 0.8 * s, ey - 1.1 * s, 0.9 * s, 0.9 * s, '#FFFFFF')
    soft(cx + 2.2, cy + 1.9, 2.3, 1.3, (255, 128, 150, 150)); soft(cx + 11, cy + 1.4, 1.8, 1.1, (255, 128, 150, 150))
    d.polygon([P(cx + 5.2, cy - 0.6), P(cx + 10.4, cy + 0.5), P(cx + 5.4, cy + 1.9)], fill='#FFAE57', outline=BIRD_INK)
    return img.resize((size, size), Image.LANCZOS).convert('RGB')


icon(192).save('icons/icon-192.png')
icon(512).save('icons/icon-512.png')
icon(512, True).save('icons/icon-maskable-512.png')
icon(180).save('icons/apple-touch-icon.png')
icon(32).save('icons/favicon-32.png')
print('icons written')
