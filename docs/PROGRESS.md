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
- **Alive city pass (2026-10-24, owner: "their characters and cities feel alive"):**
  - **Moves:** both people now have 26 everyday moves, adding Quaternius' CC0 "Universal Animation Library 2" (no weapon moves). The new ones include phone calls, eating and drinking, a seller's folded arms, carrying, yes, no, calling out, sitting, dancing, serving, bending to pick up, pushing a cart and kneeling to fix. Crowd models (`*-mass.glb`) carry 19 street moves. The crowd system stores them at half precision to save memory.
  - **Life at places** (`src/game/streetScenes.ts`), set up at the places nearest the player:
    - kiosks get a seller at the counter (waiting, calling out, serving, handing over) and customers who chat, nod, shake their heads, pay and drink;
    - about one kiosk in five plays music, with 3 to 5 people dancing in front;
    - umbrella stalls get a seller (waiting, bending to the goods, calling out) and coloured plastic chairs, with people sitting and chatting;
    - children kick a football about on open ground beside side streets, where there is room;
    - people change what they are doing every few seconds.

    Roadsides now have more kiosks and stalls, on minor roads too. Scene people use reserved slots in the crowd batches (24 / 60 / 100), so they need no extra draws.
  - **People notice you:** within 5 m, people at places turn to face you, and now and then someone calls out in a speech bubble. Sellers call "Pure water! Pure water!", "Waakye dey!" and similar; others say "Chale!", "How far?", "Akwaaba!" and so on.
  - **Sound of Accra** (`src/game/streetSound.ts`, all made in code, no files):
    - a traffic rumble and a crowd murmur that follow how busy it is around you;
    - horns from vehicles around you, from the right side;
    - your okada's engine rising with speed;
    - a highlife groove (guitar picking over I-IV-V-I, bass, bell and shaker) from music kiosks, louder as you get close.

    It starts on the first tap, and there is a sound on/off button top left.
  - **Cloud check:** no errors, and the main game is clean. Triangles at full busy-ness are about 222,000 (Light) and 687,000 (Standard). The automatic step-down will thin the walkers first; the people at places always stay.
  - **Not yet:** voices (real recorded Ghanaian voice lines come later, per brief 15.3); football only appears where there is open ground near the player.
- **3D quality pass 1 (2026-10-24, lessons from other games, brief 4.1a):**
  - **Quality presets** (`PRESET` in `streetTest.ts`, pixel density in `createMap.ts`):
    - Light: a steady 30 fps cap, pixel density up to 1.25, no shadows, simple light.
    - Standard: 60 fps, density 1.5, sun shadows (1024 map), light from a sky model, smooth crowd frames.
    - Ultra: as Standard, with density 2 and a 2048 shadow map.
  - **Sky light:** a physical sky model is rendered once into a small environment, which lights and reflects on every surface (no download). The warm low sun sits in the same place as the sky's sun.
  - **Sun shadows** (Standard and Ultra): you, the okada, buildings, vehicles, trees and kiosks cast shadows. They fall on the street through an invisible shadow-only sheet that follows the player. Crowd people keep their soft round shadows.
  - **Smoother crowds:** on Standard and Ultra, the crowd blends between stored animation frames.
  - **Pinch to zoom** on phones (and the mouse wheel on computers).
  - **Cloud check:** no errors, and the main game is clean. Light is back to its earlier speed now that it skips the sky light.
- **Choked city pass (2026-10-24, owner: "it must look choked"):**
  - **Traffic:** two lanes each way on main roads, nose to tail. Each lane has a vehicle every 9 to 14 m, at rush-hour crawl (2 to 6.5 m/s). The kerb lane sits further out (`OUTER_LANE` in `traffic.ts`).
  - **Every street:** every major and minor road the game loads from the map tiles also gets two-way traffic (`Traffic.addRoads`: one lane each way on minor roads). The streets the 80 fixed routes miss are no longer empty. That added traffic is worked out on each phone, so it isn't identical between players; the fixed routes still are.
  - **Queues:** each lane queues on its own with a 1.5 m gap. Vehicles from other routes in the same lane keep their distance too.
  - **Pavements:** people stay within about 65 m of the player. Friends walk in twos and threes, school children in threes and fours, and about 30% stand chatting.
  - **Hawkers in traffic:** hawkers (and some kayayei) walk along the middle of the main roads between the queuing cars.
  - **Limits:** people 110 / 320 / 560 and vehicles 70 / 150 / 260 (Light / Standard / Ultra).
  - **Automatic step-down:** every 2 seconds, below 26 fps the game shows 25% fewer people and vehicles (down to a fifth). Above 48 fps it brings them back. The debug line shows "busy %". `?full` turns this off for testing.
  - **Cloud check at full busy-ness (`?full`):** about 186,000 triangles on Light and 479,000 on Standard, with no errors and the main game clean. On a cheap phone the automatic step-down will likely lower this; the "busy %" number will show by how much.
- **Busy city pass (2026-10-24):**
  - **Crowds** (`src/game/crowd.ts`): hundreds of people, drawn in one batch per body (man, woman). Their walk, idle and talk moves are worked out once at the start and stored in a small texture, and the graphics card animates everyone from it. The kinds of people:
    - everyday men and women;
    - Muslim men in pale kaftans and white caps, and Muslim women in headscarves and long dresses;
    - people in church clothes;
    - children, and school children in mustard-and-brown uniform walking in groups of three or four;
    - kayayei with aluminium basins on their heads, and hawkers with trays.

    They walk both ways along the pavements and stand chatting at kiosks and umbrellas. Most stay within about 90 m of the player. The models are `person-mass.glb` (about 900 triangles) and `person-female-mass.glb` (about 1,300, after a lighter skirt). Numbers: 80 / 200 / 400 people (Light / Standard / Ultra).
  - **Traffic** (`traffic.ts`): from 420 vehicles to about 20,000, one every 20 to 40 m on every route. Each route has its own pace. A vehicle is just "route plus slot", so nothing is stored per vehicle, and only the stretches of road near the player are worked out. New kinds, all built in code: okadas with riders (about 15% of traffic), buses, cargo trucks with wooden sides, pickups and SUVs. Every vehicle keeps a gap to whatever is ahead in its lane, even on another route, so queues form instead of overlapping. Draw limits: 30 / 80 / 160 (raised from 15 / 40 / 100; batching keeps it cheap).
  - **Sky** (`src/game/sky3d.ts`): 3D jets on the same Kotoka arrival and departure paths as the overview map, and three helicopters circling over Circle, Makola and Ridge.
  - **Looking around:** drag on the right side of the screen (or anywhere with the mouse), or use the right stick, to turn and tilt the view up to the sky. It settles back behind you after a moment.
  - **Cloud check:** about 124,000 triangles on Light and 303,000 on Standard, with no errors and the main game still clean. This is heavy: if the cheap phone is slow, lower Light's people (80) and vehicles (30) first.
- **Street quality pass (2026-10-24):**
  - **Buildings** (`src/game/streetBuildings.ts`): the buildings near the player are real 3D, built from the same map tiles (nothing new to download). They use the map's Accra wall and roof colours and its guessed heights. The shader draws shop shutters, doors, framed windows and louvres floor by floor, with dust near the ground. The map's own blocks are switched off at street level. Building is spread over frames (5 ms each), so new streets don't make the game stutter. You can no longer walk or ride through walls; you slide along them.
  - **Ground** (`src/map/streetStyle.ts`): roads are their real width in metres (major roads 10 m, minor roads 6.5 m), with pavements, open gutters, kerbs and a dashed centre line on two-way main roads. The ground is dusty laterite, and the floating labels (house numbers, road names, icons) are switched off, which also stops them flickering.
  - **Street life** (`src/game/streetLife.ts`): neem trees, coconut palms, street lights along the main roads, painted container kiosks, vendors' umbrellas with tables, and black polytanks on about a third of the roofs. All are placed from the real roads, never on a road or inside a building. Men and women walk along the pavements or stand chatting, using light crowd models (`person-crowd.glb`, `person-female-crowd.glb`). Far ones animate at half rate.
  - **Vehicles:** vehicles on the same route now share its speed and are spaced evenly, so they never drive through each other. This also improves the overview map's traffic. Near the player, a vehicle stops when you stand in its lane, the ones behind keep a gap, and the driver hoots after a moment. Then they catch up gently.
  - **Light phones:** the player uses a lighter model with every move (`person-lite.glb`, about 6,000 triangles).
  - **Limits:** people 5 / 12 / 24, props within 140 / 200 / 280 m, buildings within 220 / 320 / 450 m (Light / Standard / Ultra).
  - **Cloud check:** about 46,000 triangles on Light and 93,000 on Standard, with no errors. The frame rate must be measured on the phone.
- **Screen layout (2026-10-24, landscape):**
  - On phones, "Tap to play" goes full screen and locks the screen sideways where the browser allows it (Android Chrome). Held upright, a "Turn your phone" card covers the game (iPhones cannot be locked).
  - Bottom left: a round minimap with a kente energy bar under it. It is drawn from the street data the map already loaded (roads, water, parks, buildings), so there are no extra downloads. It turns with you, shows north, and marks the okada.
  - Left half: a floating joystick. Touch anywhere and drag; it follows your thumb if you go past the edge.
  - Right side: round icon buttons that change with what you're doing. On foot: sprint (hold) and jump, plus the okada button, which pops up only when you're next to the bike. On the okada: brake (hold), horn and get off.
  - Top left: the phone button (coming soon). Top right: time and money.
  - Keys: W A S D move, Shift sprints, Space jumps, F gets on and off, H sounds the horn.
  - Controllers: left stick moves, right and left triggers accelerate and brake, A / ✕ jumps, B / ○ sprints, Y / △ gets on and off, and pressing the left stick sounds the horn.
  - New code: `src/hud/minimap.ts`, `src/hud/touchControls.ts` and `src/hud/landscape.ts`, ready to move into the main game.
- **Look:** an evening Accra sky, warm light, a soft shadow under the player. At street level the roads are tarmac grey with kerbs and the ground is dusty, instead of the bright overview colours. Road widths keep growing past zoom 18, so roads stay the right size up close.
- **Traffic (3D, 2026-10-24):** at street level the traffic is now real 3D vehicles built in code (`src/game/vehicles3d.ts`): private cars in several colours, yellow Accra taxis with a red band and roof sign, white trotros with side windows, a stripe and a roof rack, and pragya tricycles with a driver. They turn smoothly at bends and bounce slightly, with soft shadows. They follow the same shared clock as before (`loadTraffic()` in `traffic.ts`), so every phone sees the same vehicles. Each kind is drawn in one batch: about 10 draw calls for up to 100 vehicles. The limits are 15 on Light, 40 on Standard and 100 on Ultra, within 260 m. The overview map still uses its blocks.
- **Assets:** `public/models/person.glb` (550 KB), a Ghanaian man in a T-shirt, trousers and trainers, with 14 animations. It's built from Quaternius' free CC0 packs by `scripts/person` (see its README). The source and licence are in `public/models/LICENSES.md`. The okada is built in code, so there is no file to download.
- **People in code** (`src/game/person.ts`): one shared model and one shared shader for everyone. Skin tone, shirt, trousers, shoes and hair colours are numbers, so crowds can all look different at no download cost. Moves ready: idle, walk, jog, sprint, ride, sit, talk, dance, interact and jump. On the okada the rider uses the riding animation with the knees opened, and sits exactly on the seat.
- **Man and woman:** `person.glb` (550 KB) and `person-female.glb` (580 KB). The woman wears a T-shirt and a flared midi skirt that swings with her legs. Each file downloads only when needed. `/street-test.html?female` plays as the woman.
- **People test page:** `/person-test.html` shows two men and two women in different outfits.
- **Size:** the page's own code is 25 KB gzipped, and three.js is 144 KB gzipped (the same as /char-test.html).
- **Test hooks:** `?debug` shows the frame rate and triangle count, `?auto` rides and walks by itself and writes the result into the page, and `?tier=light|standard|ultra` forces a tier.
- **Cloud check (software graphics, no GPU, so the numbers are not the phone's):**
  - It loads with no errors.
  - The scene is about 24,000 triangles with 40 vehicles (the person is about 15,000 of them).
  - 8–11 fps under software drawing.
  - Screenshots look right on foot and on the okada.
- **Known limits:**
  - Crowds still need a lighter version of the people.
  - Vehicles don't yet react to each other at crossings, and nothing reacts to being touched (no crashes or knock-downs).
  - Light tier shows flat buildings, which look poor at street level. If the cheap phone gets Light, street view will need low walls in Light (decide after the phone test).
- **Done when:** on the cheapest Android, `/street-test.html?debug` shows 30 fps or more while walking and riding round Circle, and the controls feel right.

- **Phone controls redesign (2026-10-25, owner's layout):**
  - Minimap moved to the top left, inside an energy ring (gold, turns red when low). Beside it: a small energy number (tap for the "You" card: energy, Vibe, Sika, heat stars; Tab on a computer) and the goal line.
  - Joystick rests bottom left, where the map was. Sound, phone, time and Sika are top right.
  - One gold **action button** that changes with what is next to you: Ride, Get off, Greet, Chat (sellers answer), Sit (on empty chop bar chairs, the player really sits), Dance (at music kiosks), Stand / Stop. Keys: E or F; controllers: X / □ or Y / △. It replaces the separate okada and exit buttons.
  - Real energy (brief 11.3): sprinting uses it; sitting brings it back fast, standing slowly; at zero you cannot sprint and walk a little slower. Vibe grows from greeting and dancing.
  - First goals that teach the game: get on the okada, ride 300 m, greet someone, rest on a chair, dance where music plays (+2 Vibe each, "Goal done!" message).
  - Computers and big screens: the round touch buttons are hidden (the keyboard does them), the action button shows as a prompt with its key, and the map, chips and text are larger on screens 1200 px and wider. Checked at 844×390 (phone sideways), 1366×768 and 1920×1080.
  - Sika on this page is still the demo number; real money will come from the server.
  - **Done when:** on the phone, the map is at the top, the joystick is bottom left, the gold button shows RIDE beside the okada, GET OFF while riding, and SIT / GREET / DANCE at chairs, people and music; on a computer, E does the same.

- **Story opening and fixes (2026-10-25, owner's playtest):**
  - **Start screen** (brief 5.2, short version): "You are" (a woman / a man) and hometown (Ada, Ho, Kumasi, Tamale, Cape Coast, Koforidua, Surprise me); the title updates ("From Kumasi to Accra"). Remembered on the phone for next time.
  - **Opening film made in the game** (`src/hud/cinema.ts`: black bars, title cards, subtitles, caller card, Skip): your hometown at dawn, Grandma's ₵50 and "Go and make us proud", the bus mate's "Accra! Accra!", then the camera comes down out of the sky over the real Accra map to Circle.
  - **First story mission** (brief 7, steps 1 to 4): a boy in red snatches your bag (₵50 to ₵0); "Catch the thief!"; he weaves through the crowd and traffic and gets away; "Find the kelewele auntie" (gold marker and minimap dot); TALK opens a side-on film scene; she calls Uncle Kwame ("Stay there. I'm coming."). Then the free-roam goals start. `?nostory` skips it.
  - **You can't walk or ride through things:** vehicles, buildings, kiosks, trees, poles and tanks are solid; a vehicle that moves into you pushes you aside; riding into something stops the okada with a buzz. Test: walking at a car for 8 s, 0 frames inside it.
  - **No more floating cars:** vehicles are only drawn on streets drawn at ground level (the route data includes Circle's flyovers and slip roads, which looked like cars crossing open ground). Vehicles at crossings now wait for each other instead of driving through.
  - **Fewer people and vehicles:** walkers 60 / 170 / 300 (was 110 / 320 / 560), vehicles 40 / 90 / 150 (was 70 / 150 / 260).
  - **You start on the pavement**, not in the road.
  - **Sound:** phones only allow sound after a finger lifts, so the sound now starts on any tap (and retries until it runs). The okada horn goes through the same sound and the mute button.
  - **Buttons:** the bottom horn button is gone (it looked like a second volume button). RUN, JUMP and BRAKE carry a word and show only when useful.
  - **Done when:** on the phone the film plays from the start (or Skip), the bag is snatched, you chase, find the auntie and hear Uncle Kwame; you cannot walk through cars or buildings; the street sound plays after the first tap.

- **Automatic updates, real vehicles, people wait for cars (2026-10-25):**
  - **Automatic updates** (`.github/workflows/deploy.yml`): every update saved to GitHub goes to the test link https://ghana-life-test.ghana-life-web.workers.dev/street-test about 5 minutes later. The players' link only changes when the owner presses Run workflow with "live". The map data is copied from the live site and kept between runs. Needs the two secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in GitHub (owner's step).
  - **Real-looking vehicles:** cars (wagon, sedan, hatchback), Accra taxis (body colour with yellow front and back corners), trotros (van) and trucks are now textured models from the free PSX Style Cars pack (CC0), repainted in 24 paints by `scripts/vehicles`. About 300 to 480 triangles each, 600 KB in all, downloaded after the game starts. Pickups, buses, pragyas and okadas are still built in code.
  - **People wait for vehicles:** a walker or hawker whose path is blocked by a vehicle stands still (idle) until it passes, and steps aside if it comes right up to them. Check: 155 walkers and 88 vehicles, 0 people inside a vehicle over 12 seconds.

## Waiting on the owner

- Deploy first (the live site has none of the street work yet): `git pull`, `cd apps/web`, `npm install`, `npm run deploy`. Then the street test on the cheap Android: open `/street-test?debug`, tap to play with the phone sideways, walk, sprint, jump and ride for a minute, and report the fps number and how the controls feel.

- Two-device test for T4 (phone and PC see each other walk).
- Phone checks: map load time and smoothness, tap to walk, chat.
- Test 1b result from the cheapest Android available (/char-test.html).
- Test phone memory and cores (/device.html), and the mobile network for R3.
- Native-speaker check of the Twi and Fante greetings, and the Pidgin, Twi, Ga and Ewe word lists.
- GitHub repository visibility: make it private.
