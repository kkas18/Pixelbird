# Illustrasjoner til Pixelfugl

Illustrasjonene er laget med OpenAI imagegen fra brukerens godkjente
triptyk-referanse. Dette er spillassets uten tekst, knapper eller innbakt fugl.
Originalbildene ble kodet til WebP med Pillow for lokal levering og offline-cache.

| Fil | Innhold | Format |
|---|---|---|
| forest-night.webp | Malt norsk høstlandskap: indigo nattehimmel, løvgren, fjell, innsjø, hytte og bjørketrær | 887 × 1774, RGB |
| forest-day.webp | Dagvariant av samme komposisjon, blå himmel og sollys | 887 × 1774, RGB |
| foreground-depth.webp | Transparent nærforgrunn med avrundede steiner, mose, høstløv og bær; imagegen, kodet til WebP | 2172 × 724, RGBA |
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

## Forgrunnslag til v8

Lagret som `art/foreground-depth.webp`, generert med den innebygde imagegen-
funksjonen. `forest-night.webp` var stilreferanse; originalen ble beholdt.
Den genererte alfakanalen er bevart. Endelig prompt:

> Use case: stylized-concept. Asset type: wide transparent foreground sprite for a Norwegian 2.5D side scrolling game. Reference image is only a style/palette/material reference. Generate a brand-new single panoramic strip, 3:1 landscape format, of close-up low mossy rocks, warm orange birch leaves, small forest ferns and deep red berries at the very bottom of the image. Authentic actual transparent background above and between the plants, no sky, no landscape, no soil rectangle, no backdrop. Plants and rocks occupy only bottom 35% height; upper 65% entirely empty transparent. Detailed painterly forms from the reference but more three dimensional rounded rocks, layered leaves and sculpted moss, cool indigo shadows and warm cream rim lighting from upper right. Clusters should be low and broad, not tall branches, suitable along bottom screen edge without obstructing the game. Gentle visual density, no giant flowers or mushrooms, no text, character, buttons or UI. Keep complete subjects with padding at left and right so isolated clusters can be cropped or overlapped as independent parallax props.
