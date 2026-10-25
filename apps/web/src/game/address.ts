// How people address the player: a woman is "my daughter", "my sister", "Madam"; a man is "my son",
// "my brother", "Massa". Every line said TO the player goes through forPlayer(), so the same line
// works for both. (scripts/voice-script.mjs uses the same pairs to list the women's versions.)

export const ADDRESS: [male: string, female: string][] = [
  ['my son', 'my daughter'],
  ['my boy', 'my girl'],
  ['my brother', 'my sister'],
  ['young man', 'young lady'],
  ['brother', 'sister'],
  ['massa', 'madam'],
  ['jimmy', 'sister'],
  ['bra', 'sista'],
  ['boss', 'madam'],
];

const keepCase = (from: string, to: string) => (from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);

/** The line as it should be said to a player of this body type. */
export function forPlayer(text: string, body: 'male' | 'female'): string {
  // One pass over all the words, so "brother" -> "sister" is not changed back again.
  const pairs = body === 'female' ? ADDRESS.map(([m, f]) => [m, f]) : ADDRESS.filter(([m]) => m !== 'jimmy' && m !== 'boss').map(([m, f]) => [f, m]);
  const re = new RegExp(`\\b(${pairs.map(([a]) => a).join('|')})\\b`, 'gi');
  return text.replace(re, (word) => {
    const hit = pairs.find(([a]) => a === word.toLowerCase());
    return hit ? keepCase(word, hit[1]) : word;
  });
}
