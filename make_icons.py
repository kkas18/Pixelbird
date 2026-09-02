"""Genererer app-ikoner i samme vektorstil som spillet (krever Pillow)."""
from PIL import Image, ImageDraw

def icon(size, maskable=False):
    S = 8  # supersampling for glatte kanter
    n = size * S
    img = Image.new('RGBA', (n, n))
    d = ImageDraw.Draw(img)
    for y in range(n):
        t = y / n
        d.line([(0, y), (n, y)], fill=(int(0x5B + (0xCF - 0x5B) * t), int(0xC8 + (0xF1 - 0xC8) * t), int(0xF0 + (0xFF - 0xF0) * t)))
    u = n / 64
    def E(cx, cy, rx, ry, c): d.ellipse([cx * u - rx * u, cy * u - ry * u, cx * u + rx * u, cy * u + ry * u], fill=c)
    def R(x, y, w, h, r, c): d.rounded_rectangle([x * u, y * u, (x + w) * u, (y + h) * u], radius=r * u, fill=c)
    # sky
    for dx, dy, r in [(0, 0, 4), (5, -1.5, 5.5), (10, 0, 4)]: E(10 + dx, 12 + dy, r, r, (255, 255, 255, 235))
    # åser + bakke
    E(14, 66, 30, 16, '#7BD389'); E(52, 68, 34, 16, '#5DBF6E')
    R(0, 56, 64, 12, 0, '#EBDDA5'); R(0, 56, 64, 3, 0, '#7FCB4A')
    # rør
    R(46, 26, 12, 30, 0, '#5EBF3E'); R(48, 26, 2.5, 30, 1, (255, 255, 255, 80)); R(55, 26, 3, 30, 0, '#3B8F2A')
    R(44.5, 21, 15, 6.5, 1.8, '#5EBF3E'); R(46.5, 22, 3, 4.5, 1, (255, 255, 255, 90)); R(56.5, 21, 3, 6.5, 1.8, '#3B8F2A')
    # fugl
    cx, cy = 26, 30
    E(cx + 0.6, cy + 2.5, 15, 12, (0, 0, 0, 30))
    E(cx, cy, 15, 12, '#3FA9F5'); E(cx - 4, cy - 5, 8, 6, '#5DB9FF')
    E(cx - 3, cy + 4.5, 8.5, 5.5, '#FFFFFF')
    E(cx - 8.5, cy + 0.5, 8.5, 5, '#2B7FC4')
    E(cx + 6, cy - 4, 5.2, 5.2, '#FFFFFF'); E(cx + 7.5, cy - 4, 2.6, 2.6, '#1B1C26'); E(cx + 8.4, cy - 5, 0.9, 0.9, '#FFFFFF')
    d.polygon([(int((cx + 10) * u), int((cy + 1) * u)), (int((cx + 21) * u), int((cy + 2.5) * u)), (int((cx + 10) * u), int((cy + 5.5) * u))], fill='#FF8A3D')
    return img.resize((size, size), Image.LANCZOS).convert('RGB')

icon(192).save('icons/icon-192.png')
icon(512).save('icons/icon-512.png')
icon(512, True).save('icons/icon-maskable-512.png')
icon(180).save('icons/apple-touch-icon.png')
icon(32).save('icons/favicon-32.png')
print('icons written')
