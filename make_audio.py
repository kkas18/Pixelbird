"""Bygger lydfilene i audio/ fra fritt lisensierte opptak (krever ffmpeg og numpy).

Kildene lastes ned til en hurtigbuffer-mappe, klippes, renses og kodes som mono mp3.
Kortere lyder legges etter hverandre i én fil ("sprite") med stillhet imellom; skriptet
skriver ut tidspunktene som Sound i js/sound.js bruker. Lisenser og opphav: audio/KILDER.md.

Bruk:  python3 make_audio.py [mappe-for-nedlastinger]
"""
import os
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'audio')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'pixelfugl-lydkilder')

OGA = 'https://opengameart.org/sites/default/files/'
SOURCES = {
    # blåmeis (Cyanistes caeruleus), xeno-canto, CC0
    'xc707390.mp3': 'https://xeno-canto.org/707390/download',
    'xc973366.mp3': 'https://xeno-canto.org/973366/download',
    # vind i trær (park_ambience_wind), OpenGameArt, CC0
    'vind.wav': OGA + 'park_ambience_wind.wav',
    # tre: 100 CC0 metal and wood SFX (rubberduck) og tree creaking (AntumDeluge), OpenGameArt, CC0
    'treverk.zip': OGA + '100-CC0-wood-metal-SFX.zip',
    'knirk.ogg': OGA + 'tree_creak.ogg',
    # leketøys-xylofon (child's xylophone), OpenGameArt, CC0
    'xylofon.zip': OGA + 'child%27s_xylophone.zip',
    # kalimba (Cayenneta, Kalimba Sample Pack), Internet Archive, Public Domain Mark 1.0
    'kalimba.zip': 'https://archive.org/download/cayenneta-kalimba-sample-pack-2025/Kalimba%20Sample%20Pack.zip',
}


def fetch(name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        print('laster ned', name)
        req = urllib.request.Request(SOURCES[name], headers={'User-Agent': 'Pixelfugl-make_audio'})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
            f.write(r.read())
    return path


def from_zip(zname, member):
    path = os.path.join(CACHE, member.replace('/', '_'))
    if not os.path.exists(path):
        with zipfile.ZipFile(fetch(zname)) as z, open(path, 'wb') as f:
            f.write(z.read(member))
    return path


def load(path, filters='', start=None, dur=None):
    """Mono float32 i SR, med valgfrie ffmpeg-filtre og utsnitt."""
    cmd = ['ffmpeg', '-v', 'error']
    if start is not None:
        cmd += ['-ss', str(start)]
    if dur is not None:
        cmd += ['-t', str(dur)]
    cmd += ['-i', path, '-ac', '1', '-ar', str(SR)]
    if filters:
        cmd += ['-af', filters]
    cmd += ['-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).copy()


def fade(x, a=0.012, b=0.03):
    n, m = int(a * SR), int(b * SR)
    x[:n] *= np.linspace(0, 1, n) ** 2
    x[-m:] *= np.linspace(1, 0, m) ** 2
    return x


def peak(x, db=-1.0):
    return x * (10 ** (db / 20) / max(1e-9, np.abs(x).max()))


def encode(x, name, kbps):
    path = os.path.join(OUT, name)
    pcm = np.clip(x, -1, 1).astype(np.float32).tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-map_metadata', '-1', path],
                   input=pcm, check=True)
    print(f'{name:16s} {len(x) / SR:5.2f} s  {os.path.getsize(path) / 1024:5.1f} kB')


def sprite(parts, name, kbps, lead=0.15, gap=0.3):
    """Legger lydene etter hverandre med stillhet imellom; gir [start, lengde] per lyd."""
    out, marks, t = [np.zeros(int(lead * SR), np.float32)], {}, lead
    for key, x in parts:
        marks[key] = [round(t, 3), round(len(x) / SR, 3)]
        out += [x, np.zeros(int(gap * SR), np.float32)]
        t += len(x) / SR + gap
    encode(np.concatenate(out), name, kbps)
    return marks


def tits():
    clean = 'highpass=f=2300:poles=2,highpass=f=2300:poles=2,lowpass=f=10500,afftdn=nr=14:nf=-50'
    a, b = fetch('xc707390.mp3'), fetch('xc973366.mp3')
    cuts = [  # (navn, fil, start, slutt): sanger («si-si-sirrr») og korte kall
        ('sang1', a, 2.88, 4.64), ('sang2', a, 4.66, 6.24), ('sang3', a, 6.26, 7.98), ('sang4', a, 15.58, 16.86),
        ('sang5', b, 5.93, 7.22), ('sang6', b, 14.76, 16.56), ('sang7', b, 20.51, 22.00), ('sang8', b, 25.79, 27.35),
        ('kall1', a, 1.33, 1.99), ('kall2', a, 12.36, 12.98), ('kall3', a, 14.50, 15.12),
    ]
    parts = []
    for key, src, s, e in cuts:
        x = load(src, clean, s - 0.25, e - s + 0.5)[int(0.25 * SR):int((e - s + 0.25) * SR)]
        parts.append((key, fade(peak(x, -2.0), 0.02, 0.05)))
    return sprite(parts, 'meis.mp3', 56)


def wind():
    """Sløyfe på 14 s: slutten tones inn i starten (lik effekt), så sømmen ikke høres."""
    L, X, pre = 14.0, 1.5, 0.2
    x = load(fetch('vind.wav'), 'highpass=f=180:poles=2,lowpass=f=9000', 121.0, L + X + 0.5)
    n, m = int(L * SR), int(X * SR)
    k = np.linspace(0, np.pi / 2, m)
    body = x[:n].copy()
    body[:m] = x[:m] * np.sin(k) + x[n:n + m] * np.cos(k)
    rms = np.sqrt((body ** 2).mean())
    body *= 10 ** (-22 / 20) / rms
    body = np.clip(body, -0.89, 0.89)
    p = int(pre * SR)
    # litt av slutten foran og starten bak, så dekoderens forsinkelse aldri lander i stillhet
    encode(np.concatenate([body[-p:], body, body[:p]]), 'vind.mp3', 48)
    return {'start': pre, 'len': L}


def wood():
    clean = 'highpass=f=70'
    knock = load(from_zip('treverk.zip', 'wood_hit_07.ogg'), clean)
    knock2 = load(from_zip('treverk.zip', 'wood_hammer_02.ogg'), clean)
    creak = load(fetch('knirk.ogg'), 'highpass=f=120', 0.22, 1.75)
    parts = [('knakk', fade(peak(knock[:int(0.3 * SR)]), 0.002, 0.05)),
             ('dunk', fade(peak(knock2[:int(0.22 * SR)]), 0.002, 0.05)),
             ('knirk', fade(peak(creak, -3.0), 0.03, 0.3))]
    return sprite(parts, 'tre.mp3', 64)


def instruments():
    ping = load(from_zip('kalimba.zip', 'ping.flac'), 'highpass=f=420:poles=2', 0.06, 2.6)
    ping = peak(ping)
    tail = int(0.7 * SR)
    ping[-tail:] *= np.linspace(1, 0, tail) ** 2
    ping[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    xylo = load(from_zip('xylofon.zip', "child's_xylophone-1.wav"), 'highpass=f=300')
    encode(ping, 'kalimba.mp3', 80)
    marks = sprite([('glid', fade(peak(xylo, -2.0), 0.002, 0.08))], 'xylofon.mp3', 64)
    return marks


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    print('meis', tits())
    print('vind', wind())
    print('tre', wood())
    print('xylofon', instruments())
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.mp3'))
    print(f'totalt {total / 1024:.1f} kB')
