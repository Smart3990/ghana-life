// Real speaking voices, made by the phone itself (its built-in text-to-speech, so nothing to
// download and no data used). Bus mates shout their routes ("Circle! Circle! Accra! Accra!"),
// hawkers call out, people answer you and ask you questions.
//
// The phone picks the closest accent it has: Ghanaian English first, then Nigerian, other African
// English, then British. Every person gets their own pitch and speed, so voices differ. Ghanaian
// words are spelt the way they sound for the speech engine ("Chale" is said "Cha-lay").
// Later, real recorded Ghanaian voices (design brief 15.3) can replace any line: if a file
// /voices/<line id>.mp3 is listed in /voices/index.json, it is played instead of the speech engine.
// The line id is the line's words in small letters joined with dashes (see docs/VOICE_SCRIPT.md).

export type Speaker = { body: 'male' | 'female' | 'child'; seed: number };

// How the speech engine should say Ghanaian words (written form -> sounds).
const SAY: [RegExp, string][] = [
  [/\bChale\b/gi, 'Chah-lay'],
  [/\bCharley\b/gi, 'Chah-lay'],
  [/\bAkwaaba\b/gi, 'Ah-kwah-bah'],
  [/\bMedaase\b/gi, 'Meh-dah-see'],
  [/\bEte sen\b/gi, 'Eh-teh sen'],
  [/\bWo ho te sen\b/gi, 'Woh hoh teh sen'],
  [/\bkraa\b/gi, 'krah'],
  [/\bdey\b/gi, 'day'],
  [/\booo\b/gi, 'oh'],
  [/\bAyekoo\b/gi, 'Ah-yeh-koo'],
  [/\bKaneshie\b/gi, 'Kah-neh-shee'],
  [/\bKokomlemle\b/gi, 'Koh-koh-mleh-mleh'],
  [/\bAdabraka\b/gi, 'Ah-dah-brah-kah'],
  [/\bOdorkor\b/gi, 'Oh-dor-kor'],
  [/\bAchimota\b/gi, 'Ah-chee-moh-tah'],
  [/\bMadina\b/gi, 'Mah-dee-nah'],
  [/\bKasoa\b/gi, 'Kah-soh-ah'],
  [/\bLapaz\b/gi, 'Lah-pahz'],
  [/\bkelewele\b/gi, 'keh-leh-weh-leh'],
  [/\bkenkey\b/gi, 'ken-kay'],
  [/\bwaakye\b/gi, 'wah-chay'],
  [/\btrotro\b/gi, 'troh-troh'],
  [/\bokada\b/gi, 'oh-kah-dah'],
  [/\bAuntie Dede\b/gi, 'Auntie Deh-deh'],
  [/₵\s?(\d+)/g, '$1 cedis'],
];
const spoken = (text: string) => SAY.reduce((t, [re, s]) => t.replace(re, s), text).replace(/[“”"]/g, '');

/**
 * The file name of a line's recording: "Chale, comot for road!" -> "chale-comot-for-road".
 * Must match voiceId() in scripts/voice-script.mjs (which writes the voice script).
 */
export const voiceId = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/₵\s?(\d+)/g, '$1-cedis')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

const hash = (n: number) => {
  let x = Math.imul(Math.floor(n * 100) ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

type Job = { text: string; who: Speaker; volume: number; priority: number; id?: string; done?: () => void };

export class Voices {
  muted = false;
  private synth: SpeechSynthesis | null = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  private male: SpeechSynthesisVoice[] = [];
  private female: SpeechSynthesisVoice[] = [];
  private any: SpeechSynthesisVoice[] = [];
  private speaking: Job | null = null;
  private recorded = new Set<string>();
  private player = new Audio();

  constructor() {
    const load = () => this.pickVoices();
    load();
    this.synth?.addEventListener?.('voiceschanged', load);
    fetch('/voices/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: string[]) => ids.forEach((id) => this.recorded.add(id)))
      .catch(() => undefined);
  }

  private pickVoices() {
    const all = this.synth?.getVoices() ?? [];
    const rank = (v: SpeechSynthesisVoice) => {
      const l = v.lang.toLowerCase();
      if (l.startsWith('en-gh')) return 0;
      if (l.startsWith('en-ng')) return 1;
      if (l.startsWith('en-ke') || l.startsWith('en-za') || l.startsWith('en-tz')) return 2;
      if (l.startsWith('en-gb')) return 3;
      if (l.startsWith('en')) return 4;
      return 9;
    };
    const english = all.filter((v) => rank(v) < 9).sort((a, b) => rank(a) - rank(b));
    const best = english.length ? rank(english[0]) : 9;
    // Voices of the best accent available (and the next one, for variety).
    const pool = english.filter((v) => rank(v) <= best + 1);
    const isFemale = (v: SpeechSynthesisVoice) => /female|woman|zira|susan|hazel|serena|karen|tessa|moira|samantha|fiona|victoria|libby|sonia|abeo|ezinne|akua|ama|esi/i.test(v.name);
    this.female = pool.filter(isFemale);
    this.male = pool.filter((v) => !isFemale(v));
    this.any = pool;
  }

  /** Is there a speech engine at all on this phone? */
  get available() {
    return !!this.synth;
  }

  /** Is someone talking right now (a conversation line)? */
  get busy() {
    return !!this.speaking && this.speaking.priority >= 2;
  }

  /**
   * Say something. priority: 0 background (only if nothing else is playing), 1 someone calling out
   * near you, 2 a conversation (interrupts the others). volume 0..1 (quieter further away).
   */
  say(text: string, who: Speaker, volume = 1, priority = 1, id?: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.muted || !this.synth || volume < 0.05) return resolve();
      if (this.speaking && this.speaking.priority >= priority) return resolve(); // don't talk over them
      if (this.speaking) this.stop();
      // A real recording of this line, if the owner has added one (docs/VOICE_SCRIPT.md).
      const file = id ?? voiceId(text);
      const job: Job = { text, who, volume, priority, id: file, done: resolve };
      this.speaking = job;
      if (this.recorded.has(file)) return this.playRecorded(job);
      const u = new SpeechSynthesisUtterance(spoken(text));
      const list = who.body === 'female' || who.body === 'child' ? (this.female.length ? this.female : this.any) : this.male.length ? this.male : this.any;
      const voice = list.length ? list[Math.floor(hash(who.seed) * list.length)] : null;
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else u.lang = 'en-GB';
      // Each person sounds a little different: pitch and speed from their number.
      const r = hash(who.seed + 7);
      u.pitch = who.body === 'child' ? 1.5 + r * 0.3 : who.body === 'female' ? 1.05 + r * 0.35 : 0.75 + r * 0.35;
      u.rate = (priority === 1 ? 1.12 : 1.0) + (hash(who.seed + 3) - 0.5) * 0.2;
      u.volume = Math.max(0, Math.min(1, volume));
      const end = () => {
        if (this.speaking === job) this.speaking = null;
        resolve();
      };
      u.onend = end;
      u.onerror = end;
      // Some phones never fire "end": give up after a sensible time.
      setTimeout(end, 1500 + text.length * 120);
      this.synth.speak(u);
    });
  }

  private playRecorded(job: Job) {
    const end = () => {
      if (this.speaking === job) this.speaking = null;
      job.done?.();
    };
    this.player.src = `/voices/${job.id}.mp3`;
    this.player.volume = job.volume;
    this.player.onended = end;
    this.player.onerror = end;
    this.player.play().catch(end);
  }

  stop() {
    this.synth?.cancel();
    this.player.pause();
    const job = this.speaking;
    this.speaking = null;
    job?.done?.();
  }
}

// ---------- What people shout in the street ----------

export const ROUTES = ['Circle', 'Accra', 'Kaneshie', 'Madina', 'Lapaz', 'Achimota', 'Kasoa', 'Tema', 'Odorkor', 'Adabraka', 'Osu', 'Spintex', 'Dansoman', 'Nkrumah Circle'];
/** A bus mate's call for a trotro going somewhere: "Kaneshie! Kaneshie! Kaneshie!" */
export function mateCall(seed: number) {
  const a = ROUTES[Math.floor(hash(seed) * ROUTES.length)];
  const b = ROUTES[Math.floor(hash(seed + 1) * ROUTES.length)];
  const forms = [`${a}! ${a}! ${a}!`, `${a}, ${a}! One more, come!`, `${a} ${a}! ${b}! Last seat!`, `Circle! Circle! Circle!`, `Accra! Accra! Accra!`, `${a}! Straight! Come, come!`];
  return forms[Math.floor(hash(seed + 2) * forms.length)];
}
