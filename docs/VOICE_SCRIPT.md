# Ghanaverse voice script

Every line the game speaks, grouped by who says it. Made from the game's code by `apps/web/scripts/voice-script.mjs`, so run it again after new lines are added.

## How to record

1. Use a quiet room (a wardrobe full of clothes is a good booth). Phone voice-memo apps are fine; hold the phone about a hand's width from your mouth.
2. Speak naturally, like the person would in the street. Ghanaian English, Pidgin and Twi as written; change a word if it sounds more natural, and tell us.
3. One line per file. Name each file exactly as shown (for example `chale-comot-for-road.mp3`). MP3, mono, 44.1 kHz or 48 kHz, about 1 second of quiet removed from the start and end.
4. Different people for different characters, if you can: Grandma, Auntie Dede and Uncle Kwame should each sound like one person. Drivers, mates and sellers can be several voices.
5. Put the files in `apps/web/public/voices/`, then run `node scripts/voice-script.mjs --index` in `apps/web`. The game then plays your recording instead of the phone's own voice. Lines you have not recorded yet keep the phone's voice.
6. Only record people who agree, and keep their written OK (name, date, "you may use my voice in Ghanaverse"). Record the voice actors in `apps/web/public/models/LICENSES.md`.

Lines said to the player come twice when it matters: once for a man ("my son", "my brother", "Massa", "Bra") and once for a woman ("my daughter", "my sister", "Madam", "Sista"). Record both.

Lines with `{...}` in them say a name the game fills in (your hometown, a place): the phone's voice says those for now.

## Story: shouts

*Who:* You and Auntie Dede (in the street)

| File | Line |
| --- | --- |
| `hey-my-bag-thief.mp3` | Hey! My bag! Thief! |
| `move-move-my-bag.mp3` | Move! Move! My bag! |
| `hey-my-daughter-come-come-here.mp3` | Hey! My daughter! Come, come here! |
| `hey-my-son-come-come-here.mp3` | Hey! My son! Come, come here! |

## Story: Bus mate

*Who:* Bus mate (young man, loud)

| File | Line |
| --- | --- |
| `circle-circle-last-stop-everybody-down-down.mp3` | Circle! Circle! Last stop! Everybody down, down! |
| `accra-accra-accra-last-seat-come-come.mp3` | Accra! Accra! Accra! Last seat, come, come! |

## Story: Grandma

*Who:* Grandma (old woman, warm, slow)

| File | Line |
| --- | --- |
| `my-child-go-and-make-us-proud.mp3` | My child, go and make us proud. |
| `go-and-make-us-proud.mp3` | Go and make us proud. |

## Story: Auntie Dede

*Who:* Auntie Dede (woman about 50, loud and motherly)

| File | Line |
| --- | --- |
| `ei-sit-down-my-child-what-happened.mp3` | Ei! Sit down, my child. What happened? |
| `sorry-ooo-who-do-you-know-in-accra.mp3` | Sorry, ooo. Who do you know in Accra? |
| `give-me-his-number-i-will-call-him-on-my-phone.mp3` | Give me his number. I will call him on my phone. |
| `hello-is-this-uncle-kwame-your-niece-is-here-with-me-at-circ.mp3` | Hello? Is this Uncle Kwame? Your niece is here with me at Circle. A boy took her bag. |
| `hello-is-this-uncle-kwame-your-nephew-is-here-with-me-at-cir.mp3` | Hello? Is this Uncle Kwame? Your nephew is here with me at Circle. A boy took his bag. |
| `by-the-lorry-station-the-kelewele-umbrella-okay-okay-bye-bye.mp3` | By the lorry station, the kelewele umbrella. Okay, okay. Bye bye. |
| `he-is-coming-don-t-worry-accra-will-not-swallow-you-here-eat.mp3` | He is coming. Don’t worry, Accra will not swallow you. Here, eat! |
| `ah-no-no-okay-thank-you-take-good-care-of-this-one.mp3` | Ah, no, no… okay, thank you. Take good care of this one! |

## Story: You, the player

*Who:* You, the player (young man about 20; a young woman reads them for a female player)

| File | Line |
| --- | --- |
| `a-boy-took-my-bag-my-money-my-phone-everything.mp3` | A boy took my bag. My money, my phone… everything. |
| `my-uncle-uncle-kwame.mp3` | My uncle. Uncle Kwame. |
| `thank-you-uncle-medaase.mp3` | Thank you, Uncle. Medaase. |
| `uncle-is-nima-far.mp3` | Uncle, is Nima far? |

## Story: Uncle Kwame

*Who:* Uncle Kwame (man about 55, deep and calm)

| File | Line |
| --- | --- |
| `ei-okay-no-problem-tell-her-to-stay-there-i-am-coming-very-s.mp3` | Ei! Okay, no problem. Tell her to stay there. I am coming very soon. |
| `ei-okay-no-problem-tell-him-to-stay-there-i-am-coming-very-s.mp3` | Ei! Okay, no problem. Tell him to stay there. I am coming very soon. |
| `auntie-thank-you-oo-god-bless-you-for-looking-after-my-niece.mp3` | Auntie, thank you oo! God bless you for looking after my niece. |
| `auntie-thank-you-oo-god-bless-you-for-looking-after-my-nephe.mp3` | Auntie, thank you oo! God bless you for looking after my nephew. |
| (filled in by the game) | {dayName}! Welcome to Accra. Come, let us go home. |
| `welcome-home-this-is-our-compound-come-let-me-show-you-your.mp3` | Welcome home. This is our compound. Come, let me show you your room. |
| `this-is-your-room-it-is-small-but-it-is-yours-the-mattress-i.mp3` | This is your room. It is small, but it is yours. The mattress is new. |
| `rest-well-tomorrow-we-start.mp3` | Rest well. Tomorrow, we start. |
| `this-is-ring-road-busy-busy-you-will-learn-it-fast.mp3` | This is Ring Road. Busy, busy. You will learn it fast. |
| `not-far-fifteen-minutes-if-the-traffic-allows-ha.mp3` | Not far. Fifteen minutes, if the traffic allows. Ha! |
| `this-is-nima-our-home-everybody-knows-everybody-here.mp3` | This is Nima. Our home. Everybody knows everybody here. |

## You, chasing the thief

*Who:* You, the player (shouting while running)

| File | Line |
| --- | --- |
| `thief-thief.mp3` | Thief! Thief! |
| `stop-him-stop-that-boy.mp3` | Stop him! Stop that boy! |
| `somebody-hold-him.mp3` | Somebody hold him! |
| `my-bag-thief.mp3` | My bag! Thief! |

## Drivers when you stand in the road

*Who:* Drivers (men, annoyed but not angry, shouting from the car)

| File | Line |
| --- | --- |
| `chale-comot-for-road.mp3` | Chale, comot for road! |
| `massa-move-you-no-see-the-car.mp3` | Massa, move! You no see the car? |
| `madam-move-you-no-see-the-car.mp3` | Madam, move! You no see the car? |
| `herh-give-way-my-brother.mp3` | Herh! Give way, my brother! |
| `herh-give-way-my-sister.mp3` | Herh! Give way, my sister! |
| `charley-wait-ooo-make-i-pass.mp3` | Charley, wait ooo! Make I pass! |
| `ei-you-want-make-car-jam-you.mp3` | Ei! You want make car jam you? |
| `bra-abeg-shift-small.mp3` | Bra, abeg shift small! |
| `sista-abeg-shift-small.mp3` | Sista, abeg shift small! |
| `jimmy-move-from-the-road.mp3` | Jimmy! Move from the road! |
| `sister-move-from-the-road.mp3` | Sister! Move from the road! |
| `mepa-wo-kyew-twe-wo-ho.mp3` | Mepa wo kyew, twe wo ho! |
| `make-way-make-way-we-dey-go.mp3` | Make way, make way! We dey go! |
| `ah-you-no-hear-horn-move.mp3` | Ah! You no hear horn? Move! |

## Trotro mates when you stand in the road

*Who:* Trotro mates (young men, loud)

| File | Line |
| --- | --- |
| `ah-my-brother-move-passengers-dey-wait.mp3` | Ah! My brother, move! Passengers dey wait! |
| `ah-my-sister-move-passengers-dey-wait.mp3` | Ah! My sister, move! Passengers dey wait! |
| `circle-circle-move-we-dey-go-circle.mp3` | Circle, Circle! Move, we dey go Circle! |
| `chale-you-go-pay-our-time-move.mp3` | Chale, you go pay our time? Move! |

## A driver who gets down to push you aside

*Who:* Driver (man, firm)

| File | Line |
| --- | --- |
| `massa-i-beg-go-side.mp3` | Massa, I beg, go side! |
| `madam-i-beg-go-side.mp3` | Madam, I beg, go side! |
| `chale-the-road-no-be-your-room.mp3` | Chale, the road no be your room! |
| `herh-go-the-pavement.mp3` | Herh, go the pavement! |

## People walking past, chatting

*Who:* Anyone: men, women, children (two or three different voices)

| File | Line |
| --- | --- |
| `chale-the-traffic-today.mp3` | Chale, the traffic today! |
| `i-am-coming-i-am-coming.mp3` | I am coming, I am coming! |
| `did-you-watch-the-match-yesterday.mp3` | Did you watch the match yesterday? |
| `charley-how-be.mp3` | Charley, how be? |
| `mummy-wait-for-me.mp3` | Mummy, wait for me! |
| `ei-the-sun-is-hot-oo.mp3` | Ei, the sun is hot oo! |
| `where-are-you-i-am-at-circle.mp3` | Where are you? I am at Circle. |
| `let-us-go-and-buy-waakye.mp3` | Let us go and buy waakye. |
| `this-trotro-is-too-slow.mp3` | This trotro is too slow! |
| `hello-i-can-t-hear-you.mp3` | Hello? I can’t hear you! |
| `ei-look-at-that-one.mp3` | Ei, look at that one! |
| `tomorrow-we-go-to-kaneshie-market.mp3` | Tomorrow we go to Kaneshie market. |
| `my-brother-how-far.mp3` | My brother, how far? |
| `my-sister-how-far.mp3` | My sister, how far? |
| `i-will-call-you-back.mp3` | I will call you back. |
| `ah-see-this-price.mp3` | Ah, see this price! |

## People greeting you

*Who:* Anyone: men and women

| File | Line |
| --- | --- |
| `chale.mp3` | Chale! |
| `ei-my-friend.mp3` | Ei, my friend! |
| `how-far.mp3` | How far? |
| `akwaaba.mp3` | Akwaaba! |
| `boss-come-and-buy.mp3` | Boss, come and buy! |
| `madam-come-and-buy.mp3` | Madam, come and buy! |
| `charley-how-be.mp3` (same as above) | Charley, how be? |
| `bra-you-dey.mp3` | Bra, you dey? |
| `sista-you-dey.mp3` | Sista, you dey? |
| `sister-come.mp3` | Sister, come! |
| `brother-come.mp3` | Brother, come! |
| `ete-sen.mp3` | Ete sen? |
| `wo-ho-te-sen.mp3` | Wo ho te sen? |

## People answering your greeting

*Who:* Anyone: men and women

| File | Line |
| --- | --- |
| `i-dey-how-about-you.mp3` | I dey, how about you? |
| `fine-fine.mp3` | Fine, fine! |
| `chale-i-dey-kraa.mp3` | Chale, I dey kraa! |
| `akwaaba.mp3` (same as above) | Akwaaba! |
| `we-dey-here-oo.mp3` | We dey here oo! |
| `medaase.mp3` | Medaase! |
| `god-dey.mp3` | God dey! |

## Sellers calling out

*Who:* Market women and hawkers (loud, sing-song)

| File | Line |
| --- | --- |
| `come-and-buy.mp3` | Come and buy! |
| `pure-water-pure-water.mp3` | Pure water! Pure water! |
| `fresh-bread.mp3` | Fresh bread! |
| `ice-cold.mp3` | Ice cold! |
| `credit-dey.mp3` | Credit dey! |
| `kenkey-hot.mp3` | Kenkey hot! |
| `waakye-dey.mp3` | Waakye dey! |

## Sellers answering you

*Who:* Market women and hawkers

| File | Line |
| --- | --- |
| `welcome-what-do-you-want.mp3` | Welcome! What do you want? |
| `my-customer.mp3` | My customer! |
| `everything-dey-come.mp3` | Everything dey, come! |
| `special-price-for-you.mp3` | Special price for you! |

## Phone sellers at Circle

*Who:* Young men (fast, cheeky)

| File | Line |
| --- | --- |
| `phones-phones.mp3` | Phones! Phones! |
| `charger-earpiece-power-bank.mp3` | Charger, earpiece, power bank! |
| `screen-guard-boss.mp3` | Screen guard, boss! |
| `credit-and-data-dey.mp3` | Credit and data dey! |
| `bring-your-phone-i-fix-am.mp3` | Bring your phone, I fix am! |
| `original-charger-come.mp3` | Original charger, come! |

## Trotro station

*Who:* Bus mates and hawkers ({dest} is a place name: the phone says those for now)

| File | Line |
| --- | --- |
| (filled in by the game) | {dest}! {dest}! |
| (filled in by the game) | {dest}, one more, come! |
| `last-seat-last-seat.mp3` | Last seat, last seat! |
| (filled in by the game) | {dest} straight! |
| `pure-water-pure-water.mp3` (same as above) | Pure water! Pure water! |
| `bread-bread.mp3` | Bread, bread! |
| `meat-pie-ice-cold-drink.mp3` | Meat pie, ice cold drink! |

## Bus mates calling routes

*Who:* Bus mates (young men, very loud, fast)

| File | Line |
| --- | --- |
| `circle-circle-circle.mp3` | Circle! Circle! Circle! |
| `circle-circle-one-more-come.mp3` | Circle, Circle! One more, come! |
| `circle-straight-come-come.mp3` | Circle! Straight! Come, come! |
| `accra-accra-accra.mp3` | Accra! Accra! Accra! |
| `accra-accra-one-more-come.mp3` | Accra, Accra! One more, come! |
| `accra-straight-come-come.mp3` | Accra! Straight! Come, come! |
| `kaneshie-kaneshie-kaneshie.mp3` | Kaneshie! Kaneshie! Kaneshie! |
| `kaneshie-kaneshie-one-more-come.mp3` | Kaneshie, Kaneshie! One more, come! |
| `kaneshie-straight-come-come.mp3` | Kaneshie! Straight! Come, come! |
| `madina-madina-madina.mp3` | Madina! Madina! Madina! |
| `madina-madina-one-more-come.mp3` | Madina, Madina! One more, come! |
| `madina-straight-come-come.mp3` | Madina! Straight! Come, come! |
| `lapaz-lapaz-lapaz.mp3` | Lapaz! Lapaz! Lapaz! |
| `lapaz-lapaz-one-more-come.mp3` | Lapaz, Lapaz! One more, come! |
| `lapaz-straight-come-come.mp3` | Lapaz! Straight! Come, come! |
| `achimota-achimota-achimota.mp3` | Achimota! Achimota! Achimota! |
| `achimota-achimota-one-more-come.mp3` | Achimota, Achimota! One more, come! |
| `achimota-straight-come-come.mp3` | Achimota! Straight! Come, come! |
| `kasoa-kasoa-kasoa.mp3` | Kasoa! Kasoa! Kasoa! |
| `kasoa-kasoa-one-more-come.mp3` | Kasoa, Kasoa! One more, come! |
| `kasoa-straight-come-come.mp3` | Kasoa! Straight! Come, come! |
| `tema-tema-tema.mp3` | Tema! Tema! Tema! |
| `tema-tema-one-more-come.mp3` | Tema, Tema! One more, come! |
| `tema-straight-come-come.mp3` | Tema! Straight! Come, come! |
| `odorkor-odorkor-odorkor.mp3` | Odorkor! Odorkor! Odorkor! |
| `odorkor-odorkor-one-more-come.mp3` | Odorkor, Odorkor! One more, come! |
| `odorkor-straight-come-come.mp3` | Odorkor! Straight! Come, come! |
| `adabraka-adabraka-adabraka.mp3` | Adabraka! Adabraka! Adabraka! |
| `adabraka-adabraka-one-more-come.mp3` | Adabraka, Adabraka! One more, come! |
| `adabraka-straight-come-come.mp3` | Adabraka! Straight! Come, come! |
| `osu-osu-osu.mp3` | Osu! Osu! Osu! |
| `osu-osu-one-more-come.mp3` | Osu, Osu! One more, come! |
| `osu-straight-come-come.mp3` | Osu! Straight! Come, come! |
| `spintex-spintex-spintex.mp3` | Spintex! Spintex! Spintex! |
| `spintex-spintex-one-more-come.mp3` | Spintex, Spintex! One more, come! |
| `spintex-straight-come-come.mp3` | Spintex! Straight! Come, come! |
| `dansoman-dansoman-dansoman.mp3` | Dansoman! Dansoman! Dansoman! |
| `dansoman-dansoman-one-more-come.mp3` | Dansoman, Dansoman! One more, come! |
| `dansoman-straight-come-come.mp3` | Dansoman! Straight! Come, come! |
| `nkrumah-circle-nkrumah-circle-nkrumah-circle.mp3` | Nkrumah Circle! Nkrumah Circle! Nkrumah Circle! |
| `nkrumah-circle-nkrumah-circle-one-more-come.mp3` | Nkrumah Circle, Nkrumah Circle! One more, come! |
| `nkrumah-circle-straight-come-come.mp3` | Nkrumah Circle! Straight! Come, come! |

## Talk: Anyone

*Who:* Anyone

| File | Line |
| --- | --- |
| `good-afternoon-you-look-new-here-where-are-you-from.mp3` | Good afternoon! You look new here. Where are you from? |
| (filled in by the game) | {home}! Akwaaba to Accra. What brought you here? |
| `work-dey-but-you-must-hustle-start-small-my-friend.mp3` | Work dey, but you must hustle. Start small, my friend. |
| `good-family-is-everything-in-this-city-stay-close-to-him.mp3` | Good. Family is everything in this city. Stay close to him. |
| `ha-this-one-is-small-come-back-at-closing-time-you-will-see.mp3` | Ha! This one is small. Come back at closing time, you will see crowd! |
| `no-problem-safe-journey-eh.mp3` | No problem. Safe journey, eh! |
| `chale-how-far-you-dey-okay.mp3` | Chale, how far? You dey okay? |
| `i-dey-kraa-by-his-grace-where-are-you-going.mp3` | I dey kraa! By His grace. Where are you going? |
| `ei-sorry-oo-was-it-at-the-station.mp3` | Ei, sorry oo! Was it at the station? |
| `those-boys-be-careful-with-your-phone-too-eh.mp3` | Those boys! Be careful with your phone too, eh. |
| `accra-is-fast-next-time-hold-your-things-in-front.mp3` | Accra is fast. Next time, hold your things in front. |
| `hello-are-you-looking-for-somewhere.mp3` | Hello! Are you looking for somewhere? |
| `the-station-is-just-there-ask-the-mate-for-your-place-he-wil.mp3` | The station is just there. Ask the mate for your place, he will shout it. |
| `buy-waakye-or-kenkey-from-the-aunties-cheap-and-it-fills-you.mp3` | Buy waakye or kenkey from the aunties. Cheap and it fills your belly. |
| `enjoy-but-hold-your-pocket-well-eh.mp3` | Enjoy! But hold your pocket well, eh. |

## Talk: your answers

*Who:* You, the player

| File | Line |
| --- | --- |
| (filled in by the game) | I am from {home}. |
| `i-came-to-find-work.mp3` | I came to find work. |
| `my-uncle-lives-here.mp3` | My uncle lives here. |
| `i-just-arrived-is-circle-always-this-busy.mp3` | I just arrived. Is Circle always this busy? |
| `sorry-i-am-in-a-hurry.mp3` | Sorry, I am in a hurry. |
| `i-dey-chale-and-you.mp3` | I dey, chale. And you? |
| `not-really-somebody-stole-my-bag.mp3` | Not really. Somebody stole my bag. |
| `yes-a-boy-in-red.mp3` | Yes, a boy in red. |
| `i-don-t-know-it-was-so-fast.mp3` | I don’t know. It was so fast. |
| `yes-where-can-i-get-a-trotro.mp3` | Yes, where can I get a trotro? |
| `where-can-i-eat-something-cheap.mp3` | Where can I eat something cheap? |
| `no-i-am-just-walking-around.mp3` | No, I am just walking around. |
| `alaikum-salaam-it-is-long-i-just-arrived.mp3` | Alaikum salaam. It is long, I just arrived. |
| `alaikum-salaam-fine-thank-you.mp3` | Alaikum salaam. Fine, thank you. |
| `alaikum-salaam-i-am-fine-thank-you.mp3` | Alaikum salaam. I am fine, thank you. |
| `i-am-new-here-and-lost-a-little.mp3` | I am new here and lost a little. |
| `yes-every-sunday.mp3` | Yes, every Sunday. |
| `not-here-yet-i-just-arrived.mp3` | Not here yet. I just arrived. |
| (filled in by the game) | My name is {name}. And you? |
| `where-is-your-mummy.mp3` | Where is your mummy? |
| `no-i-just-came-to-accra.mp3` | No, I just came to Accra. |
| `which-school-do-you-go-to.mp3` | Which school do you go to? |
| `yes-i-finished.mp3` | Yes, I finished. |
| `study-hard-eh.mp3` | Study hard, eh. |
| `no-load-today-they-took-my-bag.mp3` | No load today. They took my bag. |
| `how-much-do-you-charge.mp3` | How much do you charge? |
| `how-much.mp3` | How much? |
| `not-today-thank-you.mp3` | Not today, thank you. |
| `just-looking-for-now.mp3` | Just looking for now. |
| `how-much-is-it.mp3` | How much is it? |
| `i-have-no-money-now.mp3` | I have no money now. |
| `let-me-think-about-it.mp3` | Let me think about it. |
| `my-phone-was-stolen-how-much-is-a-new-one.mp3` | My phone was stolen. How much is a new one? |
| `i-have-no-money-yet.mp3` | I have no money yet. |
| `show-me-the-cheapest-one.mp3` | Show me the cheapest one. |
| `just-looking.mp3` | Just looking. |
| `how-much-to-kaneshie.mp3` | How much to Kaneshie? |
| `not-today.mp3` | Not today. |

## Talk: A Muslim man

*Who:* A Muslim man

| File | Line |
| --- | --- |
| `salaam-alaikum-my-brother-how-is-your-day.mp3` | Salaam alaikum, my brother. How is your day? |
| `salaam-alaikum-my-sister-how-is-your-day.mp3` | Salaam alaikum, my sister. How is your day? |
| `welcome-take-your-time-you-will-know-accra-small-small.mp3` | Welcome. Take your time, you will know Accra small small. |
| `alhamdulillah-go-well.mp3` | Alhamdulillah. Go well. |

## Talk: A Muslim woman

*Who:* A Muslim woman

| File | Line |
| --- | --- |
| `salaam-alaikum-you-look-tired-my-dear-are-you-okay.mp3` | Salaam alaikum. You look tired, my dear. Are you okay? |
| `good-drink-some-water-the-sun-is-hot-today.mp3` | Good. Drink some water, the sun is hot today. |
| `ask-the-people-at-the-kiosks-everybody-will-help-you.mp3` | Ask the people at the kiosks. Everybody will help you. |

## Talk: A church person

*Who:* A church person

| File | Line |
| --- | --- |
| `god-bless-you-my-dear-do-you-go-to-church.mp3` | God bless you, my dear! Do you go to church? |
| `praise-god-come-and-visit-our-choir-on-sunday.mp3` | Praise God! Come and visit our choir on Sunday. |
| `then-welcome-to-accra-god-will-guide-you-eh.mp3` | Then welcome to Accra. God will guide you, eh. |

## Talk: A child

*Who:* A child

| File | Line |
| --- | --- |
| `good-afternoon-please-what-is-your-name.mp3` | Good afternoon, please! What is your name? |
| `i-am-kofi-i-am-going-home-to-eat.mp3` | I am Kofi! I am going home to eat. |
| `she-is-selling-over-there-at-the-umbrella.mp3` | She is selling over there! At the umbrella. |

## Talk: A school pupil

*Who:* A school pupil

| File | Line |
| --- | --- |
| `good-afternoon-please-are-you-a-teacher.mp3` | Good afternoon, please! Are you a teacher? |
| `okay-we-are-going-home-school-was-long-today.mp3` | Okay! We are going home. School was long today. |
| `the-one-behind-the-market-did-you-finish-school.mp3` | The one behind the market! Did you finish school? |
| `ei-you-are-lucky-we-have-exams-next-week.mp3` | Ei, you are lucky! We have exams next week. |
| `yes-please-thank-you.mp3` | Yes, please! Thank you! |

## Talk: A kayayo (woman carrying loads)

*Who:* A kayayo (woman carrying loads)

| File | Line |
| --- | --- |
| `please-you-want-somebody-to-carry-your-load.mp3` | Please, you want somebody to carry your load? |
| `ei-sorry-be-careful-at-the-station-my-brother.mp3` | Ei, sorry! Be careful at the station, my brother. |
| `ei-sorry-be-careful-at-the-station-my-sister.mp3` | Ei, sorry! Be careful at the station, my sister. |
| `small-small-depends-on-the-load-and-where-you-are-going.mp3` | Small, small. Depends on the load and where you are going. |

## Talk: A hawker

*Who:* A hawker

| File | Line |
| --- | --- |
| `pure-water-ice-cold-you-want-some.mp3` | Pure water, ice cold! You want some? |
| `fifty-pesewas-only-cold-cold.mp3` | Fifty pesewas only! Cold, cold. |
| `no-problem-next-time-my-customer.mp3` | No problem. Next time, my customer! |

## Talk: A seller

*Who:* A seller

| File | Line |
| --- | --- |
| `my-customer-what-are-you-looking-for.mp3` | My customer! What are you looking for? |
| `look-well-everything-is-fresh.mp3` | Look well, everything is fresh! |
| `for-you-special-price-how-many-do-you-want.mp3` | For you, special price! How many do you want? |
| `ah-come-back-when-you-have-eh-i-will-keep-one-for-you.mp3` | Ah. Come back when you have, eh. I will keep one for you. |
| `okay-i-am-here-till-evening.mp3` | Okay, I am here till evening. |

## Talk: A phone seller

*Who:* A phone seller

| File | Line |
| --- | --- |
| `boss-phones-chargers-power-bank-what-do-you-need.mp3` | Boss! Phones, chargers, power bank! What do you need? |
| `madam-phones-chargers-power-bank-what-do-you-need.mp3` | Madam! Phones, chargers, power bank! What do you need? |
| `sorry-boss-small-phones-start-from-three-hundred-cedis-you-w.mp3` | Sorry, boss! Small phones start from three hundred cedis. You want to see? |
| `sorry-madam-small-phones-start-from-three-hundred-cedis-you.mp3` | Sorry, madam! Small phones start from three hundred cedis. You want to see? |
| `no-wahala-when-you-get-money-come-here-first-i-will-do-you-g.mp3` | No wahala. When you get money, come here first, I will do you good price. |
| `this-one-strong-battery-dual-sim-come-back-with-the-money-eh.mp3` | This one! Strong battery, dual SIM. Come back with the money, eh. |
| `look-well-boss-original-stuff-only.mp3` | Look well, boss! Original stuff only. |
| `look-well-madam-original-stuff-only.mp3` | Look well, madam! Original stuff only. |

## Talk: A bus mate

*Who:* A bus mate

| File | Line |
| --- | --- |
| `where-are-you-going-kaneshie-madina-come-come.mp3` | Where are you going? Kaneshie? Madina? Come, come! |
| `five-cedis-one-more-seat-come-and-sit.mp3` | Five cedis! One more seat, come and sit! |
| `ei-then-you-go-walk-oo-next-time.mp3` | Ei! Then you go walk oo. Next time! |
| `okay-kaneshie-kaneshie-kaneshie.mp3` | Okay! Kaneshie! Kaneshie! Kaneshie! |

## Phone: Uncle Kwame

*Who:* Uncle Kwame

| File | Line |
| --- | --- |
| (filled in by the game) | Hello, {hooks.nickname()}! Have you eaten? |
| `hehe-that-woman-is-good-stay-near-her-stall-i-am-coming-traf.mp3` | Hehe, that woman is good. Stay near her stall, I am coming. Traffic at Circle is terrible. |
| `ei-go-and-buy-something-waakye-anything-you-need-strength-fo.mp3` | Ei! Go and buy something. Waakye, anything. You need strength for Accra. |
| `i-know-i-know-don-t-worry-we-will-get-you-a-new-phone-and-a.mp3` | I know, I know. Don’t worry. We will get you a new phone and a SIM. First, let me reach you. |
| `hello-who-is-this-the-network-is-breaking-call-me-again-when.mp3` | Hello? Who is this? … The network is breaking. Call me again when you reach Circle. |

## Phone: your answers

*Who:* You, the player

| File | Line |
| --- | --- |
| `yes-auntie-dede-gave-me-kelewele.mp3` | Yes, Auntie Dede gave me kelewele. |
| `not-yet-uncle.mp3` | Not yet, Uncle. |
| `uncle-my-bag-is-gone.mp3` | Uncle, my bag is gone… |
| `i-am-fine-auntie-thank-you.mp3` | I am fine, Auntie. Thank you. |
| `auntie-where-is-the-filling-station.mp3` | Auntie, where is the filling station? |
| `yes-grandma-i-have-reached.mp3` | Yes, Grandma. I have reached. |
| `grandma-someone-stole-my-bag.mp3` | Grandma, someone stole my bag. |

## Phone: Auntie Dede

*Who:* Auntie Dede

| File | Line |
| --- | --- |
| `my-son-are-you-fine-come-and-buy-kelewele-i-have-the-hot-one.mp3` | My son! Are you fine? Come and buy kelewele, I have the hot one now. |
| `my-daughter-are-you-fine-come-and-buy-kelewele-i-have-the-ho.mp3` | My daughter! Are you fine? Come and buy kelewele, I have the hot one now. |
| `good-accra-will-not-swallow-you-greet-your-uncle-for-me.mp3` | Good. Accra will not swallow you. Greet your uncle for me. |
| `check-your-map-my-son-look-for-the-pump-they-are-everywhere.mp3` | Check your map, my son. Look for the pump. They are everywhere. |
| `check-your-map-my-daughter-look-for-the-pump-they-are-everyw.mp3` | Check your map, my daughter. Look for the pump. They are everywhere. |
| `hello-i-don-t-know-this-number-oo-who-is-calling.mp3` | Hello? I don’t know this number oo. Who is calling? |

## Phone: Grandma

*Who:* Grandma

| File | Line |
| --- | --- |
| `my-child-have-you-reached-accra-are-you-eating-well.mp3` | My child! Have you reached Accra? Are you eating well? |
| `god-be-praised-greet-your-uncle-and-keep-the-letter-safe.mp3` | God be praised. Greet your uncle. And keep the letter safe. |
| `ei-accra-people-don-t-worry-my-child-your-uncle-will-help-yo.mp3` | Ei! Accra people! Don’t worry, my child. Your uncle will help you. Be careful. |

## Phone: Ride Help

*Who:* Ride Help

| File | Line |
| --- | --- |
| `welcome-to-ghanaverse-ride-open-the-ride-app-on-your-phone-t.mp3` | Welcome to Ghanaverse Ride. Open the Ride app on your phone to choose okada, taxi or trotro. Thank you. |

---

265 lines to record.
