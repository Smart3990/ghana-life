// The game's own film tools, made from the page itself (no video files, design brief 4.4):
// thin black bars top and bottom, full-black title cards that fade, subtitles with the speaker's
// name, a caller card for phone calls, and a Skip button. Everything waits with "await", so a scene
// reads like a script.

export class Cinema {
  private root: HTMLElement;
  private card: HTMLElement;
  private sub: HTMLElement;
  private caller: HTMLElement;
  private skipButton: HTMLElement;
  private skipping = false;
  private pic: HTMLElement;

  constructor() {
    this.root = el('div', 'cine-bars');
    this.root.innerHTML = '<i></i><i></i>';
    this.card = el('div', 'cine-card');
    this.sub = el('div', 'cine-sub');
    this.caller = el('div', 'cine-caller');
    this.skipButton = el('button', 'cine-skip');
    this.skipButton.textContent = 'SKIP ›';
    this.skipButton.addEventListener('click', () => (this.skipping = true));
    this.pic = el('div', 'cine-pic');
    document.body.append(this.root, this.pic, this.card, this.sub, this.caller, this.skipButton);
  }

  private videoEl: HTMLVideoElement | null = null;

  /**
   * Get a film clip ready: starts downloading it, and (called from a tap) unlocks it so it can
   * play with sound later, which phones only allow after a tap.
   */
  prepareVideo(url: string, poster: string) {
    const v = document.createElement('video');
    // The phone picks the format it plays best: MP4 (H.264) or WebM (VP9), the same clip.
    const webm = url.replace(/\.mp4$/, '.webm');
    v.src = v.canPlayType('video/mp4; codecs="avc1.4D401E"') ? url : v.canPlayType('video/webm; codecs="vp9"') ? webm : url;
    v.poster = poster;
    v.preload = 'auto';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.className = 'cine-video';
    this.videoEl = v;
    // Unlock: start and pause straight away inside the tap.
    v.muted = true;
    v.play().then(() => v.pause(), () => undefined).finally(() => {
      v.currentTime = 0;
      v.muted = false;
    });
  }

  /** Is the clip downloaded enough to play smoothly? */
  videoReady() {
    return !!this.videoEl && this.videoEl.readyState >= 3 && !this.videoEl.error;
  }

  /** Play the prepared clip full screen, with subtitles at set times (seconds). */
  async video(cues: [at: number, who: string, line: string][]) {
    const v = this.videoEl;
    if (this.skipping || !v) return false;
    this.pic.innerHTML = '';
    this.pic.append(v);
    this.pic.classList.add('on');
    this.card.style.transitionDuration = '0.6s';
    this.card.classList.remove('on', 'black');
    try {
      await v.play();
    } catch {
      // Not allowed with sound here: play it silently.
      v.muted = true;
      try {
        await v.play();
      } catch {
        this.pic.classList.remove('on');
        return false;
      }
    }
    const shown = new Set<number>();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (this.skipping || v.ended || v.error) return resolve();
        cues.forEach(([at, who, line], i) => {
          if (!shown.has(i) && v.currentTime >= at) {
            shown.add(i);
            void this.say(who, line, 2.4);
          }
        });
        requestAnimationFrame(tick);
      };
      tick();
    });
    v.pause();
    this.pic.classList.remove('on');
    await this.wait(0.8);
    return true;
  }

  /** Start downloading the film's pictures early, so they are ready when the film starts. */
  preload(urls: string[]) {
    for (const u of urls) new Image().src = u;
  }

  /**
   * A full-screen picture with a slow camera move (push in, pull out or pan), and subtitle lines
   * spoken over it. move: 'in' | 'out' | 'left' | 'right'.
   */
  async picture(url: string, move: 'in' | 'out' | 'left' | 'right', lines: [string, string][], hold = 0) {
    if (this.skipping) return;
    const img = el('div', 'cine-img ' + move);
    img.style.backgroundImage = `url(${url})`;
    this.pic.innerHTML = '';
    this.pic.append(img);
    this.pic.classList.add('on');
    // The picture has its own black behind it: take the title card away.
    this.card.style.transitionDuration = '0.9s';
    this.card.classList.remove('on', 'black');
    requestAnimationFrame(() => img.classList.add('go'));
    await this.wait(0.9);
    for (const [who, line] of lines) await this.say(who, line);
    await this.wait(hold);
    this.pic.classList.remove('on');
    await this.wait(0.9);
  }

  /** True after Skip was pressed in the current scene. */
  get skipped() {
    return this.skipping;
  }

  /** Start a scene: bars in, game buttons hidden. */
  begin() {
    this.skipping = false;
    document.body.classList.add('cine');
  }
  /** End a scene: bars out, buttons back. */
  end() {
    document.body.classList.remove('cine');
    this.sub.classList.remove('on');
    this.card.classList.remove('on', 'black');
    this.caller.classList.remove('on');
    this.pic.classList.remove('on');
  }

  /** Wait (cut short by Skip). */
  wait(seconds: number) {
    return new Promise<void>((resolve) => {
      const until = performance.now() + seconds * 1000;
      const tick = () => (this.skipping || performance.now() >= until ? resolve() : requestAnimationFrame(tick));
      tick();
    });
  }

  /** Fade to black (or back from black). */
  async black(on: boolean, seconds = 0.8) {
    this.card.innerHTML = '';
    this.card.style.transitionDuration = `${seconds}s`;
    this.card.classList.toggle('black', on);
    this.card.classList.toggle('on', on);
    await this.wait(seconds);
  }

  /** A title card on black: big line, small line under it. */
  async title(big: string, small = '', seconds = 3.2) {
    if (this.skipping) return;
    this.card.style.transitionDuration = '0.7s';
    this.card.classList.add('on', 'black');
    this.card.innerHTML = '';
    const text = el('div', 'cine-text');
    const b = el('div', 'big');
    b.textContent = big;
    text.append(b);
    if (small) {
      const s = el('div', 'small');
      s.textContent = small;
      text.append(s);
    }
    this.card.append(text);
    requestAnimationFrame(() => text.classList.add('in'));
    await this.wait(seconds);
    text.classList.remove('in');
    await this.wait(0.6);
  }

  /** Called with each spoken line (to say it out loud). */
  onLine: ((who: string, line: string) => void) | null = null;

  /** A subtitle line, with who is speaking. */
  /** When someone last spoke a line (seconds, performance clock): the street goes quiet round talks. */
  lastTalk = -99;
  async say(who: string, line: string, seconds = 0) {
    if (this.skipping) return;
    this.onLine?.(who, line);
    if (who) this.lastTalk = performance.now() / 1000 + (seconds || Math.max(2, 0.8 + line.length / 14));
    this.sub.innerHTML = '';
    if (who) {
      const name = el('b');
      name.textContent = who;
      this.sub.append(name);
    }
    this.sub.append(line);
    this.sub.classList.add('on');
    // Long enough to read: about 14 letters a second, never under 2 seconds.
    await this.wait(seconds || Math.max(2, 0.8 + line.length / 14));
    this.sub.classList.remove('on');
    await this.wait(0.25);
  }

  /** The caller card at the top: "Uncle Kwame, calling…" */
  call(name: string | null) {
    this.caller.classList.toggle('on', !!name);
    if (name) this.caller.innerHTML = `<span>${name[0]}</span><div><b>${name}</b><small>calling…</small></div>`;
  }
}

function el(tag: string, cls = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

// ---------- The start screen (design brief 5.2, short version) ----------

export type StartChoice = { body: 'male' | 'female'; hometown: string };
const HOMETOWNS = ['Ada', 'Ho', 'Kumasi', 'Tamale', 'Cape Coast', 'Koforidua'];

/** Two taps and Start: who you are and where you come from. The title updates as you choose. */
export function startScreen(preset: Partial<StartChoice> = {}, onStart?: () => void): Promise<StartChoice> {
  let saved: Partial<StartChoice> = {};
  try {
    saved = JSON.parse(localStorage.getItem('gv.start') ?? '{}');
  } catch {
    // No storage here (private window): start fresh.
  }
  const choice: StartChoice = { body: preset.body ?? saved.body ?? 'male', hometown: saved.hometown ?? 'Ada' };
  let surprise = false;
  const screen = el('div', 'start');
  screen.innerHTML = `
    <div class="start-in">
      <div class="brand">GHANAVERSE</div>
      <div class="bar kente"></div>
      <h1 class="start-title"></h1>
      <div class="start-q">You are</div>
      <div class="start-row" data-q="body"><button data-v="female">A woman</button><button data-v="male">A man</button></div>
      <div class="start-q">Your hometown</div>
      <div class="start-row" data-q="hometown">${HOMETOWNS.map((h) => `<button data-v="${h}">${h}</button>`).join('')}<button data-v="?">Surprise me</button></div>
      <button class="play start-go">START</button>
    </div>`;
  document.body.append(screen);
  const title = screen.querySelector('.start-title')!;
  const draw = () => {
    title.textContent = `From ${choice.hometown} to Accra`;
    for (const b of screen.querySelectorAll<HTMLButtonElement>('.start-row button')) {
      const q = (b.parentElement as HTMLElement).dataset.q as keyof StartChoice;
      const v = b.dataset.v!;
      b.classList.toggle('on', q === 'hometown' && v === '?' ? surprise : choice[q] === v && !(q === 'hometown' && surprise));
    }
  };
  screen.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('.start-row button') as HTMLButtonElement | null;
    if (!b) return;
    const q = (b.parentElement as HTMLElement).dataset.q;
    if (q === 'body') choice.body = b.dataset.v as StartChoice['body'];
    if (q === 'hometown') {
      surprise = b.dataset.v === '?';
      choice.hometown = surprise ? HOMETOWNS[Math.floor(Math.random() * HOMETOWNS.length)] : b.dataset.v!;
    }
    draw();
  });
  draw();
  return new Promise((resolve) => {
    screen.querySelector('.start-go')!.addEventListener('click', () => {
      onStart?.(); // inside the tap: lets the film clip play with sound
      try {
        localStorage.setItem('gv.start', JSON.stringify(choice));
      } catch {
        // Not saved: they choose again next time.
      }
      screen.remove();
      resolve(choice);
    });
  });
}
