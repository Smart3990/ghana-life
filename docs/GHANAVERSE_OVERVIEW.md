# Ghanaverse: Complete Project Overview

*A single briefing for anyone (a person or another AI) joining the project. Written 30 October 2026
from the project's own documents, code and work history. It summarises; the detailed sources are
listed in section 13.*

---

## 1. The game in one paragraph

**Ghanaverse** (working title before 24 Oct 2026: "Ghana Life") is a free 3D open-world game that runs
in any web browser (phone, tablet, laptop, Android TV). It is a living virtual Ghana on the **real map
of Greater Accra**: third-person camera behind your character, crowded streets, trotros and okadas,
markets, day and night on real Accra time, a cinematic story (Season 1, "From your village to
Accra"), and later a shared online world with jobs, homes, friends, voice chat, heists, police and
moving adverts. The feeling: a big-budget open-world action game, but Ghanaian to the core.

**The owner** is a beginner developer in Ghana, building with an AI coding assistant (Claude, in
Claude Code). He tests on a cheap Android phone (**Samsung Galaxy A07**) and an iPhone, and gives
feedback by voice notes, screenshots and short videos.

---

## 2. Links

| What | Where |
|---|---|
| Players' (live) site | https://ghana-life-web.ghana-life-web.workers.dev |
| Test site (updates automatically about 5 minutes after every save to GitHub) | https://ghana-life-test.ghana-life-web.workers.dev/street-test |
| Test straight into the ride home | `/street-test?scene=ride` |
| Test with the frame rate on screen | `/street-test?debug` (or `?fps`) |
| Model catalogue (every Epic City model, spin, day/night) | `/catalogue` |
| Code | GitHub `Smart3990/ghana-life` (**private**: it contains a paid asset pack) |

Useful test switches on `/street-test`: `?nostory` (skip the story, free roam at Circle),
`?scene=ride` or `?scene=nima` (jump to a story scene), `?hour=23` (any time of day),
`?timescale=60` (fast clock), `?tier=light|standard|ultra` (force a quality level), `?debug`.

---

## 3. Non-negotiable rules (from the owner and the design brief)

1. **Performance first, then fun, then realism.** Nothing is done until the Light quality tier runs
   smoothly on a cheap Android phone.
2. **Never name or reference any other game**, anywhere (game, text, store pages, marketing). Other
   Accra browser games exist; never copy their map, layout, art or characters. Only learn their
   general qualities (smoothness, lighting, animation, phone controls).
3. **No weapons.** Action is chases, driving, stealth, timing, fists, tackles. Police use handcuffs.
4. **18+ only**, house rules accepted first. **Anonymous**: nicknames only; never real names, phone
   numbers, photos, ID or real location.
5. **All money is decided on the server**, checked and capped (no client-side money exploits).
6. **Fictional** banks, police, gangs, businesses and brands. No real people or brands without
   written permission (for example the trotro model has no maker's badge; adverts are our own
   brands like "Sika Mobile Money").
7. **Only content that is free to use or our own**, with its source and licence recorded
   (`apps/web/public/models/LICENSES.md`).
8. **Working style:** one task at a time; plain words and exact commands for the owner; every task
   ends with a "done when" test; save to Git after every task; update `docs/PROGRESS.md`; no more
   than three big features in progress at once.
9. **Clean screen:** show nothing unless it matters now; everything else lives in the in-game phone.
10. **No chores:** every mission uses fun actions. Every mission is explained in one sentence.
11. **Respect:** places of memory are quiet zones; no tribal, religious or sexual insults.

---

## 4. Technology and tools

### 4.1 The stack (all free to start: the "zero-dollar start" rule)

| Part | Technology |
|---|---|
| Game (browser) | **TypeScript**, built with **Vite 8**, in `apps/web` |
| Map | **MapLibre GL JS 6** drawing Greater Accra from self-hosted **Protomaps** vector tiles (OpenStreetMap data), zoom 0 to 15, about 9,654 tile files |
| 3D | **three.js 0.186**, drawn inside MapLibre as a **custom layer** (`street-3d`): the city, people, vehicles and props near the player are real 3D on top of the real map ("Prototype A" of the design brief, chosen and kept) |
| Hosting | **Cloudflare Workers** with static assets (free plan) |
| Live server | **Cloudflare Worker + Durable Objects** in `apps/server`: one room per map area, live positions, chat, filter, reports, rate limits |
| Automatic deploys | **GitHub Actions** (`.github/workflows/deploy.yml`): every push to `main` goes to the test site; the live site changes only when the owner runs the workflow with "live". Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets (never in the code) |
| Fonts and icons | Self-hosted Latin fonts including Ɛ and Ɔ |
| Data scripts | Node scripts in `scripts/`: map tiles (`export-tiles.mjs`, needs the `pmtiles` tool), walking streets for all Greater Accra (`build-roads-areas.mjs`, 296 area files), traffic routes, live-data fetch for a new computer, deploy check |
| Model build scripts | `scripts/person` (people from Quaternius packs), `scripts/vehicles` (Blender 4.2 Python plus meshopt compression), `scripts/food` (market food) |
| Sound | Street recordings by the owner in Accra; music and many effects made in code (no samples) |

### 4.2 AI and outside tools used

- **Claude Code (Anthropic)**: writes and tests all code, runs a headless browser to take screenshots
  and measure, and explains each step to the owner. All work is committed to Git with notes.
- **Headless browser testing**: scripts open the game, click START, jump to scenes, log what happens
  (for example how long each car waits) and take screenshots to check every visual change.
- **ImagineArt (model Seedream v5 lite)**, owner's account: the opening film pictures and billboard
  photos (fictional people, no logos). Check before launch that the plan allows commercial use.
- **The owner's own videos** (the opening trotro clip, sent on WhatsApp) and **sound recordings**.
- Python with Pillow (only for making contact sheets of screenshots during testing).

### 4.3 Bought and free content

| Content | Source | Licence / notes |
|---|---|---|
| **Low Poly Epic City** (438 models: buildings, vehicles, people, street things, roads, rail, nature) | Polyperfect, Unity Asset Store, bought by the owner for $25 | Standard Asset Store licence: use and change in the game; the original pack never goes into Git or onto the website, only converted game files. Reason the repo is private |
| People (player, story cast, crowd) | Quaternius "Universal Base Characters", "Universal Animation Library" 1 and 2, "Posed Background Characters" | CC0 |
| Market food | "Low Poly Food Pack" by reodesuxz; "Ultimate Food Pack" by Quaternius | Free for commercial games; CC0 (owner to confirm the source page says CC0) |
| SUV | Free Low Poly Vehicles Pack (Rgsdev) | CC0 |
| **Trotro** (both kinds) | **Our own**, built in code from five reference pictures the owner sent (front, back, both sides, top) | Ours. No badge, made-up plates |
| Tricycles (pragya, motor king), okada, compounds, chairs, kiosks | Built in code | Ours |
| Map | OpenStreetMap via Protomaps | Credit shown |

---

## 5. Repository map

```
apps/web/               the game
  street-test.html      the main game page today (story + open world)
  src/test/streetTest.ts   the game's main file (about 5,000 lines: camera, controls, story, scenes)
  src/game/             world systems:
     trafficSim.ts        traffic simulation (lanes, junctions, lights, the 10-second rule, story cars)
     vehicles3d.ts        drawing every vehicle, adverts on them, the trotro model, headlights
     vehicleTypes.ts      which model each vehicle type uses, sizes, how common
     streetLife.ts        crowds, kiosks, stalls, umbrellas, lamps, poles, market at Circle
     streetBuildings.ts / packBuildings.ts   buildings from the map and from the Epic pack
     epicRoads.ts / epicKit.ts   roads in the pack's style; the pack's shared material, day/night glow
     dayNight.ts          the sun on real Accra time and the light for each hour
     signals.ts           traffic lights and zebra crossings
     flyovers.ts, railway.ts, places.ts, trotroStation.ts, compound.ts, foodKit.ts, ...
  src/hud/              screen parts: cinema (title cards, subtitles, Skip), phone, minimap, full map, touch controls, advert card
  src/map/              MapLibre styles, quality tiers
  public/               models, film, music, sounds, map tiles (tiles and street data not in Git)
apps/server/            Cloudflare Worker + Durable Objects (live rooms, chat, moderation)
scripts/                data and model build scripts
docs/                   the plans and this overview
```

---

## 6. Design (from `docs/GHANAVERSE_DESIGN_BRIEF.md`)

- **Look:** modern Accra as it is today, from real map data; warm natural light, golden sunsets,
  Harmattan haze, neon nights; "beautiful and believable", not photoreal everywhere.
- **Interface: "Royal Kente"**: night `#121A14`, kente gold `#E3A92B`, kente red `#C8442E`, harvest
  green `#2F8F57`, royal blue `#1F5FA8`, calico white `#F2EFE6`; a thin woven kente strip as the
  signature motif. Kente colours are for the interface only, never for tinting the city.
- **Controls:** touch joystick and buttons; keyboard and mouse; game controllers (Gamepad API);
  Android TV with a remote.
- **Quality tiers:** Light, Standard, Ultra with automatic detection and step-down.
- **Story, Season 1 "From your village to Accra":** five chapters. Cast includes Uncle Kwame, Auntie
  Esi, Auntie Dede (kelewele seller at Circle), Kofi Shortcut (trotro mate), Tunde No-Wahala (rival),
  Landlord Two-Years, Kwaku Percentage, Naa Kokonsa (reporter), Don Shito (the boss) and the Borla
  Bandits, Inspector Slow-Motion, Akosua Trending. Secret plot: Don Shito wants the whole block to
  build "Accra Dubai Plaza".
- **Chapter 1** (about 1 to 2 hours): Welcome Chop, Get Connected, Mate for a Day, Lights Off, Two
  Years Advance, Your Own Key. The story deliberately leaves the player short of money so they use
  the free world.
- **Free world:** jobs with random twists, energy (no sleeping), Sika (cedis) money, rides with
  cinematic journeys, leaderboards, street scenes.
- **Social:** nearby voice, compound voice group, text chat, friends, calls from story characters.
- **Crime:** police and "heat" stars, Most Wanted, heists, fictional rough areas and gangs.
- **Business model:** in-world adverts (on trotros, buses, billboards, big screens, taxi roof
  screens) with a separate advertiser page; a style-only shop with Gold coins, paid through
  **Paystack** once the business is registered. Money always on the server.
- **Build order** (brief section 23): look → city → opening → social core → free world → Chapter 1
  missions → Chapters 2–3 → Explore Ghana → big screens/news → Chapters 4–5 → flights and boats →
  ads page and shop → Season 2.

---

## 7. What is built today (as of 30 Oct 2026)

### 7.1 Foundations (week one, 16–17 Oct)
Styled Accra map with OSM credit; quality tiers; walking on real roads (A* path finding over all
Greater Accra); live server with rooms per area (round trip about 170 ms on a Ghana phone); chat with
a filter, report, block and mute; simulated traffic and planes at Kotoka on a shared clock; 18+ gate
and house rules; first load about 1.5 MB on mobile data.

### 7.2 The 3D street game (`/street-test`, since 24 Oct)
- **Player:** 3D man or woman (Quaternius bodies, 26 everyday moves), walks, runs, jumps, rides an
  okada; joystick or keys or controller; one gold action button (Ride, Greet, Chat, Sit, Dance);
  camera behind you that swings round anything blocking the view.
- **City:** real Accra buildings rebuilt with Epic City pack buildings that fit each real outline
  (banks, clinics, mosques, flats, villas in rich areas); the pack's road style on every real road
  (tarmac, kerbs, pavements, lines, zebras, roundabouts); the Kwame Nkrumah Interchange flyovers in
  3D; the real railway with track; electricity poles and wires; street lamps on every road; traffic
  lights at junctions; bus stops, filling stations ("SIKA OIL"), signs at real places.
- **Circle's market:** rows of striped market stands, umbrella tables, container kiosks and food
  carts on the open ground, with goods from the food packs; nothing on the road.
- **People:** crowds on every pavement (hundreds; walkers who walk on and on across Accra, people
  standing, chatting, buying, selling, carrying head loads), faces with eyes and brows, Ghanaian skin
  tones and clothes; nobody walks into kiosks or cars; street calls ("Pure water!").
- **Traffic:** every Epic pack road vehicle plus our trotros and tricycles; lanes, junctions, red
  lights, rush hours; **strict rule: no vehicle waits more than 10 seconds** (lights cycle 14 s;
  impatient drivers ease through; stuck vehicles are removed out of sight).
- **Adverts:** full-side moving advert wraps on trotros, buses and lorries, taxi roof screens,
  billboards and big screens; advertisers' own adverts come from `public/data/ads.json`.
- **Day and night** on the real Accra clock (real sun position for the date); warm lamp light,
  lit windows, glowing signs and a slight neon hint at night.
- **Sound:** the owner's street recordings in layers, trotro mates calling, horns; our own highlife
  tune for the opening.
- **Interface:** minimap, full map (locked to the Circle area for now), the in-game phone with
  contacts and calls, mission cards and the "AYEKOO!" banner, Skip button for films.

### 7.3 The opening story (playable)
1. Start screen: choose woman or man and a hometown (Ada, Ho, Kumasi, Tamale, Cape Coast,
   Koforidua, or Surprise me).
2. Title cards over music: "You are {Akan day name}", a university graduate from your hometown, no
   work at home, so you go to Accra to stay with your uncle and hustle. **No Grandma** (removed by the
   owner).
3. The owner's short clip of the trotro driving away, then "Hours later. Kwame Nkrumah Circle."
4. The camera flies down over Accra to Circle (no flashes of the street before it).
5. Your trotro (white with the green "Sika Mobile Money" advert, like the clip; its sign reads
   "{HOMETOWN} - ACCRA") pulls in to the kerb, steering; its door opens; you step down.
6. A boy snatches your bag; you chase; a taxi blocks you; he is gone.
7. **Mission 1:** cross at the zebra to Auntie Dede's kelewele stall (Epic pack market stand,
   kelewele table, coal pot). She sits you down, takes Uncle Kwame's number, calls him (camera on her
   face), and feeds you kelewele.
8. Uncle Kwame arrives in his red car, pays Auntie, and drives you home: **the ride home** is four
   street-level shots of about 10 seconds (Ring Road Central, its big junction, Nima Roundabout, Nima
   Market). Nothing blocks his car: he waits at most a second at a red light, the cars ahead keep
   moving, nobody crosses in front of him.
9. **Home in Nima:** a quiet street of pack houses; his white family house, Auntie Esi and the
   children Kofi and Akos greet you; your room at the back. "Chapter 1 · Fresh in Accra" (Welcome Chop
   coming soon).

**Skip** works in every scene: the screen goes black ("Skipping…") and the scene runs to its end at
about six times speed behind it.

### 7.4 Latest changes (29–30 Oct 2026)
- Our own **Accra trotro** from the owner's five pictures (rounded, white top, gold stripe, blue
  lower body, black window band, "TRO TRO" on nose and doors, route on the side, Ghana flags, yellow
  GR plates), plus a long high-roof kind.
- **Richer colours:** neutral tone curve instead of filmic (which washed colours to pastel), half the
  pack's flat "day glow", warmer midday light; lower exposure at night so lamps don't burn white.
- **Accra road surface** drawn by the graphics card on the pack's roads: warm sun-faded tarmac,
  grain, mended patches, red laterite dust, worn lines, weathered pavements.
- Auntie Dede's stall rebuilt from the big pack; camera shots fixed so you see faces.
- Frame-rate line shows with `?debug`.

---

## 8. Performance (the most important open problem)

- The owner reports **lag** on his Samsung Galaxy A07. **The frame-rate number has not yet been
  read on that phone**; the next step needs it (`/street-test?debug`, the grey line at top right).
- The master plan's Light budget was about 20 people and 15 cars near you. The game now draws far
  more on Light (measured at Circle earlier: about 260 people, up to 280 simulated cars, about
  455,000 triangles), and MapLibre itself uses about a quarter of the processor time.
- Already done for speed: Light runs at a steady 30 frames a second; crowds and traffic thin
  automatically when the frame rate drops (never below set floors); far buildings and vehicles are
  simpler; roads near you are a lookup grid; building is spread over frames; while a film or black
  screen covers the city the street runs at 5 updates a second.
- **Planned next: a speed pass** using the A07's real numbers (fewer draws, smaller crowds on Light,
  cheaper shadows and lights, and so on).

---

## 9. What is still to do

**Owner's agreed order:** speed pass first, then the next Epic City step.

**Epic City plan** (`docs/EPIC_CITY_PLAN.md`): steps 1–6 done (models, roads, day/night and lights,
vehicles and traffic, people, buildings and street things). Next:
- **Step 7, the living world:** trains on the real railway with level crossings; planes at Kotoka;
  a helicopter, a hot-air balloon, boats at the coast.
- **Step 8:** redo all story film shots for the new look.
- **Step 9:** final full check on the cheap Android.
- Later: rain, wind, storms.

**Earlier owner requests not yet done:** a pause button; people never walking through each other
(much better, not perfect); market mix of about 70% kiosks, 15% umbrellas, 15% other, and a top-down
market view with smooth scrolling; advert taps that do not work on some cars.

**Bigger roadmap:** accounts and guest mode, real neighbours in the compound, voice, Chapter 1
missions, jobs and energy, police and heat, Explore Ghana with real sites, the advertiser page and
payments, Season 2.

**Waiting on the owner:** the A07 frame rate; two-device live test; native-speaker checks of the
Twi, Fante, Ga, Ewe and Pidgin text and word lists; recording the voice script with Ghanaian
speakers who agree in writing; permission for any commercial song; a business Mobile Money or
Paystack account before payments; checking ImagineArt's licence and the food pack's CC0 page.

**Open decisions (design brief section 25):** Chapter 1 name; final advert prices in cedis; when to
register the business; Midnight Gold theme colours; voice actors; which real sites to capture first
and permission letters; trademark and domain check for "Ghanaverse".

---

## 10. How the owner and the AI work together

- The owner describes what he wants (often by voice, so words may be misheard: "Dada" for Dede,
  "Killer Willy" for kelewele, "Neymar" for Nima, "Epic park" for the Epic pack).
- The AI builds one thing at a time, tests it in a headless browser with screenshots and measured
  logs, explains in plain words, saves to Git with a clear note, updates `docs/PROGRESS.md`, and gives
  a "done when" check for the owner's phone.
- Every save to GitHub reaches the test site in about 5 minutes; the owner checks on his phones and
  replies with what to change.

---

## 11. Facts another AI should not get wrong

- The trotro is **our own model**, not from the Epic pack (the pack's van was replaced on 30 Oct).
- The opening has **no Grandma**; nobody gives the player money at the start.
- The **10-second rule**: no car waits in traffic more than 10 seconds, anywhere.
- The **ride home** to Nima uses real street-level shots; Uncle's car is never blocked.
- The **night look** the owner likes: mostly warm and dark like the real Circle, with only a hint of
  neon colour. He rejected "too colourful".
- Kente colours are for the **interface**, never for the city.
- The repository is **private** because of the paid pack; never put the original pack files online.
- Do not name other games, ever, including in planning documents meant for the public.

---

## 12. Questions worth brainstorming

1. How to make the Light tier fast on a Samsung A07 without losing the "crowded Accra" feeling.
2. Chapter 1 missions (Welcome Chop onwards): how each should play in this engine, cheaply.
3. How players meet in the shared world (rooms per area, voice) without breaking the budget.
4. The advertiser page and pricing, and how advertisers send adverts safely.
5. The living world (step 7): what makes trains, planes and boats feel alive at low cost.
6. A name for Chapter 1, and the tone of title cards and dialogue in Ghanaian English and Pidgin.

---

## 13. Where the full details are

| File | What it holds |
|---|---|
| `CLAUDE.md` | The rules for every task |
| `docs/GHANAVERSE_DESIGN_BRIEF.md` | The game design (wins on design questions) |
| `docs/MASTER_PLAN.md` (and the original PDF) | Engineering rules: zero-dollar start, performance budget, tiers, risk register, task list |
| `docs/EPIC_CITY_PLAN.md` | The 9-step plan for using the Epic City pack |
| `docs/PROGRESS.md` | Everything built and tested, day by day, with "done when" tests |
| `docs/VOICE_SCRIPT.md` | Voice lines to record |
| `apps/web/public/models/LICENSES.md` | Every outside asset, its source and licence |
| `README.md` | Setup and deploy commands |
