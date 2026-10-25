# 3D models: sources and licences

| File | What it is | Source | Licence | Notes |
|---|---|---|---|---|
| `person.glb` | The 3D person: male body, short hair, T-shirt, trousers and trainers, with 26 everyday animations (no weapon moves) | Quaternius, "Universal Base Characters [Standard]" (male body, Buzzed hair), "Universal Animation Library [Standard]" and "Universal Animation Library 2 [Standard]" (animations), https://quaternius.com | CC0 1.0 (public domain); credit is not required but given here | Clothes painted on and reshaped, weapon animations removed, shrunk to about 550 KB. Built by `scripts/person` (see its README). Skin tone and clothes colours are set in code. |
| `person-female.glb` | The 3D woman: female body, "Buns" hair, T-shirt, a flared midi skirt and shoes, with the same 26 animations | Same Quaternius packs (female body, Buns hair) | CC0 1.0 (public domain) | Same build; the skirt is a shape we add in the build. About 580 KB. |
| `person-mass.glb`, `person-female-mass.glb` | Very light versions for big crowds (about 900 and 1,300 triangles; 19 street moves: walk, jog, talk, phone, eat, sell, carry, call out, sit, dance, serve, push and more) | Made from the two files above | CC0 1.0 | `scripts/person/make-crowd.mjs ... mass` |
| `person-lite.glb`, `person-female-lite.glb` | The player on Light phones (about 6,000 and 8,600 triangles, every move) | Made from the two files above | CC0 1.0 | `scripts/person/make-crowd.mjs ... lite` |

The okada (`src/test/streetTest.ts`) the street traffic (cars, taxis, trotros and pragyas in `src/game/vehicles3d.ts`), the street props (trees, palms, street lights, kiosks, umbrellas, polytanks, head-load basins and trays in `src/game/streetLife.ts`), and the planes and helicopters (`src/game/sky3d.ts`) are built in code from simple shapes. They are our own and need no licence.

Removed: `player.glb` (a Mixamo test figure, the three.js "Xbot"), replaced by `person.glb` on 2026-10-24.

The plastic chairs and football (`src/game/streetScenes.ts`) are built in code. All street sounds and the highlife groove (`src/game/streetSound.ts`) are made in code; there are no sound files.

## Vehicles (public/models/vehicles)

- **Free Low Poly Vehicles Pack** by Raphael Gonçalves (Rgsdev), from https://opengameart.org/content/free-low-poly-vehicles-pack. Licence: **CC0** (public domain; credited here anyway).
  - Used: Sedan (cars and Accra taxis), Hatchback, SUV, Pickup, Van (trotro), Bus, Truck.
  - Changes: resized to the real size of the cars they stand for, split into a paint part and a fixed part with colours baked in, and compressed, by `scripts/vehicles/build_modern.py` and `scripts/vehicles/optimise-vehicles.mjs`. The Accra taxi's yellow corners are drawn by the game.
- Pragya tricycles and okadas are still built in code (`src/game/vehicles3d.ts`).

## Opening film pictures (public/film)

- `village.webp`, `hands.webp`, `bus.webp`, `circle.webp`: made for Ghanaverse on 2026-10-25 with the owner's ImagineArt account (model Seedream v5 lite), from our own written descriptions. All people are invented (not real people), with no logos or brand names.
- Before launch, check that the ImagineArt plan used allows commercial use of these pictures (some free plans do not); if not, make them again on a plan that does.
