# Illustrasjoner til Pixelfugl

Illustrasjonene er laget med OpenAI imagegen fra brukerens godkjente
triptyk-referanse. Dette er spillassets uten tekst, knapper eller innbakt fugl.
Originalbildene ble kodet til WebP med Pillow for lokal levering og offline-cache.

| Fil | Innhold | Format |
|---|---|---|
| forest-night.webp | Malt norsk høstlandskap: indigo nattehimmel, løvgren, fjell, innsjø, hytte og bjørketrær | 887 × 1774, RGB |
| forest-day.webp | Dagvariant av samme komposisjon, blå himmel og sollys | 887 × 1774, RGB |
| panorama-night.webp | Bredt nattlandskap for kontinuerlig fremdrift | 2172 × 724, RGB |
| panorama-day.webp | Dagvariant med samme komposisjon | 2172 × 724, RGB |
| woodland-scroll.webp | Separat skogslag med transparent himmel | 2172 × 724, RGBA |
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

## Kontinuerlig landskap til v9

Laget med innebygd imagegen, lagret i `art/panorama-night.webp`,
`art/panorama-day.webp` og `art/woodland-scroll.webp`. RGB/alfakanal er bevart
ved WebP-koding. Menymaleriene ble ikke erstattet. Skogslagets nattlys tegnes
av Canvas over en nøytral original. Alle spillets tekster og figurer tegnes separat.

Endelig nattprompt (`forest-night.webp` var stilreferanse):

> Use case: stylized-concept. Asset type: horizontally scrolling Norwegian autumn game panorama, wide 3:1 aspect ratio. The attached portrait is a style/palette/detail reference, not an image to squeeze into landscape. Create a NEW expansive continuous landscape 3 times as wide as tall. Keep the deep indigo starry night and finely painted storybook texture, sculpted autumn foliage, violet Norwegian mountain ranges, dark pines and golden birch forests, reflective lake and one modest warmly lit red cabin near the middle-right. IMPORTANT layout: upper 40% is clean indigo sky with sparse tiny stars and a few soft violet clouds; snowy mountain peaks begin at 43% height and mountains extend to 65%; distant tree line begins at 64%; rolling birch groves, lake, varied small coves and low forest hills fill 65% to 86%; a continuous level mossy grass edge lies EXACTLY at 86% height all across the image, and brown soil with small stones fills the bottom 14%. The scene must feel horizontally expansive with different terrain along its width. Left and right edges must have matching continuous mountain heights, water level and green terrain colours, suitable for horizontal game tiling; no prominent object or cabin at either edge. No framing trees or overhead branches, no giant close foreground objects, no moon or sun (drawn separately in game), no characters, text, score, buttons or UI. Retain the approved image's quality and colours, make rounded moss, tree canopies and rock faces read with soft dimensional light and indigo shadows. Do not use symmetry or mirrored repeated scenery.

Endelig dagprompt (redigering av nattpanoramaet):

> Use case: lighting-weather. Edit target: this exact wide Norwegian game panorama. Produce its DAYLIGHT variant. Preserve precisely the 3:1 composition, all mountain contours, lake coves, birch groves, cabin, rocks, level grass edge at 86% and soil strip. Change only light/weather: clear soft blue day sky with a few warm white clouds, no stars, gentle warm late autumn sunlight from upper right, distant mountains in cool blue violet, luminous gold foliage and sunlit lake reflections. Cabin windows unlit in daylight. Keep the original's detailed dimensional painterly storybook texture, not flat vector graphics. No sun disc, moon, characters, text or UI. Maintain the same matching side edges for horizontal tiling.

Endelig skogprompt (`panorama-day.webp` var stilreferanse):

> Use case: stylized-concept. Asset type: separate midground parallax strip for this Norwegian 2.5D autumn game, wide 3:1 landscape. Reference is the style/palette/material reference only. Generate one continuous low rolling forest ridge with mossy rocks, green ground, small golden orange birch groves and occasional dark pine trees. NO lake, cabin, mountains, sky, moon, backdrop, text or UI; all space above the tree/hill contours genuinely transparent. Very important coordinates: ridge hills mostly occupy 70%-86% of full image height, scattered slender birch treetops reach 57%-65%, nothing at all above 53% (fully transparent upper half). The ground's LEVEL grass edge is exactly at 86% height across full width, and textured brown soil fills bottom 14%. Keep low foliage, varying open areas between tree groups so distant landscape remains visible. Continuous matching left/right terrain edges for horizontal tiling, no symmetry and no giant foreground framing trees. Same detailed sculpted painterly 3D storybook material style as reference, gentle neutral warm daylight from upper right with cool soft shadows, golden leaves and white birch bark. The exact supplied day image will remain visible BEHIND this independent moving strip, so generate only a foreground ridge, no distant scenery.
