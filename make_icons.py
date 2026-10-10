"""Lager app-ikonene i arkadestilen (krever Pillow): blåmeisen som pikselfigur på svart, med en dobbel
blå labyrintramme og en rad prikker foran nebbet. Fuglen og fargene leses fra js/render.js, så ikonet
alltid er den samme figuren som i spillet. Alt tegnes som hele piksler (ingen utjevning)."""
import re
from PIL import Image, ImageDraw

SRC = open('js/render.js', encoding='utf-8').read()


def js_rows(name):
    """Henter en liste med strenger (rader i en sprite) fra render.js."""
    block = re.search(r'const ' + name + r' = \[(.*?)\];', SRC, re.S).group(1)
    return re.findall(r"'([^']*)'", block)


BODY = js_rows('BIRD_BODY')
PAL = dict(re.findall(r"(\w): '(#[0-9A-Fa-f]{6})'", re.search(r'const BC = \{(.*?)\};', SRC).group(1)))
WING = re.search(r"mid:\s*\[(-?\d+), (-?\d+), \[(.*?)\]\]", SRC)
WING_X, WING_Y, WING_ROWS = int(WING.group(1)), int(WING.group(2)), re.findall(r"'([^']*)'", WING.group(3))
BG, WALL, FILL, DOT = '#000000', '#2B3CFF', '#03082A', '#FFC7A1'


def bird_cells():
    """Fuglen i hvile (vingen midt på, øyet åpent), som {(x, y): farge} i kroppens koordinater."""
    cells = {}

    def pat(ox, oy, rows):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in PAL:
                    cells[(ox + i, oy + j)] = PAL[ch]
    pat(-3, 5, ['bbb.', 'bBBb', '.bbb'])                 # stjerten
    pat(-3, 10, ['RRRRR', '.Rr..', '..r..'])             # skjerfsnippen
    pat(0, 0, BODY)
    pat(WING_X, WING_Y, WING_ROWS)
    return cells


def rr_cell(x, y, w, h, rad):
    """0 = utenfor, 1 = på streken, 2 = innenfor en pikselrund firkant (samme som rrCell i pixel.js)."""
    if x < 0 or y < 0 or x >= w or y >= h:
        return 0
    dx = rad - x - 0.5 if x < rad else x - (w - rad) + 0.5 if x >= w - rad else 0
    dy = rad - y - 0.5 if y < rad else y - (h - rad) + 0.5 if y >= h - rad else 0
    if dx > 0 and dy > 0:
        d = (dx * dx + dy * dy) ** 0.5
        return 0 if d > rad else 1 if d > rad - 1.05 else 2
    return 1 if x in (0, w - 1) or y in (0, h - 1) else 2


def icon(size, maskable=False):
    G = 48                      # ikonet er 48 × 48 kunstpiksler
    px = size / G
    img = Image.new('RGB', (size, size), BG)
    d = ImageDraw.Draw(img)

    def cell(x, y, col):
        x0, y0 = round(x * px), round(y * px)
        d.rectangle([x0, y0, round((x + 1) * px) - 1, round((y + 1) * px) - 1], fill=col)

    if not maskable:            # dobbel labyrintramme (en maskerbar flate klippes, så den får ingen ramme)
        m, w = 2, G - 4
        for y in range(w):
            for x in range(w):
                o = rr_cell(x, y, w, w, 7)
                i = rr_cell(x - 3, y - 3, w - 6, w - 6, 5)
                if o == 1 or (o == 2 and i == 1):
                    cell(m + x, m + y, WALL)
                elif o == 2 and i == 2:
                    cell(m + x, m + y, FILL)
    cells = bird_cells()
    xs = [x for x, _ in cells]
    ys = [y for _, y in cells]
    bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
    # fuglen litt til venstre for midten, så prikkene foran nebbet får plass (én kunstpiksel = én ikonpiksel)
    ox = (G - bw) // 2 - min(xs) - 3
    oy = (G - bh) // 2 - min(ys)
    for (x, y), col in cells.items():
        cell(ox + x, oy + y, col)
    # prikkene foran nebbet (den nærmeste er allerede spist)
    beak_y = oy + 7
    for i in range(2):
        cx = ox + 22 + i * 4
        for a in range(2):
            for b in range(2):
                cell(cx + a, beak_y + b, DOT)
    return img


icon(192).save('icons/arkade-192.png')
icon(512).save('icons/arkade-512.png')
icon(512, True).save('icons/arkade-maskable-512.png')
icon(180).save('icons/arkade-apple-touch.png')
icon(48).save('icons/arkade-favicon-48.png')
print('icons written')
