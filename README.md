# Pixelfugl

Et koselig flakse-spill (v4.2): en liten blåmeis med lusekofte-skjerf flyr
hjem gjennom en norsk bjørkeskog, fra fjellet ned til hytta. Varm pastellstil med myke konturer, fjell og fjord,
røde hytter med torvtak og pipe-røyk, luftballong, ildfluer om kvelden og en
søvnig måne. Dag/natt-tema, musikk på kalimba, ekte naturopptak (blåmeis og
vind i bjørk) og vibrasjon.
Bygget som en installerbar PWA, optimalisert for Samsung Galaxy (portrett) og
andre Android-telefoner.

All grafikk er generert i koden – ingen bildefiler trengs utover ikonene. Lyden
er en blanding av syntese og noen få fritt lisensierte opptak (`audio/`, 273 kB
i alt). Fonten (Fredoka) og opptakene ligger lokalt, så spillet ser og høres
likt ut også uten nett.

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
- **Overskriftene** («Klar?», «Pause», «Garderobe», «Ny rekord!», «Å nei!» og de andre) er
  brodert i den samme håndlagde skriften som logoen.
- **Panelene er ting i verden:**
  - Game over er et treskilt av furuplanker med spikre og malt rosemaling. Det henger i to tau
    og svinger litt når det faller på plass.
  - Garderoben er en knaggrekke der pynten henger på lapper med sydd kant.
  - Pausemenyen ligger på et stykke bjørkenever.
- **Ikonknapper:** lyd, musikk og dag/natt er runde trestykker (som snittflaten på stammene) med
  tegnede ikoner, plassert nede til venstre. Pauseknappen er av samme slag.
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
| `js/sound.js` | Musikk, lydeffekter og naturlyder (Web Audio: opptak med syntese som reserve) |
| `js/game.js` | Spilltilstand, input, fysikk, tid på døgnet og oppdatering |
| `js/render.js` | Tegning: forhåndstegnede lag, stammer, fugl, partikler og brukergrensesnitt |
| `js/main.js` | Oppstart: skjermstørrelse, spill-løkke og PWA |
| `manifest.webmanifest` | PWA-manifest: navn, ikoner, portrett, standalone |
| `sw.js` | Service worker – spillet fungerer offline etter første besøk |
| `icons/` | App-ikoner (192, 512, maskable 512, Apple touch, favicon) + skjermbilde |
| `fonts/` | Fredoka (woff2, variabel vekt) + lisens (SIL OFL 1.1) |
| `audio/` | Lydopptak (mp3): blåmeis, vind, tre, kalimba og xylofon. Kilder og lisenser i `audio/KILDER.md` |
| `docs/REVISJON.md` | Første revisjon: funn og plan (fase 1–4, gjennomført) |
| `docs/REVISJON-2.md` | Andre revisjon: poeng og tiltak mot «AI-stil» (fase A–G) |
| `.nojekyll` | Sørger for at GitHub Pages serverer alle filer som de er |
| `make_icons.py` | Regenererer ikonene (blåmeisen foran en bjørkestamme; valgfritt, krever Pillow) |
| `make_audio.py` | Bygger `audio/` fra originalopptakene: klipper, renser og koder (valgfritt, krever ffmpeg og numpy) |

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
- **Hjemme:** når fuglen har landet på fuglebrettet ved hytta, hviler den til du trykker. Da flyr den videre.
- Etter game over: **Spill igjen** eller **Meny** (for å bytte nivå, lyd eller tema).
- De tre runde trestykkene nede til venstre på startskjermen slår **lydeffekter** (høyttaler) og
  **musikk** (note) av/på og velger om runden starter på **dag** (sol) eller **natt** (måne).
  Av vises med en skrå strek over ikonet.
- **Garderobe** på startskjermen: velg pynt til fuglen (se under).
- Beste poengsum og samlede poeng lagres lokalt på enheten.

Medaljer (broderte merker med selburose): 10 bronse, 20 sølv, 30 gull, 40 platina.

## Reisen hjem

Hver runde er en reise fra fjellet ned til hytta. Underveis passerer fuglen ti steder:

| Poeng | Sted | I landskapet |
|:-:|---|---|
| 0 | Fjellet | start |
| 5 | Bjørkelia | |
| 10 | Elgmyra | elgen i skogkanten |
| 15 | Seterbua | setra med kuene |
| 20 | Tjernet | et lite tjern med siv |
| 27 | Sauebeitet | sauen som beiter |
| 34 | Stavkirka | stavkirka i lia |
| 42 | Fyrlykta | fyret ute i fjorden |
| 50 | Postkassa | postkassa ved stien |
| 60 | Hytta | hjemme |

- **Ved hvert sted** står et veiskilt mellom stammene, og navnet vises kort under poengene. Der stedet
  har et landemerke, dukker det opp. De tilfeldige landemerkene hører alltid til steder fuglen allerede
  har passert, så rekkefølgen stemmer.
- **Hjemkomst ved 60 poeng:** stammene tar slutt, hytta med fuglebrettet glir inn, og verden bremser
  jevnt til brettet står rett under fuglen. Fuglen lander, pikker i frøene og hviler så lenge du vil.
  Et trykk sender den videre; stammene kommer tilbake, og poengene teller videre.
- **Game over forteller hvor langt du kom:** «Du kom forbi Tjernet» og «5 til Sauebeitet», med ruten
  brodert på skiltet og en liten blåmeis der reisen sluttet. Etter hytta står det «Du kom hjem til
  hytta!» og hvor langt fuglen fløy videre.
- **Pause** viser også hvor på veien hjem fuglen er.

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

## Dybde

Spillet er fortsatt tegnet i lag, men har de signalene øyet bruker for å se dybde i et kamerabilde:

- **Dybdeskarphet:** fuglen, stammene og bakken er skarpe. Bakgrunnen blir gradvis uskarpere
  jo lenger unna den er (fjell mest, så åser, skog og busker), og skyer og landemerker følger
  avstanden sin.
- **Luftperspektiv:** mer dis jo lenger unna.
- **Forgrunn:** noen få uskarpe gresstuster, bregner og blader nederst, helt nær kameraet.
  De glir forbi raskere enn alt annet og dekker aldri fuglen eller stammene.
- **Kameraet følger fuglen litt i høyden** (maks 8 px), og lagene forskyves etter avstand.
- **Fokustrekk:** i menyen ligger fokus på landskapet, som da er skarpt. Når runden starter,
  glir fokus over til fuglen.
- **Partikler og skygge:** noen få partikler ligger helt nær kameraet (store, myke og raske),
  og fuglen har en skygge på bakken som blir mindre og svakere jo høyere den flyr.

Uskarpheten lages én gang når scenen tegnes, i lav oppløsning, så den koster nesten ingenting
per bilde og bruker lite minne. Nettlesere uten innebygd uskarphet på lerretet får den laget i
JavaScript. Med «redusert bevegelse» står kameraet stille, og fokus skifter uten glidning.

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
- Ved krasj: fuglen klemmes flat, mister noen fjær, spretter og blir sittende oppreist og
  svimmel (spiraløyne).

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

Musikken spilles i Web Audio og er i F-dur, 88 BPM, med lett swing. Melodien spilles på et
ekte kalimbaopptak: én tone som spilles raskere eller langsommere for å gi alle tonehøyder. Under
ligger en myk pad (Fmaj7 – Dm7 – B♭maj7 – Csus4 …) og etterklang.

- **Form:** A – A' – B – A'', i alt 32 takter (cirka 87 s) før den gjentas. B-delen er et lavere
  mellomspill med lengre toner. Annenhver runde endres basslinjen og kalimba-glimtene litt.
- **Bro:** når tiden på døgnet skifter midt i en runde, spilles en kort bro på to takter: fallende mot
  kvelden, stigende mot morgenen, med et glid over en leketøys-xylofon.
- **Meny og spill:** på menyen spilles en enklere, varmere versjon. I spill kommer rund bass,
  kalimba-glimt, en myk shaker og et rolig «hjerteslag» inn i stedet for trommer.
- **Kveld:** om kvelden spilles en vuggevise-variant uten rytme, en oktav lavere.
- Sakte film demper lyden. Musikken starter ved første trykk (nettlesere krever brukerhandling).

**Lydeffekter:**

- mykt «fwip» når fuglen flakser
- kalimbatone som stiger i skala for hvert poeng på rad
- kalimba-arpeggio og en dempet blåmeis hvert 10. poeng
- glid over en leketøys-xylofon og meisesang ved ny rekord
- «plopp» når såpeboblen sprekker
- treknakk når fuglen treffer en stamme, og et mykt dunk i bakken
- knirk i tauene når game over-skiltet svinger
- et lite treklikk på knappene
- en liten «å nei»-melodi i dur på game over
- små klikk når poengene telles opp

**Naturlyder:** vind i bjørk (en sømløs sløyfe på 14 s) og blåmeis som synger fra ulike steder i
skogen om dagen. Om kvelden er det svakere vind, sirisser og en ugle innimellom. «Musikk av» slår
av både musikk og naturlyder.

**Opptak og reserve:** opptakene (`audio/`, 273 kB) er CC0 eller merket som allemannseie; se
[`audio/KILDER.md`](audio/KILDER.md). De hentes når siden lastes, dekodes ved første trykk, og
service workeren hurtigbufrer dem for bruk uten nett. Til de er klare, eller om de ikke kan
lastes, spilles den syntetiske versjonen av hver lyd.

Felles romklang og en begrenser (kompressor) på slutten hindrer klipping når
mange lyder overlapper.

## Animasjoner

Bevegelsene har pauser og intensjon i stedet for jevn vugging. De bygger på nøkkelbilder med
pauser, myk start og stopp, overskyting og forberedelse.

- **Fuglen i hvile** svever med små vingeslag. Hvert slag gir et lite løft, og den synker litt
  imellom, i uregelmessig takt. Innimellom gjør den én liten handling:
  - ser til siden og holder blikket
  - pirker i fjærene med lukkede øyne
  - blunker to ganger
  - rister seg (med forberedelse)
  - ser opp når ballongen eller fugleflokken passerer over den

  Om natten sover den og flakser rolig.
- **Vingeslaget** går raskt ned og saktere opp igjen, med en liten overskyting.
- **Bakgrunnen:**
  - Skyene driver jevnt.
  - Ballongen stiger og synker i rolige trinn med pauser.
  - Fugleflokken flakser i støt og glir imellom.
  - Bare noen få stjerner blinker om gangen, og ildfluene blinker i små serier med mørke pauser.
- **Brukergrensesnittet:**
  - Logoen faller på plass når menyen åpnes og står så stille.
  - Egget på game over rister i korte støt.
  - Hånden på «Klar?» trykker.
  - Power-ups står i ro og slår som et hjerte.
- Overgang mellom skjermer: en sirkel som åpner seg rundt fuglen.
- Knapper klemmes litt når du trykker.
- Poengtallet spretter som en fjær; game over-panelet og tittelen spretter inn,
  og medaljen (eller egget) snurrer inn når poengene er talt opp.
- Ny rekord: «Ny rekord!» og en liten flokk meiser som letter, med blader som virvler opp etter dem.
- Poeng gir bjørkefrø og et blad som virvler; et krasj gir fjær og barkstøv. Det er ingen
  stjerner, hjerter eller utropsord som «Bonk!»; lyden og bevegelsen sier det.
- Alt respekterer «redusert bevegelse» i systemet.

## Oppdatere

Endre `VERSION` øverst i `sw.js` ved hver ny utgivelse, ellers kan installerte
apper fortsette å bruke den gamle, cachede versjonen.
