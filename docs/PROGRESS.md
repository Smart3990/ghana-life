# Progress and test results

## Week one

| Task | Status | Notes |
|---|---|---|
| T0 Hello page online | Done (2026-10-16) | Live at https://ghana-life-web.ghana-life-web.workers.dev, opens on phone and Windows |
| T0a Map file test (R2) | Passed on PC, phone check pending | See R2 below. Phone test page: /tile-test.html |
| T0a Round-trip test from Accra (R3) | Not started | |

## Test results for the risk register

- R2 (map file under 25 MiB), measured 2026-10-16 with Protomaps build 20261015:
  - Greater Accra (bbox -0.55,5.45,0.72,6.10) at full detail (zoom 15): 34 MB, over the limit.
  - Same area capped at zoom 14: 12.5 MB as one .pmtiles file. Under the limit. MapLibre overzooms past 14.
  - Cloudflare static hosting does not serve parts of a file (Range requests return the whole file), so one .pmtiles file cannot be used directly.
  - Fix chosen: export to plain tile files, `tiles/accra/{z}/{x}/{y}.pbf` (2,517 files, 15.1 MiB unpacked, largest 174 KiB), with `public/_headers` setting `application/x-protobuf` so Cloudflare compresses them (brotli, about 27 percent smaller). Missing tiles return 404.
  - Rebuild: `pmtiles extract https://build.protomaps.com/<date>.pmtiles data/accra.pmtiles --bbox=-0.55,5.45,0.72,6.10 --maxzoom=14`, then `node scripts/export-tiles.mjs data/accra.pmtiles apps/web/public/tiles/accra`.
  - Note: uploading all tiles from this PC took about 5 minutes; later deploys only upload changed files.
- R3 (round-trip time from Accra): not measured yet

## Changes from the master plan

- Hosting: the plan says Cloudflare Pages. Wrangler 4 now deploys Pages projects as Workers with static assets, so the site is a Worker (`apps/web/wrangler.jsonc`). Still free, static requests still unlimited, 25 MiB per file still applies. Deploy with `npm run deploy` in `apps/web`.
- Login: Wrangler uses an API token in `apps/web/.env` (not in Git) because the browser login kept timing out.

## Test phone

- Not chosen yet. Open the hello page on candidate phones and note the memory shown.
