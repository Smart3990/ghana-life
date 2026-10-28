// Conversations with the people of the city: they speak first (often with a question), you choose
// what to answer, and they reply; some go on for a second question. Who they are decides what they
// talk about. {home} is the player's hometown, {name} the player's day name.

export type TalkNode = { them: string; choices?: { you: string; next?: TalkNode | string }[] };
const end = (text: string): TalkNode => ({ them: text });

export const TALKS: Record<string, TalkNode[]> = {
  any: [
    {
      them: 'Good afternoon! You look new here. Where are you from?',
      choices: [
        { you: 'I am from {home}.', next: { them: '{home}! Akwaaba to Accra. What brought you here?', choices: [
          { you: 'I came to find work.', next: 'Work dey, but you must hustle. Start small, my friend.' },
          { you: 'My uncle lives here.', next: 'Good. Family is everything in this city. Stay close to him.' },
        ] } },
        { you: 'I just arrived. Is Circle always this busy?', next: 'Ha! This one is small. Come back at closing time, you will see crowd!' },
        { you: 'Sorry, I am in a hurry.', next: 'No problem. Safe journey, eh!' },
      ],
    },
    {
      them: 'Chale, how far? You dey okay?',
      choices: [
        { you: 'I dey, chale. And you?', next: 'I dey kraa! By His grace. Where are you going?' },
        { you: 'Not really. Somebody stole my bag.', next: { them: 'Ei, sorry oo! Was it at the station?', choices: [
          { you: 'Yes, a boy in red.', next: 'Those boys! Be careful with your phone too, eh.' },
          { you: 'I don’t know. It was so fast.', next: 'Accra is fast. Next time, hold your things in front.' },
        ] } },
      ],
    },
    {
      them: 'Hello! Are you looking for somewhere?',
      choices: [
        { you: 'Yes, where can I get a trotro?', next: 'The station is just there. Ask the mate for your place, he will shout it.' },
        { you: 'Where can I eat something cheap?', next: 'Buy waakye or kenkey from the aunties. Cheap and it fills your belly.' },
        { you: 'No, I am just walking around.', next: 'Enjoy! But hold your pocket well, eh.' },
      ],
    },
  ],
  muslimMan: [{ them: 'Salaam alaikum, my brother. How is your day?', choices: [
    { you: 'Alaikum salaam. It is long, I just arrived.', next: 'Welcome. Take your time, you will know Accra small small.' },
    { you: 'Alaikum salaam. Fine, thank you.', next: 'Alhamdulillah. Go well.' },
  ] }],
  muslimWoman: [{ them: 'Salaam alaikum. You look tired, my dear. Are you okay?', choices: [
    { you: 'Alaikum salaam. I am fine, thank you.', next: 'Good. Drink some water, the sun is hot today.' },
    { you: 'I am new here and lost a little.', next: 'Ask the people at the kiosks. Everybody will help you.' },
  ] }],
  church: [{ them: 'God bless you, my dear! Do you go to church?', choices: [
    { you: 'Yes, every Sunday.', next: 'Praise God! Come and visit our choir on Sunday.' },
    { you: 'Not here yet. I just arrived.', next: 'Then welcome to Accra. God will guide you, eh.' },
  ] }],
  child: [{ them: 'Good afternoon, please! What is your name?', choices: [
    { you: 'My name is {name}. And you?', next: 'I am Kofi! I am going home to eat.' },
    { you: 'Where is your mummy?', next: 'She is selling over there! At the umbrella.' },
  ] }],
  pupil: [
    { them: 'Good afternoon, please! Are you a teacher?', choices: [
      { you: 'No, I just came to Accra.', next: 'Okay! We are going home. School was long today.' },
      { you: 'Which school do you go to?', next: { them: 'The one behind the market! Did you finish school?', choices: [
        { you: 'Yes, I finished.', next: 'Ei, you are lucky! We have exams next week.' },
        { you: 'Study hard, eh.', next: 'Yes, please! Thank you!' },
      ] } },
    ] },
  ],
  kayayo: [{ them: 'Please, you want somebody to carry your load?', choices: [
    { you: 'No load today. They took my bag.', next: 'Ei, sorry! Be careful at the station, my brother.' },
    { you: 'How much do you charge?', next: 'Small, small. Depends on the load and where you are going.' },
  ] }],
  hawker: [{ them: 'Pure water, ice cold! You want some?', choices: [
    { you: 'How much?', next: 'Fifty pesewas only! Cold, cold.' },
    { you: 'Not today, thank you.', next: 'No problem. Next time, my customer!' },
  ] }],
  seller: [
    { them: 'My customer! What are you looking for?', choices: [
      { you: 'Just looking for now.', next: 'Look well, everything is fresh!' },
      { you: 'How much is it?', next: { them: 'For you, special price! How many do you want?', choices: [
        { you: 'I have no money now.', next: 'Ah. Come back when you have, eh. I will keep one for you.' },
        { you: 'Let me think about it.', next: 'Okay, I am here till evening.' },
      ] } },
    ] },
  ],
  phones: [
    { them: 'Boss! Phones, chargers, power bank! What do you need?', choices: [
      { you: 'My phone was stolen. How much is a new one?', next: { them: 'Sorry, boss! Small phones start from three hundred cedis. You want to see?', choices: [
        { you: 'I have no money yet.', next: 'No wahala. When you get money, come here first, I will do you good price.' },
        { you: 'Show me the cheapest one.', next: 'This one! Strong battery, dual SIM. Come back with the money, eh.' },
      ] } },
      { you: 'Just looking.', next: 'Look well, boss! Original stuff only.' },
    ] },
  ],
  // Okada riders and drivers you talk to from the kerb (in traffic, or stopped).
  rider: [
    { them: 'Chale, where you dey go? I fit drop you.', choices: [
      { you: 'Not now, thank you.', next: 'Okay, no wahala! Another time.' },
      { you: 'Is it far to Nima?', next: 'Nima? Not too far. With okada, ten minutes, if the traffic allows.' },
    ] },
    { them: 'Bra, how far? The traffic is too much today oo.', choices: [
      { you: 'Ei, true! Every day?', next: 'Every day! Accra traffic, we just manage.' },
      { you: 'Ride safe, my brother.', next: 'Thank you, God bless you!' },
    ] },
  ],
  driver: [
    { them: 'Hello! Taxi? Where are you going?', choices: [
      { you: 'Just looking around.', next: 'Okay, enjoy Accra! Circle is busy, watch your bag.' },
      { you: 'How is business today?', next: 'Small small. But God is good!' },
    ] },
    { them: 'Ah, this traffic! You are walking? You are faster than me today!', choices: [
      { you: 'Ha! Sorry oo.', next: 'No problem. Have a good day!' },
    ] },
  ],
  mate: [
    { them: 'Where are you going? Kaneshie? Madina? Come, come!', choices: [
      { you: 'How much to Kaneshie?', next: 'Five cedis! One more seat, come and sit!' },
      { you: 'I have no money now.', next: 'Ei! Then you go walk oo. Next time!' },
      { you: 'Not today.', next: 'Okay! Kaneshie! Kaneshie! Kaneshie!' },
    ] },
  ],
};

export const asNode = (n: TalkNode | string | undefined): TalkNode | null => (n === undefined ? null : typeof n === 'string' ? end(n) : n);
