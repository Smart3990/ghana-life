// The sound of Accra, made in code (no sound files to download):
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
};

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

  constructor() {
    const start = () => {
      if (this.ctx) return;
      try {
        this.ctx = new AudioContext();
        this.build();
      } catch {
        this.ctx = null; // no sound on this device
      }
    };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
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
  }

  /** Call every frame with what is around the player. */
  update(s: SoundScene) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    // How busy the roads are close by.
    let near = 0;
    for (const v of s.vehicles) if (Math.hypot(v.x - s.x, v.z - s.z) < 60) near++;
    this.rumble.gain.setTargetAtTime(Math.min(0.32, 0.05 + near * 0.006), now, 0.5);
    this.murmur.gain.setTargetAtTime(Math.min(0.28, s.people * 0.012), now, 0.6);

    // Engine.
    const e = this.engine;
    e.gain.gain.setTargetAtTime(s.riding ? 0.05 + Math.min(0.06, s.speed * 0.004) : 0, now, 0.15);
    e.osc.frequency.setTargetAtTime(38 + s.speed * 7, now, 0.1);
    e.filter.frequency.setTargetAtTime(400 + s.speed * 60, now, 0.1);

    // Horns: someone in the jam hoots every few seconds.
    if (now > this.nextHorn && s.vehicles.length) {
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
