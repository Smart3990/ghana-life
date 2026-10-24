# Ghanaverse: Game Design Brief

Version 1.0 · 24 October 2026
Companion to `docs/MASTER_PLAN.md` (Ghana Life Master Plan, revision 2)

---

## 0. How to use this document

This brief records every design decision made after the master plan's revision 2. Give Claude both documents at the start of every build session.

**Which document wins**

- **Design** (story, missions, characters, screens, money, shop, look): **this brief wins.**
- **Engineering rules** (zero-dollar start, performance budget, quality tiers, risk register, server-side money, scale plan, task "done when" tests): **the master plan still applies**, except where section 22 of this brief changes them.
- When unsure, ask the person before building.

**Working style for Claude**

- The person is a beginner. Explain every step in plain words, give exact commands, and wait for them to confirm each step works.
- One task at a time. Every task ends with a "done when" test.
- Save to Git after every task.

---

## 1. What Ghanaverse is

**Name:** Ghanaverse (Ghana + universe: a whole Ghana world you can step into).
**One line:** A free 3D open-world game that runs in any browser. A living virtual Ghana where real people hustle, play missions, pull heists, fly over Accra, make friends and fall in love, on the real map of Accra.

**The feeling:** a big-budget open-world action game, but Ghanaian to the core. Missions with cinematic scenes, driving, chases, heists, police and a living city, plus a full free-world life with jobs, homes, friends and voice.

**Map scope for now:** Greater Accra only, built from real map data, plus a few fictional places inside it (section 12 and section 16).

---

## 2. Golden rules (apply to every task)

1. **Performance first, then fun, then realism.** If a feature looks great but lags on a cheap phone, simplify it or cut it. No exceptions.
2. **Clean screen.** Show nothing unless it matters right now. Everything else lives in the in-game phone.
3. **Never name or reference GTA** (or any other game) in the game, its text, its store pages or its marketing.
4. **No weapons for now.** Action comes from chases, driving, stealth, timing, fists and tackles. Guards and gang members can be knocked out. Police use handcuffs.
5. **18+ only,** with house rules accepted before play.
6. **Anonymous by design.** Nickname only. No real names, phone numbers, photos, ID or real location are ever collected or shown.
7. **All money is decided on the server.** Payouts are checked and capped. (Lagos Life had a fake-money exploit; we must never have one.)
8. **No real people, real brands or real gangs** without written permission. Fictional banks, fictional police force, fictional gangs, fictional businesses until a business claims its place.
9. **No chores.** Every mission and job uses fun actions: running, driving, chasing, haggling, racing, flying, quick mini games.
10. **Every mission is explained in one sentence.**
11. **Content we use must be free to use or our own** (section 24). Folklore (kente, adinkra, Ananse) is drawn and written in our own versions.
12. **Respect:** places of memory (Cape Coast and Elmina castles, later) are quiet zones. Sacred rites are never games or jokes. No tribal, religious or sexual insults.

---

## 3. Platforms, controls and quality

**Runs in any modern browser:** phone, tablet, laptop or desktop, and Android TV.

| Device | Controls |
| --- | --- |
| Phone and tablet | Touch: virtual joystick on the left, action buttons on the right |
| Laptop and desktop | Keyboard and mouse (WASD to move, mouse for camera), or a game controller |
| Android TV | Game controller. Menus must also work with a TV remote's arrow keys |

**Game controllers:** Xbox, PlayStation 4 and 5, and most Bluetooth or USB pads, through the browser Gamepad API.

- Left stick: move. Right stick: camera. Triggers: accelerate and brake. D-pad: menus and phone.
- Button prompts switch to match the pad (A/B/X/Y or ✕/○/□/△).
- A button-remapping screen for pads that report buttons in an unusual order.

**Quality tiers:** keep the master plan's Light, Standard and Ultra tiers with automatic detection and automatic step-down. Android TV usually lands on Light.

**Performance targets (must pass before a feature is accepted):**

- Smooth on a cheap Android phone (about 2 to 3 GB memory): no stutter while walking, driving or riding.
- Quick first load on mobile data; the rest of the city loads quietly while playing.
- No freezes during cinematic rides, flights or busy scenes like Circle at rush hour.
- Every new feature is tested on the cheap phone before it is accepted.

---

## 4. Look and feel

### 4.1 The world

- **Modern Accra as it is today,** built from real map data: real roads, building positions and sizes, landmarks.
- **Cinematic feel:** warm natural light, golden sunsets, Harmattan haze, rain, neon nights, street lamps at dusk.
- **Third-person camera** behind the character, pulling back when driving, like a big-budget action game.
- **Street life:** hawkers at traffic lights, container kiosks, chop bar umbrellas, trotros loading, goats, gutters, rush-hour jams at Circle.
- **Shop signs, menus and trotro slogans** in a Ghanaian style ("No Condition Is Permanent", "Sea Never Dry"), designed by us. Hand-painted art from local sign painters may come later.
- **Realism means "beautiful and believable," not photoreal everywhere.** Detail only where the eye goes; simpler far away.
- **Faces:** keep close-ups on hands, objects and body language; show faces at a little distance, in good light, briefly.

### 4.1a Lessons from other Accra games (owner's decision, 2026-10-24)

Other browser games set in Accra exist (for example accralife.cc). **We do not copy them.**

- **Never their map.** Their city is a small model town seen from above, where you tap pins to go to places. That is not our game. Ours is a third-person open world on the real streets of Accra.
- **Learn their 3D quality, and use it in our own world:**
  - smooth, steady frame rates;
  - warm, consistent lighting from the sky, with soft shadows;
  - good-looking animation;
  - easy phone controls: joystick, drag to turn, pinch to zoom, clean bottom panels;
  - quality presets (low, medium, high) that change pixel density, the frame-rate cap, shadows and smoothing of edges.
- **Promotional art** (the hero picture, store images) is our own. It may share the warm, busy, golden-hour Accra spirit, but never their scene, layout or characters.

### 4.2 The game's interface: Royal Kente

The kente colours are for the interface, title cards and branding, never for tinting the city. The city keeps natural colours.

**Royal Kente (default, free):**

| Name | Hex | Use |
| --- | --- | --- |
| Night | `#121A14` (deep `#0E1410`) | Main dark background |
| Card | `#1C2620`, border `#2E3A32` | Cards on dark |
| Kente gold | `#E3A92B` | Primary accent, buttons, highlights |
| Kente red | `#C8442E` | Alerts, "AYEKOO!" banner, danger |
| Harvest green | `#2F8F57` | Success, money gained |
| Royal blue | `#1F5FA8` | Information |
| Calico white | `#F2EFE6` | Main text on dark |
| Soft text | `#C9D3CB` | Secondary text on dark |

**Signature motif:** a thin woven kente-style strip (alternating blocks of gold, night, red, green and blue) across the top of screens, as the loading bar, and as the energy bar under the minimap.

**Fonts used in the pitch deck:** Oswald (titles) and Nunito Sans (text). Reuse unless a better free, licensed choice is found.

**Extra themes (part of the Big Man Pack, section 19):**

| Theme | Colours |
| --- | --- |
| Ewe Indigo | Indigo night `#14162B`, ochre `#D9A441`, rust `#A8442E`, sage `#6E8F5A`, plum `#6A4C93`, raw cotton `#EDE4D3` |
| Accra Dusk | Maroon `#2A1410`, sunset amber `#F0A432`, flame `#D8572F`, sea teal `#1E8C86`, palm green `#7FA23C`, shell white `#FBEFE3` |
| Midnight Gold | Exclusive to the pack. To be designed |

Players switch themes for their phone, menus and title cards in settings.

### 4.3 The on-screen display

**Always on:** time and Sika (top right), phone button (top left), round minimap with a thin energy bar (bottom left).
**Only when needed:** "Tap to enter" prompts, the mic button when someone is near, chat bubbles that fade, place names that fade in as you pass, the add-friend card, the caller card.
**One tap hides everything** for photos.

Reference: the gameplay preview sketch made in the design chat (sunset at Circle).

### 4.4 Cinematic language

- Cinematics last 10 to 20 seconds. Mid-mission beats last 3 to 8 seconds.
- Thin black letterbox bars during cinematics.
- Fade to black between scenes.
- Colour mood per scene: golden for hope, cooler and darker for danger and Dumsor City, warm and faded for memories.
- All cinematics are made **inside the game engine** (not video files), using the same characters and city, so they stay light.
- Voice lines are short, with subtitles. Skippable after the first viewing.

---

## 5. Starting the game

### 5.1 First screen

- A big **"Play now"** button: no sign-up. Guests play the whole journey and first day.
- **Sign in** for returning players.

### 5.2 The three-tap start screen

One screen, styled in Royal Kente (dark background, gold selections, woven strip at the top). Reference: the start screen mockup from the design chat.

| Step | Ghanaian or Nigerian | From abroad |
| --- | --- | --- |
| Who are you? | Ghanaian / Nigerian | From abroad |
| Background | SHS graduate / University graduate | Hidden |
| Coming from | Hidden | Country, suggested automatically from the connection's country and confirmed by the player. Optional big city from a short list |
| You are | A woman / A man | A woman / A man |
| Hometown | Pick from a short list, or "Surprise me" | Hidden |

- The title updates live: "From Ada to Accra", "From Enugu to Accra", "From London to Accra".
- The connection country is used only to pre-fill the choice and is never stored. Only the chosen country name is kept.
- **Start** begins the opening film.

### 5.3 The character is rolled

- No customization screens. The game rolls face, hair and clothes.
- **Day name:** the player is "born" the day they arrive, so the day name comes from the sign-up day (Saturday: Kwame or Ama). No real birthday is asked.
- Players change their look later at the barber or salon (shop item) and by buying clothes.

### 5.4 Sign-up (after the first day, or any time)

- Prompt at the right moment: when the guest reaches home, "Want to keep your progress? Pick a nickname."
- **Fields:** nickname, password, email (optional, recovery only), "I'm 18 or older".
- Gender, side, background and hometown are already chosen on the start screen.
- A **secret recovery code** (a few random words) is shown once.
- The game warns if a nickname looks like a real full name or contains a phone number.
- Guest progress is kept on the device and moves to the account on sign-up.

**Guests can:** play the journey and first day, walk, drive, explore, watch events, chat with ready-made phrases.
**Guests cannot:** own property, join crews or heists, use voice or free typing, add friends, appear on leaderboards.

---

## 6. Opening films (cinematic, about 30 to 60 seconds)

| Start | Film |
| --- | --- |
| Ghanaian, university graduate | Graduation day: caps in the air, Grandma proudly holding your arm. Weeks later in the village, the NSS posting letter: "Accra". Grandma's goodbye at the roadside: ₵50 folded into your hand, "Go and make us proud." The bus to Accra |
| Ghanaian, SHS graduate | SHS results day with friends. Back in the village with nothing to do. Grandma's goodbye and the ₵50. The bus |
| Nigerian (SHS or university) | Results day or graduation in Nigeria. Your mother at a busy motor park: "Go and show those Ghanaians." The long bus ride along the coast to Accra |
| From abroad | The plane comes in over Accra; the camera glides past Jamestown Lighthouse, Labadi Beach, Independence Square and the Black Star Gate, the Kwame Nkrumah Memorial Park, names fading in. Touchdown at Kotoka. The big "Akwaaba" sign at arrivals |

**Grandma shot list (village start):** dawn mist and cockerels → Grandma waiting on a stool → close-up of old hands folding cedi notes into yours → her face at a distance: "Go and make us proud" (Twi or Ga, English subtitles) → the bus mate shouting "Accra! Accra!" → a quick road montage → Accra's skyline → the bus stops at Circle.

---

## 7. The journey and first day (solo, computer-run)

Everything before the compound gate is a **private story bubble** played alone with computer characters, so it works with zero other players online.

1. **Circle station:** noise, crowds, hawkers. A boy snatches your bag (money, phone and Grandma's letter inside).
2. **The chase:** through the station, between trotros, over a gutter. **You lose him.**
3. **The kelewele auntie** calms you down: "Sit down, my child. Who do you know in Accra?" She calls your uncle on her own phone.
4. **Uncle Kwame:** "Stay there. I'm coming." He arrives, pays the auntie, and takes you home by trotro through the traffic.
5. **The compound gate:** the bubble ends and the live shared city opens.

**Money:** Grandma's ₵50 is stolen with the bag. The player arrives with ₵0.

**From abroad:** no theft. Walk out of arrivals; three place cards appear: "Where to first?" (section 13.1). They stay at a small guesthouse instead of the compound.

**Payoff later (Chapter 3):** at Borla Hills the player spots the same boy. Catch him and get Grandma's letter back, with a short emotional scene reading it.

---

## 8. The compound house

- Uncle's compound has 6 to 8 rooms. Other rooms belong to **real players who arrived around the same time** (grouped by start time and usual playing hours).
- **Empty rooms are filled by computer neighbours.** When a new real player arrives, a computer neighbour "moves out".
- **Compound voice group:** one open voice group for the compound, wherever members are in the city. One tap to join or leave.
- **Compound life:** shared prepaid meter, loud music, yard gossip, the landlord at the door, dumsor nights when everyone sits outside.
- Uncle Kwame, Auntie Esi and Kofi Shortcut are shared characters in the city, but react to each player according to that player's own story.

---

## 9. Season 1: "From your village to Accra"

### 9.1 How the story works in a shared world

- **Each player lives their own version of the story.** Story-only characters (Don Shito, Captain Tokro, Naa Kokonsa in missions) appear only in that player's missions.
- **Story missions are solo,** except about one or two **"Bring a friend"** missions per chapter: one friend, optional, with a real part to play (driving, pushing a cart, spotting a thief). The friend gets a reward; the host's story advances.
- **Always solo:** choices, heist nights, emotional scenes, endings.
- **Free-world players never have to play the story.** It waits in the phone ("Uncle Kwame is calling").
- **Story rewards** are fun extras, never things free-world players cannot get another way.
- **Background branches:** university graduates also get **NSS missions** at their posting; SHS graduates and Nigerians get **apprenticeship and hustle missions** instead (section 13.3).

### 9.2 Cast (final names)

| Character | Role |
| --- | --- |
| Uncle Kwame | Your uncle, compound tenant, always has advice |
| Auntie Esi | Chop bar owner, loud and loving. Calls mid-chase: "Have you eaten?" |
| Kofi Shortcut | Trotro mate. His "shortcuts" always end in trouble |
| Tunde No-Wahala | Your Nigerian rival, also new in Accra. Every plan starts "Trust me, this one is clean". There is always wahala |
| Landlord Two-Years | The compound landlord. Only ever says "two years' advance" |
| Kwaku Percentage | The landlord's nephew and "agent". Charges a fee for everything |
| Naa Kokonsa | Fearless reporter who knows everyone's secrets |
| Don Shito | The boss. Small, dark and dangerous, like shito |
| Captain Tokro | Leader of the Borla Bandits |
| The Borla Bandits | Don Shito's gang |
| Don Shito's nephew | Wants to be a rapper. Unnamed |
| Inspector Slow-Motion | Police officer who always arrives late, panting: "Who did this?" |
| Akosua Trending | Influencer who will do anything for views |
| The Coffin Kings | Dancing pallbearer crew (fictional, not the real group) |
| Bongo Ryder | Fictional dancehall superstar |

**Places:** Borla Hills (rubbish hill; the Borla Bandits' base, **Scrap Kingdom**, is inside it), Dumsor City (the area where the lights never come back on), the Old Port, **Accra Dubai Plaza** (Don Shito's planned building).

### 9.3 The secret plot (revealed in Chapter 4)

- Don Shito wants the whole block around the compound to build **Accra Dubai Plaza.**
- Every bad thing that happened was part of the plan: Kwaku Percentage was spying for him, the Borla Bandits squeezed the shops, Kofi's trotro was seized over a debt, your shop burned.
- **Tunde always ends up on the opposite side to the player.** If the player joins Don Shito, Tunde works with Naa Kokonsa; if the player refuses, Tunde joins Don Shito. They face each other in the finale and make peace.
- **Reveal:** a fast flashback montage of the earlier clues: "It was always Don Shito."
- Early visible clues: a half-hidden Accra Dubai Plaza poster at Circle, Kwaku Percentage whispering on the phone, the bag thief in Borla Bandits colours.

### 9.4 Mission card format

Every mission is written and built with these fields:

| Field | Content |
| --- | --- |
| Name and chapter | |
| How it starts | Who calls, and where the marker appears |
| Intro cinematic | Shots, lines (10 to 20 s) |
| Control point | The exact moment the player takes over; one-line goal shown 3 s |
| Steps | Each objective with success and failure |
| Twist | |
| Outro cinematic | Shots, lines |
| Rewards and unlocks | Sika, titles, what opens next |
| Real people | Bring a friend? Who can watch? |
| Reuses | Existing places, movements, vehicles (keeps it light) |
| Choices | What changes by path or decision |

Failure restarts from the last checkpoint, never from the beginning. Completion shows the **"AYEKOO!"** banner (3 seconds, highlife sting, money flying into the wallet, one unlock line).

### 9.5 Chapter 1 (name to confirm: "Fresh from Ada", using the player's hometown)

**Goal:** from Uncle's guest to a person with your own key. About 1 to 2 hours. Starts when the player walks through the compound gate.

| # | Mission | One-sentence goal | Action | Reward |
| --- | --- | --- | --- | --- |
| 1 | Welcome Chop | "Uncle says a newcomer must feed the compound. Get the food and share it." | Haggle at Auntie Akua's chop bar; run home through a busy street carrying a stack of food packs without dropping it (kick back the kids' football or not); hand a pack to each neighbour (natural hellos with real players) | +₵200, compound voice group, neighbours in contacts |
| 2 | Get Connected | "Buy a new phone and SIM, and set up your mobile money wallet." | At the kiosk a scammer snatches your money and escapes on an okada; chase him on another okada and get it back | +₵300 (SIM costs ₵20); the phone's apps light up |
| 3 | Mate for a Day | "Ride the Kaneshie–Circle trotro and give the right change." | Hang off the door shouting stops; Mate's Change mini game; a passenger refuses to pay | +₵500, Kofi Shortcut's number |
| 4 | Lights Off *(Bring a friend)* | "Dumsor tonight. Get fuel for the generator before the freezer food spoils." | Okada race against a timer; the nearest station is empty; find another. The friend drives the okada | +₵400 (fuel costs ₵100) |
| 5 | Two Years Advance | "Uncle found you a room. The landlord wants two years upfront. Bring your share." | Room is next to Uncle's in the same compound. ₵500 a month × 24 = ₵12,000. Uncle pays ₵10,500; you bring ₵1,500. Out-talk Kwaku Percentage's "agent fee". Earn the rest in the free world. No hard failure: the landlord grumbles loudly, Uncle holds the room | Room secured |
| 6 | Your Own Key | "Pay the landlord and get the key to your own room." | Short warm scene; then a housewarming jam where you DJ (tap-to-the-beat game) while neighbours dance | +₵1,000 gifts, title "Newcomer" → "Resident" |

**Chapter end:** in the yard, a police chase roars past the gate and the radio shouts "Breaking news!" Then Tunde No-Wahala calls: "So you're the new one in Accra? Let's see who makes it first."

**Money check:** missions pay about ₵1,280 before Mission 5 (minus costs), so the player is about ₵220 short and must use the free world. This pattern repeats every chapter: **the story pushes players into the free world.**

### 9.6 Chapter 2: Small Hustle

**Goal:** from odd jobs to owning your first okada. About 2 to 3 hours. Start with about ₵1,000.

| # | Mission | Goal and action | Reward |
| --- | --- | --- | --- |
| 1 | Tunde's Challenge | Race Tunde from Kaneshie to Osu on foot, trotro and taxi, using side streets | +₵400 |
| 2 | Makola Rush *(Bring a friend)* | Push a wooden cart of a market queen's goods through crowded lanes before the street is cleared. Friend clears the way | +₵600 |
| 3 | Okada Lessons | Kofi lends his okada: traffic, potholes, junctions, then a passenger shouting "faster!" | +₵500 |
| 4 | Match Day | Sell water and plantain chips to a Black Stars fan-zone crowd (fast selling game), then celebrate the goal | +₵700 |
| 5 | The Wedding Run *(Bring a friend)* | The bridal car broke down: get the bride to the church in Dansoman on time by okada, her dress flying. Friend carries the groom on a second okada | +₵800 |
| 6 | Kofi's Trotro | The Borla Bandits seized Kofi's trotro over a debt: full trotro chase to get it back | +₵1,000 |
| 7 | Wheels of Your Own | Haggle for a second-hand okada at Abossey Okai (₵6,000). The "perfect" bike breaks down on the test ride; talk the dealer into fixing it | Own okada; title "Hustler"; okada ride job unlocks (real players can book you) |

**Money:** about ₵5,000 total, so about ₵1,000 short of the okada: free world again.
**Chapter end:** Tunde calls, excited: "Chale, I've found big money. A man called Don Shito is hiring. Trust me, this one is clean."

### 9.7 Chapter 3: The Offer

**Goal:** turn the hustle into a business, then face the biggest choice. About 3 to 4 hours.

**Part 1 (everyone):**

| # | Mission | Action | Reward |
| --- | --- | --- | --- |
| 1 | Open Shop | Buy a container shop at a busy junction; survive the opening-day rush (serving game) | A shop that earns while you are away |
| 2 | Supply Run *(Bring a friend)* | Drive a loaded pickup from the Tema harbour market through traffic without losing goods; friend guards the load | +₵1,500 |
| 3 | Protection Fee | The Borla Bandits demand weekly protection money; refuse and chase their collector to Borla Hills (Scrap Kingdom); spot the bag thief from day one and get Grandma's letter back | +₵2,000; the gangs know your name |
| 4 | Dinner with Don Shito | Cinematic night meeting in Dumsor City, lit only by generators. He slides a bank photo across the table: "At 9 o'clock the lights go off. The generator takes four minutes. Four minutes. Are you in?" | The choice |

**The choice:**

- **Accept:** the Dumsor Job begins. Street path.
- **Refuse:** "Accra is a dangerous city. Go well." Next day the shop window is smashed with Borla Bandits graffiti; Don Shito calls: "Last chance." **Refuse again:** that night a neighbour calls screaming "Your shop is burning!" Race there by okada, pull out stock and cash before the roof falls, chase the runner. Nobody is hurt; the story shop is gone. **What is kept:** wallet money, room, okada, friends, all free-world property, anything bought with real money. Then choose again:
  - **Crawl back to Don Shito:** street path, smaller share of the heist, a debt that drives more missions.
  - **Fight back clean:** go to Naa Kokonsa ("Help me take him down"). Hero path: go undercover in the crew.

**Part 2: The Dumsor Job (both paths play the same night)**

Setup missions (street path as crew; hero path the same missions but secretly recording for Naa, with a suspicion meter):

1. **The Timetable:** sneak into the fictional Power Company office at night and steal the dumsor load-shedding timetable.
2. **The Wheels:** steal a fast getaway car from a rich party's valet in East Legon; escape the guards.
3. **The Eyes:** climb a rooftop opposite the bank at night and photograph guards, cameras and doors with the phone.

**Finale, 9:00 p.m.:** lights die across East Legon → move through the dark bank by torchlight as the clock counts down → vault-cracking game under time pressure → the generator starts early, alarms → getaway through dark streets: police cars, roadblocks, helicopter searchlight → the split at the hideout.
**Hero path:** record evidence, choose when to tip off the police, escape police and the crew's suspicion.

| Path | Reward |
| --- | --- |
| Street (accepted at once) | +₵20,000, first heat stars |
| Street (crawled back) | Smaller share, a debt to Don Shito |
| Hero | +₵15,000 reward money, Naa's trust, Don Shito becomes an enemy |

Performance note: the dark scene is cheap (torch beams, few lights). One bank interior is reused with different layouts.

### 9.8 Chapter 4: The Truth

Opens with the flashback reveal: Accra Dubai Plaza and the plan for the block. Land guards (Borla Bandits) arrive at the compound.

**Street path ("Don Shito's right hand"):** bigger jobs: **the Gold Run** (armoured truck on the highway), **smuggling at the Old Port** (night boat run), **Sky Thief** (steal a helicopter and fly low over Accra), **The Ancient Mask** (street version: swap Don Shito's fake "ancient" mask at the National Museum gala for a convincing replica before the curator turns it over), **Backstage Pass** (deliver Don Shito's envelope to a city official backstage at Bongo Ryder's stadium concert while babysitting Don Shito's nephew, who forgets every lyric: save him in a hype-man rhythm game). Then the order: "Clear the compound. Your own people." **Choice:** do it, or secretly warn the neighbours and switch to the hero path.

**Hero path ("Undercover"):** Naa's office in Osu is the safe house with an **evidence board** (clues pinned with string). Missions: record Don Shito's land deals with the hidden camera (keep the target in frame, get the key line; suspicion meter), **The Ancient Mask** (hero version: make sure the curator turns it over in front of the cameras: "Made in China", Don Shito embarrassed live), **Backstage Pass** (record the envelope handover), **Night Defence** (hold the compound against land guards with the neighbours), **The Chase** (hunt the land guard leader, Captain Tokro, across Borla Hills).

### 9.9 Chapter 5: The Rooftop (finale, both paths)

**Starts:** Don Shito (street) or Naa (hero) calls: "Tonight. Airport City rooftop. Don Shito's launch party." Marker on the tower.

**Intro cinematic (about 20 s):** the tower at night, a helicopter on the roof, music → red carpet, cameras, guests in kente and suits, banner "Accra Dubai Plaza: Coming Soon" → Don Shito on stage: "Tonight, Accra changes forever" → close-up of the player in the crowd. **Control point:** "Get to Don Shito's office."

**Hero steps:** blend in past security (stay near crowds; spotted → restart from the lift) → sneak upstairs while Naa distracts Don Shito (about 3 minutes) → open the safe (same cracking game), photograph the land papers → Tunde or a guard walks in: reply choice to convince Tunde, or knock him out and run → reach the roof and send the story live: every big screen in Accra cuts to the news → police storm the roof; stop Don Shito before his helicopter takes off.

**Street steps:** greet guests and collect "gifts" (reply choices) → asked to fetch the papers, instead copy the keys to his accounts → secretly call the police → sirens; Don Shito: "You?!" → short brawl with guards (fists and tackles) → take his helicopter and leave him on the roof as police arrive; fly to the Old Port with a police helicopter behind you.

**Don Shito's fate (both paths):** arrested. No killing.

**Endings:**

| Ending | Outro | Reward | Title |
| --- | --- | --- | --- |
| Hero: The Pride of Kaneshie | Don Shito in handcuffs on every big screen; the anchors report it; the compound street party; Grandma at your door: "You made us proud." | ₵50,000 and a house | The Pride of Kaneshie |
| Street: The Boss | Land at the Old Port; the crew bows; your Most Wanted poster fills the screens; Grandma calls: "I heard what you've become. Is this what I sent you for?" | Don Shito's businesses and their income | The Boss |

**Real people:** the broadcast plays on the big screens for every player. Real police players can join the rooftop raid. The big screens show a headline with the player's nickname.

**Credits:** "Your Story" montage of the player's own choices (hometown, first room, shop, heist night, ending), ready to share.

### 9.10 After Season 1

- **Street ending → Empire mode:** run your businesses, defend turf against the Borla Bandits and rival crews of real players, a police task force hunts you; plan your own heists with real crews.
- **Hero ending → Cases mode:** Naa sends new investigation cases (3 to 5 missions each); the police career opens fully.
- Many "Bosses" compete on a Bosses' ranking; the city reports "This week: 58% chose the hero path".
- **Seasonal live events** shared by everyone (for example a villain arrives for one weekend and the whole city faces him).
- Players can start a new character to see the other path.

---

## 10. Season 2: Chairman's Debt (outline, unlocked after Season 1)

- **The player is a city person now.** Driving through Airport City, a goat runs into the road, you swerve into a Ranger Royal (fictional luxury brand), plate **CHAIRMAN 1.** **Chairman Wahala** (gold chains, white agbada, sunglasses at night): "Ah. The famous one from Kaneshie. That one is ₵250,000."
- **Debt meter** in the phone. Chairman adds funny charges: "Emotional damage: ₵5,000." Chairman takes your story car as collateral; season missions pay the debt first.
- **Kept:** home, free-world money, businesses, real-money items. Only the story restarts from the bottom.
- **Season 1 ending changes the start:** hero players pay a "hero tax"; Boss players are pressured to work for Chairman or recruited by his rival **Papa Pressure.**
- **Cast:** Chairman Wahala, Papa Pressure, Lil Wahala (Chairman's terrible rapper nephew), Akosua Trending, Inspector Slow-Motion, the Coffin Kings, Bongo Ryder, plus Auntie Esi, Kofi Shortcut, Naa Kokonsa and Tunde No-Wahala (also in debt to Chairman).
- **Missions:** The Prize Ram (chase Chairman's ram through a wedding, market and trotro station), Going Viral (stunts for Akosua's livestream), The Wrong Coffin (swap two coffins at neighbouring funerals), Tunde's Big Idea (fake phones at Kantamanto, escape through the market), The Train Job (chase the Accra–Tema train for Chairman's "very important parcel": his toupee), The Fan War (Bongo Ryder's fans against a rival's), Emotional Damage (collect a debt from Chairman's brother-in-law in the middle of a family meeting).
- **Twist:** Tunde finds out the Ranger Royal was already damaged; Chairman scams every newcomer.
- **Finale, The Debt Book:** with Tunde and Chairman's other "debtors", steal the debt book and the Ranger Royal at Chairman's birthday party. **Choice:** burn the book (everyone free) or keep it (become the new Chairman).

Future seasons (when the map grows): the Port, the Gold (Kumasi), Lagos.

---

## 11. The free world

### 11.1 The map shows what is around

| Map icon | Meaning |
| --- | --- |
| Letters (U, E, K, N…) | Story missions from Uncle, Esi, Kofi, Naa… |
| Star | Side missions (short funny stories) |
| Briefcase | Jobs |
| Graduation cap | NSS posting |
| Camera | Real Ghana sites to explore |
| Small icons | Clubs, chop bars, garages, barbers, cinema, airport, helipads, police stations |

Place names fade in as you pass ("Mama Akos Chop Bar · New place discovered"). Unvisited places glow slightly.

### 11.2 Jobs (repeatable, with random twists)

Accept by walking into a job marker or answering a call. Random twists: rain, dumsor, a passenger in a hurry, a very fragile parcel, traffic at Circle.

| Job | Pay |
| --- | --- |
| Delivery (food, parcels, documents, including to the airport) | ₵100–250 |
| Okada and taxi trips (computer or real passengers) | ₵50–200 a trip |
| Trotro mate shift | ₵200 |
| Airport shuttle | ₵300 |
| Hotel valet | ₵150 |
| Chop bar shift | ₵150 |
| Club bouncer | ₵250 a night |
| DJ gig (rhythm game) | ₵300 |
| Garage repairs at Abossey Okai (repair game) | ₵200 |
| Tour guide (more pay after passing a site knowledge check) | ₵250 |
| Canoe runs at Ada or Jamestown | ₵200 |
| Pilot charter (needs licence) | ₵800 |
| Police patrol | ₵300 |

Starting values. Tune with real players.

### 11.3 Energy (no sleeping)

- Energy drains when running, working, driving.
- **Recover:** eat (kelewele ₵10, waakye ₵30, chop bar plate ₵50), drink (sachet water ₵1), rest (bench, chop bar seat, riding as a passenger).
- **Empty:** walk slowly, cannot run or work until you eat. Never faint or die.
- **The bed** is where you rest and log off safely.

### 11.4 Money and spending

- **Sika** is earned by playing and spent on everything in the game.
- **Spending:** food, rent and two years' advance (₵12,000 for a ₵500/month flat), clothes, okada (₵6,000), cars, boats, a business, club entry (₵100), cinema, tours, flights, pilot licence, the big dream: a house in East Legon.
- **Moving up:** every new home needs its own two years' advance.

### 11.5 When you log off

Your character goes home to bed. Your business keeps running with a computer worker. On return: "While you were away, your chop bar sold 40 plates."

### 11.6 Street scenes (ambient drama, near the player only)

Short scenes that start on their own near the player: a trotro fare fight over ₵1, two drivers arguing after a bump ("Who taught you to drive?" "Your father!"), market women quarrelling over a customer, a drinking-spot football debate, an okada rider and pedestrian shouting, a landlord at a tenant's door, a street fight (shoving, a few punches, a crowd: "Leave am! Leave am!"), a funeral procession with a brass band, a wedding convoy, children chasing a goat. Players can walk past, calm it down (small Vibe bonus), film it, or watch.

**Never shown:** weapons, blood, violence against women or children, domestic abuse, fights at mosques, churches or funerals.

**Random events** also offer 1–2 minute side tasks: a wedding convoy needs a driver, a market fire (carry goods to safety), a goat runs off with someone's phone.

### 11.7 Leaderboards and progress

- Weekly leaderboards (reset weekly), including per district: richest, fastest-growing business, taxi driver of the week, best-rated chop bar, top heist crew, most wanted.
- Titles: Newcomer → Resident → Hustler → Known Face → Boss → Big Man or Big Woman → Legend.
- Skills improve with use: driving, flying, haggling, cooking, charm, stealth.
- Collections: passport stamps, rare trotro slogans, cars, outfits.
- Funny achievements: "Survived 10 dumsors", "Out-haggled a trotro mate", "Chased by a goat".
- Season legends get a mural in the city.
- "Tonight in Ghanaverse": one simple list of tonight's events.
- Ghanaverse Wrapped: a shareable season summary card.
- A clip button saves the last 15 seconds as a vertical video.

---

## 12. Getting around

### 12.1 Rides

- Ride app in the phone (or "Go there" on any place card): okada, taxi or trotro.
- A **real player driver gets the booking first** for a few seconds; otherwise a computer driver arrives almost at once.
- **Computer rides are cinematic:** pickup at normal speed → the camera lifts and time speeds up along the **real route** with landmark names ("Passing Independence Arch…") → slows for arrival at the door. **15 to 20 seconds.** One button cycles cameras (behind, inside, window, above); the button disappears when not riding.
- **Real player rides run in real time.**
- The ride doubles as loading time: the destination loads during the ride.

### 12.2 Long trips and flights (Greater Accra only for now)

Long trips chain real steps, each a short cinematic leg: taxi to the airport → buy a ticket at the counter → walk to the gate → board (walk the aisle, take your seat) → flight → land and step out. About a minute in total.

| Destination (fictional unless noted) | Transport | Price |
| --- | --- | --- |
| Rooftop helipads: Airport City, East Legon, Osu, Tema | Helicopter hop | ₵300 |
| Sky tour of Accra (pilot narrates Independence Square, Labadi, Jamestown, the coast) | Helicopter | ₵500 |
| Paradise Island: island resort off the coast | Helicopter | ₵800 |
| Ada Coast Airstrip: estuary airstrip, beach huts, canoes | Small plane | ₵1,000 |
| Shai Hills Lodge: lodge and viewpoint in the hills | Helicopter | ₵800 |
| Pilot licence (fly yourself, earn from charters) | | ₵5,000 |
| Own helicopter | | ₵250,000 |

**In the air:** the screen shows only height, speed and a compass. Real land below (from free satellite imagery and free elevation data near and around Accra), drifting clouds, Harmattan haze, place names fading in ("Labadi… Tema… Ada"), the pilot speaking ("On your left, Labadi Beach"). Four cameras: window seat, cockpit, behind the aircraft, wide view. Arcade-style flying with auto-levelling and landing help. A weekly air race along the coast.

### 12.3 Boats

Fishing canoes at Jamestown, canoes across the estuary at Ada, boat races along the coast, night boat runs at the Old Port. Same control system as cars.

### 12.4 Route pointer

- Glowing route line on the minimap and phone map along real roads; small glowing arrows at turns; a soft destination marker with distance; instant recalculation.
- **Voice guide:** normal, or **local landmark voice:** "When you reach the Total filling station, turn left." "Pass the big mango tree, then branch right." (Use fictional or generic landmark names unless a brand agrees.)

---

## 13. Real Ghana, learning and exploring

### 13.1 Explore Ghana

- Every player has the **Explore** app. Players from abroad see it first, as three swipeable place cards when they walk out of the airport ("Where to first?" · "See all places" · "Just walk around"). Never more than three cards; cards hide while moving.
- Free-world players get at most one or two gentle suggestion cards a day, based on where they are and the time.
- **Each card:** a real photo, name, travel time. Tap for a short real video (tap to play) and a few lines.
- **Accra sites:** Kwame Nkrumah Memorial Park, Independence Square and the Black Star Gate, the National Museum, the Centre for National Culture (Arts Centre), the W.E.B. Du Bois Centre, Jamestown Lighthouse, Osu Castle, Labadi, Kokrobite and Bojo beaches, Makola, Kantamanto, Aburi Botanical Gardens, Shai Hills, Ada.
- **Akwaaba Stamp Book:** a stamp for each place visited, food tried, greeting learned. A full book gives the title "Accra Expert". (In-game only. No real passport or document is ever asked for.)

### 13.2 Photoreal pockets

- The open city stays fast and simple. **Walking into a real site opens a "pocket" that looks almost exactly like the real place,** captured from real photos and video of that site (for example with a photo-scan technique such as Gaussian splatting for small fixed spaces).
- **Light tier:** 360° photos of the same rooms instead.
- **Inside:** tap an exhibit for its story, photos and narration (English or Twi). Tap "Watch" for an **embedded official YouTube video** (for example historic footage of Nkrumah's "Ghana, our beloved country, is free forever"). Videos never autoplay, show their size first, low quality by default.
- Captures need the person to photograph or film sites themselves (inside sites usually need the site's permission).

### 13.3 NSS and apprenticeships

- **University graduates: NSS posting** to the museum, a radio station, a tourism office, a school or a newspaper. Posting tasks are short missions at that place. Small monthly allowance (setting; master plan has the real figure to verify), bonuses for good work, a certificate after the service year (a few weeks of play) that unlocks better jobs. Ghanaian humour: the supervisor who is never in, the late allowance.
- **SHS graduates and Nigerians: apprenticeships** at a garage, a tailor, a chop bar or a radio station, plus hustle missions from Kofi and Auntie Esi.

### 13.4 Learning in small doses

- **A phrase a day** from a market auntie (Twi, Ga, Ewe or Pidgin); use it that day for a small reward.
- **"Did you know?" cards** on first visits.
- **Radio facts** between songs on Ghanaverse FM. Every fact is checked before use.
- **Greetings and respect:** greet elders properly and give with the right hand for better prices and jobs.

---

## 14. Social features

### 14.1 Voice and text

- **Nearby voice:** hear people near you, louder when close. With strangers, hold to talk. In a crowd, only the closest few voices (about 8).
- **Compound voice group** and **friend or crew groups** (up to about 8), open mic allowed.
- **Inside a trotro,** passengers share one voice group.
- **Text always available:** small chat box and quick phrases.
- **On screen:** one mic button; a small glow above a speaking player's head.
- **Weak connection:** voice switches off automatically, text keeps working.
- **Voice is never recorded.**

### 14.2 Friends

- After talking with someone for a while, a small card slides up: "Add Kwesi_Ada as a friend?" **Both must accept.**
- Friends appear in **Contacts** with an online dot.
- **Call friends any time,** anywhere in the city: their phone rings, they pick up, voice call.
- **Meet up:** share your location with a friend for 10 minutes; switches off automatically.
- Friends can join free-world jobs, crew heists and "Bring a friend" missions.
- **The map shows lively places right now** ("Labadi Beach: busy") so people know where to meet.
- No real-life meetups are built.

### 14.3 Phone calls from story characters

- Ringtone (highlife), a small caller card slides in. Answer or decline. The character lifts the phone to their ear while the player keeps walking or driving.
- **Reply by choosing** 2 or 3 options (not free speech to computer characters). Choices change the reply.
- Missed story calls wait; an icon stays on the map.
- Touches: Uncle calls mid-chase to ask if you have eaten; bad network during dumsor ("Hello? Hello? You're breaking…"); callers greet properly first.
- **No email app, no messages app.** Missions come by calls and map markers only.

### 14.4 City Feed and chat

- **City Feed** mixes automatic city events ("Bank robbed at Airport City", "Party at Labadi tonight") with chat from **your district only.**
- **Laptop and desktop:** chat floats over the game like a livestream (lower left, no box, text with soft shadow, fades after a few seconds, max 5–6 lines, game events in gold, dims automatically during heists, chases and cutscenes, one key to toggle, adjustable transparency).
- **Phone:** no chat on the main screen; City Feed is an app in the phone; a small dot shows new activity; big moments appear as a brief one-line banner.
- Slow mode when busy, filters for insults, phone numbers and links. Guests read only.

### 14.5 Safety

Nicknames only; chat blocks phone numbers, emails and addresses; one-tap mute, block, report; a personal space bubble; voice from friends only option; never show exact location except Meet up; trust levels for new accounts; bans by account and device clues.

---

## 15. Sound and people

### 15.1 Sound of Accra

- Layered ambient loops per area and time: horns everywhere, engines, brakes, okadas, mates shouting routes, hawkers ("Pure water!"), market bargaining, shop music, preachers with megaphones, loudspeaker vans advertising, street football, beach waves and drumming.
- Circle and Makola very loud; Osu at night music and laughter; residential streets quieter.
- Sunday morning church choirs; the call to prayer at prayer times; generators humming during dumsor.
- Only nearby sounds play, with a cap on simultaneous sounds.

### 15.2 People

- A wide mix: Akan, Ga, Ewe, Northern Ghanaians, Fante and others; Muslim women in hijabs and veils, Muslim men in kufi caps, batakari smocks and kaftans (especially in Zongo areas like Nima and Maamobi); Christians in Sunday best; kayayei carrying head pans at Makola and Kantamanto (shown with dignity, never targets or jokes); traders, mechanics, students, office workers, hawkers, pallbearers, elders on verandas, children playing football, Nigerians living in Accra.
- Variety from a few body types with many combinations of clothes, head wraps, caps and colours.

### 15.3 Voice lines (short, reused, real Ghanaian voices)

- Computer characters speak in Ghanaian accents, mixing English, Twi, Ga, Ewe, Hausa, Dagbani and Pidgin, with English subtitles.
- Examples: "Kwasia, drive faster!" · "Gyimii! Are you blind?" · "Circle! Circle! One more seat!" · "Ei! My tomatoes oo!" · "Chale, take the gutter side!" · "Abeg, how much last price?" · "Ayekoo, my brother!"
- **Allowed:** everyday street talk (kwasia, gyimii). **Never:** tribal or ethnic insults, religious insults, anything sexual.
- **"Street talk" setting:** on by default; players can switch to cleaner language.
- A few hundred short lines (1–2 seconds each), recorded by Ghanaian voice actors.

---

## 16. Crime, police and heists

### 16.1 Who can be involved

- Only players who **choose the street path** (story or free world) can be chased, robbed, targeted or shown as wanted. Normal-life players are never chased or arrested by mistake.
- **Fictional only:** banks, police force, gangs, businesses. No real robberies, no mobile money fraud, no internet fraud (sakawa), no elections, no real religious leaders.

### 16.2 Police and heat

- Heat stars rise with crime. Police cars on real roads, roadblocks, checkpoints (only for players with heat), spike strips, a helicopter after big heists.
- **Police is a real career:** police players get alerts and chase robbers live. Computer police always provide a presence.
- **Caught:** fine, lost share, short jail time, lost Vibe.
- Police stations: pay fines, get released, start a police career.

### 16.3 Most Wanted

- Live ranking of the city's most wanted street players: character face, nickname, crimes, bounty.
- On big screens and on wanted posters on walls.
- Number 1 triggers a city-wide alert ("Most Wanted spotted in Osu").
- Off the list by being caught, paying, serving time, or lying low for a few days.

### 16.4 Fictional rough areas and gangs

| Place | What happens |
| --- | --- |
| Borla Hills (with Scrap Kingdom) | Chop shops for stolen cars, scrap deals, gang hideouts in containers |
| The Old Port | Smuggling, night boat runs, warehouse deals |
| Dumsor City | Underground boxing, illegal street races, a generator-lit black market |
| Tokro Junction | Gang meetings under an unfinished flyover, hidden stashes, lying low |

- Placed on empty land or as new areas, never on top of a real neighbourhood and never with a real neighbourhood's name.
- A quiet note on entry: "Borla Hills: rough area." Normal-life players can visit; gangs ignore them unless provoked.
- **Real districts get personalities from energy, not crime** (Nima lively, Circle and Kaneshie chaotic, Osu nightlife, Jamestown old and proud, East Legon and Airport City rich and calm). Never label a real neighbourhood as criminal.
- Areas where players commit many heists become temporarily "hot" with more police.

### 16.5 Heists

- **Structure:** setup missions → choose quiet or loud → finale with roles → split the take.
- **Free-world heists with crews of real players** (separate from the story). Plan at the crew hideout.
- **Scores:** star ratings (speed, stealth, loot, nobody caught), a record wall at each bank, **Heist of the Week** with a weekly leaderboard and a twist.
- **Things go wrong:** dumsor ends early, the getaway trotro breaks down, rain, a crew member's phone rings, Circle is jammed.
- **The Dumsor Job** becomes available in a district when a dumsor event hits that district.
- **Heist list (start with a few, add over time):** The Dumsor Job, The Gold Run, Trotro Getaway, Pallbearer Escape, Sky Thief, The Airstrip Job, Okada Rush, Ananse's Con, The Jollof Heist, Bring It Home (recover stolen gold artefacts from a foreign collector's yacht), Harmattan Run, The Livestream Disaster, Waakye Truck Getaway, Jailbreak, Two Crews One Vault, The Pragya Chase, Jamestown Rooftops, The Harbour Job, The Railway Chase, Match Day, The Haunted Bank, Robin Hood of Nima, Frenemies Heist (two Ghanaians and two Nigerians with secret objectives).
- Payouts checked and capped by the server; cooldowns on big heists.

---

## 17. News and big screens

- **Big screens** at Circle, Osu, Accra Mall, the airport roundabout, the Tema motorway and Madina rotate four things: Most Wanted, Ghanaverse News, ads, and "Tonight in Ghanaverse".
- **Ghanaverse News:** replays of real player moments (chases, heists, record holds), re-rendered in the game from recorded movement data (no real video sent), with a headline and ticker. Good news too ("Best chop bar in Osu", "New okada race record").
- **Anchors:** Auntie Akos ("Chale, this one too!") and Chidi from Lagos ("Wahala dey!").
- The same stories run on the in-game TV, Ghanaverse FM and the Ghanaverse Times newspaper.
- Players can opt out of appearing by name.

---

## 18. Ads and the advertiser page

### 18.1 Ad spaces (all inside the world, never pop-ups)

Billboards, building walls and rooftop signs, bus stops, stadium boards, container kiosks and chop bar umbrellas, loudspeaker vans, and **moving ads on computer-driven trotros, taxis, buses and delivery vans** that drive their real routes. Sponsored moments on Ghanaverse FM. Player-owned vehicles never carry ads, and players are never paid for ads.

**Placeholders first:** fictional brands, our own events, and "Your ad here".

### 18.2 Prices (per week, always below Lagos Life)

| Space | Ghanaverse | Lagos Life, as reported (Oct 2026) |
| --- | --- | --- |
| Kiosk or umbrella | ₵25 | No equivalent |
| Small street sign or poster | ₵35 | Billboards from ₦5,000 (about ₵42) |
| Big billboard at a busy spot | ₵350 | Billboards up to ₦250,000 (about ₵2,100); airport ₦500,000 (about ₵4,250) |
| Building wall or rooftop | ₵450 | |
| Trotro route pack | ₵250 | No equivalent |
| Citywide fleet | ₵900 | No equivalent |
| Event takeover | ₵600 per event | |

Shared billboards rotate several businesses at a lower price. Launch offer: first week free or half price for small Ghanaian businesses. Re-check exchange rates before setting final prices.

### 18.3 The advertiser page (separate web page, shareable link or QR code)

1. Pick a spot on a small map (price and typical traffic shown).
2. Upload the image, business name and a link (WhatsApp, website or Instagram).
3. Pay (manual mobile money at first; Paystack later).
4. Review within a few hours (no scams, betting, adult content or politics), then live.

No account needed; the business gets a **private results link** showing daily views (including each time a trotro carrying the ad passes a player), people reached, taps (tapping a billboard or passing trotro shows a small card), best districts and times, and a shareable weekly report.

**Counting fairly:** a view counts only if the ad is visible on screen, large enough, for at least a second; the same player counts once every few minutes; counts are sent in small batches.

---

## 19. Shop and payments

### 19.1 Two kinds of money

- **Sika:** earned by playing. Buys everything in the game. **Never sold.**
- **Gold coins:** bought with real money. **Buy style and social extras only.** Never cashed out, never turned into Sika, never refunded except where law requires.

### 19.2 Gold coin bundles

| Bundle | Price |
| --- | --- |
| 100 Gold | ₵10 |
| 550 Gold (+10%) | ₵50 |
| 1,200 Gold (+20%) | ₵100 |
| 2,600 Gold (+30%) | ₵200 |

### 19.3 Big Man Pack: ₵99 (launch price ₵79 for the first month), shown as "worth 3,000 Gold"

- **Themes:** Ewe Indigo, Accra Dusk, and exclusive Midnight Gold (Royal Kente stays free).
- **Wardrobe:** designer white agbada, kente-trim suit, Friday Wear outfit, smock, gold chain, designer sunglasses, sneakers, watch.
- **Ride:** three luxury paint jobs (one kente-stripe), custom plate "BIG MAN" plus nickname, custom trotro-style horn tune.
- **Home:** penthouse decoration set in any theme, big TV and sound system playing Ghanaverse FM, neon sign with your nickname.
- **Status:** gold name tag, "Big Man" or "Big Woman" title, VIP badge (walk straight into clubs and concerts), gold-confetti "AYEKOO!", three dances (Azonto, Shaku Shaku, a celebration dance).
- **Bonus:** 500 Gold.
- **No money, homes, cars or shortcuts.**

### 19.4 Other items

| Item | Price guide |
| --- | --- |
| Spray money (party notes to spray at weddings, birthdays, concerts; show only, never real value) | About ₵5 a stack |
| Radio shout-out on Ghanaverse FM | About ₵2 |
| Billboard shout-out for an hour in one district | About ₵5 |
| Host your own event (Labadi beach spot, Osu rooftop, compound yard) | ₵20–100 |
| Barber and makeover visit | About ₵10 |
| Caller tune or ringtone | About ₵3 |
| Gifts for friends | Item price |
| Player-made kente designs sold to other players (we keep a small share) | Set by creator |
| Hustle Pass premium track, per season (free track for all) | About ₵30 |
| Second character slot | About ₵20 |

**Later:** a "Big Man Club" monthly pass (about ₵30: a monthly outfit, weekly Gold, a monthly VIP party).

### 19.5 Rules

- Small prices, mostly ₵2–₵30.
- **No mystery boxes or lucky draws.**
- **No paying to skip waiting,** no energy paywalls.
- **Nothing that makes a player richer or stronger.** No paid rich start.
- Clear price and a confirm button before every purchase.

### 19.6 Payments

- **Paystack** (mobile money and cards) for Gold coins and ads. Needs a **registered Ghanaian business** and a verified Paystack account. Check current fees.
- A short terms page: coins are for in-game items only, cannot be cashed out.
- **Until then:** the zero-dollar plan applies. Ads are placed by hand after a manual mobile money payment; no in-game purchases.

### 19.7 Business income

Ads; featured places on the Explore map (free listing, paid "featured" with photos, "Tonight's special", top suggestions); brand-sponsored events; song premieres on Ghanaverse FM and the Ghanaverse Charts; school virtual field trips; product launches at city venues; creator codes for streamers.

---

## 20. Culture and fun systems (keep, add over time)

- **Chiefs, not governors:** district stools, enstoolment by community vote with palanquin and drums, destoolment if people are unhappy (fictional stools only).
- **Asafo crews:** crews are "companies" with their own flags.
- **Masquerade nights:** masks on, names hidden, unmask at midnight by choice; a rooftop club in Osu where everyone dances floating at midnight.
- **The family house:** family calls for school fees, funeral contributions; outdoorings, weddings, funerals as events; the knocking ceremony with the famously long list.
- **Festivals and real days:** Homowo, Chale Wote, 6 March parade with a fly-past by player pilots, Detty December (returnees flood the city), Black Stars match nights at fan zones, Friday Wear bonus, Saturday clean-up event.
- **Ghana Twin:** real Accra weather and real time of day in the game.
- **Small games:** Oware against Whot, Ludo, draughts, penalty shootout, Haggle Off, Wahala Court, Pidgin Guess, Mate's Change, Suya and Waakye Rush, daily games (Daily Route, Name the Spot, Sound of the City), the Gold Key Hunt (three keys, a clue each week, optional; the last key opens only when a Ghanaian and a Nigerian turn their keys together), Ghanaverse League (district five-a-side clubs), races (night street races, okada races, helicopter rings).
- **Music and film:** Ghanaverse FM (player DJs, call-ins, shout-outs), Ghanaverse Charts (independent artists upload songs they own), Kumawood against Nollywood movie night (official trailers only), open mic night.
- **Ghanaverse Times** newspaper written from player events.
- Respect rules from the master plan's culture calendar apply.

---

## 21. Removed or rejected ideas (do not build)

- The Golden Pot, the Quick Draw quiz and the Ghana-vs-Nigeria Pot rivalry.
- Nana's Will / the Ready Player One-style legend frame (the Gold Key Hunt replaces it in simple form).
- Email and messages apps in the phone.
- Free voice conversation with computer characters (later, maybe an optional "say it out loud" for the shown choices, recognised on the device).
- Friends playing whole chapters together (only "Bring a friend" missions).
- Paid rich start, "Borga" start, selling Sika.
- Real food ordering and real mobile money transfers between players.
- Weapons (for now).
- Real celebrities (for example Shatta Wale), real robbery stories, real neighbourhoods labelled as criminal, kayayei as targets or props, police bribes at checkpoints, betting adverts, mystery boxes.
- "Ghanaverse Gives Back" community donations (not for now).
- Chores (sweeping, fetching water, bathroom queues).
- The Reveal Ladder from the master plan is simplified into mutual "Add friend" plus "Meet up" (location share for 10 minutes). Real-life meetups are not built.
- Planes to other regions (Kumasi, Tamale, Lagos) until the map grows.

---

## 22. Changes to the master plan's engineering

### 22.1 Rendering approach: decide with tests first (most important open decision)

**Where the code is today (see `docs/PROGRESS.md`):** the repository already follows the map-first path. MapLibre draws Greater Accra from self-hosted Protomaps tiles with 3D buildings (painted walls, zinc or terracotta roofs), quality tiers, walking on real roads with A*, live Durable Object rooms, chat, 420 simulated vehicles and planes. Three.js is used only on the character test page (`/char-test.html`).

This brief asks for a **third-person open-world feel** (camera behind the character, driving an okada, chases, flying). Before building new features:

1. **Finish the pending week-one checks** listed under "Waiting on the owner" in `docs/PROGRESS.md`, especially Test 1b (`/char-test.html`) on the cheapest Android.
2. **Prototype A (extend what exists):** keep MapLibre for the city; add a close, low, pitched camera that follows behind the avatar; draw the player, nearby people and vehicles as real 3D through a three.js custom layer inside MapLibre (the nearest few in 3D, the rest as today); add a joystick and direct control for walking and an okada.
3. **Prototype B (only if A fails the budget):** build a small 3D scene of about 1 km² around Circle from OpenStreetMap data in three.js (extruded buildings, roads, props, level of detail), with MapLibre kept for the phone map and minimap.

**Test:** third-person walk and okada ride around Circle with 15 cars, 20 people and street props, on the cheap Android on mobile data. Measure frames per second, first-load size and time, and memory. Prefer A, because it reuses everything already built. Record the result in `docs/PROGRESS.md` and the risk register.

### 22.2 Other changes

- **Movement:** joystick and direct control replace click-to-move. Send position only when direction changes and at a capped rate to nearby players; animate in between. Heist crews and chases send more often but only to the crew and nearby players. Measure against the free-plan request limits.
- **Voice:** nearby voice and the compound group are core features (master plan had nearby voice in Phase 2; keep private groups first if needed for limits).
- **Story missions run on the player's device** (scripted scenes, computer characters, chase routes); the server checks only mission start, completion and payout.
- **Payments:** Paystack for Gold coins and ads after the business is registered (master plan had no payments at launch; keep zero-dollar until then).
- **Controllers:** add Gamepad API support.
- **Platforms:** Android TV via browser, usually Light tier.

---

## 23. Build order

Each step ends with its "done when" test and a cheap-phone performance check.

1. **Finish the week-one checks still pending in `docs/PROGRESS.md`,** then the rendering prototypes in 22.1. The existing opening (Akwaaba screen, glide to Black Star Square, area tour) stays until the new start screen and opening films replace it in step 2 and step 4.
2. **The look:** Royal Kente start screen (three taps), clean HUD, minimap, quality tiers, controller and keyboard input.
3. **The city:** a slice of Accra around Circle and Kaneshie with traffic, people, street life, sound layers, day and night.
4. **The opening:** opening films (in-engine), the journey and first day (solo bubble), arriving at the compound.
5. **Social core:** accounts and guest mode, compound house with real neighbours and computer fill, nearby voice, compound voice group, text chat, add friend, calls.
6. **Free world core:** energy, Sika, jobs with markers and calls, rides with cinematic journeys, route pointer, rent and two years' advance, log-off summary.
7. **Chapter 1** with the mission system (cards, cinematics, AYEKOO, checkpoints, reply choices).
8. **Chapters 2 and 3,** police and heat, the Dumsor Job.
9. **Explore Ghana** with place cards, the first photoreal pocket (Kwame Nkrumah Memorial Park), stamp book, NSS and apprenticeships.
10. **Big screens, news, Most Wanted, City Feed and stream-style chat on laptops.**
11. **Chapters 4 and 5,** endings, Empire and Cases modes.
12. **Flights, helipads, fictional destinations, boats.**
13. **Ads page and moving ads,** then **shop and Paystack** once the business is registered.
14. **Season 2.**

Rule of three still applies: no more than three big features in progress at once.

---

## 24. Content sourcing and licences

- **Use only content that is free to use or our own.** "Online" does not mean free.
- **Good sources:** Wikimedia Commons (credit, sometimes share-alike), Mapillary street photos (credit, share-alike; reference for building streets), OpenStreetMap (credit), Unsplash and Pexels (care with recognisable people and brands), public domain archives (check each item), Sentinel satellite images (credit), official YouTube embeds (only where embedding is enabled; never download and re-upload).
- **Our own content:** the person's own photos, videos and sound recordings around Accra (outdoor public spaces are fine; inside museums and paid sites usually needs permission). A shot list per place can be prepared.
- **Keep a credits list** in the game for every source that needs credit, and a sources file recording where every asset came from and its licence.
- **Folklore:** kente, adinkra, Ananse, festivals stay in, made in our own versions. Keep a swap list of Ghanaian alternatives. Contact Ghana's National Folklore Board when the game earns real money.
- **Real brands and celebrities:** only with written permission.
- **Ghana's Data Protection Act** applies to the little data kept; a clear privacy page before launch.

---

## 25. Open decisions

- Chapter 1 name: "Fresh from [hometown]", "Small Small" or "JJC".
- Rendering approach (22.1), decided by tests.
- Final ad prices in cedis at the current exchange rate.
- When to register the business for Paystack.
- Midnight Gold theme colours.
- Which cheap Android phone is the official test phone (from the master plan).
- Voice actors for English, Twi, Ga, Ewe, Hausa and Pidgin.
- Which real sites to capture first, and permission letters to the Kwame Nkrumah Memorial Park and the National Museum.
- Trademark and domain check for "Ghanaverse".
