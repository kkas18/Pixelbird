# Lydopptak: kilder og lisenser

Opptakene i denne mappen er laget av `make_audio.py` i rotmappen. Skriptet laster ned
originalene, klipper, filtrerer og normaliserer dem, og koder dem som mono mp3.
Alle originalene er fritt lisensiert. Ingen av dem krever kreditering, men opphavet
står her likevel.

| Fil | Innhold | Original | Opphav | Lisens |
| --- | --- | --- | --- | --- |
| `meis.mp3` | Sang 1–4 og kall 1–3 fra blåmeis (*Cyanistes caeruleus*) | [XC707390](https://xeno-canto.org/707390), Carolles (Frankrike), 2021 | Sonothèque des oiseaux de Carolles et de la baie du Mont-Saint-Michel | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `meis.mp3` | Sang 5–8 fra blåmeis | [XC973366](https://xeno-canto.org/973366), Schneverdingen (Tyskland), 2025 | Christian Kahle | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `vind.mp3` | Vind i trær med raslende løv, 14 s sømløs sløyfe | [Park ambiences](https://opengameart.org/content/park-ambiences) (`park_ambience_wind.wav`) | Thimras | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `tre.mp3` | Treknakk og dunk | [100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx) (`wood_hit_07`, `wood_hammer_02`) | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `tre.mp3` | Knirk i tre | [Tree creaking](https://opengameart.org/content/tree-creaking) | AntumDeluge | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `kalimba.mp3` | Én kalimbatone (E6), som spilles i alle tonehøyder | [Kalimba Sample Pack](https://archive.org/details/cayenneta-kalimba-sample-pack-2025) (`ping.flac`) | Cayenneta | [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/), merket av opphavspersonen selv |
| `xylofon.mp3` | Glid over en leketøys-xylofon | [Children's xylophone](https://opengameart.org/content/childrens-xylophone) (`child's_xylophone-1`) | AntumDeluge | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Bearbeiding

- **Blåmeis:**
  - høypass ved 2,3 kHz og lavpass ved 10,5 kHz, mot trafikk og sus
  - støyreduksjon med FFT-filteret i ffmpeg
  - hver frase normalisert til −2 dBFS, med myke inn- og uttoninger
- **Vind:**
  - høypass ved 180 Hz, mot mikrofonbuldring
  - 1,5 s krysstoning mellom slutten og starten, så sløyfen ikke har søm
  - normalisert til −22 dBFS RMS
- **Kalimba:**
  - høypass ved 420 Hz, mot brum
  - tonen er kortet til 2,6 s og tones ut
- **Tre og xylofon:** filtrert lett og normalisert til −1 dBFS.

Spillet bruker den syntetiske lyden fra før så lenge opptakene ikke er lastet, og hvis de ikke
kan lastes i det hele tatt.
