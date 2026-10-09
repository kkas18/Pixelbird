# Pixelfugl

Et koselig flakse-spill (v3.2): en liten blå fugl med strikket skjerf flyr
gjennom en norsk bjørkeskog. Varm pastellstil med myke konturer, fjell og fjord,
røde hytter med torvtak og pipe-røyk, luftballong, ildfluer om kvelden og en
søvnig måne. Dag/natt-tema, generert musikk, syntetisert lyd og vibrasjon.
Bygget som en installerbar PWA, optimalisert for Samsung Galaxy (portrett) og
andre Android-telefoner.

All grafikk og lyd er generert i koden – ingen bildefiler eller lydfiler
trengs utover ikonene. Fonten (Fredoka) er selvhostet, så spillet ser likt ut
også uten nett.

## Filer

| Fil | Formål |
|-----|--------|
| `index.html` | Hele spillet (Canvas 2D, ingen avhengigheter) |
| `manifest.webmanifest` | PWA-manifest: navn, ikoner, portrett, standalone |
| `sw.js` | Service worker – spillet fungerer offline etter første besøk |
| `icons/` | App-ikoner (192, 512, maskable 512, Apple touch, favicon) + skjermbilde |
| `fonts/` | Fredoka (woff2, variabel vekt) + lisens (SIL OFL 1.1) |
| `docs/REVISJON.md` | Revisjon av spillet med funn og plan for forbedringer |
| `.nojekyll` | Sørger for at GitHub Pages serverer alle filer som de er |
| `make_icons.py` | Regenererer ikonene fra sprite-kartet (valgfritt, krever Pillow) |

## Publisering på GitHub Pages

1. Opprett et nytt repo, f.eks. `pixelfugl`.
2. Last opp alle filene (inkludert mappen `icons/` og `.nojekyll`) til rot-nivået i repoet.
3. Gå til **Settings → Pages**. Under *Build and deployment* velger du
   **Deploy from a branch**, branch `main`, mappe `/ (root)`. Lagre.
4. Etter ett–to minutter er spillet live på  
   `https://<brukernavn>.github.io/pixelfugl/`

Alle stier i manifest og service worker er relative (`./`), så det fungerer
også i en undermappe.

## Installere på Samsung / Android

1. Åpne adressen i **Chrome** eller **Samsung Internet**.
2. Trykk **Installer Pixelfugl**-knappen nederst på startskjermen, eller velg
   *Legg til på startskjermen* / *Installer app* i nettlesermenyen.
3. Appen åpnes i fullskjerm uten nettleser-linjer, låst til portrett.

## Kontroller

- **Trykk** hvor som helst på skjermen (eller mellomrom / pil opp) for å flakse.
- **Pause**: knappen øverst til høyre, eller Esc / P. Spillet pauses også automatisk
  når appen legges i bakgrunnen, og lyden stoppes. «Fortsett» gir en kort 3-2-1-nedtelling.
- Etter game over: **Spill igjen** eller **Meny** (for å bytte nivå, lyd eller tema).
- Knappene på startskjermen slår **lydeffekter** og **musikk** av/på og bytter **dag/natt**.
- Beste poengsum lagres lokalt på enheten.

Medaljer: 10 bronse, 20 sølv, 30 gull, 40 platina.

## Vanskelighetsgrader

Velges på startskjermen. Beste poengsum lagres per nivå.

| Nivå | Gap (px) | Fart (px/s) | Maks sprang mellom gap (px) | Varianter fra poeng |
|------|----------|-------------|-----------------------------|---------------------|
| Lett | 152 | 118 | 150 | 14 |
| Normal | 130 | 136 | 135 | 8 |
| Hard | 112 | 160 | 120 | 4 |

Gapet krymper litt med poengsummen, men aldri under 92 px. Gapene plasseres i en
fast sone på 400 px over bakken, så vanskeligheten er lik på alle skjermhøyder.

## Hinder: bjørkestammer

Hver stamme er unik (barkmerker, kjuker, kvister, fluesopp, av og til en ugle
som titter ut), men ser lik ut hele veien gjennom skjermen.

- **Høstløv på kanten** – stammen beveger seg opp og ned.
- **Lyng i mosen** (lilla blomster) – smalere åpning (20 % mindre gap).

## Power-ups

Dukker opp i gapet fra 3 poeng. Fly gjennom for å plukke opp.

- **Såpeboble** (skjold) – tåler ett treff: boblen spretter, fuglen blinker, er
  usårbar i 0,8 s og glir mykt inn i gapet.
- **Snegl** (sakte film) – 6 sekunder med 55 % fart.
- **Gyllen eikenøtt** (dobbel) – 8 sekunder med 2 poeng per stamme.

Aktive effekter vises som striper under poengsummen.

## Fuglen

- Blunker, ser seg rundt i menyen og sover (med «z») i menyen om natten.
- Lukker øynene glad (^ ^) når den får poeng, og sperrer dem opp i fritt fall.
- Skjerfsnippene er en liten fysikksimulering (Verlet) som blafrer i fartsvinden.
- Ved krasj: «Bonk!», fuglen klemmes flat, spretter og blir sittende oppreist og
  svimmel, med stjerner som går rundt hodet.

## Grafikk og ytelse

De statiske bakgrunnslagene (fjell og fjord, åser med hytter, bjørkeskog, busker,
bakke), himmelen og vignetten tegnes én gang til offscreen-lerreter og blittes
hvert bilde. Bare det som beveger seg tegnes live. Tegneoppløsningen er begrenset
til 2× skjermpiksler. Spillet holder 60 bilder/s på en 2,6×-skjerm, også uten GPU.

## Fysikk

Tidsbasert modell med fast steg på 120 Hz (uavhengig av skjermens
oppdateringsfrekvens). Tegningen interpoleres mellom to fysikk-steg, så
bevegelsen er jevn på 60, 90 og 120 Hz-skjermer:

- Tyngdekraft og flaks i px/s², luftmotstand og terminalfart (560 px/s).
- Fast flaks-impuls: hvert trykk gir nøyaktig samme løft, uansett rytme.
- Rotasjon som fjær mot målvinkel med demping, squash-and-stretch på fuglen.
- Presis sirkel-mot-avrundet-rektangel-kollisjon (hettene har runde hjørner).
- Ved krasj spretter fuglen av røret, tumler og spretter én gang i bakken.
  Skjermen rister i en dempet svingning bort fra treffet (av ved «redusert
  bevegelse»), og kanten tones mykt i stedet for en hvit blits.

## Musikk

Alt er generert i Web Audio – ingen lydfiler. En 8-takters loop i C-dur på
128 BPM med bass, akkord-arpeggio, lead med chorus, og trommer. På menyen
spilles en rolig, filtrert versjon; i spill åpnes filteret og trommene
kommer inn. Sakte film demper filteret, game over gir en kort sting.
Musikken starter ved første trykk (nettlesere krever brukerhandling).

## Oppdatere

Endre `VERSION` øverst i `sw.js` ved hver ny utgivelse, ellers kan installerte
apper fortsette å bruke den gamle, cachede versjonen.
