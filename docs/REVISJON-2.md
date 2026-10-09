# Revisjon 2 av Pixelfugl (v3.5): særpreg og «AI-stil»

**Dato:** 9. oktober 2026
**Omfang:** Hele spillet etter fase 1–5 (`index.html`, `js/*.js`, `sw.js`, ikoner)
**Metode:** Kodegjennomgang, kjøring i Chromium (412 × 915, DPR 2), skjermbilder av meny, spill,
natt, game over og garderobe, og målinger i koden: antall gradienter, sirkler og sinusbevegelser,
fargepalett og flisbredder.

> **Status:** Fase A (signatur og identitet) er gjennomført i v3.6, fase B (variasjon uten
> gjentakelse) i v3.7, fase G (dybde og kamera, lagt til etter ønske) i v3.8 og fase C (animasjon
> med intensjon) i v3.9, fase D (UI i verden og færre klisjeer) i v4.0, fase E (lyd med ekte
> opptak) i v4.1 og fase F (en liten fortelling) i v4.2. Alle fasene er gjennomført; se seksjon 8–14.

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

### Fase G: dybde og kamera (lagt til etter ønske)

Målet er at spillet skal se ut som et kamerabilde med dybde, ikke som flate pappfigurer, men uten å gå
over til ekte 3D (som ville kostet det håndtegnede preget):

1. **Dybdeskarphet** bakt inn i lagene: uskarpere jo lenger unna. Skjøtene skal være sømløse, og det skal
   finnes en reserveløsning for nettlesere uten filter på lerretet.
2. **Luftperspektiv:** mer dis jo lenger unna.
3. **Forgrunn nær kameraet:** sparsomme, uskarpe klynger nederst som aldri dekker spillet.
4. **Kamera som følger fuglen litt i høyden**, med forskyvning av lagene etter avstand.
5. **Fokustrekk:** skarpt landskap i menyen og fokus på fuglen i spill.
6. **Partikler og skygge etter dybde.**

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

---

## 8. Status: fase A gjennomført (v3.6)

| Tiltak | Hva som ble gjort |
|---|---|
| A1 Blåmeis | Fuglen er nå en blåmeis: blå hette med hvit ring, hvitt ansikt, mørk øyestripe og halsring, gul buk, gulgrønn rygg, blå vinger og hale med hvite fjærspisser, lite mørkt nebb og blågrå føtter. De rosa kinnene er fjernet. Øynene har en lys kant så de leses i øyestripen. All pynt i garderoben passer uten endringer. |
| A2 Lusekofte og rosemaling | Skjerfet har hvite «lus» i korssting i forskjøvne rader, både rundt halsen og på snippene. Panelene og pauseskjermen har et lite rosemalingsornament (rose, C-snirkler, blad og prikker). Sømmen i panelene er sydd for hånd, med ujevne sting. |
| A3 Korssting-logo | «Pixelfugl» er en egen pikselskrift der hver piksel er ett korssting; i-prikken er et blått sting. Navnet og stilen henger nå sammen: korssting er piksler i stoff. Medaljene er broderte merker med en selburose i korssting og kant i plattsøm. |
| A4 Håndtegnet strek | Konturene på fugl, paneler, knapper, busker, trær og stammer er litt ujevne og tykkest på skyggesiden. Ujevnheten er frøstyrt, så den er lik i hvert bilde (testet). |
| A5 Papirkorn | Et mykt papirmønster (marmorering, fint korn og fibre) er bakt inn i himmel, landskap og skyer, og legges over panelene. Det koster ingenting ekstra per bilde. |
| A6 Færre gradienter | Fra 18 til 9 gradienter. Fugl, stammer, skyer, jord, sol, hyttevindu, power-ups og medaljer bruker nå flate tonetrinn med fast lysretning (sola oppe til høyre). Knappene har en flat underkant i stedet for blank glans. |

Ikonene er tegnet på nytt med blåmeisen og lusekofte-skjerfet.

**Før og etter:**

- [`revisjon-2/fase-a/fugl.jpg`](revisjon-2/fase-a/fugl.jpg): fuglen og pynten
- [`revisjon-2/fase-a/meny.jpg`](revisjon-2/fase-a/meny.jpg): menyen med korssting-logoen
- [`revisjon-2/fase-a/over.jpg`](revisjon-2/fase-a/over.jpg): game over med brodert medalje og rosemaling
- [`revisjon-2/fase-a/garderobe.jpg`](revisjon-2/fase-a/garderobe.jpg): garderoben
- [`revisjon-2/fase-a/natt.jpg`](revisjon-2/fase-a/natt.jpg): kveld

**Verifisering:**

- 22 nye automatiske tester for fase A, blant annet palett, logo uten font, selburose og stabil strek.
- Alle tidligere testpakker består (fase 1, 2, 4, 5 og lyd).
- Bildefrekvensen i spill er like god som i v3.5, målt vekselvis mot `main` på samme maskin.

**Oppdaterte poeng:**

| Område | Før fase A | Etter fase A |
|---|:-:|:-:|
| Grafikk: særpreg og originalitet | 4,5 | **6,5** |
| Grafikk: håndverk og ryddighet | 7,5 | **8** |
| UI og UX | 7,5 | **7,5** |
| **Menneskelig preg** | **3,5** | **5,5** |

Det som gjenstår for å komme forbi «AI-pent» er særlig gjentakelsen og symmetrien i bakgrunnen
(fase B) og den jevne vuggingen (fase C).

---

## 9. Status: fase B gjennomført (v3.7)

| Tiltak | Hva som ble gjort |
|---|---|
| B1 Bakken | Bakken er bygget av 14 stykker (96 px) med felles kantprofil. Rekkefølgen er tilfeldig, men fast per posisjon, og samme stykke kommer aldri igjen før minst fire andre har passert. Gresskanten har ujevne buer (8–16 px). Stykkene har tuer, stubbe, stor stein, blåbærlyng, sti, maurtue, kantareller og markblomster, og innholdet følger årstiden (snø om vinteren). |
| B2 Fjellene | Én hovedtopp med bratt vegg (halvbredde 23 px) og lang skulder (48 px), et skar og lavere nabotopper (høyeste 70 % av hovedtoppen). Snøfonnene er V-formede, ryggen er rufsete og skyggesiden følger en takket rygg. |
| B3 Hus og lag | Rød hytte med vimpel, okergult gårdshus med flaggstang, hvit seterbu med vedstabel og stabbur på stolper. Åsene er 720 px (var 360), skogen 600 (var 300) og buskene 480 (var 240). Trær og busker står i klynger. Faste farger tones etter tiden på døgnet. |
| B4 Landemerker | Stavkirke, fyr, seter med kuer, elg, sau og postkasse kommer omtrent hvert 30.–60. sekund, aldri det samme som de to forrige. De står plantet på sitt eget lag. Sauen beiter med pauser, og fyret har en roterende lysstråle om kvelden. |
| B5 Barken | Merker i klynger med bar bark imellom, mørke belter, «øyne» og lenticeller. Merkene tegnes samlet etter strektykkelse, så det ikke koster ytelse. Lange lag tegnes bare der de er synlige. Stammene er fortsatt like brede og rette, så treffsonen er uendret og rettferdig. |

**Før og etter:**

- [`revisjon-2/fase-b/panorama.jpg`](revisjon-2/fase-b/panorama.jpg): tre skjermbredder av landskapet, før og etter
- [`revisjon-2/fase-b/landemerker.jpg`](revisjon-2/fase-b/landemerker.jpg): alle landemerkene, dag og kveld
- [`revisjon-2/fase-b/meny.jpg`](revisjon-2/fase-b/meny.jpg), [`natt.jpg`](revisjon-2/fase-b/natt.jpg), [`spill.jpg`](revisjon-2/fase-b/spill.jpg)

**Verifisering:**

- 25 nye automatiske tester for fase B, blant annet:
  - ingen periode i bakkens rekkefølge
  - sømløse skjøter mellom alle 196 par av stykker
  - skjev hovedtopp
  - hyppighet og variasjon for landemerkene
  - bark i klynger
- Alle tidligere testpakker består på funksjon (fase 1, 2, 4, 5, A og lyd).
- Tegnetiden per bilde er lik `main` (15,3 mot 15,2 ms på en 2,6×-skjerm uten GPU, målt vekselvis på samme maskin). Med to landemerker på skjermen samtidig er den cirka 3–4 % høyere.
- To gamle tester med faste fps-terskler (≥ 55 i spill og ≥ 45 under krysstoning) havner like under grensen på testmaskinen, og `main` gjør det samme der. De sammenlignende testene består.

**Oppdaterte poeng:**

| Område | Etter fase A | Etter fase B |
|---|:-:|:-:|
| Grafikk: særpreg og originalitet | 6,5 | **7,5** |
| Innhold og variasjon | 7,5 | **8,5** |
| **Menneskelig preg** | **5,5** | **6,5** |

Det tydeligste gjenværende «AI-tegnet» er den jevne sinusvuggingen. Fase C (animasjon med intensjon)
tar den.

---

## 10. Status: fase G gjennomført (v3.8)

| Tiltak | Hva som ble gjort |
|---|---|
| G1 Dybdeskarphet | Fjell (2,2 px), åser (1,4), skog (0,8), busker (0,35), skyer (0,7) og forgrunn (3,2) gjøres uskarpe én gang når scenen tegnes. Landemerkene følger laget sitt. Uskarpheten lages og lagres i lav oppløsning og skaleres opp når den tegnes, så den bruker lite minne og koster nesten ingenting per bilde. Flisene er sømløse, og nettlesere uten filter får uskarpheten laget i JavaScript (samme resultat). |
| G2 Luftperspektiv | Dis i himmelfarge etter avstand (fjell 20 %, åser 11 %, skog 5 %). |
| G3 Forgrunn | Fire klynger (høyt gress, bregner, store bjørkeblader, høstfarger om høsten og snø om vinteren) glir forbi med fart 1,45. De starter ved gresskanten og går aldri mer enn 4 px over den. |
| G4 Kamera | Kameraet følger fuglen i høyden (maks 8 px, kritisk dempet), og lagene forskyves etter avstand. Skogbunnen forlenges, så det aldri blir glipper. Kameraet er av i menyen og ved «redusert bevegelse». |
| G5 Fokustrekk | Menyen bruker skarpe kopier av lagene (bare for menyens tid på døgnet). Når runden starter, glir fokus til fuglen på cirka et halvt sekund. |
| G6 Partikler og skygge | Cirka 12 % av partiklene ligger nær kameraet: store, myke og raske. Fuglen har en skygge på bakken som krymper og blekner med høyden. |

**Før og etter:**

- [`revisjon-2/dybde/spill.jpg`](revisjon-2/dybde/spill.jpg): spill før og etter
- [`revisjon-2/dybde/fokus.jpg`](revisjon-2/dybde/fokus.jpg): fokus på landskapet i menyen og på fuglen i spill
- [`revisjon-2/dybde/natt.jpg`](revisjon-2/dybde/natt.jpg): kveld

**Verifisering:**

- 25 nye automatiske tester for fase G, blant annet:
  - at uskarpheten øker med avstanden
  - sømløse skjøter
  - lav oppløsning og skarpe kopier bare der de trengs
  - fokustrekket
  - at det ikke blir glipper når kameraet er i ytterpunktene
  - at forgrunnen holder seg nede
  - bakkeskyggen
  - reserveløsningen
  - redusert bevegelse
  - ingen lange blokkeringer mens scenene bygges i forkant
- Alle tidligere testpakker består på funksjon (fase 1, 2, 4, 5, A, B og lyd).
- Å bygge en scene tar cirka 115–165 ms i programvaretegning (fase B: 80–115 ms). Byggingen skjer én scene om gangen med pauser, og ingen blokkering er over cirka 100 ms.
- Tegnetiden per bilde for fase B og G samlet er mellom −2 % og +10 % mot v3.6 i ulike kjøringer (grense +12 %). Dybdefunksjonene alene står for cirka 3 %.

**Oppdaterte poeng:**

| Område | Etter fase B | Etter fase G |
|---|:-:|:-:|
| Grafikk: særpreg og originalitet | 7,5 | **8** |
| Grafikk: håndverk og ryddighet | 8 | **8,5** |
| **Menneskelig preg** | **6,5** | **7** |

---

## 11. Status: fase C gjennomført (v3.9)

| Tiltak | Hva som ble gjort |
|---|---|
| C1 Nøkkelbilder | `keyframes()` med pauser (samme verdi på to nøkler), easing per overgang (`inOut`, `out`, `in`, `back` med overskyting og `antic` med forberedelse) og `loopKeys()` for sykluser. |
| C2 Fuglen i hvile | Sinus-svevet er erstattet av svev med vingeslag: hvert slag gir løft, og fuglen synker litt imellom, med uregelmessig takt (0,24–0,36 s). Småhandlinger kommer én om gangen med 2–5 s pause imellom: se til siden, pirke i fjærene, dobbeltblunk, riste seg, og se opp når ballongen eller fugleflokken passerer. Om natten sover den med rolige slag (0,75–1,25 s). |
| C3 Bakgrunn og brukergrensesnitt | Skyer uten vugging, ballong i trinn med pauser, fugleflokk som flakser og glir, stjerner som blinker én og én, ildfluer i serier. Logo som faller på plass, egg som rister i støt, hånd som trykker og power-ups i ro med hjerteslag. Sinus-vugging er redusert fra cirka 17 steder til 5, og de som er igjen er fysiske fenomener (båt på vann, såpeboble, vind i skjerf og løv). |
| C4 Vekt i flaksingen | Vingeslaget går raskt ned (0,07 s) og saktere opp (0,23 s) med overskyting, likt i hvile og i spill. |

Alt følger «redusert bevegelse»: ingen småhandlinger, logo og egg står stille, og ildfluene lyser jevnt.

**Bilder:** [`revisjon-2/fase-c/handlinger.jpg`](revisjon-2/fase-c/handlinger.jpg) viser fuglens småhandlinger.

**Verifisering:**

- 24 nye automatiske tester for fase C, blant annet:
  - nøkkelbilder
  - løft etter vingeslag
  - uregelmessig takt
  - småhandlinger og at fuglen ser opp
  - ballongens pauser
  - stjerner og ildfluer
  - vingeslagets form
  - power-ups i ro
  - natt og redusert bevegelse
  - hele flyten i alle årstider
- Alle tidligere testpakker består på funksjon. Tegnetiden i meny og spill er lik `main`.

**Oppdaterte poeng:**

| Område | Etter fase G | Etter fase C |
|---|:-:|:-:|
| Animasjon | 6 | **8** |
| UI og UX | 7,5 | **8** |
| **Menneskelig preg** | **7** | **7,5** |

Det som gjenstår fra planen: fase D (UI i verden og færre klisjeer), fase E (lyd med ekte opptak) og
fase F (en liten fortelling).

---

## 12. Status: fase D gjennomført (v4.0)

| Tiltak | Hva som ble gjort |
|---|---|
| D1 Paneler i verden | Game over er et treskilt av furuplanker med årer, kvister, spikre og malt rosemaling. Det henger i to tau og svinger litt (pendel) når det har falt på plass. Medaljemerket er spikret fast. Garderoben er en knaggrekke der hver pynt henger fra en knagg på en lapp med sydd kant. Pause ligger på et stykke bjørkenever med revet kant, lenticeller, «øyne» og en krøllet flik. Flatene tegnes én gang og gjenbrukes. |
| D2 Ikoner | Lyd, musikk og dag/natt er runde trestykker med tegnede ikoner (høyttaler, note, sol, måne), plassert asymmetrisk nede til venstre. «Av» vises med en skrå strek. Pauseknappen er i samme stil. |
| D3 Færre klisjeer | Stjerner og hjerter ved poeng er byttet ut med bjørkefrø og blader. «Bonk!», «Plopp!» og «Oi!» er fjernet; fjær, barkstøv og lyden bærer øyeblikket. Konfetti ved ny rekord er byttet ut med en meiseflokk som letter og blader som virvler. Stjernene rundt hodet etter krasj er fjernet (spiraløynene sier nok), og månen har ikke lenger rosa kinn. |
| D4 Medalje | Allerede et brodert merke med selburose (fase A). Nå er det spikret fast på skiltet. |
| D5 Overskrifter | «Klar?», «Pause», «Garderobe», «Ny rekord!», «Å nei!», «Oi da!» og «Uff da!» er brodert i logoens håndlagde pikselskrift, som er utvidet med de bokstavene som trengs (også Å med ring). Brødtekst er fortsatt Fredoka. |

Tekst på treskiltet har kontrast på minst 4,9:1 (krav 4,5:1).

**Før og etter:**

- [`revisjon-2/fase-d/over.jpg`](revisjon-2/fase-d/over.jpg): game over
- [`revisjon-2/fase-d/garderobe.jpg`](revisjon-2/fase-d/garderobe.jpg): garderoben
- [`revisjon-2/fase-d/pause.jpg`](revisjon-2/fase-d/pause.jpg): pause
- [`revisjon-2/fase-d/meny.jpg`](revisjon-2/fase-d/meny.jpg): meny med ikonknapper

**Verifisering:**

- 27 nye automatiske tester for fase D, blant annet:
  - ingen utropsord, stjerner, hjerter eller rosa kinn
  - broderte overskrifter i stedet for fonten
  - ikonknappene virker
  - garderoben virker
  - kontrast
  - frø og blader ved poeng
  - skiltets sving
  - meiseflokken
  - pause på never
  - alle årstider og tider
- Alle tidligere testpakker består på funksjon. Tegnetiden (median av seks vekselvise runder) er +1 % i menyen og −8 % på game over mot `main`, siden skiltet nå er et ferdig bilde.

**Oppdaterte poeng:**

| Område | Etter fase C | Etter fase D |
|---|:-:|:-:|
| UI og UX | 8 | **8,5** |
| Tekst og tone | 7 | **8** |
| Grafikk: særpreg og originalitet | 8 | **8,5** |
| **Menneskelig preg** | **7,5** | **8** |

Det som gjenstår fra planen etter fase D: fase E (lyd med ekte opptak) og fase F (en liten fortelling).

---

## 13. Status: fase E gjennomført (v4.1)

| Tiltak | Hva som ble gjort |
|---|---|
| E1 Ekte opptak | Elleve fraser blåmeissang og -kall fra to CC0-opptak på xeno-canto (Frankrike og Tyskland), vind i trær med raslende løv, treknakk, dunk og knirk i tre, et glid over en leketøys-xylofon og én kalimbatone. Alt er klippet, renset for sus og brum og normalisert av `make_audio.py`, som kan kjøres på nytt. Kilder og lisenser står i `audio/KILDER.md`. |
| E2 Brukt der det betyr noe | Blåmeisen synger fra ulike steder i skogen om dagen (tilfeldig frase, avstand og retning). Vinden er en sømløs sløyfe på 14 s. Treff mot en stamme gir et treknakk, game over-skiltet knirker i tauene, og knappene klikker som tre. Hvert 10. poeng svarer en dempet meis, og ny rekord gir xylofonglid og meisesang. |
| E3 Kalimba som instrument | Melodien, poengtonene og de små arpeggioene spilles på kalimbaopptaket. Én tone spilles raskere eller langsommere for å gi alle tonehøyder. Nivået er kalibrert mot den gamle syntesen (+0,5 dB på poenglyden, +1 dB i menyen). |
| E4 Lengre musikk | Formen er A – A' – B – A'' på 32 takter (cirka 87 s mot 22 s før). B er et lavere mellomspill med egne akkorder (B♭maj7 – C – Am7 – Dm9 – Gm7 …). Annenhver runde endres bass og kalimba-glimt. |
| E5 Bro ved tid på døgnet | Når tiden på døgnet skifter, byttes resten av delen ut med en bro på to takter. Den faller mot kvelden og stiger mot morgenen, med xylofonglid. Deretter fortsetter formen. |
| E6 Offline og reserve | Opptakene hentes når siden lastes og hurtigbufres av service workeren (v4.1.0). Til sammen er de 273 kB, under rammen på 400 kB. Hver lyd har den syntetiske versjonen som reserve, så spillet høres likt ut som før hvis opptakene ikke kan lastes. |

**Før og etter:**

- [`revisjon-2/fase-e/lydbilde.jpg`](revisjon-2/fase-e/lydbilde.jpg): spektrogram av lyden fra spillet.
  Før er det rene sinustoner. Etter ses blåmeisens «si-si-sirrr» (4–8 kHz) og kalimbatonene over vinden.

**Verifisering:**

- 35 nye automatiske tester for fase E, blant annet:
  - filstørrelse, kilder og lisenser
  - at alle opptak dekodes og brukes der de skal
  - ingen blåmeis om natten
  - sløyfeskjøten i vinden
  - lydnivå mot `main`
  - reserve uten opptak
  - musikkens form, toneart og broer
  - offline fra hurtigbufferen
  - ingen klipping
- De eksisterende lydtestene består uendret.

**Det som fortsatt er syntetisk:** flaksingen, såpeboblen, poengklikkene, padden, bassen, sirissene
og ugla. Kalimbaopptaket er merket som allemannseie (Public Domain Mark) av opphavspersonen selv,
ikke med CC0; det står i kildelisten.

**Oppdaterte poeng:**

| Område | Etter fase D | Etter fase E |
|---|:-:|:-:|
| Lyd og musikk | 6,5 | **8** |
| **Menneskelig preg** | **8** | **8,5** |

Det som gjenstår fra planen etter fase E: fase F (en liten fortelling).

---

## 14. Status: fase F gjennomført (v4.2)

| Tiltak | Hva som ble gjort |
|---|---|
| F1 Reisen hjem | Hver runde er en reise fra fjellet ned til hytta, med ti navngitte steder: Fjellet, Bjørkelia, Elgmyra, Seterbua, Tjernet, Sauebeitet, Stavkirka, Fyrlykta, Postkassa og Hytta. Ved hvert sted står et veiskilt (en pilformet planke på en stolpe) i luka mellom to stammer, og navnet vises kort under poengene. «Klar?»-skjermen sier «Fra fjellet hjem til hytta», og pausen viser hvor på veien fuglen er. |
| F2 Landskapet følger reisen | Stedene har sine landemerker: elgen ved Elgmyra, setra ved Seterbua, et nytt tjern med siv ved Tjernet, sauen, stavkirka, fyret og postkassa. De tilfeldige landemerkene hører alltid til steder fuglen allerede har passert, så rekkefølgen i landskapet stemmer med fortellingen. |
| F3 Game over forteller | «Du kom forbi Tjernet» og «5 til Sauebeitet» står på treskiltet, med ruten brodert som sting, et merke per sted, hytta i enden og en liten blåmeis som flytter seg mens poengene telles. Ved død rett før hytta står det «Hytta var rett der framme!». |
| F4 Hjemkomst | Ved 60 poeng tar stammene slutt, og den falurøde hytta med torvtak, røyk fra pipa og et fuglebrett glir inn. Verden bremser jevnt til brettet står rett under fuglen. Fuglen lander med et lite klem, pikker i frøene (to raske hakk, så en pause) og hviler under «Hjemme!» så lenge spilleren vil. Et trykk sender den videre; stammene kommer tilbake, og poengene teller videre. Etter hytta sier game over «Du kom hjem til hytta!» og hvor langt den fløy videre. |

Hjemkomsten avslutter ikke runden. Det var et bevisst valg, så poengjakten er som før, og hytta blir en
belønning underveis. Med tiden på døgnet kommer man hjem om kvelden, med lys i vinduene. Lengden på
reisen (60 poeng) er valgt for at hjemkomsten skal være sjelden.

**Før og etter:**

- [`revisjon-2/fase-f/over.jpg`](revisjon-2/fase-f/over.jpg): game over forteller hvor langt du kom
- [`revisjon-2/fase-f/reise.jpg`](revisjon-2/fase-f/reise.jpg): «Klar?», et veiskilt på veien og pausen
- [`revisjon-2/fase-f/hjemme.jpg`](revisjon-2/fase-f/hjemme.jpg): landingen, hvilen på fuglebrettet og avreisen

**Verifisering:**

- 43 nye automatiske tester for fase F, blant annet:
  - rute og tekster
  - skilt som aldri står inni en stamme
  - landemerker i riktig rekkefølge
  - teksten på game over og i pausen
  - hjemkomst på Lett og i Zen: stammene slutter, presis landing, verden står stille, ingen død under hvilen, pause, avreise og poeng videre
  - død rett før hytta
  - ny runde nullstiller reisen
  - redusert bevegelse
- Tegnetiden er som før: −6 % med to veiskilt og +3 % med hytta på skjermen mot `main` (median av fem vekselvise runder). Skiltene og hytta er ferdige bilder.

**Oppdaterte poeng:**

| Område | Etter fase E | Etter fase F |
|---|:-:|:-:|
| Tekst og tone | 8 | **8,5** |
| Innhold og variasjon | 7,5 | **8,5** |
| **Menneskelig preg** | **8,5** | **9** |

Alle fasene i planen (A–G) er nå gjennomført.
