# Revisjon 2 av Pixelfugl (v3.5): særpreg og «AI-stil»

**Dato:** 9. oktober 2026
**Omfang:** Hele spillet etter fase 1–5 (`index.html`, `js/*.js`, `sw.js`, ikoner)
**Metode:** Kodegjennomgang, kjøring i Chromium (412 × 915, DPR 2), skjermbilder av meny, spill,
natt, game over og garderobe, og målinger i koden: antall gradienter, sirkler og sinusbevegelser,
fargepalett og flisbredder.

> Den første revisjonen ([`REVISJON.md`](REVISJON.md)) handlet om å gjøre spillet *ryddig, mykt og
> koselig*. Det er gjort. Denne revisjonen spør om noe annet: **ser spillet ut som noe et menneske har
> laget med vilje, eller som «typisk AI-generert»?** Den gir poeng per område, viser hva som avslører
> AI-stilen, og foreslår konkrete tiltak.

---

## 1. Sammendrag

Pixelfugl er nå **teknisk solid og pent**: jevn fysikk på 120 Hz, myke overganger, ingen hakking,
mykt lydbilde og mye innhold. Det som trekker ned, er ikke feil, men **mangel på særpreg**. Spillet
er bygget av «trygge standardvalg» som hver for seg er fine, men som sammen gir det glatte, generiske
uttrykket folk forbinder med AI-generert innhold:

- Alt er **myke sirkler, gradienter og glød**, med jevne strekbredder og ingen ujevnheter.
- Alt som beveger seg, **vugger i en jevn sinusbølge**, og ingenting har pauser eller intensjon.
- Bakgrunnen **gjentar seg synlig**: bakken to ganger per skjerm, to identiske hytter og helt
  symmetriske fjell.
- Det søte er bygget av **standardklisjeer**: rosa kinn, hjerter, stjerner, «Bonk!», konfetti og
  pilleknapper med glans.
- Det norske er en **sjekkliste** (bjørk, hytte, fjell, nisselue, vikinghjelm) uten en egen vri.

**Samlet poeng: 6,9 av 10.** Håndverket er godt, men særpreget er svakt.
**Menneskelig/håndlaget preg: 3,5 av 10.** Spillet ser i dag ganske tydelig «AI-pent» ut.

De tre tiltakene med størst effekt (se seksjon 5):

1. **Gi fuglen en ekte identitet:** en blåmeis med sine kjennetegn, ikke en generisk rund fugl.
2. **Bryt det perfekte:** litt ujevne streker, papirtekstur og variasjon i farge og form.
3. **Fjern gjentakelse og symmetri:** unike hytter, fjell med karakter, sjeldne landemerker og
   lengre bakkeflis.

---

## 2. Poeng per område

Skala 1–10. «Før» er poengene fra første revisjon (anslått ut fra funnene der), «nå» er v3.5.

| Område | Før | Nå | Kommentar |
|---|:-:|:-:|---|
| Teknisk kvalitet og ytelse | 6 | **9** | 120 Hz-fysikk med interpolering, forhåndstegnede lag, 60 bilder/s og 52–58 under krysstoning. Offline-PWA. |
| Spillfølelse og fysikk | 5 | **8** | Flaksingen kjennes god, og krasj, skjold og Zen er myke. Litt lite «vekt» i fuglen ved toppen av hoppet. |
| Grafikk: håndverk og ryddighet | 4 | **7,5** | Rene kanter, ingen trappetrinn, god palett per tid og årstid. |
| Grafikk: særpreg og originalitet | 3 | **4,5** | Her ligger hovedproblemet. Se seksjon 3. |
| Animasjon | 4 | **6** | Myk, men ensformig. Alt vugger med samme sinusrytme (rundt 17 samtidige sinusbevegelser i koden). |
| Lyd og musikk | 3 | **6,5** | Koselig speiledåse og god miksing, men helt syntetisk, og løkka er bare 8 takter (cirka 22 s). |
| UI og UX | 5 | **7,5** | Tydelig, pause, garderobe med sider. Men standardknapper og et sentrert, symmetrisk oppsett. |
| Tekst og tone | 6 | **7** | Varm norsk tone. «Bonk!», «Plopp!» og «Nesten!» er likevel standard tegneseriespråk. |
| Innhold og variasjon | 4 | **7,5** | Tid på døgnet, årstider, 12 pynt-ting og fire vanskelighetsgrader. |
| Tilgjengelighet | 4 | **5,5** | Liten tekst (ned mot 9–10 px logisk), svak kontrast i noen paneler, ingen haptikk-bryter og ingen fargeblindhjelp. |
| **Samlet** | **4,4** | **6,9** | |

### Indikator for «AI-preg»

| Kjennetegn | Nivå i dag |
|---|---|
| Glatt, «perfekt» vektorgrafikk uten ujevnheter | Høyt |
| Generiske, søte klisjeer | Høyt |
| Synlig gjentakelse og symmetri | Middels til høyt |
| Bevegelse uten intensjon (jevn vugging) | Høyt |
| Gradienter og glød overalt | Høyt |
| Standard UI (pilleknapper, avrundet font) | Middels |
| Unik identitet (karakter, historie, stil) | Lavt |

**AI-preg: cirka 7 av 10**, altså **menneskelig preg: cirka 3,5 av 10**.
**Målet etter tiltakene: menneskelig preg på 7 eller mer.**

---

## 3. Hva avslører «AI-stilen»? Funn med bevis

### 3.1 Alt er perfekt glatt

Målt i koden:

| Mål | Antall |
|---|---|
| Kall til `circle(`/`ellipse(` | 99 (54 + 45) |
| Avrundede rektangler (`rr(`) | 29 |
| Radielle gradienter | 12 |
| Lineære gradienter | 6 |

Nesten alle streker ligger i samme smale bånd, `lineWidth` 1,1–1,6.

- **Hvorfor det ser AI-aktig ut:** Menneskelige illustratører varierer strekbredde (tykt i skygge,
  tynt i lys), lar linjer bli litt ujevne og bruker få, bevisste gradienter. Perfekte sirkler med en
  myk gradient og glød oppå er nettopp «standardutseendet» til generert illustrasjon.
- **Se:** [`revisjon-2/spill.jpg`](revisjon-2/spill.jpg), [`revisjon-2/meny.jpg`](revisjon-2/meny.jpg).

### 3.2 Synlig gjentakelse

Se [`revisjon-2/gjentakelse.jpg`](revisjon-2/gjentakelse.jpg). Rød stiplet linje markerer der
bakkeflisen starter på nytt, blå markerer like busker.

- **Bakken** gjentar seg omtrent hver 206. CSS-piksel, altså **to ganger per skjermbredde**, med
  identiske steiner og tuer.
- **Gresskanten** er bølget med helt jevn avstand (hver 12. piksel) og like høye buer.
- **Lagbreddene** er 420, 360, 300, 240 og 144 px. Med parallakse blir mønsteret lett å se etter noen
  sekunder.
- **Bjørkebarken** bruker de samme merketypene med jevn fordeling.

Det menneskelige øyet er svært godt til å oppdage gjentakelse, og det er et av de tydeligste tegnene
på «generert» bakgrunn.

### 3.3 Symmetri og kloner

Se [`revisjon-2/fjell-og-hytter.jpg`](revisjon-2/fjell-og-hytter.jpg).

- **Fjellene** er laget av gaussiske «klokker». De blir perfekt symmetriske topper uten skar,
  hamrer eller rygger, og ingen ekte fjell ser slik ut.
- **De to hyttene** er identiske: samme størrelse, farge, vindu, pipe og røyk.
- Menyen, game over-panelet og garderoben er **sentrert og speilsymmetriske**.

### 3.4 Bevegelse uten intensjon

- **Rundt 17 steder** bruker `Math.sin(time…)` til vugging: skyer, ballong, power-ups, tittel,
  knapper, fugl i menyen, ildfluer og stjerner.
- Alt beveger seg hele tiden, med samme type kurve og uten pauser.
- Profesjonell animasjon bruker **nøkkelbilder med pauser** («hold»), forberedelse (anticipation),
  overskyting og **tilfeldige små handlinger**. En fugl som ser seg rundt, pirker i fjærene, blunker
  dobbelt eller skvetter når en sky passerer, oppleves levende. En fugl som vugger jevnt, oppleves
  som en skjermsparer.

### 3.5 Søte standardklisjeer

| Klisjé | Hvor |
|---|---|
| Rosa kinn (`cheek`) på fuglen | `render.js` (fuglepaletten) |
| Hjerter (`heartPath`) og stjerner | Partikler og effekter i `render.js`/`game.js` |
| «Bonk!», «Plopp!», «Nesten!», «Ny!» | Flytetekst og etiketter |
| Konfetti ved rekord | `game.js` |
| Pilleknapper med hvit glansstripe | Meny, game over og garderobe |
| Avrundet font (Fredoka) | Hele UI-et |
| Kremfarget panel med stiplet «søm» | Game over og garderobe |

Hver av disse er helt greie alene. Til sammen er det **den mest typiske «cute mobile game»-pakken**,
og det er den bildegeneratorer og kodegeneratorer lager når man ber om «koselig og søtt».

### 3.6 Norsk som sjekkliste

Bjørk, rød hytte, fjell, nisselue, vikinghjelm og fluesopp er riktige motiver, men de er de
**første** man tenker på. Det mangler et lite, personlig blikk:

- et konkret sted
- en bestemt fugl
- et mønster fra norsk håndverk
- en detalj man bare legger merke til hvis man har vært der

### 3.7 Lyden er ren syntese

Speiledåse, pad og effekter er generert med oscillatorer. Det låter rent, men **sterilt**. Ekte opptak
mangler helt: fuglekvitter, vind, knirk i tre og en ekte speiledåse. Dessuten er musikkløkka på
**8 takter (cirka 22 s)**, så den blir gjenkjennelig etter et par runder.

### 3.8 Navn og stil passer ikke sammen

Spillet heter **Pixel**fugl, men har myk vektorgrafikk uten piksler. Det oppleves som et navn som ble
beholdt mens stilen ble byttet, altså som noe som ikke er gjennomtenkt helhetlig.

---

## 4. Hva som allerede fungerer godt (ikke rør)

- **Fysikken og interpoleringen:** dette er profesjonelt nivå.
- **Bjørkestammene** som hinder: et godt, særegent valg som bør bygges videre på.
- **Skjerfet** med verlet-simulering: en fin, levende detalj.
- **Tid på døgnet og årstider:** gir variasjon og gjør spillet personlig.
- **Zen-modus** og den myke krasjen: varmt spilldesign.
- **Ingen emojier**, og en ren, norsk tekst.

---

## 5. Tiltak, prioritert i faser

Fasene er ordnet etter **effekt per arbeidsinnsats**. A og B gir mest synlig forskjell.

### Fase A: signatur og identitet (størst effekt)

1. **Fuglen blir en blåmeis.** Det gir en ekte, gjenkjennelig norsk art i stedet for en generisk rund
   fugl:
   - blå hette, hvite kinn og svart øyestripe
   - gul buk og grønnaktig rygg
   - de rosa kinnene fjernes, og den hvite kinnflekken gjør jobben
   - garderobepynten tilpasses den nye hodeformen
2. **Mønster fra norsk håndverk.** Skjerfet får lusekofte-mønster (enkle rosetter eller
   «lus»-prikker). Rosemaling-ornamenter brukes sparsomt i UI-hjørner, på medaljen og på
   pause-panelet.
3. **Egen logo i stedet for Fredoka-tittel.** «Pixelfugl» tegnes som en egen ordmerke-sti med litt
   ujevn, håndtegnet bokstavform, gjerne med fuglen integrert i en bokstav.
   - **Navnet:** enten (a) behold «Pixelfugl» og innfør bevisste pikseldetaljer, som et
     brodert/korssting-preg på skjerf, medaljer og ikoner (korssting *er* piksler i håndarbeid), eller
     (b) gi spillet et nytt navn som passer stilen, for eksempel «Meisefjell» eller «Lille meis».
   - Anbefaling: **(a) korssting-vrien**. Den knytter navnet, det norske håndarbeidet og den koselige
     stilen sammen til én idé.
4. **Håndtegnet strek.** En hjelpefunksjon legger liten, **frøstyrt** ujevnhet på konturer og
   varierer strekbredden langs linjen (tykkere i skygge). Den brukes på fugl, stammer, hytter og
   panel. Fordi effekten er frøstyrt, «skjelver» ikke grafikken mellom bilder.
5. **Papir- og stofftekstur.** Et svakt kornlag (forhåndstegnet, 2–4 % dekkevne) legges over himmel
   og paneler, og flatene får liten fargevariasjon i stedet for rene gradienter.
6. **Færre gradienter og mindre glød.** Halver antallet radielle gradienter og bruk heller
   **2–3 flate tonetrinn** (cel-skygge) med en bevisst lysretning.

### Fase B: variasjon uten gjentakelse

1. **Bakken bygges av segmenter** i tilfeldig rekkefølge: tuer, steiner, blåbærlyng, en
   maurtue, en stubbe og en sti. Det gir minst 4–5 skjermbredder før noe gjentar seg, og
   gresskanten får ujevne buer.
2. **Fjell med karakter:**
   - en asymmetrisk silhuett med skar og en tydelig hovedtopp (inspirert av en ekte topp)
   - snøfonner i renner i stedet for jevne hetter
3. **Unike hytter:** ulik størrelse, farge (rød, oker, hvit) og takvinkel. Én har vimpel, én har
   flaggstang og én har vedstabel.
4. **Sjeldne landemerker** som dukker opp en sjelden gang (cirka 1 per 30–60 s):
   - stavkirke, fyr ved kysten eller seterbu med kuer
   - en sau, en elg i skogkanten eller en postkasse ved stien

   Det belønner oppmerksomhet og gjør runder forskjellige.
5. **Bjørkebark med ekte uregelmessighet:** horisontale lenticeller i klynger, svarte «øyne» der
   greiner har falt av, og ulik stammebredde og helning.

### Fase C: animasjon med intensjon

1. **Nøkkelbilder med pauser** i stedet for sinus: et lite animasjonssystem med `hold`, `ease`,
   overskyting og forberedelse.
2. **Tilfeldige smålåter** for fuglen i menyen og mens den venter:
   - ser til siden, pirker i fjærene, blunker dobbelt og rister seg
   - kikker opp når en sky eller ballong passerer
3. **Mindre samtidig vugging.** Maks 3–4 ting beveger seg i bakgrunnen samtidig, med ulik rytme og
   pauser. Skyer driver heller jevnt enn å vugge.
4. **Bedre vekt i flaksingen:** en kort «squash» før vingeslaget, og vingene henger litt etter
   kroppen.

### Fase D: UI i verden og færre klisjeer

1. **Panelene blir gjenstander i verden:**
   - game over vises på et treskilt med spikre
   - garderoben blir en kurv eller en knaggrekke
   - pause blir et bjørkenever-panel
2. **Tegnede ikoner i stedet for tekstpiller** der det passer (lyd, musikk, tema), og asymmetrisk
   plassering.
3. **Klisjeer erstattes med naturlige reaksjoner:**
   - hjerter og stjerner blir fjær, frø og blader
   - «Bonk!» og «Plopp!» blir en liten fjærsky og en lyd, uten tekst
   - konfetti blir en flokk småfugler eller løv som virvler opp
4. **Medaljen** blir en utskåret tremedalje eller et brodert merke med korssting (henger sammen med
   A3).
5. **Font:** behold Fredoka for brødtekst om ønskelig, men bruk den egne logoen og en litt mer
   karakterfull font i overskrifter. Fonten må kunne lagres lokalt (offline).

### Fase E: lyd med ekte opptak

1. **Noen få CC0-opptak** gir organisk preg:
   - blåmeisens «si-si-dy» som flaks- eller poenglyd (dempet)
   - en treknakk ved treff
   - vind i bjørk som bakgrunn
   - en ekte speiledåse eller kalimba som musikkinstrument
2. **Lengre musikk** med A/B-deler og variasjon: minst 32 takter før gjentakelse, og en egen kort
   «solnedgangs-bro» når tiden på døgnet skifter.
3. Lydene **lastes inn i forkant og legges i service worker-hurtigbufferen**, så offline fortsatt
   fungerer. Total størrelse holdes under cirka 400 kB.

### Fase F: en liten fortelling

1. **Fuglen er på vei hjem.** Hver runde er en reise fra fjellet ned mot hytta, med navngitte steder
   man passerer (for eksempel «Bjørkelia», «Tjernet», «Seterbua»).
2. **Game over forteller hvor langt man kom:** «Du kom forbi Tjernet» i stedet for bare poeng.
3. **En sjelden «hjemkomst»-scene** ved høy poengsum: fuglen lander på fuglebrettet ved hytta.

### Tilgjengelighet (gjøres løpende)

- Minste tekst på 12 px logisk, og kontrast på minst 4,5:1 på all tekst i paneler.
- **Bryter for vibrasjon/haptikk** og respekt for `prefers-reduced-motion` (mindre vugging og
  rolige overganger).
- Power-ups skilles på **form**, ikke bare farge (fargeblindvennlig).

---

## 6. Forventet effekt på poengene

| Område | Nå | Etter A–B | Etter A–F |
|---|:-:|:-:|:-:|
| Grafikk: særpreg og originalitet | 4,5 | 7 | **8,5** |
| Animasjon | 6 | 6,5 | **8** |
| Lyd og musikk | 6,5 | 6,5 | **8** |
| UI og UX | 7,5 | 7,5 | **8,5** |
| Tilgjengelighet | 5,5 | 6 | **7,5** |
| **Samlet** | **6,9** | **7,6** | **8,5** |
| **Menneskelig preg** | **3,5** | **6** | **7,5–8** |

---

## 7. Anbefalt rekkefølge

1. **Fase A** (blåmeis, korssting-vri, håndtegnet strek og tekstur). Dette er det største enkeltløftet
   og bestemmer stilen for resten.
2. **Fase B** (variasjon). Den fjerner de mest synlige «generert»-tegnene.
3. **Fase C og D** sammen, siden begge handler om at ting skal ha intensjon.
4. **Fase E og F** til slutt, fordi de bygger videre på den nye identiteten.

Hver fase leveres som en egen PR med automatiske tester og skjermbilder før og etter, som før.
