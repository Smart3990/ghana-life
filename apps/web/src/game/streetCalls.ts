// What people shout in the street (shown as words in speech bubbles; there are no made-up voices:
// owner, 29 Oct 2026, "remove the AI voice completely… maintain the texts").

/** Who is speaking: a body (for the words' "Sister" / "Bra") and a number that tells people apart. */
export type Speaker = { body: 'male' | 'female' | 'child'; seed: number };

const hash = (n: number) => {
  let x = Math.imul(Math.floor(n * 100) ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

export const ROUTES = ['Circle', 'Accra', 'Kaneshie', 'Madina', 'Lapaz', 'Achimota', 'Kasoa', 'Tema', 'Odorkor', 'Adabraka', 'Osu', 'Spintex', 'Dansoman', 'Nkrumah Circle'];
/** A bus mate's call for a trotro going somewhere: "Kaneshie! Kaneshie! Kaneshie!" */
export function mateCall(seed: number) {
  const a = ROUTES[Math.floor(hash(seed) * ROUTES.length)];
  const b = ROUTES[Math.floor(hash(seed + 1) * ROUTES.length)];
  const forms = [`${a}! ${a}! ${a}!`, `${a}, ${a}! One more, come!`, `${a} ${a}! ${b}! Last seat!`, `Circle! Circle! Circle!`, `Accra! Accra! Accra!`, `${a}! Straight! Come, come!`];
  return forms[Math.floor(hash(seed + 2) * forms.length)];
}
