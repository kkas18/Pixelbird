# Illustrasjoner til Pixelfugl

De tre illustrasjonene er laget med OpenAI imagegen fra brukerens godkjente
triptyk-referanse. Dette er spillassets uten tekst, knapper eller innbakt fugl.
Originalbildene ble kodet til WebP med Pillow for lokal levering og offline-cache.

| Fil | Innhold | Format |
|---|---|---|
| forest-night.webp | Malt norsk høstlandskap: indigo nattehimmel, løvgren, fjell, innsjø, hytte og bjørketrær | 887 × 1774, RGB |
| forest-day.webp | Dagvariant av samme komposisjon, blå himmel og sollys | 887 × 1774, RGB |
| birch.webp | Hvit bjørkestamme med barkmerker, sopper, årringer og mosekant | 1024 × 1536, RGBA |

Bildene er generert for dette prosjektet, ikke hentet fra en tredjeparts bildebank.
Stilretningen i genereringen var en detaljert malt norsk eventyrbok, varme
oransje høsttrær, kjølige fiolette fjell og håndmalt papirtekstur. Referansen
styrte fargene, komposisjonen og detaljnivået. Dagvarianten ble laget som en
redigering av nattlandskapet for å bevare samme landskap.

`js/art.js` deler landskapet ved 86 % av høyden slik at gresskanten følger
spillets fysiske bakke. Barkens midtfelt og den nederste snittflaten tegnes
hver for seg, slik at mose og årringer ikke strekkes med stammelengden.
Måne/sol, fallende løv, poeng, menyer og fugl kommer fra spillkoden.

Fraunces-fonten er fra Google Fonts: https://github.com/google/fonts/tree/main/ofl/fraunces
Den lokale instansen har vekt 650, optisk størrelse 72, SOFT 70 og WONK 1,
og er begrenset til latinske tegn U+0020–U+017E. SIL OFL-lisensen følger med i
`fonts/FRAUNCES-OFL.txt`.
