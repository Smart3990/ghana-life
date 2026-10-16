# Progress and test results

## Week one

| Task | Status | Notes |
|---|---|---|
| T0 Hello page online | Done (2026-10-16) | Live at https://ghana-life-web.ghana-life-web.workers.dev, opens on phone and Windows |
| T0a Map file test (R2) | Not started | |
| T0a Round-trip test from Accra (R3) | Not started | |

## Test results for the risk register

- R2 (map file under 25 MiB): not measured yet
- R3 (round-trip time from Accra): not measured yet

## Changes from the master plan

- Hosting: the plan says Cloudflare Pages. Wrangler 4 now deploys Pages projects as Workers with static assets, so the site is a Worker (`apps/web/wrangler.jsonc`). Still free, static requests still unlimited, 25 MiB per file still applies. Deploy with `npm run deploy` in `apps/web`.
- Login: Wrangler uses an API token in `apps/web/.env` (not in Git) because the browser login kept timing out.

## Test phone

- Not chosen yet. Open the hello page on candidate phones and note the memory shown.
