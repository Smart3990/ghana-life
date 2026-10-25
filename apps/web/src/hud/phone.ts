// The in-game phone (design brief 4.3, 9.5, 12, 14). Everything that is not needed on the main screen
// lives here: Missions, the Map, the Ride app, City Feed, Calls, the Mobile Money wallet, Friends and
// Settings. No email and no messages app (brief 21): story people reach you by calls and map markers.
// Plain HTML, built the first time it opens, so it costs nothing while you play.
import type { Speaker } from '../game/voices';

export type MissionRow = { title: string; goal: string; state: 'done' | 'now' | 'next' | 'locked' };
export type Destination = { name: string; x: number; z: number; kind: string };
type CallLine = { say: string; choices?: { text: string; next: CallLine }[] };
type Contact = { name: string; role: string; who: Speaker; call: () => CallLine; color: string };

export type PhoneHooks = {
  money: () => number;
  history: () => { what: string; amount: number; time: string }[];
  missions: () => MissionRow[];
  goal: () => string;
  openMap: () => void;
  destinations: () => (Destination & { dist: number })[];
  setWaypoint: (d: Destination | null) => void;
  waypoint: () => Destination | null;
  feed: () => { who: string; text: string; time: string; gold?: boolean }[];
  say: (text: string, who: Speaker) => Promise<void>;
  /** The line in the form for the player ("my son" or "my daughter"). */
  toMe: (text: string) => string;
  stopTalking: () => void;
  nickname: () => string;
  storyDone: (step: string) => boolean;
  muted: () => boolean;
  toggleSound: () => void;
  tier: () => string;
};

const APPS = [
  { id: 'missions', name: 'Missions', icon: '★', bg: 'linear-gradient(135deg,#e3a92b,#c8442e)' },
  { id: 'map', name: 'Map', icon: '🗺️', bg: 'linear-gradient(135deg,#2f8f57,#1f5fa8)' },
  { id: 'ride', name: 'Ride', icon: '🛺', bg: 'linear-gradient(135deg,#121a14,#2f8f57)' },
  { id: 'feed', name: 'City Feed', icon: '📣', bg: 'linear-gradient(135deg,#1f5fa8,#6a4c93)' },
  { id: 'calls', name: 'Calls', icon: '📞', bg: 'linear-gradient(135deg,#2f8f57,#7fa23c)' },
  { id: 'momo', name: 'MoMo', icon: '₵', bg: 'linear-gradient(135deg,#f2c21a,#e3a92b)' },
  { id: 'friends', name: 'Friends', icon: '👥', bg: 'linear-gradient(135deg,#c8442e,#d8572f)' },
  { id: 'settings', name: 'Settings', icon: '⚙️', bg: 'linear-gradient(135deg,#2e3a32,#121a14)' },
] as const;
type AppId = (typeof APPS)[number]['id'];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cedis = (n: number) => `₵ ${n.toLocaleString('en-GH')}`;
const nowTime = () => {
  const d = new Date(); // Ghana time is UTC
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

export class Phone {
  isOpen = false;
  private root: HTMLElement | null = null;
  private screen!: HTMLElement;
  private app: AppId | 'home' | 'call' = 'home';
  private seenFeed = 0;
  private calling = 0; // changes on every new call, so an old call stops when you hang up
  private contacts: Contact[];

  constructor(private hooks: PhoneHooks) {
    const uncle: Speaker = { body: 'male', seed: 55 };
    const dede: Speaker = { body: 'female', seed: 50 };
    const grandma: Speaker = { body: 'female', seed: 81 };
    this.contacts = [
      {
        name: 'Uncle Kwame',
        role: 'Family',
        who: uncle,
        color: '#1f5fa8',
        call: () =>
          hooks.storyDone('auntie')
            ? {
                say: `Hello, ${hooks.nickname()}! Have you eaten?`,
                choices: [
                  { text: 'Yes, Auntie Dede gave me kelewele.', next: { say: 'Hehe, that woman is good. Stay near her stall, I am coming. Traffic at Circle is terrible.' } },
                  { text: 'Not yet, Uncle.', next: { say: 'Ei! Go and buy something. Waakye, anything. You need strength for Accra.' } },
                  { text: 'Uncle, my bag is gone…', next: { say: 'I know, I know. Don’t worry. We will get you a new phone and a SIM. First, let me reach you.' } },
                ],
              }
            : { say: 'Hello? Who is this? … The network is breaking. Call me again when you reach Circle.' },
      },
      {
        name: 'Auntie Dede',
        role: 'Kelewele, Circle',
        who: dede,
        color: '#e3a92b',
        call: () =>
          hooks.storyDone('auntie')
            ? {
                say: 'My son! Are you fine? Come and buy kelewele, I have the hot one now.',
                choices: [
                  { text: 'I am fine, Auntie. Thank you.', next: { say: 'Good. Accra will not swallow you. Greet your uncle for me.' } },
                  { text: 'Auntie, where is the filling station?', next: { say: 'Check your map, my son. Look for the pump. They are everywhere.' } },
                ],
              }
            : { say: 'Hello? I don’t know this number oo. Who is calling?' },
      },
      {
        name: 'Grandma',
        role: 'Home',
        who: grandma,
        color: '#7fa23c',
        call: () => ({
          say: 'My child! Have you reached Accra? Are you eating well?',
          choices: [
            { text: 'Yes, Grandma. I have reached.', next: { say: 'God be praised. Greet your uncle. And keep the letter safe.' } },
            { text: 'Grandma, someone stole my bag.', next: { say: 'Ei! Accra people! Don’t worry, my child. Your uncle will help you. Be careful.' } },
          ],
        }),
      },
      {
        name: 'Ride Help',
        role: 'Ghanaverse Ride',
        who: { body: 'female', seed: 12 },
        color: '#2f8f57',
        call: () => ({ say: 'Welcome to Ghanaverse Ride. Open the Ride app on your phone to choose okada, taxi or trotro. Thank you.' }),
      },
    ];
  }

  /** How many City Feed posts are new since the phone was last opened (for the little dot). */
  newPosts() {
    return Math.max(0, this.hooks.feed().length - this.seenFeed);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(app: AppId | 'home' = 'home') {
    this.build();
    this.isOpen = true;
    this.root!.classList.remove('hidden');
    void this.root!.offsetWidth; // so the slide-up animation starts from below
    this.root!.classList.add('up');
    this.show(app);
  }

  close() {
    if (!this.root || !this.isOpen) return;
    this.isOpen = false;
    this.hangUp();
    this.root.classList.remove('up');
    setTimeout(() => !this.isOpen && this.root!.classList.add('hidden'), 260);
  }

  private build() {
    if (this.root) return;
    const root = document.createElement('div');
    root.id = 'phone';
    root.className = 'hidden';
    root.innerHTML = `
      <div class="ph-shade"></div>
      <div class="ph-body" role="dialog" aria-label="Your phone">
        <div class="ph-status"><b class="ph-time"></b><span>GV-Tel ▂▄▆ · 4G · 🔋 82%</span></div>
        <div class="ph-screen"></div>
        <div class="ph-nav"><button type="button" class="ph-back" aria-label="Back">‹</button><button type="button" class="ph-homebtn" aria-label="Home"></button><button type="button" class="ph-x" aria-label="Close the phone">✕</button></div>
      </div>`;
    document.body.append(root);
    this.root = root;
    this.screen = root.querySelector('.ph-screen')!;
    root.querySelector('.ph-shade')!.addEventListener('click', () => this.close());
    root.querySelector('.ph-x')!.addEventListener('click', () => this.close());
    root.querySelector('.ph-homebtn')!.addEventListener('click', () => this.show('home'));
    root.querySelector('.ph-back')!.addEventListener('click', () => (this.app === 'home' ? this.close() : this.show(this.app === 'call' ? 'calls' : 'home')));
    // Touches on the phone must not move the player or turn the camera.
    for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    this.screen.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-go]') as HTMLElement | null;
      if (el) this.act(el.dataset.go!, el.dataset.arg ?? '');
    });
  }

  private act(go: string, arg: string) {
    if (go === 'app') this.show(arg as AppId);
    else if (go === 'map') {
      this.close();
      this.hooks.openMap();
    } else if (go === 'ride') {
      const d = this.hooks.destinations().find((x) => x.name === arg);
      if (d) this.rideTo(d);
    } else if (go === 'unride') {
      this.hooks.setWaypoint(null);
      this.show('ride');
    } else if (go === 'call') {
      const c = this.contacts[Number(arg)];
      if (c) this.startCall(c);
    } else if (go === 'hang') {
      this.hangUp();
      this.show('calls');
    } else if (go === 'sound') {
      this.hooks.toggleSound();
      this.show('settings');
    } else if (go === 'tier') {
      const u = new URL(location.href);
      u.searchParams.set('tier', arg);
      location.href = u.toString();
    }
  }

  private show(app: AppId | 'home' | 'call') {
    this.app = app;
    this.root!.querySelector('.ph-time')!.textContent = nowTime();
    const page = (title: string, body: string) => `<div class="ph-app"><h2>${title}</h2>${body}</div>`;
    let html = '';
    if (app === 'home') {
      const dot = this.newPosts();
      html = `<div class="ph-home">
        <div class="ph-clock">${nowTime()}<small>${new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} · Accra</small></div>
        ${this.hooks.goal() ? `<button type="button" class="ph-widget" data-go="app" data-arg="missions"><small>NOW</small>${esc(this.hooks.goal())}</button>` : ''}
        <div class="ph-grid">${APPS.map((a) => `<button type="button" class="ph-icon" data-go="app" data-arg="${a.id}"><i style="background:${a.bg}">${a.icon}${a.id === 'feed' && dot ? `<em>${dot}</em>` : ''}</i>${a.name}</button>`).join('')}</div>
        <div class="ph-kente"></div></div>`;
    } else if (app === 'missions') {
      const rows = this.hooks.missions();
      html = page(
        'Missions',
        `${this.hooks.goal() ? `<div class="ph-card now"><small>RIGHT NOW</small><b>${esc(this.hooks.goal())}</b><button type="button" data-go="map" class="ph-btn">Show on map</button></div>` : ''}
        <div class="ph-list">${rows
          .map((m) => `<div class="ph-row ${m.state}"><span class="ph-badge">${m.state === 'done' ? '✓' : m.state === 'now' ? '●' : m.state === 'next' ? '›' : '🔒'}</span><div><b>${esc(m.title)}</b><small>${esc(m.state === 'locked' ? 'Opens later in the story' : m.goal)}</small></div></div>`)
          .join('')}</div>`,
      );
    } else if (app === 'map') {
      this.close();
      this.hooks.openMap();
      return;
    } else if (app === 'ride') {
      const wp = this.hooks.waypoint();
      const list = this.hooks.destinations().slice(0, 14);
      html = page(
        'Ghanaverse Ride',
        `${wp ? `<div class="ph-card now"><small>GOING TO</small><b>${esc(wp.name)}</b><button type="button" class="ph-btn red" data-go="unride">Cancel</button></div>` : ''}
        <p class="ph-soft">Where to? We mark it on your map and minimap. Okada, taxi and trotro drivers are coming soon; fares are always set by Ghanaverse, never by the phone.</p>
        <div class="ph-list">${list
          .map((d) => {
            const km = d.dist / 1000;
            const fare = Math.max(5, Math.round(km * 6)); // a rough guide only
            return `<button type="button" class="ph-row tap" data-go="ride" data-arg="${esc(d.name)}"><span class="ph-badge">${d.kind === 'FILLING STATION' ? '⛽' : d.kind === 'LORRY STATION' ? '🚐' : '📍'}</span><div><b>${esc(d.name)}</b><small>${km < 1 ? `${Math.round(d.dist)} m` : `${km.toFixed(1)} km`} · okada about ₵${fare} · trotro ₵${Math.max(3, Math.round(fare / 3))}</small></div></button>`;
          })
          .join('')}</div>`,
      );
    } else if (app === 'feed') {
      const posts = this.hooks.feed();
      this.seenFeed = posts.length;
      html = page(
        'City Feed',
        `<p class="ph-soft">What is happening in Accra right now. Chat from your district comes when the city is online.</p>
        <div class="ph-feed">${posts
          .slice()
          .reverse()
          .map((p) => `<div class="ph-post ${p.gold ? 'gold' : ''}"><b>${esc(p.who)}</b><span>${esc(p.time)}</span><p>${esc(p.text)}</p></div>`)
          .join('')}</div>`,
      );
    } else if (app === 'calls') {
      html = page(
        'Calls',
        `<div class="ph-list">${this.contacts
          .map((c, i) => `<button type="button" class="ph-row tap" data-go="call" data-arg="${i}"><span class="ph-avatar" style="background:${c.color}">${c.name[0]}</span><div><b>${esc(c.name)}</b><small>${esc(c.role)}</small></div><span class="ph-dial">📞</span></button>`)
          .join('')}</div><p class="ph-soft">Friends you add in the city show here too. Nobody ever sees a real phone number.</p>`,
      );
    } else if (app === 'momo') {
      const h = this.hooks.history();
      html = page(
        'Mobile Money',
        `<div class="ph-card momo"><small>SIKA WALLET · ${esc(this.hooks.nickname())}</small><b>${cedis(this.hooks.money())}</b><span>Kept safe on the Ghanaverse server</span></div>
        <div class="ph-actions"><button type="button" class="ph-btn" disabled>Send</button><button type="button" class="ph-btn" disabled>Pay shop</button><button type="button" class="ph-btn" disabled>Cash out</button></div>
        <p class="ph-soft">Sending and paying open with Mission 2, “Get Connected” (new SIM and wallet). Game money only: Sika is never sold or cashed out for real money.</p>
        <h3>History</h3>
        <div class="ph-list">${
          h.length
            ? h
                .slice()
                .reverse()
                .map((t) => `<div class="ph-row"><span class="ph-badge ${t.amount < 0 ? 'out' : 'in'}">${t.amount < 0 ? '−' : '+'}</span><div><b>${esc(t.what)}</b><small>${esc(t.time)}</small></div><span class="ph-amt ${t.amount < 0 ? 'out' : 'in'}">${cedis(Math.abs(t.amount))}</span></div>`)
                .join('')
            : '<p class="ph-soft">Nothing yet.</p>'
        }</div>`,
      );
    } else if (app === 'friends') {
      html = page(
        'Friends',
        `<div class="ph-card"><small>YOU</small><b>${esc(this.hooks.nickname())}</b><span>Nickname only. No real names, numbers, photos or places.</span></div>
        <div class="ph-list">
          <div class="ph-row"><span class="ph-badge">👋</span><div><b>Add a friend</b><small>Greet a player in the street, then tap “Add”</small></div></div>
          <div class="ph-row"><span class="ph-badge">📍</span><div><b>Meet up</b><small>Share where you are with one friend for 10 minutes, then it switches off</small></div></div>
          <div class="ph-row"><span class="ph-badge">🎙️</span><div><b>Voice calls</b><small>Friends only, any time, anywhere in the city</small></div></div>
        </div><p class="ph-soft">Friends open when the city goes online.</p>`,
      );
    } else if (app === 'settings') {
      const tier = this.hooks.tier();
      html = page(
        'Settings',
        `<h3>Sound</h3><div class="ph-actions"><button type="button" class="ph-btn" data-go="sound">${this.hooks.muted() ? '🔇 Sound is off' : '🔊 Sound is on'}</button></div>
        <h3>Picture quality</h3><div class="ph-actions">${['light', 'standard', 'ultra']
          .map((t) => `<button type="button" class="ph-btn ${t === tier ? 'on' : ''}" data-go="tier" data-arg="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`)
          .join('')}</div>
        <p class="ph-soft">Light is smoothest on cheap phones. Changing quality restarts the street.</p>
        <h3>Theme</h3><div class="ph-themes">
          <div class="ph-theme on" style="background:linear-gradient(135deg,#121a14 40%,#e3a92b 40% 55%,#c8442e 55% 70%,#2f8f57 70%)"><b>Royal Kente</b></div>
          <div class="ph-theme lock" style="background:linear-gradient(135deg,#14162b 40%,#d9a441 40% 55%,#a8442e 55% 70%,#6e8f5a 70%)"><b>Ewe Indigo 🔒</b></div>
          <div class="ph-theme lock" style="background:linear-gradient(135deg,#2a1410 40%,#f0a432 40% 55%,#d8572f 55% 70%,#1e8c86 70%)"><b>Accra Dusk 🔒</b></div>
        </div><p class="ph-soft">More themes come with the Big Man Pack.</p>`,
      );
    }
    this.screen.innerHTML = html;
    this.screen.scrollTop = 0;
  }

  private rideTo(d: Destination) {
    this.hooks.setWaypoint(d);
    this.close();
  }

  // ---------- A story call with 2 or 3 answers ----------

  private async startCall(c: Contact) {
    const id = ++this.calling;
    this.app = 'call';
    const draw = (status: string, line: string, choices: { text: string; next: CallLine }[] = []) => {
      if (id !== this.calling || !this.isOpen) return;
      this.screen.innerHTML = `<div class="ph-call"><span class="ph-avatar big" style="background:${c.color}">${c.name[0]}</span><b>${esc(c.name)}</b><small>${esc(status)}</small>
        <p class="ph-line">${esc(line)}</p>
        <div class="ph-choices">${choices.map((ch, i) => `<button type="button" class="ph-btn" data-choice="${i}">${esc(ch.text)}</button>`).join('')}</div>
        <button type="button" class="ph-hang" data-go="hang" aria-label="Hang up">📞</button></div>`;
      this.screen.querySelectorAll<HTMLElement>('[data-choice]').forEach((b) =>
        b.addEventListener('click', () => {
          const next = choices[Number(b.dataset.choice)].next;
          void speak(next);
        }),
      );
    };
    const speak = async (line: CallLine) => {
      const said = this.hooks.toMe(line.say);
      draw('On the line', said);
      await this.hooks.say(said, c.who);
      if (id !== this.calling) return;
      if (line.choices?.length) draw('Your answer', said, line.choices);
      else {
        draw('Call ended', said);
        setTimeout(() => id === this.calling && this.app === 'call' && this.show('calls'), 2200);
      }
    };
    draw('Calling…', '');
    await new Promise((r) => setTimeout(r, 1400));
    if (id !== this.calling) return;
    await speak(c.call());
  }

  private hangUp() {
    this.calling++;
    this.hooks.stopTalking();
  }
}
