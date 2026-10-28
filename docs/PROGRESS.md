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

  - **Advertiser steps** (tap a billboard on the map or a vehicle with an advert, then "Put your advert here"): 1 Space (how many weeks, launch offer: first week free for small Ghanaian businesses, the total), 2 Design (upload your own finished flyer, shown whole or edge to edge; or the Ghanaverse design with your words, your product photo shown whole or filling the board, and colours), 3 Contact (phone, WhatsApp, website or Instagram; phone shown on the advert if you choose), 4 Check and pay (summary, Mobile Money or card). Phone numbers and links are allowed on adverts. "Preview it in the city" shows it on that space for you at any step. Tapping your advert later gives Call, WhatsApp and Website buttons. Pictures are made smaller on the phone before use. Paying is not switched on yet: the request is kept on the phone with a reference (GV-…) and the card says so plainly; payments and going live for everyone need the server and a payment account.

  - **The snatch, redone:** you stop with both hands on your head ("Hey! My bag! Thief!"; the arms are aimed by code, as there is no clip for it), then run after him shouting ("Thief! Thief!", "Stop him!"). When the road is just ahead, a taxi comes along the road itself (never out of a wall) and brakes across your path; you dodge round it and he is gone.
  - **Uncle Kwame takes you home to Nima:** he parks at the stall, pays Auntie Dede, and you both walk to the car (he to the driver's door on the left, you to the passenger door) and get in. The 15-second ride is filmed from your seat inside the car: out of the right window, through the windscreen, then out of the left window, while you two talk ("Uncle, is Nima far?"). Then Nima (5.5813 N, 0.1982 W): the city there loads behind a title card and the compound house is placed on a plot by a road; the map's buildings on that plot and a small forecourt are cleared, and shop signs there removed. Nima opens on the big map (Circle and Nima open now).
  - Scenes are lighter: no extra sharpness on Light, a little (at most 1.5) on Standard and Ultra.
  - Camera fix: it worked out its distance from a measurement that is wrong when already zoomed in, and once boxed in it kept the "high and close" view for good. Now it uses the same distance rule as the film shots and always takes the best clear view.

  - **The ride to Nima, on the real roads, with signs:** after a short look out of the window at Circle, the camera rises behind Uncle's red car and follows it the whole real way (2.8 km, found on our own map tiles by `scripts/route/nima-route.mjs`: Kwame Nkrumah Interchange, Ring Road Central, Al-Waleed Bin Talal Highway, Nima Roundabout), with a road sign every second or so for the roads, areas (Kokomlemle, Asylum Down) and public landmarks you pass (Circle Lorry Station, Fire Service, Nima Police Station, Nima Market, Nima Post Office…), ending with "Welcome to Nima". No businesses or brands.
  - **Home:** Uncle drives in through the gate and parks in the yard; you both get out (he on the driver's side), he says "Welcome home", walks you to your room at the back and in you go. The tin roof lifts away and the camera looks down into the room (bed, table, bucket, calendar, bulb): "This is your room. It is small, but it is yours." Then Chapter 1.
  - **Cars never drive under a low ramp:** a ground route that passes under a flyover ramp where it is lower than 4.5 m gets no vehicles, and the low ends of every ramp have walls and kerbs, so cars stay on the road under and on the bridge.
  - **Big fix, the 3D world now sits exactly on the map:** our metres used the true earth size, but the map draws on a slightly smaller round earth, so the 3D streets, cars and houses slid off the map's own streets by about 8 m at Nima (and less near Circle). Now both use the map's metres and line up to under a pixel.
  - **Fix, roads at the edge of a map square:** a long straight road piece that crossed the edge of a map square was lost from both squares, so the game did not know about that bit of road (Uncle's house once landed on one). Pieces are now cut exactly at the edge. Before the house is placed, every map square within 250 m is loaded first.

  - **Arriving at Circle by trotro:** after the opening film, the trotro from home pulls in at the kerb (filmed from along the kerb, the kiosks there stand back so nothing blocks the view), the mate calls "Circle! Circle! Last stop!", you step down and walk onto the pavement, the trotro pulls away, you turn to face the road, and the boy snatches your bag.
  - **Film music:** our own highlife tune (made entirely in code, `scripts/music/highlife.mjs`, no samples) fades in as the bus leaves for Accra in the opening film, plays through Circle, the snatch and the chase, and fades away as the thief gets away. The Sound button mutes it too. The owner's chosen song can replace `public/music/arrival.mp3` once the artist and label give written permission.
  - **The taxi now blocks you from the front:** you pull up at the kerb, the taxi screeches in right in front of you, you put your hands on your head, look left and right for a way round, then dodge round its back, and he is gone.
  - **Auntie Dede's kelewele:** you stay in your chair and eat, the hand going up to the mouth bite after bite.
  - **Uncle Kwame parks off the road:** he drives in along the lane and pulls off onto the pavement by the stall (the kiosks there make room), so the traffic flows on past; he walks round the front of his car (never through it), pays Auntie, and you both walk to your doors and get in. He pulls back out into the lane and away.
  - **The ride, a short film (about 15 s):** the car pulling away at Circle, then six close shots of Uncle's car driving at a normal speed through real places on the real way (Circle, Kokomlemle, Asylum Down, Al-Waleed Bin Talal Highway, Nima Roundabout, Nima), each with its road, area and landmark signs, quick fades between shots, the city in 3D on every phone for these seconds. No views out of the windows any more.
  - **Home in Nima:** a bigger compound (24 x 20 m) on a quieter street (not on a main road), open ground round it with no sellers crowding it, flower pots, bougainvillea over the wall and a carport inside the gate. The screen fades, and Uncle's car comes along the road, turns in through the middle of the gate and parks under the carport (never through a wall).
  - **You walk to your room yourself:** after "Welcome home", the controls are yours ("Follow Uncle Kwame to your room"); Uncle walks ahead and waits by your door, steps in as you come up, and you follow him in. The doorway is now 1.2 m wide (it was so narrow that you could get stuck, and a low strip of wall ran across it). As you come to the door the tin roof lifts away, and inside the camera looks down into the room (it showed the wall before); walk out and the roof comes back.
  - **Tap any vehicle with an advert:** it works on both halves of a phone screen now (the left half is also the walking stick), whenever you are walking, also during the story.
  - **Advert prices by place, the same for everybody** (no small-business discount for now): side street ₵300, main road ₵450, busy station or market ₵600, airport ₵900, moving taxi ₵1,000, trotro ₵1,200, city bus ₵1,500 a week. Step 1 is now "Where should your advert go?" with the whole list. A billboard's own price comes from where it stands.
  - **Your flyer is never stretched:** "Automatic" (the new default) fills the board when the picture is about its shape and otherwise shows all of it on a soft blurred copy of itself (no empty bars); an optional button on the flyer ("Call now") as the call to action.
  - **More billboards:** about every 30 m on main roads and every 60 m on side streets (they were 40 m and 110 m); drawn out to 250 m on Light phones, 320 m on others; advert faces always match their frames when there are many.
  - **The big map's locked areas** look washed out: pale and grey like a faded photo, deepening gently over the first 300 m past the gold edge.
  - Tests can start straight at the Nima arrival (`?scene=nima`) or at the ride (`?scene=ride`).

  - **The owner's own Accra sounds (27 Oct):** four recordings from Accra are now the sound of the streets everywhere in the game (`public/sounds/accra`, used exactly as recorded; an Opus copy only for the few browsers that cannot play the original AAC). The street recordings (traffic, horns, people talking) play one after the other, louder where the road is busy and people are many, soft inside the compound. The trotro mates' recordings play whenever a trotro, the Circle lorry station or a bus stop is near you, from that direction, fading as you leave it. The moments someone calls out in a recording are marked (`sounds.json`), and at that same moment a 📣 shows over the trotro or station mate calling, or a person near you starts talking with their hands (💬). The made-up voices of the street and the made-up horns stay quiet while the recordings play. Each file is downloaded once and unpacked in memory (about 16 MB for all four), which works on every phone, including iPhones.
  - **The opening film is taken out** (a new one is being made): two title cards, the music starts, then the flight down to Circle and the trotro.
  - **No more starting inside a kiosk:** kiosks arrive with the streets, a moment after you, and could land where you stand (it looked like you were inside a building). The story's places (where you start, the bus stop, Auntie's stall, the compound) are now kept clear for good.
  - **Auntie Dede's stall is never on the road:** it stands at least 2.2 m from the road, and the customer's chair on its road side is on the pavement too. A close shot from the side shows you sitting and eating from your hand, bite after bite.
  - **The ride home is one unbroken shot** (about 24 seconds, no cuts or fades): a camera drone follows Uncle's car all the way along the real roads, turning gently with them; the signs show each road, area and landmark as it passes, and nobody talks over it ("This is Ring Road. Busy, busy" is gone).

  - **Traffic:** when a phone struggles and the game shows fewer vehicles to stay smooth, it no longer removes one that is already close to you (they drive on past; only newcomers and far ones are left out). Checked on Light: no jumps, no overlaps, nothing off the road.

  - **Owner's pass, 27 Oct (afternoon):**
    - You arrive on the trotro: you are not seen until it stops and you step down (before, you stood there waiting for it). Then you stand and take Accra in for about 3 seconds, amazed, looking one way down the road and then the other ("Ei! So this is Accra!"), and then the boy snatches the bag.
    - **Full roads again:** the rule that kept cars from driving under the low end of a ramp threw out every road that came near a ramp within 900 m, and around Circle that was most of them. Now a vehicle is left out only for the few metres where its road runs under a low ramp (out of sight behind the ramp's walls). Vehicles are also packed closer (a vehicle every 4.6 to 7.6 m in each lane). On Light: about 80 vehicles round you (it was 35), kept within 120 m so it costs little.
    - **One seamless sound:** each street recording fades into the next under it (no stop and start), the mates fade in and out softly, and whenever someone talks to you (a chat, Auntie Dede, Uncle Kwame) the whole street drops to 30% and comes back after.
    - **Ambulances:** about every minute and a half while you walk the streets, a white ambulance with a red stripe and flashing red and blue roof lights drives along a road near you with its siren on (from where it is, louder as it passes); the traffic behind it waits, and in a jam it waits too. (No siren was found in the owner's recordings, so the siren is made in code.)
    - **The ride home at a real speed** (about 15 m/s, 54 km/h), 25 seconds, filmed low behind the car so the street fills the picture: the real street the whole way (its buildings, kiosks, people, traffic lights and traffic are built round the car; the map squares along the way start loading when Auntie calls Uncle), Uncle's car waiting behind the traffic ahead like everyone else. First along Ring Road Central past the Interchange (14 s), a fade ("Twenty minutes later", with the signs of the places in between), then into Nima (11 s) and home.
    - **Busier streets:** more container shops (rows six deep), more market umbrellas, phone stands, fewer trees; more people (Light 110, Standard 380, Ultra 650; the busy % still thins them on a struggling phone).
    - **People walk on and on:** at the end of a pavement they cross to the next one that carries on (waiting at the kerb until no vehicle is coming), instead of turning round and walking back; they turn back only at a real dead end.
    - Cost on Light: about 330,000 triangles in the test spot (was 266,000); the logic takes about 3 ms a frame. Needs the owner's check on the cheap Android.

  - **Speech bubbles are back** (owner, 27 Oct): people chatting, sellers calling and trotro mates calling their stops show their words in bubbles again, every few seconds, as before; with the owner's recordings playing they are text only (the recordings are the voices). At the moments a mate calls out in a recording, the bubble over that trotro or station mate shows a call too ("📣 Kaneshie Kaneshie! Odorkor! Last seat!").

  - **Snatch seen from behind, roads crowded** (owner, 27 Oct): after the trotro drops you, the camera is behind you, a little high, with the road and the pavement either side in view, so you see the boy run up, grab the bag and dash across. Roads are packed: a vehicle every 3.8 to 6.2 m (side streets nearly as full as main roads), up to 100 round you on Light. A space too short for its vehicle (a bus in a car's space) stays empty, so no vehicle appears inside the one ahead.
  - **Fix, empty streets on slower phones:** the game thinned people and traffic whenever the frame rate fell under 26, down to a quarter, and on Light (capped at 30) it needed 48 to come back, so after one slow moment the streets stayed empty for good. Now it compares with the phone's own cap (fewer below 72% of it, back above 90%), and vehicles never go below three-quarters.

  - **Epic City pack, step 1: all models in game form, and a catalogue** (owner, 27 Oct): the owner bought the Low Poly Epic City pack (Polyperfect, $25) and asked to use all of it on the real Accra map: their roads, buildings, vehicles, people, traffic rules, trains, planes, and a day and night that follow real Accra time (plan of 7 steps agreed in chat; weather later).
    - All 438 models converted to game files (true metres, one shared texture sheet, 9 MB in all, 48 MB before packing): 100 buildings, 55 vehicles, 26 animated people with stand, walk and run, 67 street things, 95 road, bridge, rail and runway pieces, nature, beach and more. No weapons in any of them (checked).
    - The catalogue page `/catalogue`: every model's picture by group, search, tap to spin it in 3D, Day and Night buttons (at night the windows, lamps and signs glow with the pack's own night glow), and the people walk, run and stand.
    - Found on the way: the pack's people all have light skin, so in step 5 they get a range of Ghanaian skin tones (the licence lets us change the models); the pack has no day and night system of its own (we build it in step 3); the pack has only about ten everyday road vehicles (taxi, car, bus, school bus, van, police, ambulance, trucks), so the trotro and okada come from the van and old motorbike, or our own, in step 4.
    - Licence recorded in `public/models/LICENSES.md`; the repository is now private.
    - **Done when:** the owner opens `/catalogue` on the test site on a phone and sees every model, spins a few, and sees the night glow.

  - **Epic City pack, step 2: the pack's road design on every real Accra road** (owner, 27 Oct):
    - The pack's road pieces were measured (`src/game/epicKit.ts` keeps the colours): dark tarmac sunk 15 cm below a grey pavement with a kerb face between; main roads and highways with the pack's unbroken yellow centre line and white lane dashes (1.67 m, one every 5 m), stopping short of junctions; side roads without lines, as in the pack. Accra's real widths are kept (main road 11 m of tarmac, side road 7.6 m).
    - `src/game/epicRoads.ts` lays this along every real road from the map, bends included. At every junction the kerb turns each corner in a smooth curve and the tarmac fills the middle; where roads cross without the map marking a junction, pavements and lines stop at the other road. Lanes and service roads are flat tarmac, with the pavement of the road they join running across their mouth like a driveway. Roundabouts get an island: grass when small, paved when big (Circle's, full of traders).
    - Flyovers in the pack's bridge design (`flyovers.ts`): dark tarmac deck with the same lines, white barriers, grey concrete, flat blade piers.
    - Zebra crossings in the pack's white, on the tarmac, and never two on top of each other. The flat map roads far away are in the same colours, so the distance matches.
    - Vehicles, walkers crossing and the player step down onto the sunk tarmac (and back up onto the pavement).
    - Phones: the roads are built in 120 m blocks and only the blocks near you are drawn (Light 260 m, Standard 380 m, Ultra 550 m); curvy roads keep only the points they need; each map square is built a little each frame (3 ms on Light), nearest first, so loading never freezes the game. In the test spot the whole scene went from about 305,000 to 264,000 triangles (the roads near you are about 7,600).
    - The pack's own square road pieces are not placed as they are: they only fit a straight grid with the pack's widths, and our roads are built from their exact shapes and colours instead, so they look the same and follow Accra.
    - **Done when:** on the test site, every street round Circle has the pack's tarmac, kerbs, pavements and lines, the flyovers look like the pack's bridges, and the game stays as smooth as before on the cheap Android.

  - **Epic City pack, step 3: day and night on real Accra time, street lights everywhere** (owner, 27 Oct):
    - `src/game/dayNight.ts`: the sun's real place over Accra for the date and time (checked: on 27 Oct sunrise 5:47, sunset 17:43; in June sunset 18:16). The light, the sky light, the shadows, the map's sky and the flat ground follow it: warm low light in the morning, white at midday, golden in the afternoon, an orange sunset, blue dusk, then a dim moonlit night. Accra keeps GMT, so the game clock is the real UTC time (the on-screen clock shows it). For testing: `?hour=21` starts at another hour, `?timescale=60` runs the clock faster.
    - Street lights all round the city: the pack's road lamp on both sides of main roads about every 30 m and on one side of side roads about every 36 m (`streetLife.ts`).
    - At night: the lamps' heads glow (the pack's night glow), a pool of light lies on the road under every lamp near you, about half the windows and many small shops are lit, shop signs glow, every vehicle has headlights with a beam on the road and red tail lights, billboards stay bright, and a soft warm light around the player keeps the people near you visible. On Standard and Ultra the nearest 4 to 8 lamps also give real light.
    - Greetings and street talk follow the clock ("Good morning / afternoon / evening"; no "the sun is hot" after dark).
    - Cost on Light: no extra real lights except the one round the player; the lamp pools and headlights are flat glowing shapes drawn in a few batches.
    - Still to do in later steps: pupils with school bags still walk at night (step 5 makes the crowd change with the hour); the pack's night glow turns car windows pink, handled when the pack's vehicles come in (step 4).
    - **Done when:** on the test site the light matches the real time outside (morning, afternoon, evening), and at night the street lights, windows and headlights are on and the people near you can still be seen, with the game as smooth as before on the cheap Android.

  - **Street lights like a city, the pack's traffic lights** (owner, 27 Oct evening):
    - Road lamps in pairs facing each other across every road (main roads every 20 m, side roads every 27 m), arms over the road; half way between the pairs, a pavement lamp (the pack's city lamp with a globe) on each side lights the walkway. They stand there by day too.
    - Yellow sodium light at night: yellow lamp heads and globes, yellow pools on the road and smaller ones on the pavements, warm yellow real light from the nearest lamps on Standard and Ultra.
    - Traffic lights: the pack's tall traffic light at every arm of the big junctions, with the signal head over the lanes and a low one for people at the kerb; both show the real red, amber and green.
    - Cost on Light: about 30,000 more triangles in the test spot (now about 305,000 by day); no extra real lights.
    - Asked for and planned for step 4: the main roads crowded in the evening (rush hour).

  - **The whole road lit at night** (owner, 27 Oct night):
    - Street lights are now spaced along the whole road (before, the count started again at every bend, so on curvy roads the lamps came out uneven and not always in pairs): exact pairs facing each other across the road, every 20 m on main roads and every 27 m on side roads.
    - Each road lamp lights its half of the road, from the pavement behind it to past the middle, and the whole gap to the next pair, so the two lamps of a pair light the full width and the light runs on unbroken to the end of the road. The pavement lamps light their stretch of walkway the same way.
    - New: lamps on the lanes and service roads (one side, every 25 m) and in pairs on the flyover decks (every 25 m, lighting the deck).
    - Phones: on Light only the nearest 200 road lamps, 110 pavement lamps and 40 deck lamps are drawn, but the light on the ground is drawn for every lamp near you. About 312,000 triangles at night in the test spot.

  - **Fix: street lights faced the pavement** (owner, 27 Oct night): the road lamps' arms pointed away from the road, so their light fell on the pavements and shops and the roads stayed dark (the pavement lamps had the opposite mistake). All lamps now face the road: arms over the lanes, light on the tarmac from the kerb to past the middle; pavement lamps light their walkway. Under the flyovers, lights fixed under the deck now light the road below (it was the darkest place at night).

  - **Epic City pack, step 4: the pack's vehicles, crowded roads, rush hours** (owner, 27 Oct night):
    - The pack's vehicles on Accra's roads (`vehicles3d.ts`, PACK): saloon cars in many paint colours (also for the small cars and SUVs), the taxi in Accra taxi colours (its body in the vehicle's colour, orange-yellow corners), the pickup, the van as the trotro (white roof, yellow stripe, the lower body in its colour, adverts on both sides), the city bus (with its stripes and adverts), the box truck (adverts on the box), the old motorbike as the okada, and the pack's ambulance for the story's ambulance (with its flashing light bar). The pragya and motor-king tricycles stay our own (the pack has none).
    - Each pack vehicle is split by colour into its paintwork (repainted per vehicle) and the rest (glass, tyres, lights, trim in the pack's colours). The vehicles keep the pack's day glow at night, so their windows stay glass, not pink.
    - Beyond 38 m each vehicle is drawn with a simpler copy of its shape (about a third of the triangles, made when it loads), where the difference can't be seen: the vehicles cost about 80,000 triangles at rush hour on Light instead of 147,000.
    - Crowded roads: vehicles packed much closer (Light: one place every 7 to 12 m on each road, up to 130 vehicles near you; Standard 280; Ultra 360). Vehicle lengths for spacing and collisions are the pack's.
    - Rush hours (`roadFill` in dayNight.ts): the share of places filled follows the clock: packed in the morning rush (7:30) and the evening rush (16:30 to 20:00, the fullest), busy by day, thinner late at night; it changes smoothly, so the roads fill up and empty out gradually. In the test spot within 80 m: 24 vehicles at 3 am, 62 at 1 pm, 77 to 86 at 6 pm (the slow test machine thins it a little; a smooth phone shows the full rush).
    - Traffic rules kept and checked with the new sizes: vehicles follow the one ahead, stop at red lights at the line, wait for anything in their way (people, the story's vehicles), climb the flyovers.
    - Scene on Light at the evening rush: about 300,000 to 316,000 triangles.
    - **Done when:** at the evening rush on the test site the roads round Circle are full of the pack's cars, taxis, trotros and buses, the junctions are jammed, and the game stays smooth on the cheap Android.

  - **Traffic that drives by the rules, every Epic City road vehicle, many more cars** (owner, 28 Oct):
    - The owner saw vehicles passing through each other and swerving in the middle of roads. Cause: each vehicle followed a timetable along a fixed loop (the same on every phone), and only checked the vehicles right beside it; at tile joins and loop joins its path could jump. Now `src/game/trafficSim.ts`: each vehicle is its own driver, as in the pack's traffic system:
      - every road is cut into lanes (Ghana drives on the right; main roads two lanes each way, one-way roads, such as each side of a dual carriageway, all their lanes one way); a vehicle keeps to its lane and turns only at a real junction, along a smooth curve into the lane it turns into (left turns from the inner lane, right turns from the outer);
      - it keeps a safe distance from whatever is ahead, speeding up and braking smoothly (the intelligent driver rule of real traffic simulators), and also looks out of its windscreen for anything in the space ahead on any road (map roads that run side by side or cross with no junction on the map);
      - it stops at the line on red, and enters a junction only when nothing on a crossing path is in it and there is room in the lane it turns into;
      - it picks its way at every junction (straight on most often) and drives on for ever. Around the player the roads are kept full (fuller in the rush hours): new vehicles join out of sight, far ones are let go.
      - Checked on the test machine: no vehicles overlapping and none stuck in most checks; vehicles wait at red lights.
      - Traffic is now worked out on each phone (no longer the same on every phone); the story's own drives (Uncle Kwame's car, the ambulance) still use the old routes, which are not drawn.
    - Every road vehicle of the Epic City pack is on the streets (`src/game/vehicleTypes.ts`): besides the saloons, taxis, trotros, buses, pickups, box trucks and okadas, now police cars, old cars, racing cars, open jeeps, the odd formula car and golf cart, tow trucks, fire pickups, ambulances, the school bus, tippers, tankers, cement mixers, fire engines, armoured trucks, and slow road rollers, bulldozers, excavators, cranes and forklifts. The special ones keep the pack's colours; each type has its own length and width for the drivers. (Bicycles, scooters, boats, trains, planes, the helicopter and the balloon come with step 7.)
    - Many more cars: on Light up to 420 vehicles drive round you (170 drawn), Standard 650 (320), Ultra 900 (420); about one vehicle every 7.5 m of lane in the rush.
    - Not used: the "ARCADE Ultimate Vehicles Pack" file the owner sent has a note inside saying it was uploaded by unityassetcollection.com, a site that gives out paid packs without the makers' permission, so it is not licensed for the game; the unpacked copy was deleted. Bought from the Unity Asset Store, it can be added.
    - Scene on Light: about 315,000 to 325,000 triangles.

  - **Riders on the bikes, story vehicles that respect traffic, nothing disappearing** (owner, 28 Oct):
    - Okadas have their rider, and about half a passenger behind; open jeeps, golf carts, road rollers, bulldozers and forklifts have their driver (`src/game/riders.ts`). They are the pack's people, sat down: the rigged person is posed (thighs forward, knees bent, hands on the handlebars) and frozen into a plain shape, so hundreds draw in one go; their skin is moved to the pack's darker skin colours (Ghanaian tones). Far away they are drawn simpler, like the vehicles.
    - The story's own vehicles (the trotro you arrive in, the chase taxi, Uncle Kwame's car) drove on fixed timings and went through the traffic. Now their way is cleared of traffic at the camera cut that starts each scene (nobody sees cars go), traffic waits behind them, and when they drive off they wait behind whatever is in front (never through it) and are let go once out of sight.
    - Vehicle windows stay glass at night (their material keeps the day glow even when it is made at night).
    - Nothing blinks out: the crowd is never thinned below 85% on a struggling phone (it was down to 30%), and many more vehicles may be drawn (Light 260, Standard 420, Ultra 560) than are ever near you, so the ones at the edge no longer blink in and out. Vehicles switch to their simpler shape from 30 m.
    - Cost on Light at the test spot: about 430,000 triangles, most of it the crowd (our people models, about 1,100 to 1,300 triangles each, about 165,000 in all); step 5 replaces them with the pack's people (about 450 each). Needs the owner's frame-rate check on the cheap Android.

## Waiting on the owner

- Deploy first (the live site has none of the street work yet): `git pull`, `cd apps/web`, `npm install`, `npm run deploy`. Then the street test on the cheap Android: open `/street-test?debug`, tap to play with the phone sideways, walk, sprint, jump and ride for a minute, and report the fps number and how the controls feel.

- Two-device test for T4 (phone and PC see each other walk).
- Phone checks: map load time and smoothness, tap to walk, chat.
- Test 1b result from the cheapest Android available (/char-test.html).
- Test phone memory and cores (/device.html), and the mobile network for R3.
- For advert payments: a business Mobile Money number or a Paystack account in the business's name (only the owner can open one), then the server takes the payments.
- Record the voice script (docs/VOICE_SCRIPT.md) with Ghanaian speakers who agree in writing.
- The song for the opening: written permission from the artist and label to use it in the game (until then our own highlife tune plays).
- Share the picture of the advert banner style you like, so ours can match its feel (our own design).
- Native-speaker check of the Twi and Fante greetings, and the Pidgin, Twi, Ga and Ewe word lists.
