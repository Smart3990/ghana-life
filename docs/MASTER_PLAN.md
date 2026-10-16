# Ghana Life: Master Plan (text copy)

> Extracted from docs/Ghana_Life_Master_Plan.pdf. Tables lost their layout; the PDF is the original.

Ghana Life: Master Plan 
Updated Oct 9, 2026 (revision 2: quality tiers, risk register, week-one sprint) 
Summary 
Ghana Life is a free browser game where people live a Ghanaian life in a realistic virtual Ghana. Accra is 
the default home, and the whole country can be explored. Players meet in real time, talk by text and 
voice, go to school or learn a trade, work, run businesses, marry another player, vote, and travel. It runs 
from a link, with no download. 
Why it can win. Lagos Life showed that a free, shareable, locally flavoured life world can reach millions 
of players in days. We go further with a real-looking map of the country, live voice, Ghana's school and 
national service path, marriage between two real players, elections, and a business tool that lets local 
sellers promote themselves for less. 
Decisions already made 
• Browser first, installable later, never required. 
• Accra is the default, and the whole of Ghana is on the map. 
• A real-map engine built from open data, instead of hand-drawn maps. 
• Moving traffic is simulated on real roads. 
• Voice is optional: private rooms for friends come first (Phase 1), and nearby voice on the open 
map follows later. 
• The NSS allowance follows the real figure. 
• Banner prices sit below Lagos Life's reported rates. 
• Everything is 18+, and crime and gang play is fictional and consensual. 
• Three quality tiers (Light, Standard, Ultra) are picked automatically, so weak phones run 
smoothly and strong devices get the full look. 
• People and vehicles are drawn with a light 2D engine (PixiJS) above the map. 3D is loaded only 
on Ultra. 
• Week one builds a test version that proves speed on cheap phones. It is not the full game. 
• Players are anonymous by default and share more about themselves only by mutual choice, step 
by step (the Reveal Ladder). 
• Public launch leads with three signature features: the alive map, the Reveal Ladder with private 
voice, and the Ghana culture calendar. Everything else waits. 
• Scale by design: static-first files, simulation on each player's phone, many small rooms and 
admission control, so growth is gradual and overload becomes a queue, not a crash. 
Version 1 (first playable). A real-looking Accra map, a walking avatar, live chat, a few moving cars, need 
bars, one job and rent. Everything else follows in phases (see the roadmap). 
Honest expectations. Lagos Life's first four days were an exceptional case. Treat revenue as a result of a 
good game and an audience, not as something we can promise. 
No lag, honestly. Nobody can promise zero lag for every player on every phone. What we can promise is 
a game that is measured against a performance budget, that draws less when a phone struggles, and 
that is tested on a cheap Android before anyone else sees it. 
Scale, honestly. One million registered users is a design target, not a promise. The plan is free while 
small and cheap in proportion when large. Growth is controlled by invite waves, a waiting line and a 
spending limit, so overload becomes a queue, not a crash. 
How to use this document with Claude 
This is the single source of truth for the project. To build with it, give Claude the whole document, then 
work one task at a time from the "Build brief for Claude" section near the end. Each task there has a 
prompt you can paste, and a "done when" test that must pass before moving on. The rest of the 
document explains the design and the reasons behind it. Where this document says Claude must or 
must not do something, treat it as a rule. 
One honest note on scope: the goal is the same kinds of features as Lagos Life, built as our own game 
with our own names, text, art and code. It is not an exact copy, and it must not become one, for legal 
reasons explained in the legal section. 
Read first. The sections "Quality tiers and performance", "Look and feel", "Risk register" and "Week-one 
sprint" were added in revision 2. If they disagree with older text, they win. Claude must follow the 
performance budget on every task. 
Zero-dollar plan 
The whole first version must cost nothing. No paid plans, no payment card, no purchased domain, no 
paid services and no payment processing inside the game. Before adding any tool, Claude must check 
that it works with no payment method. 
Part Zero-dollar choice Free limit At the limit 
Game files and map file Cloudflare Pages Unlimited static 
requests and 
bandwidth, 500 builds 
a month. Maximum 25 
MiB per file and 20,000 
files 
Cut the map into 
several smaller files, 
each under 25 MiB. If 
that is not enough, use 
GitHub Pages as a 
backup 
Live rooms Cloudflare Workers 
with Durable Objects 
(free plan, built-in 
storage) 
100,000 requests a 
day, 13,000 GB-
seconds of compute a 
day, 100,000 stored-
row writes a day, 5 GB 
storage. Incoming 
WebSocket messages 
Calls fail until the daily 
reset at midnight UTC, 
which is Ghana time 
Part Zero-dollar choice Free limit At the limit 
count as 1 request per 
20 messages 
Voice Cloudflare Realtime First 1,000 GB a month, 
no card needed to start 
Cap voice use in code 
and keep a kill switch 
Map software MapLibre GL JS and a 
Protomaps basemap 
cut for Accra 
No licence fee None 
Accounts Nickname and 
passcode stored in 
Durable Object storage, 
no email 
Same daily row limit Guests can still browse 
Moderation Word list in code, a 
report button, and you 
reviewing reports 
None None 
Payments None inside the game 
at launch 
None Banners are placed by 
you after an agreement 
outside the game 
Code and coding help GitHub free, Claude's 
current plan 
Message limits on 
Claude's free plan 
Build slower, one task 
at a time 
Art and sound Your own, or packs 
licensed for free 
commercial use 
Check each licence Use fewer assets 
What the zero-dollar plan can handle (estimate, to be load tested). The binding limit is the 100,000 
requests a day. At 1 request per 20 incoming messages that is about 2,000,000 messages a day. If each 
active player sends about one message every 4 seconds, that is 900 an hour, so the plan supports 
roughly 2,200 player-hours a day, for example about 500 players for around 4 hours each. This is an 
estimate based on published limits and my assumptions, so measure it. 
Design rules that keep it inside the limit 
1. Click-to-move, not streaming. A player sends one message when they choose a destination, and 
others animate the walk. Why: it cuts messages by more than 90 percent compared with 
sending positions many times a second. 
2. Server messages out to nearby players are free, so broadcast results freely, but keep incoming 
messages few. Why: only incoming messages count. 
3. Send chat only when typed, and a heartbeat no more than once a minute. 
4. Keep positions in memory, and write to storage only for important events such as jobs, wallet 
changes and rent. Why: stored-row writes are limited to 100,000 a day. 
5. Use the WebSocket hibernation API so idle rooms stop using compute. 
6. Count usage in code. At about 90 percent of the day's limit, show "the city is resting until 
midnight" to new arrivals. Why: a friendly message is better than random failures. 
What zero dollars cannot do. It cannot give unlimited players, a satellite look (needs a card), email 
password reset, or taking real payments in the game. Why: each of those needs a paid or card-backed 
service. They are later upgrades paid for by income. 
No strong computer needed. Once deployed, nothing in this plan runs on your own computer. The 
game files, the map files and the live rooms all sit on Cloudflare's free servers, so players never connect 
to your laptop. "Self-host" in this plan means putting our own map file on Cloudflare Pages, not running 
a server at home. Your computer is only used to write code and deploy, so a modest laptop is enough 
(about 8 GB of memory is comfortable, 4 GB is tight). If it is too weak, use GitHub Codespaces, a free 
coding environment in the browser (check its free monthly hours and that no card is needed). The tool 
that cuts the map is expected to download only the Accra region, not the whole world, and T2 confirms 
this. 
Alternatives considered 
Option Why it is not the default 
Firebase Realtime Database, free Spark plan Limited to 100 simultaneous connections 
Supabase free plan 200 live connections, and projects pause after 7 
days of no use 
Oracle Cloud Always Free server Needs a card to sign up, capacity is hard to get, 
and its free ARM allowance was reported halved 
from 18 August 2026 
Mapbox satellite Needs a card on file 
Running the server on your own computer Free but must stay on all day 
Sources: Cloudflare plans, Cloudflare Durable Objects pricing, Cloudflare Realtime pricing, Firebase 
Realtime Database limits, Supabase Realtime limits 
The world 
A real map, no drawing. The game world is the real map of Ghana, built from open data and shown in 
the browser. Players, vehicles and places sit on top of real streets, so Accra looks and feels like Accra. 
Interiors such as a chop bar, a club, a hospital or a game centre open as simple illustrated scenes. Why: 
you get a realistic country with almost no hand-drawing, and travel is just moving the map. 
Two looks, one engine 
Look What it is Cost and risk When 
Stylised map The real streets and 
buildings in our own 
bright colours, from 
Free to host yourself, 
light on mobile data 
Version 1 
Look What it is Cost and risk When 
OpenStreetMap 
through Protomaps 
and MapLibre 
Satellite view Real aerial photos 
under the same game 
Mapbox offers satellite 
and free 50,000 map 
loads a month, then 
about 5 dollars per 
1,000, and needs a 
card. Heavy on data. 
Check its terms for use 
in a game 
Later, as an optional 
switch 
Imagery to avoid or check. Do not use Google satellite imagery in the game: Google says satellite view 
falls under Google Earth's commercial restrictions and bans tracing roads from it. OpenAerialMap offers 
free imagery, but coverage is patchy and licences vary by image (many are CC-BY, some are not), so 
check each one. Why: licence problems are expensive to fix after launch. 
Moving traffic. Real live traffic data is not needed. Cars, taxis, trotros, tricycles, motorbikes, bicycles and 
pedestrians are simulated along the real road network. Everyone sees the same traffic because it runs 
from a shared clock and seed, so it costs no network data. Rush hour, rain and power cuts change how it 
moves. Why: it looks alive, and it is free to run. 
Light mode. A data-saving mode with the stylised map, fewer vehicles and no satellite. Why: many 
Ghanaian players are on limited mobile data. The three tiers are set out in the next section, "Quality 
tiers and performance". 
Places. About 100 hero landmarks get illustrated interiors, and thousands of other places come from 
open data with generic names. Public landmarks use real names, and private businesses use generic or 
invented names until the owner claims the place. Examples: the presidency building, hospitals, 
universities, the airport, Makola and Kantamanto markets, Oxford Street, Labadi Beach, the stadium, 
game centres, nightlife, churches and mosques. Why: it covers popular and unpopular spots without 
implying a business has joined. 
Travel across Ghana. The same map covers all 16 regions, so players travel by trotro, bus, taxi, ride app 
or a domestic flight, which costs Sika and time. Detail grows region by region: Greater Accra first, then 
Kumasi, Cape Coast, Tamale and others as players vote. 
Characters. A layered creator with a wide range of skin tones, hairstyles such as braids, locs, short cuts 
and headwraps, and clothes from uniforms to kente. Start semi-realistic and improve later. Why: players 
want to see themselves, and heavy realism is slow to produce. The method is set out in the section 
"Characters and avatars". 
Quality tiers and performance 
The idea. One game, three quality tiers. On first load the game checks the device and runs a five-second 
frame-rate test, then picks Light, Standard or Ultra. The player can switch in settings, and the choice is 
remembered. Why: weak phones stay smooth, strong devices get the full show, and we build one game, 
not two. 
Where lag really comes from. In map games, most lag comes from the phone drawing too much, then 
from slow or unstable networks, and last from the server. So the first fixes are drawing less and sending 
less. 
The three tiers 
Tier Who gets it What is drawn Target 
Light Older or low-memory 
Android phones, slow 
or data-saver 
connections 
Flat stylised map, no raised buildings, up to 
about 15 cars, about 20 avatars nearby, 
planes as simple sprites, no weather 
particles, flights skip the cinematic 
30 frames per 
second, smallest 
download 
Standar
d 
Most mid-range 
phones and laptops 
Stylised map with simple shadows, 
buildings raised near the player only, about 
40 cars, clouds, day and night tint, ambient 
planes, a short flight cinematic 
45 or more frames 
per second 
Ultra Recent phones, 
laptops and desktops 
with a good graphics 
chip 
Tilted camera, 3D buildings, about 100 cars, 
a 3D plane model, rain and night lights, 
dumsor blackout waves, full flight cinematic 
60 frames per 
second 
All numbers here are starting targets. Test 1 in the week-one sprint decides the real ones. 
Automatic downgrade. If the frame rate stays below the tier's target for about 3 seconds, the game 
removes detail one step at a time: fewer cars, then effects, then raised buildings, then it moves to the 
next tier down. It never upgrades by itself during play, it offers a button instead. Why: lag is fixed by 
drawing less, not by waiting. 
Engines considered 
Option Verdict Why 
MapLibre GL JS Use Draws the real map in WebGL, is free, works with 
PMTiles, and has tilted cameras and raised buildings built 
in 
PixiJS Use, confirm in 
Test 1 
Fast 2D drawing of many small sprites, free and open 
source. Good for avatars, cars, shadows and effects 
drawn above the map 
Option Verdict Why 
three.js Use on Ultra 
only 
Needed only for the 3D plane and special effects, so Light 
and Standard never download it 
Phaser Not now A good 2D game engine, but it usually wants to own the 
whole screen, which clashes with a real map as the base 
Unity, Godot or Unreal 
on the web 
No Web builds are usually large and heavy on weak phones, 
and they are not made for streaming a real map 
deck.gl Backup Strong at drawing many moving points on a map, but a 
bigger library. Keep it as a fallback if sprites turn out too 
slow 
Why not a single big game engine: a Ghanaian player on mobile data will leave if the first load is slow. 
Small libraries, loaded only when needed, keep the first load short. 
How we keep it light 
• Draw only what is on screen, and only the nearest players and cars. 
• Use one shared sprite sheet for avatars and vehicles, and reuse sprite objects instead of creating 
new ones. 
• Run traffic and plane paths in a Web Worker, away from the drawing code, so the screen stays 
smooth. 
• Cap pixel density (about 1.5 on Light, 2 on the others). Why: phones draw many more pixels for 
little visible gain. 
• Cache the map and game files on the phone with a service worker, so the second visit is fast and 
costs no data. 
• Compress pictures (WebP) and use short audio clips. Load voice, 3D and flights only when first 
needed, never in Light. 
• Cut the map into several small files. Each file must stay under 25 MiB, which is the Cloudflare 
Pages limit per file (confirmed in Cloudflare's documentation). 
• Animate other players between messages, so a slow network looks smooth instead of jumpy. 
• Show a loading screen with real progress and a data-saver switch that tells players roughly how 
much data they use. 
Performance budget 
Measure Light Standard Ultra 
Game download before the map 
shows 
Under 3 MB Under 8 MB Under 20 MB 
Seconds until the map shows, on 
4G 
Under 5 Under 5 Under 8 
Frames per second 30 or more 45 or more 60 
Measure Light Standard Ultra 
Cars drawn at once Up to 15 Up to 40 Up to 100 
Avatars drawn at once Up to 20 Up to 40 Up to 80 
Messages sent per player Under 10 a minute 
on average 
Under 10 a minute 
on average 
Under 10 a minute 
on average 
These are targets, not measured facts. Measure them on real phones with Chrome remote debugging, 
Lighthouse and our own frame-rate overlay. 
Official test phone. Pick the cheapest Android phone you or a friend has (about 2 to 3 GB of memory). If 
the game is smooth there, it will be smooth on most phones. Test also on one mid-range phone and one 
laptop, and open the link inside the WhatsApp browser. 
Look and feel: realistic, alive, exciting 
Honest limits. At zero dollars, "realistic" means a real map of Ghana in our own beautiful style, not 
photographs. The city feels real because of motion, light and sound, not because of satellite pictures. Do 
not promise photo-real graphics, a perfect no-lag game or unlimited players. Promise this: smooth on 
cheap phones, beautiful on good ones. 
What makes it feel real 
• Real streets, rivers, lagoons, beaches and parks from open data, coloured in our own palette. 
• Buildings raised to their real height where the data has it, and a standard height where it does 
not. Map data is patchy in parts of Ghana, so spot-check each district. 
• Day and night that follow Ghana time, with street lights, shop lights and car lights switching on 
at dusk. 
• Weather: harmattan haze in the dry season, and rain with wet roads and slower traffic in the 
wet season. 
• Dumsor: a blackout that rolls across districts at night, with generators humming in some places. 
Why: it is local, funny and looks striking. 
• Traffic with personality: trotros that stop and load, taxis that honk, jams at known bottlenecks, 
and tricycles weaving through. 
• Sound by area: market chatter, traffic, beach waves, radio music, and church and mosque 
ambience handled with respect. 
Planes you can see. Ambient planes fly over Accra on approach to and from Kotoka, run from the same 
shared clock and seed as the traffic, so every player sees the same plane in the same place at no 
network cost. The path is an approximate approach line, not real flight data. Light and Standard show a 
small sprite with a shadow, and Ultra shows a 3D model with lights at night. Why: planes overhead make 
the city feel alive long before the booked-flight cinematic exists in Phase 4. 
The first 60 seconds, ranked 
Wow moment Impact Difficulty Tiers 
Opening swoop: the camera flies from all of 
Ghana down to the player's spot in Accra 
High Easy All (shorter in Light) 
Alive roads: cars, taxis and trotros moving, with 
horn sounds 
High Medium All 
A plane crosses the sky overhead High Medium All (3D on Ultra) 
Other real players walk past, wave or chat High Medium All 
Dusk falls and the lights come on High Easy Standard, Ultra 
Rain rolls in and traffic slows Medium Medium Standard, Ultra 
A dumsor blackout wave crosses the district Medium Medium Standard, Ultra 
A character creator with real Ghanaian looks High Hard All (after week one) 
Build order for wow: the first four in week one if possible, then dusk, rain and dumsor, then the 
character creator. 
The first 60 seconds 
The goal. In one minute a new player should feel "this is Ghana, it is alive, and someone is here". Every 
step below must also work in Light, and the first load must stay inside the performance budget. 
Seconds What the player sees and hears Notes 
0 to 5 A kente-inspired loading screen with a real progress 
bar and the word "Akwaaba" (welcome) 
Tiny download, no 3D 
5 to 12 The camera swoops from all of Ghana down to Accra, 
with soft city sound rising 
A map camera move, cheap on 
every tier 
12 to 25 Quick start: pick male or female, a skin tone and a 
hairstyle, and get a day-name nickname such as "Kofi 
of the Lagoon". A skip button is always there 
Max 15 seconds, flat preview in 
Light 
25 to 35 You land at a beautiful landmark. Cars, trotros and 
tricycles move, a plane crosses the sky, and a trotro 
mate shouts a stop 
Light and weather follow Ghana 
time, so it must look good at any 
hour, including a night with city 
lights 
35 to 45 Tap to walk. Another player waves, and an "Agoo" 
button lets you knock and greet them 
One tap to say hello is the social 
hook 
45 to 60 Your phone buzzes: a friendly guide (a fictional 
"Auntie Ama") sends your first small gig and mentions 
today's event from the culture calendar 
Shows that the world has things 
to do and a calendar 
Measure it: time to the first walk, and how many new players are still playing after 5 minutes. These two 
numbers say whether the first minute works. 
Characters and avatars 
The goal. Players pick male or female, then customise skin tone, hair, face and clothes. The character 
looks beautiful and Ghanaian, and stays light enough for phones. Why: players look at their own 
character more than anything else, so it must feel good. 
The method: two base bodies, many swappable parts 
• Two base bodies, male and female, each with one shared skeleton, so every animation works on 
both. 
• Skin tone is a set of 8 to 10 preset tones applied through the material colour, not 8 to 10 
separate models. 
• Hair, clothes, shoes and accessories are separate pieces fitted to the same skeleton, swapped in 
and out. 
• Body parts hidden under clothes are switched off, so nothing pokes through. 
• Later: face and body sliders, and a few more body builds. 
Where each tier uses what 
Tier Characters 
Light Flat sprites, never real 3D 
Standard Sprites with shadows, or low-poly 3D for the nearest few players if Test 1b allows it 
Ultra Real low-poly 3D for the nearest 10 or so players, sprites for the rest 
Close-up scenes Full 3D on every tier (character creator, wedding, interiors, flight cabin), because 
only a few characters are on screen 
Budget per character (starting targets, to be measured). About 3,000 to 5,000 triangles for a body, 500 
to 1,500 for each hair or clothing piece, one compressed 1024-pixel texture, and under about 2 MB per 
base body including animations. Every piece shares one skeleton and one set of animations. 
How to make the bodies 
• Step 1. Make reference pictures: front, side and back views of each base person, in a neutral 
pose with plain fitted base clothing, using an image AI. Keep the same face and body in every 
view. 
• Step 2. Turn the pictures into a 3D model with an image-to-3D tool. A multi-view mode gives a 
better shape. Compare Hunyuan 3D (reported to be free), Meshy, Tripo and Rodin, and check 
each tool's licence for commercial use. 
• Step 3. Clean it up in Blender (free): reduce triangles, fix the shape, make clean textures and 
stand the model in an A-pose. 
• Step 4. Add the skeleton with Mixamo (free, needs an Adobe account) or the tool's auto-rig. Test 
walk, idle, run, wave and sit. 
• Step 5. Make hair and clothes as separate pieces fitted to the same skeleton. This is the hardest 
step and needs Blender skill or a 3D artist. 
• Step 6. Export compressed GLB files, load them in the browser and test on the cheap phone. 
Prompt for the base body pictures (edit and reuse) 
A full-body character reference sheet of an adult Ghanaian [man or woman], neutral A-pose with arms 
slightly away from the body, plain fitted grey base clothing, bare feet, even studio lighting, plain light 
background. Front view, side view and back view of the same person, realistic proportions, stylised 
semi-realistic game character, no logos, no text. 
Honest limits. AI shapes usually need cleanup, and hands and faces are often the weak spot. Fitting hair 
and clothes onto a shared skeleton is real 3D work. With two bodies, players of one gender share a body 
shape, so characters will feel similar until sliders and extra builds arrive. Check early that braids, locs, 
twists and headwraps come out well, because AI models often get them wrong. A freelance 3D artist for 
a few days may be worth paying later to finish the final bodies and the first set of hair and clothes. That 
is optional, and week one stays at zero dollars. Never use a real person's photo or likeness for a base 
body without permission. 
Test 1b: character speed. Load 10, 20 and 30 animated low-poly 3D characters with the map on the 
cheap Android phone and note the frame rate. If 10 characters hold about 30 frames per second, 
Standard and Ultra may show real 3D for the nearest few. If not, real 3D stays in close-up scenes only. 
Feature checklist: everything Lagos Life has, and our better version 
The left column comes from the unofficial Lagos Life guide (figures checked in-game on 5 October 2026, 
so they may change). The middle and right columns are our design. We borrow the idea of each system, 
not its names, text or art. 
Lagos Life has Ghana Life version Why ours is better 
A birth lottery with three starts 
and no reroll 
Five starts (compound child, 
returnee, graduate, market 
child, landlord's heir), picked or 
drawn 
More choice, and Ghana's own 
starting points 
Six needs: hunger, energy, 
hygiene, bladder, fun, social 
Energy, food, hygiene, mood 
and Vibe, with social, health, 
skill and peace added later 
Vibe is a new community stat 
33 career tracks with five ranks 
each, skills, shifts and 
promotion by performance 
Ghana careers: teaching, 
nursing, medicine, law, banking, 
civil service, tech, trading, 
tailoring, hairdressing, chop bar, 
trotro and ride driving, radio, 
music, football, farming, real 
estate, aviation, and more 
Each shows a requirements 
card, and school and NSS feed 
into them 
Lagos Life has Ghana Life version Why ours is better 
Side gigs such as helping at a 
food spot, carrying loads, 
freelancing, reselling, open mic, 
comedy, photoshoots and 
dance battles 
Gigs such as chop bar help, 
market runner, WhatsApp 
hustle, thrift resale, tutoring, 
mobile money agent, open mic, 
comedy night, Labadi 
photoshoot, dance battle 
Gigs link to real Ghanaian 
hustles 
Businesses that pay out each 
evening and can lose on a bad 
day, with 60 percent resale 
Kiosks, a waakye stand, a chop 
bar, a salon, a barbershop, a car 
wash, a trotro, an event centre, 
a club share 
Players can hire other players as 
staff 
Land that grows weekly, with a 
risk of land guards demanding 
fees 
Plots around Accra and beyond, 
with a real land-guard risk and a 
paperwork mini game 
A real Ghana issue turned into 
gameplay 
15 homes with weekly rent due 
on Saturday, arrears and 
eviction 
Rooms from a hostel to a 
mansion, with weekly rent or a 
discounted rent advance 
The advance option matches 
how rent works in Ghana 
Power cuts, with generator and 
solar choices 
Dumsor, with a generator, solar 
and power banks 
Local and relatable 
A weekly player-run governor 
election with policies like a 
transport subsidy 
A ladder from neighbourhood 
leader to president, fictional 
parties, policies, term limits and 
a recall vote 
Higher goals, and safer against 
abuse 
Billboards, lagoon plots, music 
in clubs and brand apps on the 
phone 
Banners, claim-your-place, 
music slots, brand apps, jobs 
board, property listings 
Lower prices and more buyer 
types 
28 named places across 8 areas, 
with opening hours, prices and 
activities 
Thousands of imported places, 
about 100 illustrated landmarks, 
real opening hours 
The whole of Ghana, not one 
city 
Hospital, chapel, mosque, radio 
house, university, markets, 
police, court, hotel, clubs, 
beach, mall 
The same kinds of places, with 
Ghanaian versions of each 
Same depth, local flavour 
Police, bail, fines and jail Police, courts and jail as 
consequences for crime play 
A clear cost for the bad-boy 
path 
Lagos Life has Ghana Life version Why ours is better 
A daily clue hunt for a cash prize A daily "treasure of the day" 
with Ghana trivia, kente and 
local clues 
Teaches culture while it 
entertains 
Gifts of money between players 
with a small fee 
A mobile-money style wallet 
with a small fee and scam 
warnings 
Familiar to every Ghanaian 
player 
Danfo buses and other rides 
between places 
Walk, ride app, taxi, trotro, 
tricycle, own car, intercity bus 
and domestic flights, with 
players as drivers 
Player-run transport and flights 
An aviation career at the airport 
and airport staff jobs, with 
flights listed as coming soon 
A full airport at Kotoka: flights 
between regions, cabin crew, 
pilots and ground staff, with a 
cinematic flight view 
Planes that actually fly 
A casino No casino. Skill-based game 
centres and arcades instead 
Avoids gambling rules and harm 
Real-time clock and opening 
hours 
The same, matched to Ghana 
time 
Same feel, local rhythm 
Taxes tracked weekly, wage 
policies, degree bonuses 
Tax, degree bonuses and the 
NSS allowance as real 
mechanics 
School and service matter 
Other cities (Abuja, Port 
Harcourt) announced 
All 16 regions on one map One engine, no redraw 
Guest browsing, an account to 
enter venues, 18+ 
The same, plus voice chat and 
marriage between players 
More ways to connect 
A reset after a fake-money 
exploit 
Server-side money checks from 
day one 
Prevents the problem 
Planes, specifically. Players book flights from the phone, check in at the airport scene (skippable), and 
watch a cinematic flight over the real map. Flights connect Accra with other regions. Players can work as 
cabin crew, pilots or ground staff, and friends on the same flight share a voice room. Airlines sponsor 
flights. Why: it turns travel into an experience, and gives aviation careers a purpose. 
Sources: Lagos Life guide: map, jobs, money, houses and rent, governor election, what is Lagos Life 
Life systems 
Time. The game day follows the real clock, so mornings and evenings match Ghana. Why: a shared clock 
makes the world feel alive and gives players reasons to log in together. 
Needs and stats. Launch with Energy, Food, Hygiene, Mood and Vibe (community standing). Add Social, 
Health, Skill and Peace next, and ageing and family later. Why: too many bars confuse new players, and 
each new one needs content to feed it. Money is Sika, in cedis. 
Starting paths. Nothing is compulsory. Players can begin as a senior high student, a university student, 
an apprentice, or go straight to work or business. Each career shows a requirements card before the 
player commits, with the steps, time, cost and success chance. Why: it teaches the real steps and keeps 
every choice meaningful. 
Career Steps If there is no job 
Doctor Senior high school, university 
medicine, exams, national 
service, licence, then hospital or 
clinic 
Locum shifts, teaching, side 
hustle 
Lawyer Senior high school, university 
law, law school, bar call, then a 
firm or own chambers 
Paralegal work, writing, small 
business 
Engineer School, university or technical 
school, internship, then a firm 
or workshop 
Repair jobs, freelancing, trade 
work 
Teacher Training college or university, 
national service, then a school 
Private tutoring 
Tailor, mechanic, hairdresser Find a master, learn over time, 
open a workshop 
Work from home, rent a chair, 
sell online 
Trader or farmer Capital, a stall or land, supplier 
contacts 
Start smaller, partner with a 
friend 
Creator or musician Practise, post, build an 
audience, perform 
Sponsored content, event gigs 
Steps are compressed so a path takes weeks, not years. 
Student life. Hall or hostel life, lectures, solo or voice study groups, quizzes, fees, scholarships and part-
time jobs. Results come from attendance, study time and quiz scores. 
National service (NSS). Graduates are posted to a sector and region, with a monthly allowance, 
supervisor sign-off, and sometimes late payments that push players into side hustles. The allowance 
follows the real figure: the latest approved amount I found is GH₵715.57 a month (from January 2023), 
and a raise to GH₵1,200 was proposed in 2026 but reported as not yet in effect. Make the amount a 
setting and check the current figure before launch. Keep the portrayal gentle and funny, and never 
accuse real offices or people. After service players can be retained, job hunt, return to school or start a 
business. 
The hustle layer. If a job does not come, players hustle through odd jobs, selling, tutoring or deliveries, 
so nobody is stuck. 
Story mode. An optional guided path of short chapters in the shared world: 1. Arrival (pick a start, find a 
room, get a first job, pay first rent). 2. Hustle (earn Sika, make three friends). 3. Community (join a circle, 
attend an event, mentor someone). 4. Love and home (court, marry, set up a home). 5. Power (run for 
office or start a business). Open mode has no goals except your own. Why: story mode helps 
newcomers, and open mode keeps the freedom. 
Career circles. When a player picks a field, coworkers, bosses, events and after-work spots match it, and 
experienced players can mentor others. Each field shows short, checked "did you know" tips, labelled as 
general information, not professional advice. Why: it makes the world believable and gives players real-
life value. 
Getting around: transport and booking 
How Lagos Life handles it, from public information only: players ride danfo buses across a map of real 
Lagos landmarks, and reports say they can also use taxis, motorbikes and tricycles, or drive themselves. 
The city has 28 named places in 8 areas, split into mainland and island, and each place has opening 
hours, prices and activities. A job in another area means travelling there. I could not find how the map is 
rendered or the exact booking steps, so the design below is ours, not a copy. 
Mode How it works in Ghana Life Phase 
Walk Tap a spot and your avatar 
walks the real road. Free, slow 
and tires you 
0 
Ride app Book from your phone, see the 
fare and wait, a driver arrives, 
you ride, then pay and rate. 
Most expensive, door to door 
1 
Taxi Hail one on the street and 
haggle over the fare in a quick 
mini game 
1 
Trotro Go to a station, wait until it fills, 
ride a fixed route, and pay the 
mate. Cheapest and slowest, 
with transfers at hubs like Circle 
2 
Tricycle and motorbike taxi Short, cheap hops, with a 
chance of delays and fines 
2 
Bicycle or own car Buy one, pay for fuel and 
repairs, and park it 
3 
Mode How it works in Ghana Life Phase 
Intercity bus and domestic flight Between regions, costing more 
Sika and time 
4 
Booking flow for a ride 
1. Open the phone and choose Rides. 
2. Pick a destination on the map. 
3. See the fare and the wait, which depend on distance, time of day, rain and traffic. 
4. A driver accepts, and you watch the car come along real roads. 
5. Ride, or skip ahead to save time. 
6. Pay Sika, then rate the driver. 
Player-run transport. Players can work as taxi drivers, ride drivers, trotro drivers or mates, and earn 
fares from other players. When no player is free, a non-player driver steps in so nobody waits forever. 
Why: it makes transport a real job and a social meeting place, which Lagos Life's public descriptions do 
not mention. 
Feel. Ride times are compressed to seconds or a minute, with a skip button. Rush hour, rain, power cuts 
and fuel price events change speed and cost. Why: it gives the city rhythm without wasting players' 
time. 
Routing. Roads come from the same OpenStreetMap data as the map. Start with a precomputed road 
graph for Accra and simple pathfinding in the browser, and add a routing service later if needed. Why: it 
needs no paid service and keeps cars on real streets. 
Anti-abuse. Fares are paid in Sika only, with caps, ratings and report buttons for harassment. Why: it 
keeps the driver and rider roles safe and fair. 
Flights and cinematic travel 
Lagos Life's public guide lists its airport as "coming soon", so I could not verify a plane scene there or 
how it was built. The design below is our own. 
The idea. A flight is a short cinematic. The camera follows a plane over the real map from takeoff at the 
airport to landing in another region, so players see Ghana from above, passing over cities, roads, rivers 
and coast. Why: it makes travel feel like an experience and shows off the real map. 
How it works 
1. Book. Players book from the phone: pick a destination, see the fare, and check in. The airport 
scene can be skipped. Why: it matches the ride flow players already know. 
2. Camera. The map camera tilts and turns behind the plane, using the map library's camera 
movement (pitch, bearing and animated moves). Why: it gives the sense of flying with no extra 
engine. 
3. Path and pace. The plane follows a smooth line between airports, with a takeoff, a cruise and a 
landing, shortened to about 30 to 60 seconds with a skip button. Why: it feels real without 
wasting time. 
4. Look. Raised buildings near the airport, colourful land, clouds drifting at different speeds, the 
sun matched to the game clock, city lights at night, dusty haze in the dry season and rain clouds 
in the wet season. Why: the sky changes with the world, so every flight looks different. 
5. The plane. A small 3D model shown through a 3D layer, or a simple sprite in light mode. Use a 
generic fictional airline look unless an airline agrees to be shown, and check every model's 
licence. Why: it avoids trademark problems and keeps downloads small. 
6. Sound. Engine sounds and cabin announcements in English and local languages, recorded by our 
own voices. Why: it adds a strong sense of place. 
7. Together. Friends booked on the same flight share a cabin voice room. Why: a flight becomes a 
social moment. 
8. Light mode. Slow connections skip the cinematic and show a simple progress bar. Why: it 
protects players on limited data. 
Money. Airline sponsorships (fictional or agreed in writing), premium seat cosmetics and branded cabin 
screens. Why: it adds income without selling an advantage. 
Cost and risk. Flying over satellite imagery loads many map tiles and uses a lot of data, so the stylised 
map is the default. Test on low-end phones before launch. This is a Phase 4 feature, built after the basics 
work. 
Social systems 
Live chat. Players near each other see chat bubbles in real time, with private chat, friend requests, 
online status, gifts of Sika and event invites. Chat accepts English, Pidgin, Twi, Ga, Ewe and more. Report, 
block and mute work everywhere, with a word filter and rate limits from day one. 
Nearby voice. Players hear others within a short distance on the map, louder when close. Mic is off by 
default, with push to talk. Private voice rooms work for couples, crews and study groups. Voice launches 
after text chat is stable. Why: it is the standout feature, but it is the hardest to moderate and the last to 
build. Revision 2.1: private voice rooms for friends, couples and study groups launch earlier, in Phase 1 
(task T13a), with push to talk, a small room cap, a kill switch and the 18+ rule. Nearby voice on the open 
map stays in Phase 2. 
Marriage between two real players. Both players must agree at every step, and either can leave safely 
at any time. 
1. Courtship. Dates at venues build a shared Affection meter. 
2. The knocking. One player sends a formal request, and the other accepts, delays or declines, with 
optional witnesses. 
3. The list. Both receive a generated list of items to fund, scaled to status, which they can split. 
4. The wedding. A scheduled event where friends attend and give gifts. 
5. The household. Pooled or separate wallets, a shared home, and a Peace of Mind boost when 
both stay active. 
6. Family events. In-law visits, joint investments and naming ceremonies, decided together. 
Safeguards: both players are verified 18 or older, divorce uses a cooling-off period and a clear rule for 
splitting shared Sika, and blocking or reporting a spouse always works. 
Elections and the presidency. The ladder runs from neighbourhood leader to market association head 
to district assembly member to president. Players found and run fictional parties, with campaign 
seasons, rallies, live-chat debates and real player votes. Winners can set limited in-game rules and fund 
districts. Term limits and a recall vote prevent permanent rule, and money cannot buy votes. The people 
in the presidency building are fictional, so no real leader appears. 
Open lives. Players choose any path: entrepreneur, politician, creative, street crew, bad boy or bad girl, 
community leader. Crime is a game mechanic, not a how-to. 
• Crews, parties and rivalries use fictional names, never real gangs, tribes or religions. 
• No real instructions for drugs, weapons, fraud, hacking or violence. 
• Fights are consensual and limited to a clear mini game. 
• Consequences are real in the game: police, fines, jail, lost Vibe. 
• The game is 18+, with a clear content label. 
Anonymity and the Reveal Ladder 
The idea. Everyone is anonymous by default: a nickname and an avatar, no real name, no photo. Players 
from Kasoa to Kumasi to Tamale can meet, travel and become friends in the game, and nobody knows 
who is who until a person chooses to reveal more. Why: it feels safe and free, it is very Ghanaian to 
meet people across towns, and we store almost no private data. 
Day-name identity. A new nickname starts from the Akan day-name (Kofi, Ama, Kwame, Afua and so on, 
with Ewe and Ga versions added) plus a random word, such as "Kofi of the Lagoon". Check the names 
with Ghanaian speakers before using them. 
The Reveal Ladder 
Rung What is shared Rules 
1 A first name or a nickname Both people agree. Either can step back at 
any time 
2 The home town or region (for example 
Kasoa or Kumasi), never an exact place 
Both agree, after a short wait 
3 Voice: a private call Both agree. The phone shows only 
nicknames 
4 A social handle, typed in chat by the player The game does not host or store photos in 
early versions 
5 Meeting in real life Not built until the plan says so. Groups only, 
public places, daytime (see the risk register) 
• Every rung needs both people to say yes, and each has a short cooling-off wait (for example 10 
minutes before rung 2 and a day before rung 4). Why: it stops rushing and slows scammers. 
• Reveals can be taken back. A person can stop sharing, block or report at any time. 
• The game never asks for real names, phone numbers, mobile money details, ID or photos. 
Warnings pop up when someone types words like "send money" or a number. 
• Anonymous but accountable: the server knows the account so it can ban abusers, but not the 
person's real identity. 
• Trust levels: brand-new accounts cannot start private chats with strangers until they have 
played for a while. 
• 18+ only, with a clear safety page, and a lawyer review of age checks and privacy (including 
Ghana's data protection law) before public launch. 
Ghana culture calendar 
The idea. Real Ghanaian dates become events in the game: a festival scene on the map, matching outfits 
and music, small gigs, a learning note about the tradition, and a reason for friends to log in together. 
Dates live in a simple config file, so adding or changing one never needs new code. 
Event Where or who Typical timing (verify 
each year) 
In-game idea 
Independence Day Nationwide, Black 
Star Square in Accra 
6 March A parade on the map, flag 
outfits, night fireworks, 
fictional speeches 
Eid festivals Muslim communities 
nationwide 
Moves with the moon Greetings, festive outfits, feast 
scenes, gifting 
Easter and 
Christmas 
Nationwide Easter moves, 
Christmas on 25 
December 
Church and family scenes, 
beach parties at Labadi, lights 
Aboakyir Winneba (Effutu 
people) 
Usually early May A festival town with drums and 
a durbar. No hunting game 
Homowo Ga people, Accra Usually around August 
to September, 
announced yearly 
A street feast scene, with food 
and respectful learning notes 
Chale Wote Jamestown, Accra Usually August Street art, music and dance, 
with art slots for creators 
Panafest and 
Emancipation Day 
Cape Coast and 
Elmina 
Usually July to August A heritage trail with history 
quizzes and performances 
Fetu Afahye Cape Coast Usually early 
September 
A colourful street procession 
and a durbar scene 
Hogbetsotso Anlo-Ewe, Volta 
Region 
Usually early 
November 
Drumming and dance, with 
Ewe phrases 
Event Where or who Typical timing (verify 
each year) 
In-game idea 
Damba Northern Region Moves with the Islamic 
calendar 
Drumming, northern smock 
outfits, northern phrases 
Farmers' Day Nationwide First Friday of 
December 
Market and farm gigs, prizes 
for farmers 
Akwasidae Asante About every 42 days Learn-only notes, with no royal 
rites as gameplay 
Respect rules. Sacred rites are never mini games, jokes or sold items. Each festival scene is reviewed by 
people from that community before release, and credits the source. If a community objects, we change 
it. Dates above are typical, not guaranteed. Check each one with official or local sources every year. 
The in-game phone 
The idea. A phone on screen holds most of the social and money features. It is built from plain page 
elements on top of the map, not drawn in 3D, so it costs almost nothing on any tier. 
App What it does Phase 
Settings and Safety Quality tier, data saver, report, block, mute, and Reveal Ladder 
controls 
0 
Contacts and Chat Friends, private chat, requests 1 
Calls Private voice calls and small rooms (task T13a), showing 
nicknames only 
1 
Wallet Sika, rent, gifts and susu circles 1 
Rides Book a ride (flow in "Getting around") 1 
Jobs Job board and gigs 1 
Events The culture calendar, RSVPs and reminders 1 
Map and Passport Routes, plus a Ghana Passport with stamps for regions, 
landmarks and festivals 
1 and 2 
Camera and 
Postcards 
One tap makes an image and a link to share on WhatsApp 2 
Radio and Music Stations and artist slots 2 
Mentors and Pen pals Anonymous career questions and postcards between regions 2 
Shop Codes Discount codes from shops that claim their place 2 
Brand apps Sponsored apps from telecoms, food and fashion 3 
Ghana magic: extra ideas, ranked 
Each idea is mostly screens and server rules, so none should add lag. Impact and difficulty are my 
judgement. 
Idea Impact Difficulty Phase 
Day-name identity (anonymous names) High Easy 0 to 1 
Agoo and Amee: knock to enter a room, answered 
with "Amee" 
Medium Easy 1 
Reveal Ladder High Medium 1 
Private voice rooms ("voice parties") High Medium 1 
Culture calendar events High Medium 1 
WhatsApp postcards High Easy 2 
Ghana Passport stamps Medium Easy 2 
Susu circles (friends pool and rotate Sika) Medium Medium 2 
Shop codes for real discounts High Medium 2 
Anonymous mentors and pen pals Medium Medium 2 
Twi, Ga and Ewe phrase learning Medium Medium 2 
Map-a-thon: players fix missing shop names and hours Medium Medium 2 
Diaspora "returnee" start Medium Easy 2 
Dumsor blackout wave as a shared event Medium Medium 2 
Scope guard: the rule of three 
There are now many ideas, and a free game that tries to do everything will lag, confuse players and 
never finish. So the public launch leads with only three signature features, and everything else waits. 
• Signature 1: the alive map (traffic, planes, day and night, quality tiers). 
• Signature 2: anonymous friends with the Reveal Ladder and private voice rooms. 
• Signature 3: the Ghana culture calendar with its first three events. 
• Later: marriage, elections, businesses, land, real flights, regions beyond Accra, crime play and 
the creator marketplace. 
• Rule: a new idea only goes in when another one comes out or moves to a later phase. Each 
phase adds at most three new signature features. 
• Rule: any feature that makes Light worse than its budget waits until it is fixed. 
Making money 
The game is free for players. Income comes from businesses, artists and optional extras, as it did for 
Lagos Life, which reported about 46,900 US dollars in its first four days, mostly from advertisers. We 
copy the idea behind each of its earners, price it lower, and add more. Prices below are written in dollar 
equivalents. Set them in cedis at the current exchange rate, which I could not verify today. 
Income source Lagos Life (reported) Ours Why 
Roadside billboard, per 
week 
About 3.77 dollars About 2.50 dollars Cheap for small sellers 
Large plot or board, per 
week 
About 13.56 dollars About 10 dollars Mid-size businesses 
Music in clubs About 37.74 dollars About 28 dollars Artists want new 
listeners 
Brand app on the in-
game phone 
A delivery app appears 
in the phone 
Telecoms, food 
delivery, fashion and 
others, priced by quote 
Players use the phone 
all day 
Premium main board 
or event sponsor, per 
week 
Not detailed Up to about 35 dollars One sponsor can cover 
an event 
Reports differ on Lagos Life's lowest billboard price (about 5,000 naira per week in one report, from 
about 50,000 naira in another), so check their site before relying on these comparisons. Start our prices 
low while the audience is small, then raise them as players grow, and show buyers a report of views. 
Claim your place. Every real place on the map starts with a generic name. Owners claim their real spot, 
add their name, logo, menu and banners, and pay for premium features. Why: it gives businesses a 
reason to join, protects us from implying a business has joined when it has not, and gives us income. 
Self-serve banners. A business uploads a banner, picks a district, tier and dates, and pays by mobile 
money. Every banner is reviewed against the house rules before it goes live. Food sellers get a "Today's 
special" slot with a WhatsApp order link. There is a cap per street so the world stays beautiful. 
Extra income ideas 
1. Game centres and arcades with sponsored tournaments. 
2. Club and event tickets, with a share for us. 
3. A jobs board where employers pay to post real vacancies. 
4. Property listings from agents and developers. 
5. School and university promotion. 
6. Radio and playlists for artists and stations. 
7. Cosmetics such as kente outfits, house styles and emotes. 
8. A creator marketplace where artists sell designs and we keep a share. 
9. Premium voice rooms: free small rooms, paid private and larger rooms. 
10. Tips and a "support the game" button. 
Rules. Never sell Sika for cash out. Never let money buy election results or marriage outcomes. Keep ads 
clearly labelled. Betting, alcohol, loans and health claims have special rules, so check them before 
accepting those ads. Only sell what you can deliver. Why: it protects players and keeps the game's 
reputation. 
Tech and capacity 
The game is a web app. The browser draws the map and runs the traffic simulation, and small server 
rooms handle only what must be shared: positions, chat and money. 
 
architecture · browser plus 5 services 
The browser loads the game and the map as static files, and talks to a live room for the area it is in. 
Voice and accounts go through their own services. All money and rules are decided on the server, never 
in the browser. 
Part Choice Why 
Map view MapLibre GL JS with a 
Protomaps basemap of 
OpenStreetMap data 
Free, open source, self-hostable 
Game logic in the browser TypeScript Common, and Claude writes it 
well 
Game files Cloudflare Pages Unlimited bandwidth for static 
files 

Part Choice Why 
Live rooms Cloudflare Workers with 
Durable Objects 
Built for many connections in 
small groups 
Storage Durable Object storage first, a 
database later 
No pause risk, and can grow 
Voice Cloudflare Realtime (SFU and 
TURN) 
1,000 GB of audio free each 
month, then 0.05 dollars per GB 
Payments A mobile money provider that 
supports Ghana business 
accounts, to be chosen 
Players and sponsors pay in 
cedis 
Capacity plan 
1. Area rooms. The map is split into cells, and each cell is one live room. A player joins their cell 
and sees its neighbours. Why: the server only handles the people who matter to each other. 
2. Room cap and copies. Cap a room at a set size (start with about 100, then measure), and open 
extra copies of busy places. Why: no single room gets overloaded. 
3. Waiting line. When the city is full, show a friendly queue instead of letting the server fail. Why: 
players already inside keep a smooth game. 
4. Send less. Share positions only with nearby players and a few times per second. Why: fewer 
messages means lower cost and less lag. 
5. Shared traffic seed. Traffic comes from a clock and seed, so it costs no network data. Why: it 
looks busy at no cost. 
6. Server checks. Money, jobs, rent and marriage are decided on the server, with rate limits. Why: 
it blocks cheating, and Lagos Life's fake-money exploit shows what happens without it. 
7. Test and alert. Test with friends before inviting the public, and set usage alerts. Why: free limits 
fail suddenly, so you want a warning first. 
Scale plan: from 100 players to 1 million 
Honest framing. "1 million users" can mean three different things. One million registered accounts is a 
realistic design target. One million players online at the same moment is a different world and is not a 
goal. For a game like this, the number online at the same time at the busiest hour is usually a small slice 
of the registered users (my guess is 1 to 5 percent, so 10,000 to 50,000 at the peak for 1 million 
accounts; measure it). Nobody can promise the game never crashes. What we can do is design it so that 
growth is controlled and overload turns into a waiting line, not a crash. It is free while small and cheap in 
proportion when large, but it is not free at 1 million. 
The big alternative: static-first, client-heavy, many small rooms 
• Static-first. The game, the map and the content are static files on Cloudflare Pages, which has 
unlimited bandwidth for static files. Downloads, the largest load from a million people, cost 
nothing. 
• The player's device does the work. Traffic, planes, weather, crowds and day and night run on 
each phone from a shared clock and seed, so every extra player adds no server cost for these. 
• Many small rooms, never one big one. Each map cell is a room of about 100 players, with copies 
("channels") of busy places. A matchmaker puts each player into the least-full copy. 
• One tiny server object per player for their own data (wallet, needs, job, friends). A million small 
objects cost almost nothing while nobody is playing. 
• Send little. Click-to-move, nearby-only updates, compressed messages, batched writes, and idle 
rooms put to sleep. 
• Control who gets in (admission control, below), so the game is never asked to carry more than it 
was tested for. 
• Keep the server logic in plain TypeScript so it can move to another host if prices or terms 
change. 
Rough cost model (estimate from Cloudflare's published rates, to be load tested) 
Cloudflare's published rates say a live room costs about 0.6 US cents per hour while active (128 MB at 
12.50 dollars per million GB-seconds), and WebSocket messages are billed at 1 request per 20 messages. 
In my rough sums, duration is far bigger than request cost. Free plan: about 100,000 requests and 
13,000 GB-seconds a day. Paid plan: 5 dollars a month, with 1 million requests and 400,000 GB-seconds 
included. The table assumes each room is busy about 8 hours a day, 10 incoming messages per player 
per minute, and rooms 30 to 100 players full. It leaves out voice, storage, and other services. 
Stage Players online at the peak Rooms Rough monthly cost 
Private test Up to about 100 1 to 3 0 dollars (free plan) 
Small launch About 500 to 1,000 5 to 34 About 5 to 50 dollars 
Growing About 10,000 100 to 334 About 150 to 450 dollars 
Big About 100,000 1,000 to 3,334 About 1,500 to 4,600 dollars 
One million online 
at once 
1,000,000 10,000 to 33,334 About 15,000 to 46,000 
dollars, not a goal 
Why this is fine. A game with that many players should earn from banners, sponsors, claimed places and 
cosmetics (see "Making money"). Lagos Life reported about 46,900 US dollars in its first four days, 
though that is exceptional and cannot be promised. The aim is for income to arrive before the bills do, 
and for a spending limit to protect you if it does not. 
Admission control: how the game never crashes 
• Invite waves. Open to 100, then 500, then 2,000, then 10,000 and so on, each only after the last 
wave passes its tests. 
• Waiting line with an honest estimate, and the "the city is resting" screen when the day's limit is 
used. 
• Budget breaker. Our own code counts usage and estimated cost, and stops admitting new 
players when the monthly limit you set is reached. Do not rely on the host to stop spending for 
you. 
• Kill switches for voice, notes, banners and heavy effects, so one feature cannot take the whole 
game down. 
• Browse-only mode when overloaded: guests can still look around while logged-in actions wait. 
• A status banner on the website, and alerts at 70 and 90 percent of any limit. 
Realtime back ends considered 
Option Free limit Scales to Verdict 
Cloudflare Workers 
with Durable Objects 
About 100,000 requests a 
day free, paid plan from 5 
dollars a month 
Millions of players, 
by adding more 
small rooms 
Primary choice 
Colyseus (open-source 
game server) 
The software is free, the 
hosting is not 
As far as the server 
you pay for 
Fallback: the same 
TypeScript logic can 
move to it 
Firebase Realtime 
Database 
100 simultaneous 
connections on the free plan 
Large, but costly Too small for free 
Supabase Realtime 200 connections, and free 
projects pause after 7 days 
Medium on paid 
plans 
A possible later 
database, not for live 
rooms 
Hosted realtime 
services (Ably, Pusher, 
PubNub) 
Small free tiers, not checked 
in detail 
Large, billed per 
message and 
connection 
Backup idea, check 
prices first 
A server at home Free but must stay on Very small No 
Features that scale well (they cost almost nothing per extra player) 
Feature Why it scales Phase 
Synchronised spectacles: midnight 
fireworks, festival parades, a New 
Year countdown 
Runs from the shared clock on each device, so a million 
players can see the same show at no server cost 
1 
Ghost crowds Simulated pedestrians from the shared seed, so quiet 
streets still feel busy and early rooms never feel dead 
1 
Town channels (Kasoa, Kumasi, 
Tamale and so on) 
Players meet people from their own region first, in small 
rooms 
1 
Daily treasure of the day One small request per player per day 1 
Event seasons Content from a config file, delivered by the CDN 1 
Notes on the map A player leaves a short, moderated note at a place that 
others read later, with no live connection 
2 
Feature Why it scales Phase 
WhatsApp postcards The image is made on the player's device and shared 
through WhatsApp 
2 
Leaderboards and festival 
scoreboards 
Updated in batches every few minutes 2 
Load testing. Write a bot script that opens fake players and ramps from 100 to 1,000 to 5,000, and 
record the frame rate on the test phone, server errors, messages per second and the cost. Run it on a 
test copy, never the live game. A large test will use up the free daily limit, so budget about 5 dollars for 
one paid month for the test. 
Rules for Claude. Every new feature must state its cost per player-hour and whether it needs a live 
connection. No feature may need an always-on server for each player. Keep the server logic portable. 
Risk register 
This is a stress test of the plan, written as a sceptical engineer would. Likelihood and impact are my 
judgement (Low, Medium, High), not measured. Each risk lists the cheapest fix and the test or task that 
checks it. If a test fails, stop and report it before building more. 
# Risk Likelihood 
/ impact 
Cheapest fix Checked by 
R1 Weak phones cannot draw 
the map, cars and avatars 
smoothly 
High / High Quality tiers, the performance 
budget, drawing only what is 
visible, and testing on a cheap 
Android 
Test 1 
R2 A map file is over 25 MiB, 
which is the Cloudflare 
Pages limit per file, or the 
host does not allow reading 
parts of the file 
High / High Cut the map into several smaller 
files, or find another free host that 
needs no card 
Test 0 
R3 The live server is far from 
Accra, so actions feel slow 
Medium / 
Medium 
Click-to-move and smooth 
animation hide delay. Check 
whether Cloudflare offers a 
location hint for Africa. Avoid fast-
reaction gameplay 
Test 3 
R4 The free daily limit runs out 
during a rush of players 
Medium / 
High 
Usage counter, "city is resting" 
screen, waiting line, and the 5 
dollar paid plan ready 
T13, T21 
# Risk Likelihood 
/ impact 
Cheapest fix Checked by 
R5 Links opened inside 
WhatsApp, Facebook or 
Instagram browsers run 
badly or fail 
Medium / 
High 
Detect the in-app browser and 
show an "open in Chrome or 
Safari" button 
Week-one 
day 7 
R6 Map data gaps in parts of 
Ghana: missing buildings, 
names or opening hours 
High / 
Medium 
Standard building height, generic 
names, our own opening-hours 
content, spot-checks per district 
T9 
R7 Fake money or cheating Medium / 
High 
All money and rules decided on 
the server, with rate limits 
T21 
R8 Chat abuse that one person 
cannot review 
High / High Word list, report, block and mute, 
text-only launch, a small invite-
only audience first, trusted 
volunteer moderators 
T5, T21 
R9 A typed date of birth 
cannot prove 18+, and data 
protection rules apply 
Medium / 
High 
Clear 18+ label and rules, collect 
little data, lawyer review before 
any public launch 
Verify list 
R10 Players lose passcodes, 
with no email to recover 
them 
Medium / 
Medium 
Show a one-time recovery code 
when the account is made 
T8 
R11 A beginner builder is 
overloaded by scope 
High / High One task at a time, the week-one 
cut, save to Git after every task, 
keep this document updated 
Every task 
R12 Claude's free-plan message 
limits slow the build 
Medium / 
Medium 
Small tasks, short prompts, paste 
only the needed files, keep notes 
in the project folder. A paid plan is 
optional later 
Ongoing 
R13 Voice fails on some mobile 
networks 
Medium / 
Medium 
Use Cloudflare's relay service, test 
early on MTN, Telecel and AT, 
keep voice optional 
T14 
R14 Data cost puts players off Medium / 
Medium 
Light mode, caching, a data-saver 
switch, showing approximate data 
used 
Budget 
R15 AI-made characters look 
uneven, with weak hands, 
faces or hairstyles 
High / 
Medium 
Compare several tools, pick the 
best, clean up in Blender, and test 
Ghanaian hairstyles early 
Character test 
# Risk Likelihood 
/ impact 
Cheapest fix Checked by 
R16 A free AI tool does not 
allow commercial use, or 
changes its free terms 
Medium / 
High 
Read each licence before use, 
keep a licence note with every 
asset, switch to hand-made or 
paid models if needed 
Before launch 
R17 Hair and clothes do not fit 
the shared skeleton, or 
poke through the body 
High / 
Medium 
Make parts fitted to the same 
body, hide covered body parts, 
keep the first outfit set small 
Character test 
R18 Real 3D characters make 
weak phones lag 
High / High Real 3D only on Ultra for the 
nearest players and in close-up 
scenes, sprites elsewhere 
Test 1b 
R19 Banned players come 
straight back, because 
accounts are free and 
anonymous 
High / 
Medium 
Trust levels for new accounts, rate 
limits, bans tied to the account 
and device clues, and later an 
optional email or phone check 
T8, T21 
R20 Anonymous chat enables 
grooming, scams or unsafe 
real-life meetings 
Medium / 
High 
Reveal Ladder waits, scam 
warnings, report and block, 18+ 
only, no real-life meetings in early 
phases, and meetings only in 
groups at public places later 
Reveal task 
R21 A festival scene offends a 
community or shows 
sacred things wrongly 
Medium / 
High 
Learn-only for sacred events, 
review by people from each 
community, easy to change or 
remove a scene 
Calendar 
tasks 
R22 Too many ideas, so nothing 
is finished 
High / High The rule of three, one task at a 
time, and a phase gate before 
anything new 
Every phase 
R23 Costs grow faster than 
income 
Medium / 
High 
Budget breaker with a monthly 
limit, invite waves, early banner 
and sponsor sales, and the waiting 
line 
Scale plan 
R24 Cloudflare changes its free 
limits or prices 
Medium / 
High 
Keep server logic in plain 
TypeScript so it can move (for 
example to Colyseus), and keep a 
fallback ready 
Scale plan 
# Risk Likelihood 
/ impact 
Cheapest fix Checked by 
R25 A viral spike overloads one 
popular place such as 
central Accra 
High / 
Medium 
Channels (copies of a room), town 
channels, the waiting line and 
ghost crowds in quiet areas 
Load test 
Costs 
This section is for later growth only. The zero-dollar plan above costs nothing, and Claude must not add 
anything listed here (satellite imagery, paid plans, a managed database) to the build. Nothing stays free 
and crash-proof as thousands of players arrive. Free plans have hard caps, and when you pass one the 
service stops working. Figures come from search results dated July to September 2026, and I did not 
open every provider page, so verify each before relying on it. 
Part Free option Free limit When you outgrow it 
Game files Cloudflare Pages Unlimited bandwidth 
for static files, 500 
builds per month 
Stays free for this part 
Live rooms Cloudflare Workers 
with Durable Objects, 
free plan 
About 3 million 
requests per month, 
daily reset, and calls 
fail once used up 
About 5 dollars per 
month for Workers 
Paid, then small pay-as-
you-go charges 
Voice Cloudflare Realtime First 1,000 GB per 
month 
0.05 dollars per GB 
Stylised map Self-hosted Protomaps 
file 
No licence fee Storage and bandwidth 
only, check the host's 
free allowance 
Satellite look (optional) Mapbox 50,000 map loads per 
month, card required 
About 5 dollars per 
1,000 loads above that, 
falling at higher 
volumes 
Database (optional) Supabase free plan 200 live connections, 
projects pause after 7 
days of no use 
25 dollars per month 
for Pro 
Art and sound Your own work, or 
assets licensed for free 
commercial use 
Check each licence Artist fees if you hire 
Part Free option Free limit When you outgrow it 
Legal Writing your own rules None Lawyer and trademark 
fees, worth doing 
before marketing 
Stage costs (estimates from published rates) 
Stage Players Approximate monthly cost 
Private test with friends Up to about 100 online 0 dollars 
Small public launch About 200 to 500 online About 5 to 30 dollars 
Add voice for 1,000 daily 
players, an hour each 
About 30,000 listening hours Roughly 15 to 40 dollars extra, 
assuming about 32 kilobits per 
second of audio and three 
people audible at once 
Satellite look for 5,000 players 
opening the game 30 times a 
month 
About 150,000 map loads Roughly 450 dollars, so switch it 
on only when income covers it 
Viral spike Many thousands Cannot be estimated reliably, 
depends on design and income 
Optional later spending, not part of the zero-dollar plan 
Item Cost Why 
Build and host on free tiers 0 dollars Covers a test of about 100 
players 
Cloudflare paid plan, once the 
free limit is near 
About 5 dollars per month Stops the game failing as 
players grow 
Own domain name (optional) Roughly 10 to 15 dollars per 
year, check a registrar 
The free address works, so this 
can wait 
Reserve About 30 dollars Lets you react to a surprise 
Satellite imagery needs a card on file and can grow quickly in cost, so it is not part of the zero-dollar 
plan. Claude's free plan has message limits, so building may go slower, and a paid plan is not required to 
start. 
Cheaper later. Move live rooms to a self-hosted server only when income allows, keep audio nearby-
only, keep light mode on by default for slow data, and send updates only to nearby players. Why: each 
of these cuts the main costs, which are live connections, audio and map loads. 
Scale costs. For what each stage costs from 100 players to 1 million, see "Scale plan: from 100 players to 
1 million". 
Legal, safety and credit 
I am not a lawyer. Treat this as a working checklist and have a Ghanaian or Nigerian IP lawyer review it 
before launch. 
Staying original. Copyright protects specific expression such as art, text, code and audio, not the idea of 
a life game. Trademarks protect names and logos. 
Safe to do Avoid 
Build a multiplayer life game with needs, jobs, 
rent and a map 
Copying Lagos Life's code, art, layout, icons, text 
or jokes 
Use real Ghana places, food and customs as 
inspiration 
Using its names, such as "Nepo" or "Lapo", or a 
similar game name and logo 
Use common words like Vibe, Sika and hustle Implying we are official, affiliated or an "unofficial 
sequel" 
Use original music and sound Using real songs without a licence 
Compare features honestly in marketing Real celebrities, politicians or private brands as 
characters without permission 
Credit. You do not need to credit Lagos Life in the game. A casual thank-you in interviews is a courtesy. 
Never imply a connection, and if you ever reuse anything specific of theirs, get permission first. 
Data and imagery licences 
Source What to know 
OpenStreetMap and Protomaps basemap Credit OpenStreetMap on the map. Share-alike 
can apply to derived map databases, so keep map 
data separate from game data 
Protomaps hosted service Free for non-commercial use only, so self-host for 
a commercial game 
Overture places data Permissive licence, but mixing it with 
OpenStreetMap data can bring in the share-alike 
rule 
Google satellite imagery Do not use. Google restricts commercial use and 
tracing of roads from it 
Mapbox satellite Read its terms for use in a game before switching 
it on 
OpenAerialMap Check the licence on each image, because some 
are not CC-BY 
House rules before play. Every player reads and accepts the rules before entering, and again when they 
change: 
1. No hate speech, threats, harassment or sexual content aimed at others. 
2. No sharing of real phone numbers, mobile money details, passwords or addresses. 
3. No real scams or requests for real money. Sika has no cash value. 
4. No attacks on real people, tribes, religions or parties. 
5. Be 18 or older. 
6. Crime and gang play stays fictional and consensual. 
Word flags. A blocked and warning word list in Pidgin, Twi, Ga, Ewe and English, written by Ghanaian 
speakers, with spelling tricks handled. A first hit blocks the message and warns, repeats mute, and 
persistent abuse leads to suspension. 
Safety, privacy and moderation 
1. 18+ with a date of birth check on the server. Why: chat plus romance with minors is a serious 
legal and safety issue. 
2. Report, block and mute on every player and message, with a human review queue. Why: 
automated filters miss abuse. 
3. Tell players before voice that reports may use a short clip of recent audio, and check the privacy 
rules with a lawyer, including Ghana's data protection law. 
4. Keep Sika non-withdrawable and never allow cash out. Why: it avoids gambling and finance 
rules. 
5. Scam warnings in the game about real mobile money details. 
6. Check advertising rules for betting, alcohol, loans and health claims, and payment and tax rules 
before taking real payments. 
Roadmap and start-now checklist 
 
roadmap · 5 phases 
Each phase ends when its gate is met: Phase 0 when about ten friends can play at once without lag, 
Phase 1 when real businesses buy banners, Phase 2 when voice works for small groups without abuse, 
Phase 3 when new players finish a story chapter, and Phase 4 when each big feature has been tested by 
real players. Why: a gate keeps you from adding features on top of a broken base. 

Start now 
1. Make free accounts on GitHub and Cloudflare, and keep your Claude account. 
2. Install Node.js and a code editor such as VS Code. 
3. Ask Claude to guide you through the first prompt below, one step at a time, testing each step 
before the next. 
4. Download a cut of the Protomaps basemap for Greater Accra with the free Protomaps tool, and 
host it yourself. Claude can give you the exact commands. 
5. Deploy to Cloudflare Pages, share the link with five to ten friends, and watch what they do. 
6. Write down every bug and idea, then fix the biggest one first. 
First prompt to give Claude 
I am building a free browser life game set in Ghana, with Accra as the default home. 
I am a beginner, so explain every step in plain words and wait for me to confirm each 
step works. 
Step 1: Give me the folder structure and exact commands to set up a TypeScript 
project with MapLibre GL JS. 
Step 2: Show a real map of Accra using a self-hosted Protomaps PMTiles file, with my 
own bright colour style. 
Step 3: Add a player avatar that walks along the roads when I tap or click. 
Step 4: Add live text chat between players in the same map area, using Cloudflare 
Workers and Durable Objects. 
Step 5: Add a few simulated cars that move along real roads from a shared clock and 
seed. 
Rules: keep all money logic on the server, credit OpenStreetMap on the map, and keep 
everything free to run. 
Documents to keep in the project folder: a short vision and rules file, tech notes, a content bible of 
places, jobs, events and slang in your own words, a task list, and a test checklist. Why: Claude can then 
pick up where it left off each time. 
Prompting habits. Ask for one small feature at a time, paste exact error messages, ask Claude to explain 
code in plain words, and ask for security checks on money, chat and accounts before launch. 
Week-one sprint 
Honest scope. The whole plan cannot be built and polished in one week, even with Claude's help. One 
week can produce a tech test that proves the hard parts: a styled real map of Accra that is smooth on a 
cheap phone, with walking, live chat, moving cars, an ambient plane and quality tiers. If these work, the 
rest is adding features on a proven base. If one fails, we find out in days, not months. 
Four go or no-go tests 
Test What to do Pass if (targets) 
Test 0: map hosting Cut a small Accra map, put it on Cloudflare 
Pages and load it on a phone 
Every file is under 25 MiB and 
the map loads 
Test What to do Pass if (targets) 
Test 1: cheap-
phone speed 
Styled Accra map plus 15 moving cars, on 
the cheapest Android you have, in Light 
About 30 frames per second, 
and the map shows in about 5 
seconds on mobile data 
Test 1b: characters Load 10, 20 and 30 animated low-poly 3D 
characters with the map on the cheapest 
Android 
10 characters hold about 30 
frames per second, or real 3D 
stays in close-up scenes only 
Test 2: live 
movement 
Two phones in one room, one taps to walk The other phone sees the walk 
start in about a second, with no 
errors 
Test 3: distance to 
server 
Measure round-trip time from Accra to the 
live room on mobile data 
Typically under about 250 
milliseconds. If worse, redesign 
before building more 
Day by day 
Day Tasks At the end of the day you should see 
1 T0 and T0a (Test 0) A hello page live online, and the map-file result written 
down 
2 T1 and T2 A styled Accra map on a computer and a phone, with the 
OpenStreetMap credit 
3 T2a and T3 The Light, Standard and Ultra switch with a frame-rate 
overlay, and an avatar walking on real roads 
4 T4 (Tests 2 and 3) Two phones see each other walk, and the delay is 
measured 
5 T5 Chat bubbles, a word filter and a report button 
6 T7 and T7a (Test 1) Moving cars and an ambient plane, with Light inside its 
budget 
7 Friend test Try with 5 to 10 friends aged 18 or over, including the 
WhatsApp browser. Fix the five biggest problems and 
update this document 
If you fall behind. Drop things in this order: the plane (T7a), then cars above 15 in Light, then chat 
polish. Never drop the tests. The results of day 6 and 7 decide week two. 
Not in week one. Needs, job and rent (T6), accounts and the age check (T8), places (T9), jobs, rides, 
businesses, voice, marriage, elections, real flights and regions beyond Accra. Why: each needs a proven 
base first. Share the week-one test only with adult friends until T8 adds the age check and house rules. 
Prompt to paste for any task 
Here is my Ghana Life master plan. Do task T__ from the task list in the Build brief. Follow the hard rules 
and the performance budget. Explain every step in plain words, give exact commands, and wait for me 
to confirm each step works. When finished, run the "done when" test, report the result, and tell me 
what to write in the risk register. 
Prompt to stress-test the plan 
Here is my Ghana Life master plan. Act as a sceptical senior game engineer. List the 10 biggest technical 
risks to a smooth experience on cheap Android phones on mobile data in Ghana. For each, give how 
likely it is, how bad it would be, and the cheapest fix. Do not repeat risks already in the risk register, add 
new ones. 
Build brief for Claude 
Your role and goal. You are building Ghana Life, a free browser life game set in Ghana with Accra as the 
default home, as described in this document. The person you are helping is a beginner, so explain every 
step in plain words, give exact commands, and wait for them to confirm each step works before the 
next. Work on one task at a time from the task list. 
Hard rules 
1. The first version must cost zero dollars and need no payment card. Do not add any service that 
needs one. 
2. Stay inside the free limits in the zero-dollar plan, and follow its design rules. 
3. Keep all money, jobs, rent and marriage logic on the server, never in the browser. 
4. The game is 18+. Players must confirm age and accept the house rules before playing. 
5. Use original names, text, art and code. Never copy Lagos Life's code, art, text or names. 
6. Credit OpenStreetMap on the map. Keep map data separate from game data. 
7. In-game money (Sika) has no cash value and cannot be withdrawn. 
8. Crime and gang play is fictional and consensual, with no real instructions and no real groups. 
9. Before each task ends, run its "done when" test and report the result. 
• Follow the performance budget in "Quality tiers and performance". A task is not done until the 
Light tier stays inside its budget on a cheap Android phone. 
• Load heavy things (3D, voice, flights) only when needed, and never in Light. Keep every file in 
the Pages site under 25 MiB. 
• If a test in the week-one sprint fails, stop and report it. Do not work around it silently. 
• Anonymity: store as little personal data as possible. Never ask for real names, photos, phone 
numbers or ID. Every reveal is optional, mutual and can be taken back. 
• Do not build real-life meetups, marriage, elections or crime play until the plan says so. Follow 
the rule of three. 
• Every new feature must state its cost per player-hour and whether it needs a live connection. No 
feature may need an always-on server per player. Keep server logic portable. 
Tech stack 
Layer Tool Notes 
Language TypeScript for browser and 
server 
One language, easier for a 
beginner 
Build tool Vite Fast and simple 
Map MapLibre GL JS with the 
PMTiles protocol 
Free and self-hosted 
Map data Protomaps basemap cut for 
Greater Accra, made with the 
pmtiles command-line tool 
Built from OpenStreetMap data 
Roads A road graph file made by a 
script from OpenStreetMap 
data, with A* pathfinding in the 
browser 
No paid routing service 
Live server Cloudflare Workers and Durable 
Objects with built-in SQLite 
storage and the WebSocket 
hibernation API 
Free plan 
Hosting and deploy Cloudflare Pages and the 
Wrangler command-line tool 
Free, no card 
Voice (Phase 2) WebRTC with Cloudflare 
Realtime 
First 1,000 GB a month free 
Places Overture Maps places and 
OpenStreetMap, cleaned by a 
script 
Free open data 
Tests Vitest, multi-tab manual tests, 
and a small load-test script 
Free 
On the laptop Node.js LTS, npm, Git, VS Code Free 
People and vehicles PixiJS drawn above the map, 
one shared sprite sheet 
Light 2D drawing of many small 
sprites 
3D (Ultra only) three.js, loaded only on Ultra 3D plane and special effects, 
never downloaded by Light 
Simulation Web Worker for traffic and 
plane paths 
Keeps the screen smooth 
Quality tiers Device check plus a frame-rate 
test, with player override 
Weak phones get Light, strong 
ones get Ultra 
Repository layout 
ghana-life/ 
  README.md              how to run and deploy 
  docs/MASTER_PLAN.md    this document 
  apps/web/              browser game: Vite, TypeScript, MapLibre 
    src/map/  src/game/  src/ui/  src/net/ 
    public/tiles/accra.pmtiles 
  apps/server/           Cloudflare Worker and Durable Objects 
    src/rooms/  src/rules/  src/moderation/ 
  data/                  map and places data, with build scripts 
  scripts/               build the road graph, import and clean places 
  content/               jobs.json, places.json, events.json, words.json (our own 
writing) 
Core data (stored on the server) 
Record Main fields 
Player id, nickname, passcode hash, age confirmed, 
created time, Vibe 
Wallet player id, Sika balance 
Needs player id, energy, food, hygiene, mood, last 
updated 
Job player id, career, level, performance, last shift 
Home player id, home, rent due, arrears 
Place id, generic name, category, position, opening 
hours, claimed flag 
Banner id, tier, district, image file, start, end, status 
Report id, reporter, reported, reason, time, status 
Live messages 
From the browser From the server 
hello (nickname, token) snapshot of the nearby area 
move_to (destination) player joined, left, or started walking (path and 
speed) 
chat (text) chat message 
interact (place, action) needs, wallet and job updates 
start_shift, book_ride world events such as rain, power cuts and traffic, 
and notices 
Task list 
Do these in order. Each task ends only when its "done when" test passes. Phases match the roadmap. 
# Task Done when Phase 
T0 Set up free accounts 
(GitHub, Cloudflare) 
and install Node.js, Git 
and VS Code 
A "hello" page is live on 
a Cloudflare Pages 
address 
0 
T0a Pre-flight tests: cut a 
small Accra map, check 
each file is under 25 
MiB and loads from 
Pages, and measure 
round-trip time from 
Accra to a tiny live 
room 
Both results are written 
in the risk register, and 
the map file loads on a 
phone 
0 
T1 Create the project with 
Vite, TypeScript and 
MapLibre, in the 
repository layout 
above 
A blank styled map 
opens in the browser 
and on a phone 
0 
T2 Cut a Protomaps map 
of Greater Accra, host 
it as a static file, style it 
in bright colours, and 
show the 
OpenStreetMap credit 
The map loads in under 
5 seconds on a phone, 
and light mode loads 
fewer details 
0 
T2a Add the quality tier 
check (device clues 
plus a 5-second frame-
rate test), the Light, 
Standard and Ultra 
switch, a frame-rate 
overlay and the 
performance budget 
The page picks Light on 
the cheap Android and 
Ultra on a laptop, and 
the overlay shows the 
frame rate 
0 
T3 Build the road graph 
from OpenStreetMap 
data, and make an 
avatar that walks along 
The avatar follows real 
roads to any tapped 
place 
0 
# Task Done when Phase 
roads when the player 
taps a destination 
T3a Add a placeholder 
person (a coloured 
figure) with a walk 
animation, then run 
Test 1b with 10, 20 and 
30 animated 3D 
characters 
Frame rates are 
recorded on the test 
phone, and the result 
decides which tiers use 
real 3D 
0 
T4 Build the live server: 
one Durable Object 
room per map cell, 
with hello, move_to 
and snapshot 
messages, and 
hibernation 
Two browser tabs see 
each other walk, and 
idle rooms stop using 
compute 
0 
T4a Add channels: copies of 
a busy room and a 
matchmaker that puts 
each player in the 
least-full copy 
Two copies of one 
room open when the 
first is full, and the 
matchmaker fills the 
least-full one 
1 
T5 Add chat bubbles, a 
word filter, and report, 
block and mute 
Messages appear for 
nearby players, banned 
words are blocked, and 
a report is saved 
0 
T6 Add the real-time 
clock, five needs, one 
job with a shift, and 
rent, all decided on the 
server 
Needs fall over time, a 
shift pays Sika, and 
unpaid rent builds 
arrears 
0 
T7 Add simulated traffic 
from a shared clock 
and seed, with cars, 
taxis, trotros, tricycles 
and bicycles 
Two tabs show the 
same traffic, and light 
mode shows fewer 
vehicles 
0 
T7a Add ambient planes on 
approach to and from 
Kotoka, driven by the 
Two tabs show the 
same plane in the same 
0 
# Task Done when Phase 
shared clock and seed 
(sprite in Light and 
Standard, 3D model on 
Ultra) 
place, and Light stays 
inside its budget 
T7b Build the first 60 
seconds: loading 
screen, camera swoop, 
quick character start, 
landing scene and the 
guide message 
A new player reaches 
their first walk within 
60 seconds, in Light 
and in Ultra 
1 
T7c Add ghost crowds: 
simulated pedestrians 
from the shared seed, 
and synchronised 
spectacles from the 
shared clock (fireworks 
at set times) 
Two tabs see the same 
fireworks at the same 
time, and quiet streets 
look busy within 
budget 
1 
T8 Add guest mode, 
nickname and 
passcode accounts, the 
age check and the 
house rules screen 
A new player must 
accept the rules before 
playing, and accounts 
survive a restart 
1 
T9 Import and clean 
places from Overture 
and OpenStreetMap, 
add categories, 
opening hours and 20 
landmarks with simple 
interiors 
Tapping a place shows 
its name, hours and 
activities 
1 
T9a Add the culture 
calendar: a config file 
of events with dates, 
and the first three 
events (Independence 
Day, Farmers' Day, 
Christmas) as simple 
scenes 
Changing a date in the 
config file moves the 
event, and each scene 
shows a learning note 
1 
# Task Done when Phase 
T10 Add the job board, 
careers with ranks and 
promotion, gigs, and 
the Sika wallet 
A player can take a job, 
get promoted, and do a 
gig 
1 
T10a Add the phone shell 
with Settings and 
Safety, Contacts and 
Chat, Wallet, Jobs and 
Events 
The phone opens over 
the map, every app 
works, and Light stays 
inside its budget 
1 
T11 Add walking, ride 
booking and taxis with 
fares, waits and a 
driver animation 
A booked ride arrives 
along roads and 
charges the right fare 
1 
T12 Add admin-placed 
banners and the claim-
your-place flow, 
controlled from a 
config file 
A banner appears on 
the map, and an 
owner's claimed place 
shows its real name 
1 
T13 Add friends, private 
chat and a daily limit 
guard that shows the 
"city is resting" screen 
Friends can chat 
privately, and the 
guard triggers at 90 
percent of the daily 
limit 
1 
T13a Add private voice 
rooms for 4 to 6 
players, muted by 
default with push to 
talk, a room cap, a 
usage cap, a kill switch 
and the 18+ rule 
Friends in a private 
room hear each other, 
and the kill switch 
stops all voice 
1 
T13b Add day-name 
nicknames and the 
Reveal Ladder: mutual 
requests, cooling-off 
waits, take-back, report 
and scam warnings 
Two players climb two 
rungs with mutual 
agreement, and a take-
back works at once 
1 
T14 Add nearby voice with 
push to talk, mute by 
Two players hear each 
other nearby, and the 
2 
# Task Done when Phase 
default, a cap and a kill 
switch 
kill switch stops all 
voice 
T15 Add game centres, 
trotro rides with a 
mate, and player 
drivers 
A player can drive, and 
riders pay them 
2 
T16 Add school, university, 
apprenticeship and NSS 
paths with the real 
allowance, and story 
mode 
A new player can finish 
a story chapter, and a 
graduate gets posted 
3 
T17 Add homes and rent 
advance, businesses, 
land and the daily clue 
A player can buy a 
business, and rent 
works weekly or in 
advance 
3 
T18 Add marriage between 
two players, with 
consent, divorce and 
safeguards 
Two players complete 
courtship, wedding and 
a household 
4 
T19 Add elections and 
leadership offices with 
fictional parties 
A full election runs, and 
a recall works 
4 
T20 Add the airport, flights 
and the cinematic view, 
then more regions 
A flight takes a player 
to another region with 
a skippable cinematic 
4 
T21 Run a safety and load 
review: security checks 
on money, chat and 
accounts, and a test 
with friends 
No way to create free 
Sika is found, and ten 
players play at once 
without lag 
1 onward 
T21a Add admission control: 
invite waves, waiting 
line, budget breaker 
and kill switches for 
voice, notes and 
banners 
The breaker stops new 
players at the set limit, 
and each kill switch 
turns its feature off at 
once 
1 
# Task Done when Phase 
T21b Write a bot load test 
that ramps from 100 to 
1,000 to 5,000 fake 
players on a test copy, 
and record frame rate, 
errors, messages per 
second and cost 
The results are written 
in this document and 
set the real room size 
and monthly cost 
1 
Definition of done for every task. The code runs, the "done when" test passes, the free limits are not 
exceeded, no new paid service or card is needed, and the change is saved in Git with a short note. 
Verify before launch, open decisions and sources 
Verify before launch 
• ☐ Current NSS allowance (last approved GH₵715.57, with a GH₵1,200 proposal) 
• ☐ Today's cedi exchange rate, then set banner prices in cedis 
• ☐ Mapbox terms for satellite use in a game, if you add it 
• ☐ Free limits and prices for Cloudflare, Mapbox and any database 
• ☐ A mobile money provider that supports Ghana business accounts 
• ☐ Trademark search for the game name and logo 
• ☐ Lawyer review of licences, privacy, payments and advertising rules 
• ☐ Spot-check the map and places in each district 
Open decisions 
• ☐ Game name and logo (Ghana Life is only a working title. It copies the pattern of "Lagos Life", 
so choose a clearly different name before launch) 
• ☐ Who builds it: you, a freelancer, or a small team 
• ☐ Start picked by the player or drawn by the server 
• ☐ Voice: private rooms in Phase 1 (decided), nearby voice in Phase 2 
• ☐ Whether to add a satellite look, and when income allows 
• ☐ First region beyond Accra 
• ☐ Final choice of 2D engine after the cheap-phone test (PixiJS, or drawing vehicles as map 
symbols) 
• ☐ Where to host map files if a cut is over 25 MiB (several smaller files, or another free host) 
• ☐ Which cheap Android phone is the official test phone 
• ☐ Who finishes the base bodies: you in Blender, a freelance 3D artist, or ready-made licensed 
models 
• ☐ How Light gets its character sprites: baked from the 3D models, or separate layered 2D art 
• ☐ Which AI tool makes the first base bodies (compare Hunyuan 3D, Meshy, Tripo and Rodin) 
• ☐ Whether real-life meetups ever exist, and under what rules (proposed: not before Phase 3, 
groups only) 
• ☐ Who reviews each festival scene from the community, and how to credit them 
• ☐ Whether the first three public features are the right three (proposed: alive map, Reveal 
Ladder with private voice, culture calendar) 
• ☐ Monthly spending limit for the budget breaker (the most you are willing to pay in a month) 
• ☐ Invite-only waves or an open launch 
• ☐ Which fallback realtime host to keep ready (proposed: Colyseus) 
Corrections made since the earlier drafts. Voice moved from LiveKit to Cloudflare Realtime because it is 
far cheaper at small scale. The map moved from hand-drawn to a real-map engine. Banner prices moved 
below the reported Lagos Life rates. The NSS allowance now uses the real figure. Revision 2 added 
quality tiers, a risk register and a week-one sprint after a review of lag and cheap-phone risks. 
Sources. Citinewsroom, 2023 NSS allowance approval, Citinewsroom, 2026 allowance proposal, Condia 
on Lagos Life, WeeTracker on Lagos Life, Protomaps, Protomaps FAQ, Overture Maps places guide, 
Cloudflare Durable Objects pricing, Cloudflare Realtime pricing, Supabase Realtime limits, Google Maps 
geo guidelines, OpenAerialMap terms 