# Pixelfugl

Et arkadespill (v11): en liten blåmeis med rødt lusekofte-skjerf flyr hjem gjennom en blå labyrint, fra
fjellet ned til hytta. Den flyr som i et klassisk flakse-spill: ett trykk gir ett løft, og tyngden drar ned.
I åpningene i veggene ligger prikker den kan spise. Svart skjerm, doble blå labyrintvegger, pikselskrift og
chiptune, som på en gammel arkademaskin.
Bygget som en installerbar PWA, optimalisert for Samsung Galaxy (portrett) og andre Android-telefoner.

Alt tegnes og spilles i koden: figurene er pikselgrafikk fra rutenett, skriften er en egen 5 × 7-pikselskrift
med Æ, Ø og Å, og musikken og lydeffektene lages i Web Audio. Det er ingen bilder, fonter eller lydopptak å
laste, så første besøk er cirka 110 kB (v10.1 var 3,6 MB).

## Stil: arkade, men vår egen

Uttrykket er en hyllest til de gamle labyrintspillene fra arkadehallene, ikke en kopi av noen av dem. Figuren,
musikken og lydene er laget for Pixelfugl. Det er ingen gul rund figur med kilemunn, ingen spøkelser og ingen
kjente melodier eller lyder fra andre spill.

- **Blåmeisen** er en rund 8-bits figur sett fra siden:
  - blå hette, hvitt ansikt med svart øyestripe, gult bryst og rødt skjerf som blafrer bak
  - tre vingestillinger
  - nebbet åpner seg når den spiser
  - øynene kan blunke, smile og bli svimle
  Når den vipper, roteres den i kunstpiksler, så pikslene forblir firkantede og skarpe.
- **Veggene** er doble blå streker med pikselrunde ender mot åpningen, som veggene i en labyrint.
- **Bakgrunnen** er en svak, mørkeblå labyrint som glir sakte forbi. Gulvet har en korridor med prikker som
  glir i spillets fart.
- **Logoen** «PIXELFUGL» er tykke pikselbokstaver, gule over og oransje under, med blå kontur og dybde.
- **Alle menyer** har doble labyrintrammer, pikselskrift og pikselikoner. Ingen tekst er glattet.
- **Skarpe piksler:** hver kunstpiksel legges på hele skjermpiksler, så pikslene er like store og skarpe også
  når skjermen har en skjev skalering. Lerretet tegnes i full skjermoppløsning (opptil 3×).
- **Retro-skjerm** (valg i innstillingene, på som standard): svake skannlinjer og mørke hjørner.

Se [revisjon 7](docs/REVISJON-7.md) for bilder, før og etter, og hvorfor.

## Slik spiller du

- **Trykk** hvor som helst (eller mellomrom / pil opp) for å flakse. Fly gjennom åpningene i veggene.
- **Prikkene:** hver åpning har tre prikker. Spis alle tre, så gir veggen ett ekstra poeng. Prikkene på rad
  gir stigende toner, og en full rad gir en rask arpeggio og «+1».
- **Ting i åpningene** (fra 3 poeng):

  | Ting | Virkning |
  |---|---|
  | Kraftprikk (stor, blinkende) | skjold: tåler ett treff, fuglen blinker og glir inn i åpningen |
  | Snegle | sakte film i 6 sekunder |
  | Gyllen eikenøtt | dobbel poeng i 8 sekunder (også for en full prikkrad) |

- **Poengtavla:** poengene midt øverst, rekorden øverst til venstre (som på en arkademaskin) og pause øverst
  til høyre. Aktive ting vises med en stolpe for tiden som er igjen.
- **Pause:** knappen øverst til høyre, eller Esc / P. Spillet pauses også når appen legges i bakgrunnen.
  «Fortsett» gir en 3-2-1-nedtelling.
- **Vanskelighet:** Lett, Normal, Hard og Zen i nivåvalget i menyen. Rekorden lagres per nivå.
- **Lyd:** høyttaleren i menyen slår lydeffektene av og på. Tannhjulet åpner innstillingene: lydeffekter,
  musikk, retro-skjerm og garderoben.
- **Tastatur i menyer:** Tab velger knapp, Enter eller mellomrom trykker, Esc lukker et panel.

Medaljer på resultatskjermen: 10 bronse, 20 sølv, 30 gull og 40 platina.

## Reisen hjem

Hver runde er en reise fra fjellet ned til hytta. Når fuglen når et nytt sted, blinker navnet i et banner, og
et lite signal spilles. På gulvet står neste sted («MOT ELGMYRA») og reisen som en rad med prikker: de som er
passert er spist, og den lille blåmeisen står der den har kommet.

| Poeng | Sted |
|:-:|---|
| 0 | Fjellet |
| 5 | Bjørkelia |
| 10 | Elgmyra |
| 15 | Seterbua |
| 20 | Tjernet |
| 27 | Sauebeitet |
| 34 | Stavkirka |
| 42 | Fyrlykta |
| 50 | Postkassa |
| 60 | Hytta |

**Hjemkomst ved 60 poeng:**

1. Veggene tar slutt, og en rød pikselhytte med torvtak, lyse vinduer og røyk fra pipa glir inn.
2. Verden bremser til fuglebrettet står rett under fuglen.
3. Fuglen lander på brettet og pikker i frøene. «HJEMME!» står så lenge du vil.
4. Et trykk sender den videre, og poengene teller videre.

Resultatskjermen og pausen forteller hvor langt fuglen kom.

## Oppstart og intro

Oppstartsskjermen, siden og spillet er svarte fra første bilde. Introen tar 2,6 sekunder:

1. Labyrintrammen tegnes rundt skjermen, fra midten øverst.
2. Logoen kommer bokstav for bokstav, med ett blipp per bokstav.
3. Blåmeisen flyr inn langs en rad med prikker under logoen og spiser dem. Så glir den ned på plassen sin.
4. Menyen toner fram.

Et trykk eller en tast hopper over introen (og starter ikke spillet). Under introen er knappene skjult. Ved
redusert bevegelse toner menyen rolig fram på et halvt sekund. Lyden i introen spilles bare i den installerte
appen, der Chrome tillater lyd før første trykk.

## Musikk og lyd

Chiptune i Web Audio, som en gammel lydbrikke:

- to pulsbølger, med pulsbredde 12,5 %, 25 % eller 50 %, til melodi og akkorder
- en trekantbølge til bass
- støy til trommer

All musikk er skrevet for Pixelfugl.

- **Menyen:** en rolig sløyfe i G-dur, 100 BPM, med lange akkorder og bass på grunntone og kvint.
- **Spillet:** en lys sløyfe i D-dur, 144 BPM, del A to ganger og så del B. Brutte akkorder, oktavsprett i
  bassen, stortromme, skarptromme og hi-hat.
- **Sakte film** senker tempoet og demper diskanten.
- **Game over:** en kort melodi i moll. Etter en liten pause tar menysløyfa over.

**Lydeffekter:**

| Hendelse | Lyd |
|---|---|
| flaks | et kort «bwipp» som glir opp |
| prikk | et lite pip, stigende for hver prikk på rad |
| full rad | en rask arpeggio |
| poeng | to toner som stiger med poengene på rad |
| nytt sted | et lite signal |
| hvert 10. poeng | en fanfare |
| ny rekord og hjemkomst | en seiersmelodi |
| ting | en stige opp i trinn |
| skjoldtreff | et smell |
| tett forbi | et lyst sus |
| treff | smell og fall |
| tellingen på resultatskjermen | blipp |
| fyrverkeri | små smell |

En begrenser til slutt hindrer klipping.

## Vanskelighetsgrader

| Nivå | Åpning (px) | Fart (px/s) | Maks sprang mellom åpninger (px) | Varianter fra poeng |
|------|----------|-------------|-----------------------------|---------------------|
| Lett | 152 | 118 | 150 | 14 |
| Normal | 130 | 136 | 135 | 8 |
| Hard | 112 | 160 | 120 | 4 |
| Zen | 165 | 108 | 140 | – |

- **Varianter:** vegger som beveger seg opp og ned, og smalere åpninger (20 % mindre).
- **Zen:** fuglen kan ikke dø. Treffer den en vegg, spretter den mykt inn i åpningen. Treffer den gulvet,
  spretter den opp igjen. Gå ut via pause og «Meny».
- **Åpningene:** de krymper litt med poengsummen, men aldri under 92 px. De ligger i en fast sone på
  400 px over gulvet, så vanskeligheten er lik på alle skjermhøyder.

## Garderobe

Poeng fra alle vanlige runder samles og låser opp pynt. Pynten er tegnet i piksler på figuren.

| Pynt | Krav |
|------|------|
| Bare skjerf | – |
| Sløyfe | 10 poeng totalt |
| Strikkelue | 25 poeng totalt |
| Fluesopphatt | 45 poeng totalt |
| Blomst | 60 poeng totalt |
| Solbriller | 80 poeng totalt |
| Blomsterkrans | 100 poeng totalt |
| Briller | 120 poeng totalt |
| Vikinghjelm | 150 poeng totalt |
| Nisselue | 200 poeng totalt |
| Flosshatt | 300 poeng totalt |
| Krone | gull (30 poeng) i én runde |

Garderoben har to sider med seks ting på hver. Ny pynt vises på resultatskjermen.

Spillet bruker ingen emojier eller symboltegn: all tekst er bokstaver, tall og tegnsetting i pikselskriften,
og ikoner er tegnet som pikselfigurer.

## Fysikk

Tidsbasert modell med fast steg på 120 Hz (uavhengig av skjermens oppdateringsfrekvens). Tegningen
interpoleres mellom to fysikk-steg, så bevegelsen er jevn på 60, 90 og 120 Hz-skjermer.

- Tyngdekraft og flaks i px/s², luftmotstand og terminalfart (560 px/s).
- Fast flaks-impuls: hvert trykk gir nøyaktig samme løft, uansett rytme.
- Rotasjon som en fjær mot målvinkelen, med demping. Tegningen rundes til trinn på 7,5 grader.
- Kollisjon mellom en sirkel og avrundede rektangler (veggene har runde ender). Veggen er tegnet like bred
  som treffsonen.
- Ved krasj står alt stille et øyeblikk (treffpause). Så spretter fuglen av veggen, tumler og spretter én
  gang i gulvet. Skjermen rister bort fra treffet (av ved redusert bevegelse).

## Ytelse

- Figurer, tekst, rammer, logoen og bakgrunnslabyrinten tegnes én gang per størrelse og legges på hele
  skjermpiksler hvert bilde. Bildene som ikke er brukt på lengst, kastes først, så bakgrunnen aldri lages på
  nytt midt i spillet.
- I testen (Chromium uten skjermkort) bruker meny og spill 62–67 % kortere tegnetid enn v10.1.
- 20 sekunder spill i sanntid gir ingen stopp over 50 ms (v10.1: 46).

## Filer

| Fil | Formål |
|-----|--------|
| `index.html` | Siden: lerret, stil og innlasting av skriptene |
| `js/config.js` | Konstanter, lagring, vanskelighetsgrader, ting i åpningene, garderobe og retro-skjerm |
| `js/pixel.js` | Pikselgrunnlaget: arkadepaletten, pikselskriften, sprites fra rutenett og doble labyrintrammer |
| `js/sound.js` | Chiptune: musikk og lydeffekter i Web Audio |
| `js/game.js` | Spilltilstand, input, fysikk, prikker, reisen hjem, introen og oppdatering |
| `js/render.js` | Tegning: labyrinten, veggene, prikkene, blåmeisen, hytta, logoen, introen og retro-skjermen |
| `js/ui.js` | Meny, «KLAR!», poengtavla, pause, innstillinger, garderobe, resultat og de tilgjengelige knappene |
| `js/main.js` | Oppstart: skjermstørrelse, spill-løkke og PWA |
| `manifest.webmanifest` | PWA-manifest: navn, ikoner, portrett, standalone |
| `sw.js` | Service worker: spillet fungerer uten nett etter første besøk |
| `icons/` | App-ikoner (192, 512, maskerbar 512, Apple touch, favicon) og skjermbilde |
| `make_icons.py` | Lager ikonene fra figuren i `js/render.js` (valgfritt, krever Pillow) |
| `tests/ui-smoke.cjs` | Røyktest i Chromium: menyer, knapper, lagring, fysikk, pause, fem skjermstørrelser og uten nett |
| `docs/` | Revisjonene (1–7) med funn, poeng og bilder |
| `.nojekyll` | Sørger for at GitHub Pages serverer alle filer som de er |

## Tilgjengelighet

- Hver knapp på lerretet har en HTML-knapp med samme plass og et norsk navn, så menyene kan brukes med
  tastatur og skjermleser. Valgt nivå og valgene i innstillingene har `aria-pressed`.
- Synlig tastaturfokus (gul ramme).
- «Redusert bevegelse» i systemet: ingen risting, introen toner bare fram, og ting blinker ikke.

## Publisering på GitHub Pages

1. Opprett et nytt repo, for eksempel `pixelfugl`.
2. Last opp alle filene (inkludert mappen `icons/` og `.nojekyll`) til rot-nivået i repoet.
3. Gå til **Settings → Pages**. Under *Build and deployment* velger du **Deploy from a branch**, branch
   `main`, mappe `/ (root)`. Lagre.
4. Etter ett–to minutter er spillet live på `https://<brukernavn>.github.io/pixelfugl/`.

Alle stier i manifest og service worker er relative (`./`), så det fungerer også i en undermappe.

## Installere på Samsung / Android

1. Åpne adressen i **Chrome** eller **Samsung Internet**.
2. Trykk **Installer Pixelfugl**-knappen nederst i menyen, eller velg *Legg til på startskjermen* /
   *Installer app* i nettlesermenyen.
3. Appen åpnes uten nettleserlinjer, låst til portrett, med svart statuslinje.

Hadde du installert en eldre versjon, kan telefonen en stund vise det gamle ikonet og den lyse
oppstartsskjermen. Ikonene har nye filnavn, så Chrome oppdager endringen selv. Det går raskest å fjerne appen
fra startskjermen og installere den på nytt.

## Testene

```
npm install --no-save playwright && npx playwright install chromium
node tests/ui-smoke.cjs
```

## Oppdatere

Endre `VERSION` øverst i `sw.js` ved hver ny utgivelse, ellers kan installerte apper fortsette å bruke den
gamle, hurtigbufrede versjonen.
