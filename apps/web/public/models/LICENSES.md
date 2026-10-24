# 3D models: sources and licences

| File | What it is | Source | Licence | Notes |
|---|---|---|---|---|
| `person.glb` | The 3D person: male body, short hair, T-shirt, trousers and trainers, with 14 animations | Quaternius, "Universal Base Characters [Standard]" (male body, Buzzed hair) and "Universal Animation Library [Standard]" (animations), https://quaternius.com | CC0 1.0 (public domain); credit is not required but given here | Clothes painted on and reshaped, weapon animations removed, shrunk to about 550 KB. Built by `scripts/person` (see its README). Skin tone and clothes colours are set in code. |
| `person-female.glb` | The 3D woman: female body, "Buns" hair, T-shirt, a flared midi skirt and shoes, with the same 14 animations | Same Quaternius packs (female body, Buns hair) | CC0 1.0 (public domain) | Same build; the skirt is a shape we add in the build. About 580 KB. |

The okada (`src/test/streetTest.ts`) and the street traffic (cars, taxis, trotros and pragyas in `src/game/vehicles3d.ts`) are built in code from simple shapes. They are our own and need no licence.

Removed: `player.glb` (a Mixamo test figure, the three.js "Xbot"), replaced by `person.glb` on 2026-10-24.
