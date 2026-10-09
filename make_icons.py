"""Genererer app-ikoner i samme koselige stil som spillet (krever Pillow):
blåmeisen med lusekofte-skjerf foran en bjørkestamme med mose, varm pastellhimmel."""
from PIL import Image, ImageDraw

INK = '#5B4636'        # varm kontur (verden)
BIRD_INK = '#22304F'   # kontur på fuglen (blåmeisens mørke strek)


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
    L(quad((17, 35), (12, 39), (10, 45)), '#D9473A', 2.8)
    # blåmeis: gul buk, gulgrønn rygg, hvitt ansikt, blå hette, mørk øyestripe og halsring
    cx, cy = 26, 31
    soft(cx + 0.8, cy + 2.4, 13, 13, (91, 70, 54, 45))
    E(cx - 0.6, cy + 0.8, 14.3, 14.3, BIRD_INK)   # kontur, tykkest nede til venstre
    body = Image.new('L', (n, n)); ImageDraw.Draw(body).ellipse([*P(cx - 13, cy - 13), *P(cx + 13, cy + 13)], fill=255)
    feathers = Image.new('RGBA', (n, n)); fd = ImageDraw.Draw(feathers)
    def FE(x, y, rx, ry, c): fd.ellipse([*P(x - rx, y - ry), *P(x + rx, y + ry)], fill=c)
    def FL(pts, c, w): fd.line([P(x, y) for x, y in pts], fill=c, width=max(1, int(w * u)), joint='curve')
    FE(cx, cy, 13, 13, '#FFD23E')
    FE(cx - 8.3, cy - 1.5, 8.8, 13.5, '#A9BE5A')
    FE(cx + 4.4, cy - 1.7, 9.2, 6.5, '#FFFDF6')
    FE(cx + 1.2, cy - 12.7, 13.4, 8, '#FFFDF6')
    FE(cx + 1.2, cy - 13.4, 11.9, 6.8, '#3A8AD6')
    FE(cx + 4.4, cy - 9.8, 4.4, 1.5, '#6FB2EC')
    FL(quad((cx + 5.8, cy - 1.5), (cx + 3.3, cy - 3.8), (cx - 1.6, cy - 4.8)) + quad((cx - 1.6, cy - 4.8), (cx - 6.8, cy - 5.6), (cx - 12.5, cy - 4.8)), '#22304F', 2.6)
    FL(quad((cx + 8.3, cy - 1.6), (cx + 10, cy - 4), (cx + 13.5, cy - 4.6)), '#22304F', 2.2)
    FL(quad((cx - 12, cy - 4.6), (cx - 8.8, cy + 3.6), (cx - 1, cy + 4.5)) + quad((cx - 1, cy + 4.5), (cx + 5.2, cy + 4.8), (cx + 8.8, cy + 3.1)), '#22304F', 2)
    img.paste(feathers, (0, 0), body)   # fjærdrakten klippes til kroppen
    # cel-skygge nede til venstre
    sh = Image.new('L', (n, n)); sd = ImageDraw.Draw(sh)
    sd.ellipse([*P(cx - 13, cy - 13), *P(cx + 13, cy + 13)], fill=34)
    sd.ellipse([*P(cx - 13 + 1.3, cy - 13 - 1.8), *P(cx + 13 + 1.3, cy + 13 - 1.8)], fill=0)
    img.paste(Image.new('RGBA', (n, n), (52, 44, 96, 255)), (0, 0), sh)
    # fjærtust i hetta
    L(quad((cx - 1.2, cy - 11.6), (cx - 2, cy - 15.6), (cx - 4.2, cy - 16.4)), BIRD_INK, 3.4)
    L(quad((cx - 1.2, cy - 11.6), (cx - 2, cy - 15.6), (cx - 4.2, cy - 16.4)), '#3A8AD6', 1.7)
    # lusekofte-skjerf rundt halsen: rødt med hvite korssting
    band = quad((cx - 11, cy + 5), (cx, cy + 11.5), (cx + 11.5, cy + 5.5))
    L(band, BIRD_INK, 5.6); L(band, '#D9473A', 3.8)
    for i in range(2, len(band) - 2, 3):
        x, y = band[i]
        off = 0.8 if i % 2 else -0.8
        for dx, dy in [(-0.55, -0.55), (-0.55, 0.55)]:
            L([(x + dx, y + off + dy), (x - dx, y + off - dy)], '#FFF8EC', 0.55)
    E(cx - 9, cy + 5, 2.4, 2.4, '#D9473A', BIRD_INK, 0.6)
    # vinge: blå med hvite fjærspisser
    E(cx - 7.5, cy + 2.5, 5.4, 3.4, '#4A93DA', BIRD_INK, 0.6)
    for k in range(3):
        E(cx - 10.4 + k * 2.6, cy + 2.6 - (0.3 if k == 1 else 0), 1.1, 0.7, '#FFFDF6')
    # øyne i øyestripen (med lys kant) og et lite, mørkt nebb
    for ex, ey, s in [(cx + 3, cy - 3.4, 1.0), (cx + 9.6, cy - 3.6, 0.85)]:
        E(ex, ey + 0.3 * s, 2.9 * s, 3.5 * s, '#FFFDF6')
        E(ex, ey, 2.2 * s, 2.8 * s, '#10141F')
        E(ex + 0.8 * s, ey - 1.1 * s, 0.9 * s, 0.9 * s, '#FFFFFF')
    d.polygon([P(cx + 5.4, cy - 0.8), P(cx + 9.8, cy + 0.2), P(cx + 5.6, cy + 1.8)], fill='#4A505E', outline=BIRD_INK)
    return img.resize((size, size), Image.LANCZOS).convert('RGB')


icon(192).save('icons/icon-192.png')
icon(512).save('icons/icon-512.png')
icon(512, True).save('icons/icon-maskable-512.png')
icon(180).save('icons/apple-touch-icon.png')
icon(32).save('icons/favicon-32.png')
print('icons written')
