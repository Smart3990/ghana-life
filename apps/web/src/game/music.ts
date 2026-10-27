// Film music: one track that fades in and out at set moments of the story. The file is our own
// highlife tune (scripts/music/highlife.mjs); a licensed song can replace public/music/arrival.mp3.
// The fades go through Web Audio, as phones (iPhones) ignore a plain audio element's volume. The
// track streams from the file (it is not decoded into memory).
export class FilmMusic {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private stopTimer = 0;
  private level = 0;
  muted = false;
  constructor(
    private src: string,
    private loudest = 0.5,
  ) {}

  /** Start downloading early (call when the film starts). */
  preload() {
    if (this.audio) return;
    this.audio = new Audio(this.src);
    this.audio.preload = 'auto';
    this.audio.loop = true;
  }
  private wire() {
    if (this.ctx || !this.audio) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.ctx.createMediaElementSource(this.audio).connect(this.gain).connect(this.ctx.destination);
    } catch {
      this.ctx = null; // no Web Audio: plain volume (works everywhere except iPhones)
    }
  }
  /** Fade in over `seconds` (from the start of the track). */
  play(seconds = 2) {
    this.preload();
    this.wire();
    const a = this.audio!;
    clearTimeout(this.stopTimer);
    if (a.paused) {
      a.currentTime = 0;
      void this.ctx?.resume();
      void a.play().catch(() => {});
    }
    this.fade(this.loudest, seconds);
  }
  /** Fade out over `seconds`, then stop. */
  stop(seconds = 3) {
    if (!this.audio || this.audio.paused) return;
    this.fade(0, seconds);
    clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => this.audio?.pause(), seconds * 1000 + 100);
  }
  /** A little quieter while people speak. */
  duck(on: boolean) {
    if (this.level > 0) this.fade(on ? this.loudest * 0.55 : this.loudest, 0.4);
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.audio) this.audio.muted = m;
  }
  private fade(to: number, seconds: number) {
    this.level = to;
    if (this.ctx && this.gain) {
      const g = this.gain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(to, now + Math.max(0.05, seconds));
    } else if (this.audio) {
      const a = this.audio;
      const from = a.volume;
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 1000 / Math.max(0.05, seconds));
        a.volume = from + (to - from) * k;
        if (k < 1) requestAnimationFrame(step);
      };
      step();
    }
  }
}
