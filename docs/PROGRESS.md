# Progress and test results

Live game: https://ghana-life-web.ghana-life-web.workers.dev · Code: https://github.com/Smart3990/ghana-life

## Week one

| Task | Status | Notes |
|---|---|---|
| T0 Hello page online | Done (2026-10-16) | Opens on phone and Windows |
| T0a Map file test (R2) | Done (2026-10-16) | Passed on PC and on phone (mobile data). Test page: /tile-test.html |
| T0a Round-trip test (R3) | Done (2026-10-16) | Passed on phone, 170 ms typical. Test page: /ping-test.html |
| T1 Vite + TypeScript + MapLibre project | Done (2026-10-16) | MapLibre 6.14, map code in `apps/web/src/map/` |
| T2 Styled Accra map with OSM credit | Built, phone check pending | Own Ghana palette on Protomaps layers, self-hosted Latin fonts (including Ɛ and Ɔ) and icons. Zoom 0 to 15 tiles (9,654 files), 3D buildings with painted walls and zinc or terracotta roofs |
| T2a Quality tiers | Built (2026-10-17) | Light (data saver, 1 GB memory or software graphics): flat, 15 vehicles, no tour. Standard (most phones): 3D with roofs, 40 vehicles, pixel density 1.5. Ultra (8+ cores, plenty of memory): 100 vehicles, full density. Frame rate checked every few seconds while playing; two slow checks step down one tier; remembered only after two slow visits; never steps up. `?tier=light|standard|ultra`, `?debug` shows tier and live fps |
| T3 Walk on real roads | Built (2026-10-17), phone check pending | Whole of Greater Accra: `scripts/build-roads-areas.mjs` cuts OpenStreetMap streets into 296 area files (0.05°, same areas as live rooms, 23.5 MB in total, not in Git). A walk loads only the areas it crosses and joins them. A* in the browser, tries a few nearby street points, walks over 6 km refused. Walk cycle with swinging limbs, 4.5 m/s walk rising to 9 m/s jog, ease in and out, camera glides after the avatar |
| T3a / Test 1b: 3D characters | Page built (2026-10-17), cheap-phone result pending | /char-test.html: 10, 20, 30 animated low-poly characters, about 3,300 triangles each, with three.js only on that page. Verdict rule: 10 characters at 28 fps or more means real 3D for the nearest few on Standard and Ultra |
| T4 Live server, players see each other | Built (2026-10-17), two-device check pending | One Durable Object room per area (Africa location hint, hibernation, state on sockets, cap 100, rate limits, origin check). Relay A to B measured 132 to 164 ms. Temporary Akan day-name names |
| T5 Chat, filter, report, block, mute | Built (2026-10-17) | Server filter (English starter list; Pidgin, Twi, Ga and Ewe lists to be written by Ghanaian speakers in `apps/server/src/moderation/words.ts`), blocks phone numbers and mobile money talk, rate limits, 5 minute mute after 3 blocked messages. Reports go to one ReportBox, readable at `/reports?key=` on the server (key in `apps/server/.admin-key`) |
| T7 Traffic | Built (2026-10-17) | 80 driving routes in central Accra, 420 vehicles (cars, taxis, trotros, tricycles) placed from the shared server clock, drawn at about twice real size. Same traffic on every phone, no messages |
| T7a Planes | Built (2026-10-17) | Runway 21 at Kotoka (centreline from map data): arrivals on a 3° approach, departures climbing out over the city, one every 150 s from the shared clock |
| Opening, landing, tour | Built (2026-10-16) | Akwaaba screen (Twi, Fante, English; needs checking by native speakers), glide down to Black Star Square (3D Black Star Gate and Independence Arch), one-time tour of 8 areas. Refresh within 3 hours returns to the same spot without the intro |
| 18+ and house rules | Built (2026-10-17) | First visit: confirm 18 or older and accept the six house rules; asked again when `RULES_VERSION` changes. Full accounts and server age check are T8 |
| In-app browsers (R5) | Built (2026-10-17) | Facebook, Instagram and other in-app browsers get "Open in Chrome" (Android) or Safari instructions (iPhone), plus Copy link |

## Mobile data (measured 2026-10-17, live site, phone-sized screen, Standard)

| | Downloaded |
|---|---|
| First visit until standing on Black Star Square | 1.5 MB (code 317 KB, tiles 647 KB, streets and traffic 388 KB, fonts and icons 152 KB) |
| First visit plus the first minute of the tour | 2.2 MB |
| Second visit (service worker copies on the phone) | 5 KB |

Plan budget before the map shows: under 3 MB (Light), under 8 MB (Standard). Passed.

## Test results for the risk register

- R2 (map file under 25 MiB), measured 2026-10-16 with Protomaps build 20261015:
  - Greater Accra (bbox -0.55,5.45,0.72,6.10) at zoom 15: 34 MB as one file, over the limit; at zoom 14: 12.5 MB.
  - Cloudflare static hosting does not serve parts of a file, so one .pmtiles file cannot be used directly.
  - Fix: plain tile files `tiles/accra/{z}/{x}/{y}.pbf`, now zoom 0 to 15 (9,654 files, largest 494 KiB), with `_headers` setting `application/x-protobuf` so Cloudflare compresses them. Rebuild commands are in the README.
- R3 (round-trip time), measured 2026-10-16:
  - Phone on mobile data: 170 ms typical. Passes the 250 ms target. Network and room location not yet recorded.
  - PC on home internet: Cloudflare London (LHR), 232 ms typical.
  - Design note: keep click-to-move and animate between messages.

## Changes from the master plan

- Hosting: Wrangler 4 deploys Pages projects as Workers with static assets, so the site is a Worker (`apps/web/wrangler.jsonc`). Still free, static requests unlimited, 25 MiB per file.
- Login: Wrangler uses an API token in `apps/web/.env` and `apps/server/.env` (not in Git). The token must have no IP address filter: internet addresses in Ghana change often.
- Vehicles and planes are drawn at about twice real size so they read next to the screen-sized characters.
- Dropped by the owner (2026-10-17): adding "Mr Candy Ghana" in Nationalism Park.

## New direction: Ghanaverse (2026-10-24)

The design is now set out in `docs/GHANAVERSE_DESIGN_BRIEF.md`: the game is called Ghanaverse, with a third-person open-world feel, a Season 1 story ("From your village to Accra"), missions, heists, police, a free world of jobs, cinematic rides and flights inside Greater Accra, Explore Ghana with real sites, friends and nearby voice, a Royal Kente interface, moving ads and a style-only shop.

Next steps, in order (brief section 23):

1. Finish the checks below.
2. Rendering prototype A from brief section 22.1: a close follow camera, 3D player and nearby vehicles through a three.js layer in MapLibre, joystick and okada control, tested on the cheap Android.
3. Royal Kente three-tap start screen, clean on-screen display, controller and keyboard input.

### Street test, prototype A (built 2026-10-24, waiting for the phone test)

Page: `/street-test.html` (source `apps/web/street-test.html` and `src/test/streetTest.ts`).

- **What it does:** a 3D person at Kwame Nkrumah Circle, seen from close behind, walks or runs with a touch joystick, W A S D or arrow keys, or a game controller. They get on and off an okada with the OKADA button, E, or X / □ on a controller. The bike leans in corners, its wheels turn, and the rider sits on it. The camera follows behind and turns after you. Place names fade in as you pass.
- **Look:** an evening Accra sky, warm light, a soft shadow under the player. At street level the roads are tarmac grey with kerbs and the ground is dusty, instead of the bright overview colours. Road widths keep growing past zoom 18, so roads stay the right size up close.
- **Traffic:** the live traffic is drawn at real size here (`startTraffic(..., size)`, new optional argument; the main game is unchanged).
- **Assets:** `public/models/player.glb`, a 425 KB placeholder person. Its source and licence are in `public/models/LICENSES.md`. The okada is built in code, so there is no file to download.
- **Size:** the page's own code is 25 KB gzipped, and three.js is 144 KB gzipped (the same as /char-test.html).
- **Test hooks:** `?debug` shows the frame rate and triangle count, `?auto` rides and walks by itself and writes the result into the page, and `?tier=light|standard|ultra` forces a tier.
- **Cloud check (software graphics, no GPU, so the numbers are not the phone's):**
  - It loads with no errors.
  - The scene is about 7,000–9,000 triangles.
  - 8–11 fps under software drawing.
  - Screenshots look right on foot and on the okada.
- **Known limits:**
  - There is no collision yet, so you can walk through buildings.
  - The person is a grey-model placeholder, tinted.
  - The riding pose is approximate.
  - Light tier shows flat buildings, which look poor at street level. If the cheap phone gets Light, street view will need low walls in Light (decide after the phone test).
- **Done when:** on the cheapest Android, `/street-test.html?debug` shows 30 fps or more while walking and riding round Circle, and the controls feel right.

## Waiting on the owner

- Street test on the cheap Android: open `/street-test.html?debug` after the next deploy, walk and ride for a minute, and report the fps number and how it feels.

- Two-device test for T4 (phone and PC see each other walk).
- Phone checks: map load time and smoothness, tap to walk, chat.
- Test 1b result from the cheapest Android available (/char-test.html).
- Test phone memory and cores (/device.html), and the mobile network for R3.
- Native-speaker check of the Twi and Fante greetings, and the Pidgin, Twi, Ga and Ewe word lists.
- GitHub repository visibility: make it private.
