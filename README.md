# Pixelfugl

Et moderne flakse-spill i glatt vektorstil (v2): parallakse-bakgrunn,
gradienter og myke skygger, partikler, skjermristing, dag/natt-tema,
syntetisert lyd og vibrasjon. Bygget som en installerbar PWA, optimalisert for Samsung Galaxy
(portrett) og andre Android-telefoner.

All grafikk og lyd er generert i koden – ingen bildefiler eller lydfiler
trengs utover ikonene.

## Filer

| Fil | Formål |
|-----|--------|
| `index.html` | Hele spillet (Canvas 2D, ingen avhengigheter) |
| `manifest.webmanifest` | PWA-manifest: navn, ikoner, portrett, standalone |
| `sw.js` | Service worker – spillet fungerer offline etter første besøk |
| `icons/` | App-ikoner (192, 512, maskable 512, Apple touch, favicon) + skjermbilde |
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
- Knappene på startskjermen slår **lyd** av/på og bytter **dag/natt**.
- Beste poengsum lagres lokalt på enheten.

Medaljer: 10 bronse, 20 sølv, 30 gull, 40 platina.

## Vanskelighetsgrader

Velges på startskjermen. Beste poengsum lagres per nivå.

| Nivå | Gap | Fart | Varianter fra poeng |
|------|-----|------|---------------------|
| Lett | 152 | 1.9 | 14 |
| Normal | 130 | 2.2 | 8 |
| Hard | 112 | 2.6 | 4 |

## Rør-varianter

- **Oransje hette** – røret beveger seg opp og ned.
- **Lilla hette** – smalere åpning (20 % mindre gap).

## Power-ups

Dukker opp i gapet fra 3 poeng. Fly gjennom for å plukke opp.

- **Skjold** (blå) – tåler ett treff, fuglen dyttes trygt gjennom gapet.
- **Sakte film** (lilla) – 6 sekunder med 55 % fart.
- **Dobbelt** (gul) – 8 sekunder med 2 poeng per rør.

Aktive effekter vises som striper under poengsummen.

## Oppdatere

Endre `VERSION` øverst i `sw.js` ved hver ny utgivelse, ellers kan installerte
apper fortsette å bruke den gamle, cachede versjonen.
