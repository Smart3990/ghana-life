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

- **Opening film with real-looking people (2026-10-25):** the opening's text cards are replaced by four film pictures made with ImagineArt (Grandma at dawn in the village, her hands folding the ₵50, the bus mate shouting "Accra!", arriving at Circle), each with a slow camera move, black bars and subtitles, then the 3D fly-down to Circle. 330 KB in all, downloaded only for the film. ImagineArt video clips need a paid plan, so the movement is made in the page.

- **Traffic lights, zebra crossings, modern cars and Mission 1 (2026-10-25, owner's playtest):**
  - **No okada in the story:** you arrive with nothing, so the okada is gone (it stays for tests with `?okada` and `?auto`). The first free-roam goals are now: greet someone, rest on a chair, dance.
  - **Traffic lights and zebra crossings** (`src/game/signals.ts`): every junction where a main road meets another road (found from the map's roads, 119 around Circle) gets a zebra on each arm and a light on a pole at the kerb. The lights run on the shared clock (36 s cycle: 14 s green, 3 s amber, then red while the other road goes). Vehicles drive up to the stop line and wait on red and amber.
  - **You start on the pavement beside a zebra and its traffic light**, so the first thing you see is the traffic stopping at the lights.
  - **Mission 1, "Find the kelewele auntie":** mission card, then Auntie Akos's own stall (umbrella, table, coal pot of kelewele, two plastic chairs) is placed across the road from the nearest zebra. When you're near the zebra and the cars have a red light: "The light is red: the cars have stopped. Cross now on the zebra." She calls "Hey! My son! Come, come here!" (or "my daughter") as you approach. TALK sits you on her chair and plays the film script's conversation, including "Eat small" and "Accra will not swallow you". Then the AYEKOO! banner: Mission 1 complete (+5 Vibe), and the chapter card.
  - **Modern cars:** sedans, hatchbacks, SUVs, pickups, trotros (van), buses and trucks are now modern models from the free Low Poly Vehicles Pack by Rgsdev (CC0), sized to Corolla, Vitz, RAV4, Hilux and Hiace dimensions, about 1,400 to 1,800 triangles each, 150 KB for all seven. Accra taxis: any body colour with yellow front and back corners. The older PSX cars are removed.
  - **Fewer vehicles:** 30 / 65 / 110 (was 40 / 90 / 150).
  - **Sellers beside the road, never on it:** hawkers no longer walk down the middle of the road, and kiosks, stalls and trees placed before a road had loaded are removed when that road arrives.
  - **Done when:** after the film you stand beside a zebra; the light turns red and the cars stop; after the chase the mission card appears; you cross at the zebra, the auntie calls you, TALK plays the conversation, and AYEKOO! shows Mission 1 complete.

- **Nobody stands in the road, and anyone you meet talks with you (2026-10-25):**
  - Lanes, service roads and flyovers are now known to street life too (they only keep the tarmac clear: no traffic or pavements on them), so stalls, kiosks and trees are never on them.
  - People at places (sellers, customers, people on chairs, dancers) are never put on a road or in a wall; chairs too. Dancers and the music spot stand closer to the kiosk. Check: 17 people at places, 0 on a road; 0 umbrella stalls on a road.
  - **Talk with anyone:** GREET works on everyone on the pavement as well as people at places. They stop, turn to you and talk (the walk turns into a talking pose), and you have a short conversation in bubbles over your heads. What they say depends on who they are: Muslims ("Salaam alaikum" / "Alaikum salaam"), church people ("God bless you"), school children, kayayei, hawkers, sellers, and everyday Accra chat ("Chale, how far?", directions, "hold your pocket well"). Walking away ends it.
  - The player is never moved for them once they have started moving (the start-on-the-pavement check stops then).

- **The owner's film clip and Accra paint jobs (2026-10-25):**
  - **Film clip in the opening:** the owner's 10-second ImagineArt clip (waking up, Grandma, the ₵50 and her letter, the bus leaving) now plays in the film with subtitles, in place of the first three pictures. Shrunk from 4 MB to 640 KB (854×480), in MP4 and WebM so every phone can play it; it starts downloading on the START tap and is unlocked by that tap so it plays with its sound. Light phones, Data Saver and 2G/3G connections keep the moving pictures (330 KB). If the clip is not ready within 4 s, the pictures are used.
  - **Vehicles painted like Circle** (from the owner's Circle photos): taxis in dark body colours with orange-yellow front and back corners and a yellow roof sign; trotros white on top with a yellow stripe and a white or blue lower body; buses in Metro yellow with a blue and red stripe; pickups loaded high with wooden crates. The pack's truck (a tractor unit) is dropped; the cargo truck built in code stays.

- **Circle looks like Circle (2026-10-25, from the owner's Circle photos):**
  - **The Kwame Nkrumah Interchange in 3D** (`src/game/flyovers.ts`): every road the map marks as a bridge becomes a concrete flyover about 7 m up, with low walls along both edges and round pillars every 24 m, sloping down where it ends. Nothing drives on it yet (scenery).
  - **Electricity poles and wires** along one side of every street: concrete poles with crossbars every 30 m or so, three sagging wires between neighbours (about 2,500 poles around Circle, wires drawn only near you).
  - **Billboards** along the main roads, on two legs behind the pavement, with the game's own made-up adverts (Sika Mobile Money, Auntie Akos Kelewele, Verse FM, Ghanaverse, Akos Pure Water). These are the in-world ad spaces of brief 18.1, ready for real advertisers later.
  - **Motor kings:** half of the tricycles are now cargo tricycles (mostly orange) loaded with sacks and a crate.
  - Real photos from the internet are used only to look at, never put into the game, unless their licence allows it (CLAUDE.md rule); the owner's own photos and paid, licensed photos can be used and recorded in LICENSES.md.

- **Traffic rebuilt: on the streets, joined up, no flicker, and on the flyovers (2026-10-25):**
  - **New street network** (`src/game/streetNetwork.ts`): traffic now drives only on the streets the map draws, tile by tile. Streets are cut at junctions, and at every junction each way in is matched with a different way out (straight on where possible, round the corner otherwise, never a U-turn). Following those gives closed loops round the blocks and a few open routes; every street, each way, belongs to exactly one route, so routes never overlap. The old long routes (from a separate road file that didn't match the drawn streets) are no longer used at street level, and nothing U-turns at the end of a street any more.
  - **No flicker or jumping:** a vehicle that has to wait (red light, the player in the lane, something ahead) now simply stops where it is; it never jumps backwards and catches up gently. Each tile's streets are added once (no doubled vehicles). When the phone struggles, the same vehicles always go (by their number) instead of the far ones flickering.
  - **Vehicles on the flyovers:** the bridges are part of the network; vehicles on them drive at the deck's height (about 7 m), faster and further apart, and ignore the lights and people below.
  - **Fewer, steadier vehicles:** spacing set so the vehicles near you stay under the drawing limit (Light about 32 within 90 m, Standard about 90 within 130 m), so nothing appears or vanishes close by.
  - **Simpler zebras:** traffic lights only where two main roads meet (one set per 60 m), and zebra crossings only across the main road.
  - **Check (Light, 120 frames):** 0 vehicles off the road, 3 vehicles vanishing within 60 m (route ends at the tile edge), no doubled vehicles; about 11 vehicles on the flyovers at 4 to 7 m.

- **Our own Accra trotro and taxi models (2026-10-25):** `scripts/vehicles/build_ghana.py` builds, from code, a Hiace-type trotro (cab over the front wheels, high roof, row of side windows with pillars, sliding door line, roof rack with a load, big bumpers) and a Corolla-type four-door saloon (used for most cars and every Accra taxi), shaped after the owner's Circle photos, with no badges or brand names. About 750 to 880 triangles and 11 to 13 KB each. Paint jobs as before: trotros white on top with a yellow stripe and a blue or white lower body; taxis with orange-yellow corners and a yellow roof sign. The pack's van and sedan files are removed. Internet photos were used only as a reference to look at.

- **More Circle vehicles, billboards across the city, the big screen (2026-10-25):**
  - Five more vehicles of our own (scripts/vehicles/build_ghana.py), shaped after the owner's Circle photos: Sprinter-type trotro (a third of trotros), Metro-type city bus (yellow with blue and red stripes), Picanto / Vitz-type small car (a third of cars), Hilux-type double-cab pickup (with crates), Tata-type cargo truck (wooden body, tarpaulin load). 660 to 880 triangles each; all eight vehicle files are 92 KB together. Only the SUV is still from the Rgsdev pack.
  - **Billboards across the whole city** (brief 18.1): about every 65 m along main roads and now and then on side streets, at least 30 m apart, tried at three distances back so they fit where buildings are close (about 480 in the loaded area, 31 within 300 m of the start). Drawn from up to 320 m away, since they stand tall. Eight placeholder designs: Sika Mobile Money, Kelewele at Circle, Ghanaverse FM, Ghanaverse, Cool Sachet Water, "Your ad here" (from ₵35 a week), Ghanaverse News, Tonight in Ghanaverse.
  - **The big screen at Circle** (brief 17, `src/game/bigScreen.ts`): a 12 m LED screen at the billboard spot nearest the middle of Circle, rotating Ghanaverse News, Most Wanted, an advert and Tonight in Ghanaverse every 7 s.

- **No vanishing vehicles, moving adverts, more kinds of billboards, road signs (2026-10-25, owner's request):**
  - **Vehicles never vanish:** at dead ends and at the edge of the loaded streets, vehicles now make a smooth U-turn (about 6 m, into the other lane) instead of disappearing, so every route is a closed loop. Vehicles are drawn further (140 / 180 / 230 m) and the limit is well above what is ever near you, so none pop in or out close by. Check (Light, 120 frames): 0 vehicles vanishing within 110 m, 0 off the road.
  - **More vehicles:** spacing tightened (about 70 drawn on Light, 150 on Standard).
  - **Adverts on vehicles** (brief 18.1): 8 in 10 trotros, Sprinters, buses and trucks carry a long advert along both sides (six placeholder designs from one picture, chosen by the vehicle's number, so it is the same on every phone). Taxis have a "TAXI" roof sign.
  - **More kinds of billboard, never on the road:** roadside billboards now turn a little towards the oncoming traffic; rooftop billboards on buildings beside the main roads, facing the road; rows of small poster banners on poles along the kerb of main roads; long banners along the sides of the flyover decks ("No fees. No stress.", Ghanaverse FM, "Your ad here"); and up to five more LED screens along the main roads that work like video screens (pages slide in, a news ticker scrolls, a LIVE light blinks; redrawn only within 220 m, 4 times a second on Light).
  - **Road signs:** green street-name plates on poles with the real street names from the map and the area underneath (for example "J.A. Kufuor Link"), and big green direction signs before the main junctions pointing to the nearest areas each way ("← Kokomlemle ↑ Asylum Down → Adabraka"). Seven more area names added (Tesano, Alajo, Achimota, Lapaz, Abossey Okai, Odorkor, Dzorwulu).

- **Packed Circle: full vehicle wraps, shops everywhere, the trotro station, school bags (2026-10-25, owner's request):**
  - **Full vehicle wraps:** the adverts on trotros, Sprinters, buses and trucks now cover the whole side over the windows, from just above the wheels to the roof line, and change every 8 seconds (each vehicle at its own moment), like a moving screen. Advertisers' own adverts can be added in `public/data/ads.json` (title, line, two background colours, accent) without changing the game; up to 8 show at once, with the placeholders filling the rest.
  - **Shops everywhere:** roadsides are filled on both sides about every 9 to 10 m: rows of container shops up to five deep where there is open ground, market umbrella stalls behind the pavement, umbrella stalls and **phone stands** ("Circle boys" selling phones, chargers and earpieces, calling "Phones! Phones!", "Charger, earpiece, power bank!") on the pavement's edge. Things nearest the player are always drawn first.
  - **The trotro station** (`src/game/trotroStation.ts`): found once on open ground near Circle, facing the road: a red-earth yard, 15 parked trotros and Sprinters in three rows (with their adverts, and solid), a long shelter with benches and waiting passengers, bus mates calling their destinations ("Kaneshie! Kaneshie!", "Madina, one more, come!"), hawkers between the rows, and a green CIRCLE LORRY STATION sign.
  - **More people:** walkers 95 / 250 / 480 and people at places 36 / 80 / 130 (was 60 / 170 / 300 and 20 / 44 / 70). School children always carry a school bag on their back, and about one grown-up in five a backpack.
  - **The kelewele seller is now Auntie Dede** (added to the brief's cast), so she is not confused with Auntie Akos the news presenter.
  - Triangles: Light about 300,000 with everything near (was about 222,000). The automatic busy % thins the walkers on phones that struggle; this must be checked on the cheap Android.

- **Real voices and conversations (2026-10-25, owner's request):**
  - **Voices** (`src/game/voices.ts`): people now speak out loud, using the phone's own text-to-speech (nothing downloaded, no data used). It picks the closest accent the phone has (Ghanaian English, then Nigerian or other African English, then British); each person has their own pitch and speed; Ghanaian words are spelt the way they sound ("Chale" is said "Cha-lay", "Akwaaba", "Kaneshie", "trotro", cedis). Quieter further away. The sound button mutes voices too.
  - **The street talks:** mates of passing trotros shout their routes ("Circle! Circle! Circle!", "Accra! Accra!", "Kaneshie, one more, come!", "Madina! Straight!"), the station's bus mates call their destinations, sellers and Circle boys call out as you pass, and people walking by chat ("Chale, the traffic today!", "I am coming, I am coming!"), each with a bubble.
  - **Conversations with questions** (`src/game/talks.ts`): GREET or CHAT starts a real exchange. You say hello, they answer and usually ask you something ("You look new here. Where are you from?"); you pick an answer from 2 or 3 buttons (or 1, 2, 3 on a keyboard); they reply, and some go on to a second question. Each kind of person has their own talks: Muslims, church people, school children, kayayei, hawkers, sellers, phone sellers ("My phone was stolen. How much is a new one?"), bus mates ("How much to Kaneshie?"). Your hometown and day name come into it ("Ada! Akwaaba to Accra."). Walking away ends it.
  - **The film's lines are spoken too:** Grandma, the bus mate, Auntie Dede, Uncle Kwame and you.
  - **Recorded voices later:** any line can be replaced by a real recording (brief 15.3) by putting `/voices/<line id>.mp3` in `public/voices` and listing it in `public/voices/index.json`. ImagineArt's voice generator needs a paid plan, and its voices are American or British only, so it was not used.

  - **You always see yourself** (`src/game/cutout.ts`): when a kiosk, shop, umbrella or building stands between the camera and you, a soft hole opens through it so you stay in view.
  - **Real places where they really are** (`src/game/places.ts`): the map's own points of interest become things in the street. A filling station on the map becomes a filling station there (canopy, pumps, shop, price board, fictional brand "SIKA OIL"); bus stops get shelters; banks, ATMs, pharmacies, churches, mosques, schools, clinics, hotels, chop bars, salons, markets, police, supermarkets, Mobile Money, phone shops and more get their sign at their real spot (fictional names only). Test: 4 filling stations, 19 bus stops, 105 signs around Circle.
  - **The bag snatch:** you hold your bag in your hand; the thief runs up, grabs it out of your hand and runs off with it while you stand watching.
  - **Billboards like video** (`src/game/adScreens.ts`): roadside, rooftop and kerb boards slide to a new advert every few seconds, each board at its own time. Every board has a front and a back, so you see adverts from both directions. Bus, trotro, sprinter and truck wraps change too and now have a back panel.

  - **The big map** (`src/hud/fullMap.ts`): tap the round minimap (or M on a keyboard) to open the whole map of the area: real streets and area names, a blue arrow for you, the gold star for your goal, and a pin at every real place found (filling stations, bus stops, the lorry station, banks, ATMs, chop bars, markets, pharmacies, clinics, churches, mosques, schools, shops, police). Filter chips (Fuel, Transport, Food, Money, Health, Worship, School, Shops, Safety); tap a pin for its name; drag and pinch to look around; "You" brings you back. A note says more of Ghana opens up with the story. The second map exists only while open.
  - **The phone** (`src/hud/phone.ts`): the phone button (or P) slides up a phone in the Royal Kente colours, with the brief's apps: **Missions** (what to do now, the prologue, Mission 1 and the six Chapter 1 missions, locked until the story reaches them), **Map**, **Ride** (pick a place: it is marked on both maps with a guide fare; drivers come later; fares are set by the server), **City Feed** (city news from fictional people and businesses; a red dot shows new posts), **Calls** (Uncle Kwame, Auntie Dede, Grandma and Ride Help answer with their voices and give you 2 or 3 answers to pick), **MoMo** (your Sika wallet and history; sending and paying open with Mission 2), **Friends** (add, Meet up and voice calls, when the city goes online) and **Settings** (sound, picture quality, themes). No email or messages app (brief 21).

  - **Camera keeps you in view without cutting anything** (the see-through hole is gone): when a kiosk, shop, umbrella, building, bus or flyover deck is between the camera and you, the camera swings round to the nearest clear side (all the way to your front if needed), rises to look down, or comes in closer; when the view behind you is clear, it swings back.
  - **Cars never pass through each other:** a last check every frame stops any vehicle whose body would touch another (turning, merging, at U-turns). Waiting vehicles are now held back fully on slow phones (they used to creep forward), and a vehicle held back stays drawn where it really is (no vanishing). Test: 0 overlaps and 0 vanishing on Light and Standard.
  - **Standing in the road:** vehicles stop and never hit you. The mate or driver shouts at you ("Chale, comot for road!", "Jimmy! Move from the road!", "Mepa wo kyew, twe wo ho!"), then hoots again and again; after about 7 seconds, some drivers get down, walk up and push you to the pavement ("Massa, I beg, go side!"), then get back in and drive on.
  - **The big map is animated:** it flies down from above Accra to you; 3D buildings on Standard and Ultra; pins drop in rippling out from you, coloured by kind; live traffic moves on it; your goal pulses; a marching route line runs along the real roads to the goal; a card shows where you are and how far the nearest filling station, bus stop, chop bar and bank are. The base map's real business names are hidden (our pins only). The street behind slows to 8 updates a second while the map is open.
  - **Every real place gets built:** places that cannot be placed at once (their road not loaded yet, a tight spot) are tried again every 3 seconds; filling stations try a smaller roadside size and slide along the road; places on side streets now count; duplicates are only the same kind. New signs: STUDIO, CAR SALES, PUBLIC TOILET, TAXI RANK, CAR WASH. Test: 18 of 19 filling stations built (was 4); near Circle 44 of 57 map points built, the rest are trees, monuments, crossings and parking.
  - **Voice script** (`docs/VOICE_SCRIPT.md`, made by `npm run voices` in `apps/web`): all 227 spoken lines grouped by who says them, each with its file name. Recordings named that way go in `apps/web/public/voices/`; `npm run voices:index` lists them and the game plays them instead of the phone's voice.
  - The phone stays open for testing; later it unlocks when Uncle Kwame buys you one (Mission 2, "Get Connected").

  - **New billboards** (`src/game/adPosters.ts`): a wide 16:9 screen (7.2 x 4.05 m) in a thick dark frame on two strong legs, lower so it reads from the street, two-sided, bright like a screen, still sliding to a new advert every few seconds. The adverts look like real campaigns: a photo (our own, made with ImagineArt: a woman with her phone for Sika Mobile Money, Auntie Dede's kelewele, a dancer for Ghanaverse FM, a market woman with sachet water; 104 KB in all) or a bold graphic, the brand badge, a big headline, a line, a button, an AD tag and the kente strip. Fictional brands only. Smaller advert sheet on Light phones.
  - **Billboards on the big map:** each shows its advert on two little legs; a few spread out on "All", every one under the new 📺 Ads filter.
  - **Lines said to you fit you:** a woman player hears "my daughter", "my sister", "Madam", "Sista"; a man hears "my son", "my brother", "Massa", "Bra" (`src/game/address.ts`), in the street, in talks, from drivers and on phone calls. The voice script lists both versions (244 lines).

  - **The chase:** when the boy snatches the bag, you run after him at once (the story runs you, the buttons step aside). He darts across the road; a taxi cuts across right in front of you and brakes hard ("Ei! Madam/Massa, watch the road!"); you run round the back of it, and he is gone down the far pavement. Then "You lost him" and Mission 1.
  - **Auntie Dede's scene, redone:** story people are always in full detail and the picture is sharper during scenes; the camera cuts between a side shot and close shots aimed at faces. You sit and tell her what happened (talking with your hands), hand her the slip of paper with Uncle Kwame's number, she puts her phone to her ear and calls him ("Okay, no problem. Tell him/her to stay there. I am coming very soon."), then she hands you a wrap of hot kelewele and you eat it standing at her stall.
  - **Uncle Kwame arrives:** "Forty minutes later…", his dark blue car comes along the real road and stops at the stall (traffic queues behind it); he walks over, thanks her, hands her money, and calls you by your day name. You both walk to the car.
  - **The ride home (about 14 seconds):** through the real streets, looking out of your window from your seat, then from behind the car in the traffic, while Uncle talks to you.
  - **Uncle Kwame's compound house** (`src/game/compound.ts`, our own design): walled yard, blue gate, five rooms under a tin roof with a veranda, kitchen corner, water drum, poly tank on a stand, washing line, mango tree, bench and chairs. It is placed on open ground with its gate to the road. "Chapter 1 · From Ada to Accra", Uncle welcomes you, and the goal is to walk into the compound.
  - **Tap a vehicle with an advert:** it stops (up to 30 s), the mate calls to you, and a card shows its advert, the price (₵250 a week, trotro route pack; brief 18.2) and "Put your advert here".
  - **Tap a billboard on the big map:** its card with the advert, the price (₵350 a week) and "Put your advert here".
  - **Put your advert here:** business name, big and small words, button, your own picture and colours; a live preview, then "Preview it in the city" shows it on that space for you only. Paying and going live come with the server and the advertiser page; phone numbers and links are taken out of the words.
  - The character models already had more moves; now used: talking on the phone, eating, pushing (the driver who pushes you aside), talking in a chair, picking up, nodding.
  - Story timers now count game time, so slow phones see the same scenes, not cut short.

  - **The big map is locked to Circle:** only the Circle area (about 1.1 km round) is open; the rest of Accra is greyed out behind a gold dashed edge, its area names marked "🔒 Opens later in the story", and you cannot pan far past the edge. Pins and billboards show only inside the open area; zoomed far out, the pins hide so the map stays clear.
  - **Real vehicles on the map:** every vehicle is drawn from above in its real shape and colours (blue saloons, white taxis with yellow corners and the roof sign, trotros with luggage on the rack, green and yellow buses, trucks with their load, tricycles, okadas with the rider), turned the way it drives, gliding smoothly between updates.
  - **The player card on the map:** your day name and hometown, where you are, energy, Vibe and Sika, the nearest filling station, bus stop, chop bar and bank.
  - **Who the mission sends you to:** the target on the map is the person (Auntie Dede, kelewele seller at Circle; Uncle Kwame at his compound house) with her picture-sign, name, role and pulsing rings; the card says "MISSION 1 · Meet Auntie Dede, 120 m away"; the red route runs along the roads to her; the minimap shows her too.

## Waiting on the owner

- Deploy first (the live site has none of the street work yet): `git pull`, `cd apps/web`, `npm install`, `npm run deploy`. Then the street test on the cheap Android: open `/street-test?debug`, tap to play with the phone sideways, walk, sprint, jump and ride for a minute, and report the fps number and how the controls feel.

- Two-device test for T4 (phone and PC see each other walk).
- Phone checks: map load time and smoothness, tap to walk, chat.
- Test 1b result from the cheapest Android available (/char-test.html).
- Test phone memory and cores (/device.html), and the mobile network for R3.
- Record the voice script (docs/VOICE_SCRIPT.md) with Ghanaian speakers who agree in writing.
- Native-speaker check of the Twi and Fante greetings, and the Pidgin, Twi, Ga and Ewe word lists.
- GitHub repository visibility: make it private.
