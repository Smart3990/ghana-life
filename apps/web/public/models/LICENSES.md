# 3D models: sources and licences

| File | What it is | Source | Licence | Notes |
|---|---|---|---|---|
| `person.glb` | The 3D person: male body, short hair, T-shirt, trousers and trainers, with 26 everyday animations (no weapon moves) | Quaternius, "Universal Base Characters [Standard]" (male body, Buzzed hair), "Universal Animation Library [Standard]" and "Universal Animation Library 2 [Standard]" (animations), https://quaternius.com | CC0 1.0 (public domain); credit is not required but given here | Clothes painted on and reshaped, weapon animations removed, shrunk to about 550 KB. Built by `scripts/person` (see its README). Skin tone and clothes colours are set in code. |
| `person-female.glb` | The 3D woman: female body, "Buns" hair, T-shirt, a flared midi skirt and shoes, with the same 26 animations | Same Quaternius packs (female body, Buns hair) | CC0 1.0 (public domain) | Same build; the skirt is a shape we add in the build. About 580 KB. |
| `person-mass.glb`, `person-female-mass.glb` | Very light versions for big crowds (about 900 and 1,300 triangles; 19 street moves: walk, jog, talk, phone, eat, sell, carry, call out, sit, dance, serve, push and more) | Made from the two files above | CC0 1.0 | `scripts/person/make-crowd.mjs ... mass` |
| `person-lite.glb`, `person-female-lite.glb` | The player on Light phones (about 6,000 and 8,600 triangles, every move) | Made from the two files above | CC0 1.0 | `scripts/person/make-crowd.mjs ... lite` |

| `posed/posed-male.glb`, `posed/posed-female.glb` | The still crowd: men and women standing, hands on hips, waving, looking up, covering their eyes, picking something up, sitting and sitting cheering (8 poses each, about 1,100 to 1,260 triangles, 40 and 49 KB) | Quaternius, "Posed Background Characters" (poses and hairstyles), https://quaternius.com (sent by the owner, 28 Oct 2026) | CC0 1.0 (public domain); credit given: "Background characters by Quaternius" | Built by `scripts/person/build-posed.mjs`: scaled to real heights, a pack hairstyle fitted to each head (turned with the head), a face added (eye whites, irises, brows, mouth), parts marked so the game colours each person (Ghanaian skin tones, Accra clothes). The women's bodies at about 60% of their triangles. |

The okada (`src/test/streetTest.ts`) the street traffic (cars, taxis, trotros and pragyas in `src/game/vehicles3d.ts`), the street props (trees, palms, street lights, kiosks, umbrellas, polytanks, head-load basins and trays in `src/game/streetLife.ts`), and the planes and helicopters (`src/game/sky3d.ts`) are built in code from simple shapes. They are our own and need no licence.

Removed: `player.glb` (a Mixamo test figure, the three.js "Xbot"), replaced by `person.glb` on 2026-10-24.

The plastic chairs and football (`src/game/streetScenes.ts`) are built in code. All street sounds and the highlife groove (`src/game/streetSound.ts`) are made in code; there are no sound files.

## Vehicles (public/models/vehicles)

- **Free Low Poly Vehicles Pack** by Raphael Gonçalves (Rgsdev), from https://opengameart.org/content/free-low-poly-vehicles-pack. Licence: **CC0** (public domain; credited here anyway).
  - Used: SUV only.
- **Our own models** (made in code by `scripts/vehicles/build_ghana.py`, no outside source): `saloon.glb` (Corolla-type saloon, cars and Accra taxis), `trotro.glb` (Hiace-type trotro with roof rack), `sprinter.glb` (Sprinter-type trotro), `citybus.glb` (Metro-type city bus), `smallcar.glb` (Picanto / Vitz-type small car), `pickup4x4.glb` (Hilux-type double cab) and `cargotruck.glb` (Tata-type truck with a wooden body and tarpaulin load), shaped after photos of real vehicles at Circle, with no badges or brand names.
  - Changes: resized to the real size of the cars they stand for, split into a paint part and a fixed part with colours baked in, and compressed, by `scripts/vehicles/build_modern.py` and `scripts/vehicles/optimise-vehicles.mjs`. The Accra taxi's yellow corners are drawn by the game.
- Pragya tricycles and okadas are still built in code (`src/game/vehicles3d.ts`).

## Opening film pictures (public/film)

- `village.webp`, `hands.webp`, `bus.webp`, `circle.webp`: made for Ghanaverse on 2026-10-25 with the owner's ImagineArt account (model Seedream v5 lite), from our own written descriptions. All people are invented (not real people), with no logos or brand names.
- Before launch, check that the ImagineArt plan used allows commercial use of these pictures (some free plans do not); if not, make them again on a plan that does.

## Opening film clip (public/film)

- `opening-480.mp4`, `opening-480.webm`, `opening-360.mp4`, `opening-360.webm` (a lighter copy for slow networks), `opening-poster.jpg`: the owner's 23-second opening film (Grandma's goodbye in the village, the ₵50 and the letter, the lorry park and the trotro to Accra), made by the owner with ImagineArt and sent on 2026-10-28, with its own sound. Shrunk for phones (about 1.3 MB each format). All people invented; the "SIKA Mobile Money" on the trotro is a made-up name. Same commercial-use check as the pictures above before launch.
- Removed on 2026-10-28: `journey-480.*` and `journey-poster.jpg` (the earlier 10-second clip), replaced by the opening film above.

## Billboard advert photos (public/ads/)

wallet.webp, kelewele.webp, radio.webp, water.webp: made for Ghanaverse with ImagineArt (Seedream v5 lite) on 2026-10-25, from our own prompts (fictional people, no text or logos). Resized to 768 x 432 WebP. Before launch, check that ImagineArt's plan allows commercial use of these images. The brands on the adverts (Sika Mobile Money, Ghanaverse FM, Cool Sachet Water, Adinkra Bank and so on) are the game's own, fictional.

## Film music (public/music/)

- `arrival.mp3`: our own highlife tune (palm-wine guitars, bass, bell, shaker and drums), made entirely in code by `apps/web/scripts/music/highlife.mjs` (no samples, no recordings). Ours to use.
- A commercial song may replace it only with the artist's and label's written permission for use in the game (recorded here when we have it).

## Street sounds (public/sounds/accra/)

- `street-a.m4a`, `street-b.m4a` (traffic, horns, people talking) and `mates-a.m4a`, `mates-b.m4a` (trotro mates calling passengers): recorded in Accra by the Ghanaverse owner on 26-27 Oct 2026, the owner's own recordings. Used exactly as recorded (only moved from the phone's .mp4 container into .m4a, the sound itself not re-encoded). `sounds.json` marks the moments someone calls out (found by loudness in the voice range).
- Faces and voices of passers-by are not identifiable from these; if a recording ever catches a clearly identifiable private conversation, cut that part out.

## Low Poly Epic City (public/models/epic/)

- **What:** "Low Poly Epic City" v1.0 by Polyperfect (https://u3d.as/2Fjw), bought by the Ghanaverse owner on the Unity Asset Store for $25 (Oct 2026). Licence: Unity Asset Store End User Licence Agreement (standard licence): the models may be used and changed inside our game, but the pack's files must not be given out on their own. The owner keeps the receipt.
- **Rule:** the original pack (the .unitypackage and its FBX files) never goes into Git or onto the website. Only the converted game files ship, inside the game. The GitHub repository is private (made private by the owner on 27 Oct 2026).
- **Changes we made:** converted from FBX to GLB in true metres, one shared material in place of the pack's (the pack's own texture sheets are in `tex/`: albedo, day glow, night glow, specular), shapes packed smaller with meshopt (not simplified), by `apps/web/scripts/epic/convert.cjs` and `optimise.mjs`. People are the pack's rigged versions; their animations (stand, walk, run) are in `people-animations.glb`. Catalogue pictures in `thumbs/` were drawn by our converter from the models.
- 438 models: 100 buildings, 55 vehicles, 26 people, 67 street things, 56 nature, 95 road, rail, bridge and other tiles, 16 beach, 8 farm, 6 military buildings, 4 racing, 5 hills.

## Market food (public/models/food/)

- `food.glb`: the goods on the market stalls and umbrella tables, the sellers' head loads (oranges, bread) and Mission 1's kelewele (a paper of kelewele with groundnuts, and Auntie Dede's pan). Built by `scripts/food/build-food.mjs` (see its README) on 29 Oct 2026 from:
  - **"Low Poly Food Pack" v1.0 by reodesuxz** (sent by the owner as `LowPolyFoodPack_v1.0.zip`). Licence (its LICENSE.txt): free for unlimited personal and commercial projects including games, changes allowed, no credit required (credit given here: "Low Poly Food Pack by reodesuxz"). **Not allowed:** reselling or giving out the model files themselves, changed or not, or using them to train AI. So the pack's own files never go into Git; only the built `food.glb` ships, inside the game.
  - **"Ultimate Food Pack" by Quaternius** (sent by the owner as `Ultimate Food Pack-glb.zip`, the glTF files as shared on poly.pizza). Quaternius releases this pack as **CC0 1.0** (public domain). The zip itself has no licence file: before launch, the owner should check the page it was downloaded from says CC0.
  - **Our own shapes:** the stall tables, enamel basins, egg trays, cooler box, plates, and the kelewele itself (fried plantain cubes and groundnuts; neither pack has plantain).
- Changes: resized to real sizes, colours painted onto the shapes (and some recoloured: plantain from bananas, Ghana oranges from lemons, garden eggs from eggs, bofrot balls, fried yam from fries, khebab sticks), items in piles simplified to a few dozen triangles each, joined into one file per display.
