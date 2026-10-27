// The sound of Accra. Real recordings first (public/sounds/accra, the owner's own, recorded in Accra
// and used exactly as recorded): the street (traffic, horns, people talking) everywhere along the
// roads, and trotro mates calling for passengers whenever a trotro is near you, coming from where
// the trotro is. The moments someone calls out loud in a recording are marked (sounds.json), and the
// game makes someone there call or talk at that same moment. Under them, made in code:
//  - a low rumble of traffic, louder where the roads are jammed;
//  - the murmur of people talking, louder in a crowd;
//  - car and trotro horns from vehicles around you, from the right direction;
//  - your okada's engine, rising with speed;
//  - a highlife groove from kiosks playing music, louder as you walk up to them.
// Phones only allow sound after a tap, so it starts on the first touch or key press.

type Pos = { x: number; z: number };
export type SoundScene = {
  x: number;
  z: number;
  heading: number; // where the camera faces (radians clockwise from north)
  riding: boolean;
  speed: number;
  vehicles: Pos[];
  people: number; // how many people are close by
  music: Pos[];
  /** Trotros near you, lorry stations and bus stops (the mates' calls come from them). */
  trotros?: (Pos & { id: number })[];
  /** Somewhere quiet (inside the compound): the street is heard softly. */
  quiet?: boolean;
};

/** The owner's Accra recordings (public/sounds/accra): the street, and trotro mates calling. */
const RECORDINGS: { file: string; kind: 'street' | 'mates' }[] = [
  { file: '/sounds/accra/street-a.m4a', kind: 'street' },
  { file: '/sounds/accra/street-b.m4a', kind: 'street' },
  { file: '/sounds/accra/mates-a.m4a', kind: 'mates' },
  { file: '/sounds/accra/mates-b.m4a', kind: 'mates' },
];
type Track = { file: string; kind: 'street' | 'mates'; length: number; loudness: number; calls: [number, number][] };
type Playing = { track: Track; buffer: AudioBuffer | null; src: AudioBufferSourceNode | null; started: number; offset: number; gain: GainNode; pan: StereoPannerNode; fired: Set<number> };
/** Someone calls out in a recording now: from a trotro (mates), or among the people round you (street). */
export type HeardCall = { kind: 'street' | 'mates'; from: (Pos & { id?: number }) | null; seconds: number };

export class StreetSound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private rumble!: GainNode;
  private murmur!: GainNode;
  private engine!: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode };
  private music!: { gain: GainNode; pan: StereoPannerNode };
  private nextHorn = 0;
  private nextBeat = 0;
  private beat = 0;
  muted = false;
  /** Called when a voice in a recording calls out (so a person or a trotro's mate in the game does too). */
  onCall: ((c: HeardCall) => void) | null = null;
  private tracks: Track[] = [];
  private street: Playing[] = [];
  private streetOn = -1;
  private mates: Playing[] = [];
  private mate: { p: Playing; id: number; until: number } | null = null;
  private nextMate = 0;
  private mateTurn = 0;
  /** True once the street recordings are playing (the made-up horns and murmur then stay quiet). */
  get recorded() {
    return this.streetOn >= 0;
  }

  constructor() {
    // Phones only let a page make sound after a real tap (the finger lifting counts, not touching
    // down), so try on every kind of tap until the sound is running.
    const start = () => {
      try {
        if (!this.ctx) {
          this.ctx = new AudioContext();
          this.build();
        }
        if (this.ctx.state !== 'running') void this.ctx.resume();
      } catch {
        this.ctx = null; // no sound on this device
      }
      if (this.ctx?.state === 'running') for (const ev of EVENTS) window.removeEventListener(ev, start, true);
    };
    const EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    for (const ev of EVENTS) window.addEventListener(ev, start, true);
  }

  /** The sound system, once it has started (for one-off sounds such as horns). */
  get context(): AudioContext | null {
    return this.ctx;
  }
  /** Where one-off sounds go (respects the mute button). */
  get output(): AudioNode | null {
    return this.ctx ? this.master : null;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  private noise(seconds: number, colour: 'brown' | 'pink') {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (colour === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        b0 = 0.99765 * b0 + w * 0.099;
        b1 = 0.963 * b1 + w * 0.2965;
        b2 = 0.57 * b2 + w * 1.0526;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    // Traffic rumble.
    const rumble = this.noise(4, 'brown');
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    this.rumble = ctx.createGain();
    this.rumble.gain.value = 0;
    rumble.connect(lp).connect(this.rumble).connect(this.master);
    rumble.start();

    // Crowd murmur: voice-band noise that swells and fades like conversation.
    const voices = this.noise(5, 'pink');
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 650;
    bp.Q.value = 0.9;
    const swell = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.7;
    lfoDepth.gain.value = 0.35;
    lfo.connect(lfoDepth).connect(swell.gain);
    swell.gain.value = 0.65;
    this.murmur = ctx.createGain();
    this.murmur.gain.value = 0;
    voices.connect(bp).connect(swell).connect(this.murmur).connect(this.master);
    voices.start();
    lfo.start();

    // The okada's engine.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start();
    this.engine = { osc, gain, filter };

    // Music from kiosks.
    const mGain = ctx.createGain();
    mGain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    mGain.connect(pan).connect(this.master);
    this.music = { gain: mGain, pan };
    this.loadRecordings();
  }

  // The recordings: each file is downloaded once and unpacked in memory at 24,000 samples a second
  // (about 16 MB for all four, fine on cheap phones), then played from there. That works on every
  // phone (some will not stream sound from a server that sends whole files) and starts any moment
  // exactly. When each call is and how loud each file is come from sounds.json.
  private loadRecordings() {
    const ctx = this.ctx!;
    this.tracks = RECORDINGS.map((r) => ({ ...r, length: 0, loudness: -18, calls: [] }));
    const make = (track: Track): Playing => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      gain.connect(pan).connect(this.master);
      return { track, buffer: null, src: null, started: 0, offset: 0, gain, pan, fired: new Set() };
    };
    for (const t of this.tracks) (t.kind === 'street' ? this.street : this.mates).push(make(t));
    void fetch('/sounds/accra/sounds.json')
      .then((r) => r.json())
      .then((list: { tracks: Track[] }) => {
        for (const t of list.tracks) {
          const mine = this.tracks.find((m) => m.file === t.file);
          if (mine) Object.assign(mine, { length: t.length, loudness: t.loudness, calls: t.calls });
        }
      })
      .catch(() => {});
    // The original files (AAC) where the phone can unpack them (nearly all can), else the same sound as Opus.
    const probe = document.createElement('audio');
    const aac = probe.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '';
    const unpack = async (p: Playing) => {
      const bytes = await (await fetch(aac ? p.track.file : p.track.file.replace(/\.m4a$/, '.webm'))).arrayBuffer();
      const off = new OfflineAudioContext(1, 1, 24000);
      p.buffer = await off.decodeAudioData(bytes);
    };
    // The street first (it plays straight away), then the mates.
    void (async () => {
      for (const p of [...this.street, ...this.mates]) {
        try {
          await unpack(p);
        } catch {
          continue; // that one cannot play here
        }
        if (p === this.street[0]) this.playStreet(0);
      }
    })();
  }
  private play(p: Playing, from: number, onEnd?: () => void) {
    if (!this.ctx || !p.buffer) return false;
    p.src?.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = p.buffer;
    src.connect(p.gain);
    src.start(0, from);
    if (onEnd) src.onended = () => p.src === src && onEnd();
    [p.src, p.started, p.offset] = [src, this.ctx.currentTime, from];
    return true;
  }
  private stopPlaying(p: Playing) {
    const src = p.src;
    p.src = null;
    src?.stop();
  }
  /** Where a recording is now, in seconds. */
  private at(p: Playing) {
    return p.src && this.ctx ? this.ctx.currentTime - p.started + p.offset : -1;
  }
  private playStreet(want: number): void {
    // This one, or the next that is ready.
    let i = want;
    for (let k = 0; k < this.street.length && !this.street[i]?.buffer; k++) i = (i + 1) % this.street.length;
    const p = this.street[i];
    if (!p?.buffer) return;
    this.streetOn = i;
    p.fired.clear();
    this.play(p, 0, () => this.playStreet((i + 1) % this.street.length));
  }
  /** Each recording at about the same loudness (they were recorded at different distances). */
  private level(t: Track, want: number) {
    return want * 10 ** ((-18 - t.loudness) / 20);
  }
  // A voice calling out in a recording right now: tell the game (once per call).
  private calls(p: Playing, from: HeardCall['from']) {
    const now = this.at(p);
    p.track.calls.forEach(([a, b], i) => {
      if (now >= a && now < b && !p.fired.has(i)) {
        p.fired.add(i);
        this.onCall?.({ kind: p.track.kind, from, seconds: b - a });
      }
    });
  }

  /** Call every frame with what is around the player. */
  update(s: SoundScene) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    // How busy the roads are close by.
    let near = 0;
    for (const v of s.vehicles) if (Math.hypot(v.x - s.x, v.z - s.z) < 60) near++;
    const rec = this.recorded;
    // With the street recordings playing, the made-up rumble and murmur only fill in softly.
    this.rumble.gain.setTargetAtTime(Math.min(rec ? 0.08 : 0.32, 0.05 + near * 0.006) * (rec ? 0.6 : 1), now, 0.5);
    this.murmur.gain.setTargetAtTime(rec ? 0 : Math.min(0.28, s.people * 0.012), now, 0.6);
    // The street recording: louder where the road is busy and people are many, soft when quiet.
    const sp = this.street[this.streetOn];
    if (sp) {
      const busy = Math.min(1, near / 14 + s.people / 40);
      sp.gain.gain.setTargetAtTime(this.level(sp.track, (s.quiet ? 0.22 : 0.42 + 0.4 * busy)), now, 0.8);
      this.calls(sp, null);
    }
    // A trotro near you: its mate calls for passengers (the mates' recording, from where it is).
    this.updateMate(s, now);

    // Engine.
    const e = this.engine;
    e.gain.gain.setTargetAtTime(s.riding ? 0.05 + Math.min(0.06, s.speed * 0.004) : 0, now, 0.15);
    e.osc.frequency.setTargetAtTime(38 + s.speed * 7, now, 0.1);
    e.filter.frequency.setTargetAtTime(400 + s.speed * 60, now, 0.1);

    // Horns: someone in the jam hoots every few seconds (the recordings have their own).
    if (now > this.nextHorn && s.vehicles.length && !rec) {
      this.nextHorn = now + 1.2 + Math.random() * (near > 20 ? 2.5 : 6);
      const v = s.vehicles[Math.floor(Math.random() * s.vehicles.length)];
      const d = Math.hypot(v.x - s.x, v.z - s.z);
      if (d < 90) this.horn(v, s, d);
    }

    // Music: nearest music spot.
    let best: Pos | null = null;
    let bestD = 60;
    for (const m of s.music) {
      const d = Math.hypot(m.x - s.x, m.z - s.z);
      if (d < bestD) [best, bestD] = [m, d];
    }
    this.music.gain.gain.setTargetAtTime(best ? 0.22 / (1 + bestD / 6) : 0, now, 0.4);
    if (best) this.music.pan.pan.setTargetAtTime(this.panFor(best, s), now, 0.2);
    if (best || this.music.gain.gain.value > 0.002) this.scheduleMusic();
  }

  private updateMate(s: SoundScene, now: number) {
    const m = this.mate;
    if (m) {
      const v = s.trotros?.find((t) => t.id === m.id);
      const d = v ? Math.hypot(v.x - s.x, v.z - s.z) : 99;
      // It follows its trotro; it fades away when the trotro has gone, or after a while.
      const off = !v || d > 60 || now > m.until || s.quiet;
      m.p.gain.gain.setTargetAtTime(off ? 0 : this.level(m.p.track, 0.95 / (1 + d / 9)), now, off ? 0.6 : 0.2);
      if (v) m.p.pan.pan.setTargetAtTime(this.panFor(v, s), now, 0.2);
      if (!off && v) this.calls(m.p, v);
      if (off && m.p.gain.gain.value < 0.01) {
        this.stopPlaying(m.p);
        this.mate = null;
        this.nextMate = now + 6 + Math.random() * 10;
      }
      return;
    }
    if (now < this.nextMate || !this.mates.length || s.quiet) return;
    let best: (Pos & { id: number }) | null = null;
    let bestD = 60;
    for (const t of s.trotros ?? []) {
      const d = Math.hypot(t.x - s.x, t.z - s.z);
      if (d < bestD) [best, bestD] = [t, d];
    }
    if (!best) return;
    // Start a couple of seconds before one of the loud calls, so you hear one soon.
    const p = this.mates[this.mateTurn++ % this.mates.length];
    const call = p.track.calls[Math.floor(Math.random() * p.track.calls.length)];
    p.fired.clear();
    const from = Math.max(0, (call?.[0] ?? 0) - 2 - Math.random() * 2);
    p.gain.gain.value = 0;
    if (!this.play(p, from, () => (this.mate?.p === p ? (this.mate.until = 0) : undefined))) return;
    this.mate = { p, id: best.id, until: now + 9 + Math.random() * 5 };
  }

  // Left or right, from where the sound is compared with where the camera faces.
  private panFor(p: Pos, s: SoundScene) {
    const angle = Math.atan2(p.x - s.x, -(p.z - s.z)) - s.heading;
    return Math.max(-0.9, Math.min(0.9, Math.sin(angle)));
  }

  private horn(p: Pos, s: SoundScene, d: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.panFor(p, s);
    const out = ctx.createGain();
    out.gain.value = 0.16 / (1 + d / 10);
    out.connect(pan).connect(this.master);
    const big = Math.random() < 0.3; // trotros and trucks: deeper
    const beeps = Math.random() < 0.5 ? [0] : [0, 0.22];
    for (const at of beeps) {
      for (const f of big ? [233, 294] : [392, 494]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + at);
        g.gain.exponentialRampToValueAtTime(0.5, t + at + 0.01);
        g.gain.setValueAtTime(0.5, t + at + 0.14);
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.2);
        o.connect(g).connect(out);
        o.start(t + at);
        o.stop(t + at + 0.21);
      }
    }
  }

  // A simple highlife groove: guitar picking over I-IV-V-I, bass, bell and shaker. Notes are
  // scheduled a little ahead so they stay in time.
  private scheduleMusic() {
    const ctx = this.ctx!;
    const step = 60 / 118 / 2; // eighth notes at 118 beats a minute
    if (this.nextBeat < ctx.currentTime) this.nextBeat = ctx.currentTime + 0.05;
    const chords = [[261.6, 329.6, 392.0], [349.2, 440.0, 523.3], [392.0, 493.9, 587.3], [261.6, 329.6, 392.0]];
    const pick = [0, 2, 1, 2, 0, 2, 1, 2];
    const bell = [1, 0, 1, 0, 1, 1, 0, 1];
    while (this.nextBeat < ctx.currentTime + 0.25) {
      const t = this.nextBeat;
      const bar = Math.floor(this.beat / 8) % 4;
      const i = this.beat % 8;
      const chord = chords[bar];
      this.pluck(chord[pick[i]] * (i % 4 === 3 ? 2 : 1), t, 0.25, 'triangle', 0.18);
      if (i === 0 || i === 3 || i === 6) this.pluck(chord[0] / 4, t, 0.35, 'sine', 0.35);
      if (bell[i]) this.pluck(1568, t, 0.05, 'square', 0.03);
      this.tick(t);
      this.nextBeat += step;
      this.beat++;
    }
  }

  private pluck(freq: number, t: number, length: number, type: OscillatorType, level: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(g).connect(this.music.gain);
    o.start(t);
    o.stop(t + length + 0.02);
  }

  private shaker: AudioBuffer | null = null;
  private tick(t: number) {
    const ctx = this.ctx!;
    if (!this.shaker) {
      this.shaker = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const d = this.shaker.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.shaker;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    src.connect(hp).connect(g).connect(this.music.gain);
    src.start(t);
  }
}
