# Ghana Life (working title)

A free browser life game set in Ghana. The full plan is in `docs/MASTER_PLAN.md` (text copy) and `docs/Ghana_Life_Master_Plan.pdf` (original). Progress and test results are in `docs/PROGRESS.md`.

- Game: `apps/web` (Vite, TypeScript, MapLibre), live at https://ghana-life-web.ghana-life-web.workers.dev
- Live server: `apps/server` (Cloudflare Worker with Durable Objects)
- Build scripts: `scripts/`

## First time on a new computer

You need Node.js, then:

```
cd scripts && npm install && cd ..
cd apps/web && npm install && cd ../..
cd apps/server && npm install && cd ../..
```

### Get the map data onto a new computer (needed before deploying)

The map tiles and street files are not stored in Git. On a new computer, copy them from the live site (about 3 minutes, about 110 MB):

```
node scripts/fetch-live-data.mjs
```

`npm run deploy` checks for them first and stops if they are missing, so a deploy can never publish the game without its map.

### Rebuild the generated map data (not stored in Git)

The map tiles and the Greater Accra street files are large and can be rebuilt any time:

```
# Map tiles (needs the pmtiles tool from https://github.com/protomaps/go-pmtiles/releases)
pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles data/accra.pmtiles --bbox=-0.55,5.45,0.72,6.10 --maxzoom=15
node scripts/export-tiles.mjs data/accra.pmtiles apps/web/public/tiles/accra

# Walking streets for all of Greater Accra (downloads from OpenStreetMap, about 30 minutes)
node --max-old-space-size=4096 scripts/build-roads-areas.mjs apps/web/public/data/roads

# Traffic routes (already in Git; rebuild only to change them)
node scripts/build-traffic.mjs apps/web/public/data/traffic-central.json
```

## Run the game on your computer

```
cd apps/web
npm run dev
```

## Put it online

Both apps read a Cloudflare API token from a `.env` file (not in Git):

```
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

The token must have no IP address filter. Then:

```
cd apps/web && npm run deploy
cd apps/server && npm run deploy
```

The private reports page is `https://ghana-life-server.ghana-life-web.workers.dev/reports?key=<key>`, where the key is in `apps/server/.admin-key` (not in Git).
