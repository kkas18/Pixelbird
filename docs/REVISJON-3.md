# Revisjon 3 av Pixelfugl (v4.4): helhet og særpreg

**Dato:** 9. oktober 2026
**Omfang:** Hele spillet etter revisjon 2 (fase A–G) og dyrene på stammene (v4.4)
**Metode:**

- Spilt i Chromium (412 × 915, DPR 2) og sett på skjermbilder av meny (dag og natt), «Klar?», spill,
  game over, pause, garderobe og hjemkomst.
- Gått gjennom koden for knapper, tekst, himmel, bark, bakke, forgrunn og treff.
- Tatt med brukerens egne skjermbilder fra telefon. Der var trestykke-knappene avklippet; det er rettet i v4.4.

Skjermbildene fra vurderingen ligger i [`revisjon-3/for/`](revisjon-3/for/).

---

## 1. Sammendrag

Spillet har fått et tydelig eget uttrykk: blåmeisen med lusekofte-skjerf, korssting-logoen,
bjørkestammene, rosemalingen, treskiltet, neveret, dyrene og reisen hjem. Det er ikke lenger
«typisk AI-spill».

Det som står igjen, ligger nesten helt i **grensesnittet**:

- **Knapper:** pillformede knapper i pastell, som «Lett / Normal / Hard / Zen», «Garderobe»,
  «Spill igjen», «Fortsett» og «Ferdig».
- **Tekst:** hvit tekst med tykk brun kontur, som klistremerker, for eksempel «Trykk for å flakse»,
  «Vanskelighet», stedsnavn og poengtallet.
- **Oppsett:** menyen er stablet og midtstilt som en mal.

Verden rundt knappene er håndlaget, så de bryter med resten. I tillegg finnes noen få
standardgrep i bildet:

- glorieringer rundt sola og månen
- en måne med smil og «z» over fuglen når den sover
- tynne «^»-streker på stammene som leses som tegn
- en bred jordstripe med like, ovale småstein
- uskarpe forgrunnsstrå som ser ut som flekker på telefonskjermen

**Spillfølelsen** er god i kontrollen, men har lite å vise i øyeblikkene som betyr noe:

- treffet skjer uten en kort pause som gir det tyngde
- å passere med millimeterklaring gir ingen belønning
- ballongen i menyen ligger oppå logoen

---

## 2. Poeng (v4.4)

Skala 1–10.

| Område | Poeng | Kort begrunnelse |
|---|:-:|---|
| **Design og brukergrensesnitt** | **7** | Verdens-UI-et (treskilt, never, knaggrekke, trestykker) er sterkt, men pillknapper og konturtekst er generiske og passer ikke til resten. Menyen er en midtstilt stabel. |
| **Grafikk** | **8** | Sterk identitet og godt håndverk i figurer, stammer og landskap. Himmel (glorier, smilemåne), bakke (jevn jord, like stein) og forgrunn trekker ned. |
| **Animasjoner** | **8** | Nøkkelbilder med pauser, vingeslag med løft, dyr med logisk oppførsel. Poengtallet spretter fortsatt med en standard cosinus-vibring. |
| **Spillfølelse** | **7,5** | Presis, rettferdig kontroll og tydelig gap. Treffet mangler tyngde (ingen kort stopp), og det er ingen belønning for å fly tett forbi. |
| **Samlet** | **7,6** | |

### Delpoeng

| Del | Poeng | Merknad |
|---|:-:|---|
| Typografi | 6 | Fredoka med tykk kontur overalt er det tydeligste AI- eller mal-trekket som er igjen. |
| Knapper og kontroller | 6 | Pastellpiller ved siden av trestykker og treskilt. To ulike designspråk på samme skjerm. |
| Oppsett (meny) | 6,5 | Midtstilt og symmetrisk, med tomt felt i midten. Ballongen ligger oppå «P» i logoen. |
| Verdens-UI | 8,5 | Treskilt i tau, bjørkenever, knaggrekke, broderte overskrifter. |
| Figurer (fugl, dyr) | 8,5 | Særpreget, med logisk oppførsel. |
| Himmel | 6,5 | Tre faste glorieringer rundt sola, en smilende måne og «z» for søvn er standardklisjeer. |
| Stammer | 7,5 | Barken er god, men greinarrene er tynne «^»-streker som ser ut som skrifttegn. |
| Bakke og forgrunn | 6,5 | Jevn jordstripe med like, ovale stein. Uskarpe strå som ser ut som flekker. |
| Kontroll | 8,5 | Fast impuls, 120 Hz-fysikk, rettferdig treffsone. |
| Treff og tilbakemelding | 6,5 | Fjær og barkstøv, men ingen kort pause som gir treffet vekt. |
| Belønning underveis | 7,5 | Steder, frø og blader, men ingenting for dristige passeringer. |

**AI-preg:** lavt i verden, middels i grensesnittet.

---

## 3. Funn med bevis

1. **Pillknapper.** `button()` tegner alle knapper som avrundede piller i pastell med flat skygge.
   Det er den vanligste formen i genererte mobilspill, og den står rett ved siden av trestykker og
   treskilt.
2. **Konturtekst.** `text(..., { stroke: true })` gir hvit tekst med tykk brun kontur. Det brukes
   til hint, undertitler, stedsnavn, power-up-navn og poengtallet, som står midt på skjermen hele tiden.
3. **Himmelen.** Solgløden er tre faste ringer (`[68, 50, 35]`). Månen har et lukket, smilende øye,
   og fuglen sender ut «z» i menyen om natten.
4. **Greinarr som tegn.** `paintTrunk` tegner arrene som en tynn strek med samme tykkelse: `moveTo`,
   opp, ned. Det leses som «^».
5. **Bakken.** `groundSeg` legger 3–7 like ovale stein med lys flekk og jevnt fordelte prikker på
   en flat jordfarge. Jordstripen er 92 px høy.
6. **Forgrunnen.** Mørkegrønne, sterkt uskarpe strå (`fore: blur 3.2`) ser ut som flekker på
   telefonen. Det viste brukerens skjermbilde.
7. **Ballongen** ligger på `safeTop + 58`, rett oppå logoen.
8. **Treffet:** fysikken fortsetter i samme bilde som kollisjonen skjer, uten en kort stopp.
9. **«Trykk»-hintet** på «Klar?» er en avrundet firkant som ser ut som en datamus, ikke et fingertrykk.

---

## 4. Plan: fase H, siste finpuss (v5.0)

| Tiltak | Hva |
|---|---|
| **H1 Materialer i stedet for piller** | Alle knapper blir treplanker med innbrent tekst. Hovedvalget er malt i tradisjonell rød linoljemaling. Vanskeligheten velges på en veiviser med fire pilplanker (samme stil som veiskiltene på reisen), og den valgte er malt. Garderoben blir et fjerde trestykke med lue-ikon. Pilene i garderoben blir små trestykker. «Ny pynt» og power-up-navn blir pappmerkelapper på hyssing. |
| **H2 Tekst og poeng** | Poengtallet broderes med samme korssting som logoen (nye glyfer 0–9). Hint og stedsnavn står på små papirlapper med blekk i stedet for konturtekst. |
| **H3 Himmel** | Sola får en myk, malt glød i stedet for ringer. Månen er en ekte sigd med skygger, uten ansikt. Ingen «z»: fuglen sover med hodet nede og rolig pust. |
| **H4 Bark** | Greinarrene tegnes som ekte bjørk: en mørk, avsmalnende kile («bart») med en kvist i toppen. |
| **H5 Bakke og forgrunn** | Jordlag med ujevne grenser, kantete stein i ulik størrelse samlet i grupper og delvis begravd, og røtter under gresskanten. Forgrunnen får tydeligere silhuetter, lysere toner og mindre uskarphet. |
| **H6 Spillfølelse** | Et kort stopp (70 ms) ved treff gir tyngde. En «tett forbi»-belønning når fuglen passerer nær en kant: et vindsus, fjær som følger fuglen, og et lite løft i lyden. Ingen tekst. |
| **H7 Småfeil** | Ballongen flyttes bort fra logoen. «Trykk»-hintet blir en strikket vott som trykker. |

### Forventet effekt

| Område | Nå | Etter fase H |
|---|:-:|:-:|
| Design og brukergrensesnitt | 7 | **8,5** |
| Grafikk | 8 | **8,5–9** |
| Animasjoner | 8 | **8,5** |
| Spillfølelse | 7,5 | **8,5** |
