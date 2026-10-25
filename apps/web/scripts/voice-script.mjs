// Makes the voice script: every line the game speaks, grouped by who says it, with the file name
// each recording must have. Read from the game's own code, so it always matches what is spoken.
//
//   cd apps/web
//   node scripts/voice-script.mjs
//
// Writes docs/VOICE_SCRIPT.md (to read and record from) and public/voices/lines.json (every line's
// file name). Recordings go in public/voices/<file name>.mp3; then run
//   node scripts/voice-script.mjs --index
// to list the recordings in public/voices/index.json, and the game plays them instead of the
// phone's own voice.
import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'rolldown/experimental';

const web = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const root = path.resolve(web, '../..');
const voicesDir = path.join(web, 'public/voices');

// Must match voiceId() in src/game/voices.ts.
export const voiceId = (text) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/₵\s?(\d+)/g, '$1-cedis')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

if (process.argv.includes('--index')) {
  const have = fs.readdirSync(voicesDir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
  fs.writeFileSync(path.join(voicesDir, 'index.json'), JSON.stringify(have, null, 1) + '\n');
  console.log(`${have.length} recordings listed in public/voices/index.json`);
  process.exit(0);
}

const sections = new Map(); // title -> { who, note, lines: Set }
const add = (title, who, text, note = '') => {
  if (!text || !/[a-z]/i.test(text)) return;
  if (!sections.has(title)) sections.set(title, { who, note, lines: new Set() });
  sections.get(title).lines.add(text);
};
// A small toolkit over the parser's tree (ESTree shape).
const parse = (file) => {
  const code = fs.readFileSync(path.join(web, file), 'utf8');
  const { program } = parseSync(file, code);
  program.code = code;
  return program;
};
const kids = (n) => {
  const out = [];
  for (const k of Object.keys(n)) {
    if (k === 'parent' || k === 'code') continue;
    const v = n[k];
    if (Array.isArray(v)) for (const x of v) x && typeof x.type === 'string' && out.push(x);
    else if (v && typeof v.type === 'string') out.push(v);
  }
  return out;
};
let SRC = '';
const textOf = (n) => {
  if (!n) return null;
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral') return n.quasis.map((q, i) => q.value.cooked + (n.expressions[i] ? `{${SRC.slice(n.expressions[i].start, n.expressions[i].end)}}` : '')).join('');
  return null;
};
const strings = (n, out = []) => {
  const t = textOf(n);
  if (t !== null) out.push(t);
  else for (const c of kids(n)) strings(c, out);
  return out;
};
const walkAll = (n, fn) => {
  fn(n);
  for (const c of kids(n)) walkAll(c, fn);
};
const varNamed = (sf, name) => {
  let found = null;
  walkAll(sf, (n) => {
    if (n.type === 'VariableDeclarator' && n.id?.name === name) found = n.init;
  });
  return found;
};
const keyName = (p) => p.key?.name ?? p.key?.value;
const use = (sf) => ((SRC = sf.code), sf);

// 1. The opening story (the film and the Auntie Dede scene).
const test = use(parse('src/test/streetTest.ts'));
const FILM = { GRANDMA: 'Grandma (old woman, warm, slow)', 'BUS MATE': 'Bus mate (young man, loud)', 'AUNTIE DEDE': 'Auntie Dede (woman about 50, loud and motherly)', 'UNCLE KWAME': 'Uncle Kwame (man about 55, deep and calm)', YOU: 'You, the player (young man about 20; a young woman reads them for a female player)' };
walkAll(test, (n) => {
  if (n.type !== 'CallExpression') return;
  const f = SRC.slice(n.callee.start, n.callee.end);
  if (f === 'cine.say' && n.arguments.length >= 2) {
    const who = textOf(n.arguments[0]);
    const line = textOf(n.arguments[1]);
    if (who && line && FILM[who]) add(`Story: ${FILM[who].split(' (')[0]}`, FILM[who], line);
    // Lines with a version for a woman and a man player: girl ? '...' : '...'
    if (who && FILM[who] && n.arguments[1].type === 'ConditionalExpression') for (const b of [n.arguments[1].consequent, n.arguments[1].alternate]) { const t = textOf(b); if (t) add(`Story: ${FILM[who].split(' (')[0]}`, FILM[who], t); }
  }
  // Film cues and moving pictures: [time, 'WHO', 'line'] or ['WHO', 'line'] lists.
  if (f === 'cine.picture' || f === 'cine.video') {
    walkAll(n, (a) => {
      if (a.type !== 'ArrayExpression') return;
      const parts = a.elements.map(textOf);
      for (let i = 0; i + 1 < parts.length; i++) if (parts[i] && FILM[parts[i]] && parts[i + 1]) add(`Story: ${FILM[parts[i]].split(' (')[0]}`, FILM[parts[i]], parts[i + 1]);
    });
  }
  if (/onSpeak/.test(f) && n.arguments.length >= 4) {
    for (const s of strings(n.arguments[3])) if (s !== 'female') add('Story: shouts', 'You and Auntie Dede (in the street)', s);
  }
});

// Lines kept in lists in the story: [time, 'WHO', 'line'] (the ride home).
walkAll(test, (a) => {
  if (a.type !== 'ArrayExpression') return;
  const parts = a.elements.map((e) => (e ? textOf(e) : null));
  for (let i = 0; i + 1 < parts.length; i++) if (parts[i] && FILM[parts[i]] && parts[i + 1]) add(`Story: ${FILM[parts[i]].split(' (')[0]}`, FILM[parts[i]], parts[i + 1]);
});

// 2. Drivers, mates and people in the street.
const LISTS = [
  [test, 'SHOUTS', 'Drivers when you stand in the road', 'Drivers (men, annoyed but not angry, shouting from the car)'],
  [test, 'MATE_SHOUTS', 'Trotro mates when you stand in the road', 'Trotro mates (young men, loud)'],
  [test, 'PUSH_LINES', 'A driver who gets down to push you aside', 'Driver (man, firm)'],
  [test, 'CHATTER', 'People walking past, chatting', 'Anyone: men, women, children (two or three different voices)'],
];
const scenes = parse('src/game/streetScenes.ts');
LISTS.push(
  [scenes, 'GREETINGS', 'People greeting you', 'Anyone: men and women'],
  [scenes, 'REPLIES', 'People answering your greeting', 'Anyone: men and women'],
  [scenes, 'SELLER_CALLS', 'Sellers calling out', 'Market women and hawkers (loud, sing-song)'],
  [scenes, 'SELLER_REPLIES', 'Sellers answering you', 'Market women and hawkers'],
  [scenes, 'PHONE_CALLS', 'Phone sellers at Circle', 'Young men (fast, cheeky)'],
);
for (const [sf, name, title, who] of LISTS) {
  use(sf);
  const init = varNamed(sf, name);
  if (init) for (const s of strings(init)) add(title, who, s);
}
// The trotro station's mates and hawkers.
const station = use(parse('src/game/trotroStation.ts'));
walkAll(station, (n) => {
  if (n.type === 'Property' && keyName(n) === 'words') for (const s of strings(n.value)) add('Trotro station', 'Bus mates and hawkers ({dest} is a place name: the phone says those for now)', s);
});

// 3. Bus mates shouting routes from passing trotros.
const voicesSrc = fs.readFileSync(path.join(web, 'src/game/voices.ts'), 'utf8');
const routes = JSON.parse(voicesSrc.match(/export const ROUTES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
for (const r of routes) {
  add('Bus mates calling routes', 'Bus mates (young men, very loud, fast)', `${r}! ${r}! ${r}!`);
  add('Bus mates calling routes', 'Bus mates (young men, very loud, fast)', `${r}, ${r}! One more, come!`);
  add('Bus mates calling routes', 'Bus mates (young men, very loud, fast)', `${r}! Straight! Come, come!`);
}

// 4. Conversations (they speak first; you answer by picking a button).
const talks = use(parse('src/game/talks.ts'));
const TALK_WHO = { any: 'Anyone', muslimMan: 'A Muslim man', muslimWoman: 'A Muslim woman', church: 'A church person', child: 'A child', pupil: 'A school pupil', kayayo: 'A kayayo (woman carrying loads)', hawker: 'A hawker', seller: 'A seller', phones: 'A phone seller', mate: 'A bus mate' };
const talkRoot = varNamed(talks, 'TALKS');
for (const p of talkRoot?.properties ?? []) {
  const who = TALK_WHO[keyName(p)] ?? keyName(p);
  walkAll(p.value, (n) => {
    if (n.type !== 'Property') return;
    const name = keyName(n);
    const t = textOf(n.value);
    if ((name === 'them' || name === 'next') && t) add(`Talk: ${who}`, who, t);
    if (name === 'you' && t) add('Talk: your answers', 'You, the player', t);
  });
}

// 5. Phone calls.
const phone = use(parse('src/hud/phone.ts'));
const walkPhone = (n, contact) => {
  if (n.type === 'ObjectExpression') {
    const nameProp = n.properties.find((q) => q.type === 'Property' && keyName(q) === 'name');
    if (nameProp) contact = textOf(nameProp.value) ?? contact;
  }
  if (n.type === 'Property' && contact) {
    const t = textOf(n.value);
    if (keyName(n) === 'say' && t) add(`Phone: ${contact}`, contact, t);
    if (keyName(n) === 'text' && t) add('Phone: your answers', 'You, the player', t);
  }
  for (const c of kids(n)) walkPhone(c, contact);
};
walkPhone(phone, '');

// ---------- Write it out ----------
const all = [];
const seen = new Map();
let md = `# Ghanaverse voice script

Every line the game speaks, grouped by who says it. Made from the game's code by \`apps/web/scripts/voice-script.mjs\`, so run it again after new lines are added.

## How to record

1. Use a quiet room (a wardrobe full of clothes is a good booth). Phone voice-memo apps are fine; hold the phone about a hand's width from your mouth.
2. Speak naturally, like the person would in the street. Ghanaian English, Pidgin and Twi as written; change a word if it sounds more natural, and tell us.
3. One line per file. Name each file exactly as shown (for example \`chale-comot-for-road.mp3\`). MP3, mono, 44.1 kHz or 48 kHz, about 1 second of quiet removed from the start and end.
4. Different people for different characters, if you can: Grandma, Auntie Dede and Uncle Kwame should each sound like one person. Drivers, mates and sellers can be several voices.
5. Put the files in \`apps/web/public/voices/\`, then run \`node scripts/voice-script.mjs --index\` in \`apps/web\`. The game then plays your recording instead of the phone's own voice. Lines you have not recorded yet keep the phone's voice.
6. Only record people who agree, and keep their written OK (name, date, "you may use my voice in Ghanaverse"). Record the voice actors in \`apps/web/public/models/LICENSES.md\`.

Lines with \`{...}\` in them say a name the game fills in (your hometown, a place): the phone's voice says those for now.

`;
// Lines said TO the player come in a man's and a woman's form ("my son" / "my daughter").
// Same pairs as src/game/address.ts.
const ADDRESS = [['my son', 'my daughter'], ['my boy', 'my girl'], ['my brother', 'my sister'], ['young man', 'young lady'], ['brother', 'sister'], ['massa', 'madam'], ['jimmy', 'sister'], ['bra', 'sista'], ['boss', 'madam']];
const forPlayer = (text, body) => {
  const pairs = body === 'female' ? ADDRESS : ADDRESS.filter(([m]) => m !== 'jimmy' && m !== 'boss').map(([m, f]) => [f, m]);
  const re = new RegExp(`\\b(${pairs.map(([a]) => a).join('|')})\\b`, 'gi');
  return text.replace(re, (w) => {
    const hit = pairs.find(([a]) => a === w.toLowerCase());
    if (!hit) return w;
    return w[0] === w[0].toUpperCase() ? hit[1][0].toUpperCase() + hit[1].slice(1) : hit[1];
  });
};
for (const [title, s] of sections) {
  // The player's own lines are not changed; everyone else's are said to a man or a woman.
  if (!/^You/.test(s.who)) {
    const both = [];
    for (const line of s.lines) for (const v of [line, forPlayer(line, 'male'), forPlayer(line, 'female')]) if (!both.includes(v)) both.push(v);
    s.lines = new Set(both);
  }
}
md = md.replace('Lines with `{...}`', 'Lines said to the player come twice when it matters: once for a man ("my son", "my brother", "Massa", "Bra") and once for a woman ("my daughter", "my sister", "Madam", "Sista"). Record both.\n\nLines with `{...}`');
for (const [title, s] of sections) {
  md += `## ${title}\n\n*Who:* ${s.who}\n\n| File | Line |\n| --- | --- |\n`;
  for (const line of s.lines) {
    let id = voiceId(line);
    if (line.includes('{')) {
      md += `| (filled in by the game) | ${line.replace(/\|/g, '\\|')} |\n`;
      continue;
    }
    if (seen.has(id) && seen.get(id) !== line) id += '-2';
    const repeat = seen.has(id);
    seen.set(id, line);
    if (!repeat) all.push({ id, line, who: s.who });
    md += `| \`${id}.mp3\`${repeat ? ' (same as above)' : ''} | ${line.replace(/\|/g, '\\|')} |\n`;
  }
  md += '\n';
}
md += `---\n\n${all.length} lines to record.\n`;
fs.writeFileSync(path.join(root, 'docs/VOICE_SCRIPT.md'), md);
fs.writeFileSync(path.join(voicesDir, 'lines.json'), JSON.stringify(all, null, 1) + '\n');
console.log(`${all.length} lines written to docs/VOICE_SCRIPT.md`);
