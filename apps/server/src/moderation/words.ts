// Chat checks: blocked words, plus patterns for things players must never share.
//
// IMPORTANT: these starter lists are English only. The master plan requires the Pidgin, Twi,
// Ga and Ewe lists to be written by Ghanaian speakers, including common spelling tricks.
// Add those words below (lower case, letters only). Do not guess them.

// Whole words only, so "grapes" or "peacock" are never caught by accident.
const BLOCKED_WORDS = new Set([
  'dick', 'cock', 'pussy', 'whore', 'slut', 'wanker', 'twat', 'prick', 'bastard',
  'asshole', 'arsehole', 'retard', 'rape', 'rapist', 'kys',
  'shit', 'shits', 'shite', 'shitty', 'shitting', 'bullshit', // listed, not a word start: "Shitta" is a place name
  // Pidgin, Twi, Ga, Ewe: to be added by Ghanaian speakers.
]);

// Word starts that are always abusive, catching their variants (fucking, shitty, bitches...).
const BLOCKED_STARTS = ['fuck', 'motherf', 'bitch', 'cunt', 'nigg', 'fagg'];

// Phrases checked with all spaces removed, so "kill your self" is caught too.
const BLOCKED_PHRASES = ['killyourself', 'killurself', 'goanddie'];

// Disguised letters players use to get around filters: sh1t, $hit, a$$ and so on.
const LOOKALIKES: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '8': 'b' };

const unmask = (text: string) => text.toLowerCase().replace(/[01!34@5$78]/g, (c) => LOOKALIKES[c] ?? c);
const squeeze = (word: string) => word.replace(/(.)\1+/g, '$1'); // "shiiit" -> "shit"

// Phone numbers (8 or more digits, allowing spaces and dashes) and mobile money talk.
const PHONE = /(?:\+?\d[\s-]?){8,}/;
const MONEY = /\b(momo|mobile\s*money|send\s+(me\s+)?(money|cash)|account\s*number|pin\s*code|my\s+pin)\b/i;

export type ChatCheck = { ok: true } | { ok: false; reason: 'word' | 'phone' | 'money' };

export function checkChat(text: string): ChatCheck {
  if (PHONE.test(text)) return { ok: false, reason: 'phone' };
  if (MONEY.test(text)) return { ok: false, reason: 'money' };
  const parts = unmask(text).split(/[^a-z]+/).filter(Boolean);
  // Join spaced-out letters back into a word: "f u c k" -> "fuck".
  const words: string[] = [];
  const spelledOut: string[] = []; // words typed letter by letter, a deliberate disguise
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length === 1 && i > 0 && parts[i - 1].length === 1) {
      words[words.length - 1] += parts[i];
      spelledOut[spelledOut.length - 1] = words[words.length - 1];
    } else {
      words.push(parts[i]);
      if (parts[i].length === 1) spelledOut.push(parts[i]);
    }
  }
  // Inside a spelled-out word, any blocked word counts: "s h i t s h i t".
  for (const s of spelledOut) {
    if (s.length > 2 && [...BLOCKED_WORDS, ...BLOCKED_STARTS].some((w) => s.includes(w) || squeeze(s).includes(w))) {
      return { ok: false, reason: 'word' };
    }
  }
  for (const w of words) {
    for (const form of [w, squeeze(w)]) {
      if (BLOCKED_WORDS.has(form) || BLOCKED_STARTS.some((s) => form.startsWith(s))) return { ok: false, reason: 'word' };
    }
  }
  const joined = words.join('');
  if (BLOCKED_PHRASES.some((p) => joined.includes(p) || squeeze(joined).includes(p))) return { ok: false, reason: 'word' };
  return { ok: true };
}
