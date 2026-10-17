# Progress and test results

## Week one

| Task | Status | Notes |
|---|---|---|
| T0 Hello page online | Done (2026-10-16) | Live at https://ghana-life-web.ghana-life-web.workers.dev, opens on phone and Windows |
| T0a Map file test (R2) | Done (2026-10-16) | Passed on PC and on phone (mobile data). Test page: /tile-test.html |
| T0a Round-trip test (R3) | Done (2026-10-16) | Passed on phone, 170 ms typical. Test page: /ping-test.html |
| T1 Vite + TypeScript + MapLibre project | Done (2026-10-16) | MapLibre 6.14, map code in `apps/web/src/map/` |
| Opening sequence (part of T7b) | Built (2026-10-16) | Akwaaba welcome screen (Twi, Fante, English) for 3 s while the map loads, then a 5.5 s glide from above Accra down to Osu, then a slow circle that stops on touch. Respects reduce-motion. Twi and Fante lines need checking by native speakers |
| T2a Quality tiers (first version) | Built (2026-10-16) | No button. Full (3D) by default. Light only if data saver, memory 1 GB or less, or software graphics. Frame rate measured for 3 s on the loaded street; under 20 fps on two visits switches to Light for good. Never upgrades itself. Camera lands at pitch 72 (side-on), which draws many more buildings: watch the frame rate on cheap phones. `?tier=light`, `?tier=full`, `?debug` for testing. Still to do: a separate Standard tier and the frame-rate overlay |
| T4 Live server, players see each other | Built (2026-10-17), two-device check pending | `apps/server/src/rooms/area.ts`: one Durable Object room per 0.05° area (about 5.5 km), Africa location hint, hibernation API, player state on each socket (no storage writes), cap 100 per room, moves at most every 300 ms, 40 KB message limit, only our site may connect. Messages: hello, snapshot, joined, move_to/walk (route plus server start time; others animate it), left. Measured relay A to B: 132 to 164 ms. Client `apps/web/src/net/live.ts`: simplified routes, joins late walks at the right spot, switches room when walking into another area, reconnects with backoff. Temporary names are Akan day-names plus a number. "N here" in the top bar |
| T3 Walk on real roads | Built (2026-10-16), phone check pending | `scripts/build-roads.mjs` downloads central Accra streets from OpenStreetMap (Overpass) into `public/data/roads-central.json`: 31,758 points, 34,728 segments, main network only, about 220 KB compressed. A* route search in the browser. Placeholder avatar starts on Black Star Square; tap a spot and it walks the route (14 m/s game speed) with a dashed green line, camera following until the player drags. Walking area: about 7 x 7 km from Jamestown to Osu and Ridge |
| Landing and tour | Built (2026-10-16) | Lands on Black Star Square (3D Black Star Gate with upright black star, Independence Arch). Then a one-time tour, 5 s flight plus 10 s sideways glide per stop: Jamestown, Makola Market, Osu, Labadi Beach, Airport City, East Legon, University of Ghana, Tema (Community 1). Ends circling Black Star Square. Touch stops it. One tour loads several MB of tiles on mobile data |
| 3D buildings | Built (2026-10-16) | Map now includes zoom 15 (9,654 tiles), where ordinary houses are. Full tier draws them as 3D blocks |
| T2 Styled Accra map with OSM credit | Built, phone check pending | Own Ghana palette on Protomaps layers, self-hosted Latin fonts and icons. Ready in 3.8 s in a headless desktop browser. Light mode drops buildings, land cover, icons, house numbers and shields, and caps pixel density at 1.5. Code download about 300 KB compressed. Device facts moved to /device.html |

## Test results for the risk register

- R2 (map file under 25 MiB), measured 2026-10-16 with Protomaps build 20261015:
  - Greater Accra (bbox -0.55,5.45,0.72,6.10) at full detail (zoom 15): 34 MB, over the limit.
  - Same area capped at zoom 14: 12.5 MB as one .pmtiles file. Under the limit. MapLibre overzooms past 14.
  - Cloudflare static hosting does not serve parts of a file (Range requests return the whole file), so one .pmtiles file cannot be used directly.
  - Fix chosen: export to plain tile files, `tiles/accra/{z}/{x}/{y}.pbf` (2,517 files, 15.1 MiB unpacked, largest 174 KiB), with `public/_headers` setting `application/x-protobuf` so Cloudflare compresses them (brotli, about 27 percent smaller). Missing tiles return 404.
  - Rebuild: `pmtiles extract https://build.protomaps.com/<date>.pmtiles data/accra.pmtiles --bbox=-0.55,5.45,0.72,6.10 --maxzoom=14`, then `node scripts/export-tiles.mjs data/accra.pmtiles apps/web/public/tiles/accra`.
  - Note: uploading all tiles from this PC took about 5 minutes; later deploys only upload changed files.
- R3 (round-trip time), measured 2026-10-16:
  - Phone on mobile data: 170 ms typical round trip to a Durable Object room. Passes the 250 ms target. Network, Cloudflare city and room location not yet recorded.
  - PC on home internet: Cloudflare city London (LHR), room in London, 232 ms typical, 111 ms fastest. Traffic from this connection goes through Europe.
  - Server: `apps/server` (Worker `ghana-life-server`), rooms `ping/default` (placed by first visitor) and `ping/afr` (Africa location hint).
  - Design note: keep click-to-move and animate between messages, as the plan says. 170 ms is fine for that, not for fast-reaction gameplay.

## Changes from the master plan

- Hosting: the plan says Cloudflare Pages. Wrangler 4 now deploys Pages projects as Workers with static assets, so the site is a Worker (`apps/web/wrangler.jsonc`). Still free, static requests still unlimited, 25 MiB per file still applies. Deploy with `npm run deploy` in `apps/web`.
- Login: Wrangler uses an API token in `apps/web/.env` and `apps/server/.env` (not in Git) because the browser login kept timing out. The token must have no IP address filter: home and mobile internet addresses in Ghana change often.
- Dropped by the owner (2026-10-17): adding "Mr Candy Ghana" in Nationalism Park.
- Verified live on 2026-10-17: welcome screen, no debug text on the normal link, street network served (31,758 points), tap-to-walk works in full 3D.

## Test phone

- Not chosen yet. Open the hello page on candidate phones and note the memory shown.
