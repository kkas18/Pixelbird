# Pixelfugl

Et koselig flakse-spill (v3.7): en liten blåmeis med lusekofte-skjerf flyr
gjennom en norsk bjørkeskog. Varm pastellstil med myke konturer, fjell og fjord,
røde hytter med torvtak og pipe-røyk, luftballong, ildfluer om kvelden og en
søvnig måne. Dag/natt-tema, generert musikk, syntetisert lyd og vibrasjon.
Bygget som en installerbar PWA, optimalisert for Samsung Galaxy (portrett) og
andre Android-telefoner.

All grafikk og lyd er generert i koden – ingen bildefiler eller lydfiler
trengs utover ikonene. Fonten (Fredoka) er selvhostet, så spillet ser likt ut
også uten nett.

## Stil: håndlaget og norsk

Navnet «Pixelfugl» er tatt bokstavelig på norsk-håndarbeidsvis: **korssting er
piksler i stoff**.

- **Logoen** er en egen pikselskrift der hver piksel er ett korssting (i-prikken er
  et blått sting). Den bruker ikke fonten.
- **Medaljene** er broderte merker med en **selburose** (åttebladsrose) i korssting
  og kant i plattsøm.
- **Fuglen er en blåmeis**: blå hette, hvitt ansikt med mørk øyestripe og halsring,
  gul buk, gulgrønn rygg og blå vinger med hvitt vingebånd.
- **Skjerfet** er en lusekofte: rødt med hvite «lus» i korssting.
- **Rosemaling** pynter panelene og pauseskjermen, og panelenes søm er sydd for hånd
  (ujevne sting).
- **Håndtegnet strek:** konturene er litt ujevne og tykkest på skyggesiden (lyset
  kommer fra sola oppe til høyre). Ujevnheten er frøstyrt, så ingenting flimrer.
- **Papirkorn** er bakt inn i himmel, landskap og paneler.
- **Flate tonetrinn** (cel-skygge) i stedet for gradienter på fugl, stammer, skyer,
  jord og sol.

## Filer

| Fil | Formål |
|-----|--------|
| `index.html` | Siden: lerret, stil og innlasting av skriptene |
| `js/config.js` | Konstanter, lagring, vanskelighetsgrader, power-ups, tema, årstider og garderobe |
| `js/sound.js` | Musikk, lydeffekter og naturlyder (Web Audio, alt syntetisert) |
| `js/game.js` | Spilltilstand, input, fysikk, tid på døgnet og oppdatering |
| `js/render.js` | Tegning: forhåndstegnede lag, stammer, fugl, partikler og brukergrensesnitt |
| `js/main.js` | Oppstart: skjermstørrelse, spill-løkke og PWA |
| `manifest.webmanifest` | PWA-manifest: navn, ikoner, portrett, standalone |
| `sw.js` | Service worker – spillet fungerer offline etter første besøk |
| `icons/` | App-ikoner (192, 512, maskable 512, Apple touch, favicon) + skjermbilde |
| `fonts/` | Fredoka (woff2, variabel vekt) + lisens (SIL OFL 1.1) |
| `docs/REVISJON.md` | Første revisjon: funn og plan (fase 1–4, gjennomført) |
| `docs/REVISJON-2.md` | Andre revisjon: poeng og tiltak mot «AI-stil» (fase A–F) |
| `.nojekyll` | Sørger for at GitHub Pages serverer alle filer som de er |
| `make_icons.py` | Regenererer ikonene (blåmeisen foran en bjørkestamme; valgfritt, krever Pillow) |

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
- Knappene på startskjermen slår **lydeffekter** og **musikk** av/på og velger om
  runden starter på **dag** eller **natt**.
- **Garderobe** på startskjermen: velg pynt til fuglen (se under).
- Beste poengsum og samlede poeng lagres lokalt på enheten.

Medaljer (broderte merker med selburose): 10 bronse, 20 sølv, 30 gull, 40 platina.

## Vanskelighetsgrader

Velges på startskjermen. Beste poengsum lagres per nivå.

| Nivå | Gap (px) | Fart (px/s) | Maks sprang mellom gap (px) | Varianter fra poeng |
|------|----------|-------------|-----------------------------|---------------------|
| Lett | 152 | 118 | 150 | 14 |
| Normal | 130 | 136 | 135 | 8 |
| Hard | 112 | 160 | 120 | 4 |
| Zen | 165 | 108 | 140 | – |

**Zen** er for ren kos: fuglen kan ikke dø. Treffer den en stamme, spretter den mykt
inn i åpningen; treffer den bakken, spretter den opp igjen. Ingen game over, ingen
rekord og ingen skjold (det trengs ikke). Gå ut via pause → Meny.

Gapet krymper litt med poengsummen, men aldri under 92 px. Gapene plasseres i en
fast sone på 400 px over bakken, så vanskeligheten er lik på alle skjermhøyder.

## Tid på døgnet og årstider

Hvert 10. poeng glir tiden videre: **dag → solnedgang → kveld → soloppgang → dag …**
(starter på det du har valgt i menyen). Hele verden tones mykt over i løpet av
1,8 sekunder, og musikk og naturlyder følger med (kveldsvariant om natten).

Årstiden følger datoen:

| Årstid | Måneder | Kjennetegn |
|--------|---------|------------|
| Vår | mars–mai | rosa blomstrende bjørker, blomsterblader i lufta (ildfluer om kvelden) |
| Sommer | juni–august | grønt, pollen i lufta (ildfluer om kvelden) |
| Høst | september–november | oransje og gule trær, løv som faller |
| Vinter | desember–februar | snø på trær, bakke, hustak og stammekanter; snøfall |

For å teste en annen årstid: sett `localStorage.setItem('pf.season', 'winter')`
(`spring`, `summer`, `autumn` eller `winter`) og last siden på nytt.

## Garderobe

Poeng fra alle vanlige runder samles (Zen teller ikke) og låser opp pynt:

| Pynt | Krav |
|------|------|
| Bare skjerf | – |
| Rosa sløyfe | 10 poeng totalt |
| Strikkelue | 25 poeng totalt |
| Fluesopphatt | 45 poeng totalt |
| Blomst i hetta | 60 poeng totalt |
| Solbriller | 80 poeng totalt |
| Blomsterkrans | 100 poeng totalt |
| Runde briller | 120 poeng totalt |
| Vikinghjelm | 150 poeng totalt |
| Nisselue | 200 poeng totalt |
| Flosshatt | 300 poeng totalt |
| Liten krone | gull (30 poeng) i én runde |

Garderoben har to sider med seks ting på hver (bla med pilene). Ny pynt vises på
game over-skjermen («Ny pynt: …!»).

Spillet bruker ingen emojier: all tekst er vanlige bokstaver, tall og tegnsetting,
og symboler som piler, hjerter og stjerner er tegnet som figurer.

## Landskapet

Landskapet er laget for at øyet ikke skal se gjentakelse:

- **Bakken** er satt sammen av 14 bakkestykker i tilfeldig rekkefølge, og samme stykke kommer
  aldri igjen før minst fire andre har passert. Stykkene har hvert sitt innhold: tuer, en
  bjørkestubbe, en stor mosegrodd stein, blåbærlyng (bær om sommeren, røde blader om høsten), en
  tråkket sti, en maurtue, kantareller, og blåklokker med prestekrager. Gresskanten har ujevne buer,
  og skjøtene er sømløse.
- **Fjellene** har én tydelig hovedtopp med bratt vegg og lang skulder, et skar, mindre nabotopper
  og smale snøfonner i søkkene.
- **Husene i åsen** er forskjellige: en rød hytte med vimpel, et okergult gårdshus med flaggstang,
  en hvit seterbu med vedstabel og et stabbur på stolper. Åsene er to skjermbredder lange, og skog
  og busker står i klynger med glenner imellom.
- **Sjeldne landemerker** dukker opp omtrent hvert 30.–60. sekund, aldri det samme som de to
  forrige: stavkirke, fyr (med lysstråle om kvelden), seter med kuer, elg i skogkanten, en sau som
  beiter og en postkasse ved stien. Hvert landemerke står plantet på sitt eget parallakse-lag.

## Hinder: bjørkestammer

Hver stamme er unik (barkmerker, kjuker, kvister, fluesopp, av og til en ugle
som titter ut), men ser lik ut hele veien gjennom skjermen. Barken er som ekte bjørk: merker i
klynger med bar bark imellom, mørke «belter», «øyne» der greiner har sittet og små lenticeller.
Alle stammene er like brede og står rett, så treffsonen er rettferdig.

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

- En blåmeis (se «Stil» over). Øynene sitter i den mørke øyestripen, med en lys kant
  så de er lette å lese.
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

Alt er generert i Web Audio – ingen lydfiler. En rolig 8-takters loop i F-dur
på 88 BPM med lett swing: spilledåse-melodi, myk pad (Fmaj7 – Dm7 – B♭maj7 –
Csus4 …) og etterklang. På menyen spilles en enklere, varmere versjon; i spill
kommer rund bass, kalimba-glimt, en myk shaker og et rolig «hjerteslag» inn i
stedet for trommer. Om kvelden spilles en vuggevise-variant uten rytme, en
oktav lavere. Sakte film demper lyden. Musikken starter ved første trykk
(nettlesere krever brukerhandling).

**Lydeffekter:** mykt «fwip» når fuglen flakser, bjelle som stiger i skala for
hvert poeng på rad, liten fanfare hvert 10. poeng og ved ny rekord, «plopp» når
såpeboblen sprekker, tegneserie-«bonk/boing» ved krasj, og en liten «å nei»-
melodi i dur på game over. Poengene telles opp med små klikk.

**Naturlyder:** svak vind og fuglekvitter om dagen, sirisser og en ugle innimellom
om kvelden. «Musikk av» slår av både musikk og naturlyder.

Felles romklang og en begrenser (kompressor) på slutten hindrer klipping når
mange lyder overlapper.

## Animasjoner

- Overgang mellom skjermer: en sirkel som åpner seg rundt fuglen.
- Knapper klemmes litt når du trykker.
- Poengtallet spretter som en fjær; game over-panelet og tittelen spretter inn,
  og medaljen (eller egget) snurrer inn når poengene er talt opp.
- Ny rekord: «Ny rekord!» og blomsterblader som daler ned.
- Alt respekterer «redusert bevegelse» i systemet.

## Oppdatere

Endre `VERSION` øverst i `sw.js` ved hver ny utgivelse, ellers kan installerte
apper fortsette å bruke den gamle, cachede versjonen.
