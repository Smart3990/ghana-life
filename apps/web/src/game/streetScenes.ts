// Life at places: what makes the street feel lived in, not just busy.
//  - Kiosks: a seller behind the counter (waiting, calling out, serving) and customers in front.
//  - Umbrella stalls: a seller, plus people on plastic chairs eating and chatting.
//  - Music spots: a few kiosks play music and people dance in front.
//  - Side streets: children kicking a football about.
//  - People notice you: when you pass close, people at places turn to you and some call out.
//
// The scenes use spare places in the crowd batches (crowd.ts), so they cost no extra draws; they are
// set up again only when the player has moved a fair way. Everything is fixed random numbers from
// positions, so a place looks the same each time you pass it.
import * as THREE from 'three';
import { box, merge, paint } from './vehicles3d';
import { CrowdBatch, lookFor, type Clip, type CrowdBody, type Kind, type Look } from './crowd';

type Spot = { x: number; z: number; angle: number; colour: number };
type Member = {
  body: CrowdBody;
  slot: number;
  look: Look;
  x: number;
  z: number;
  face: number; // heading the person faces (radians clockwise from north)
  clip: Clip;
  // Some people change what they are doing every few seconds (a seller calls out, then waits).
  cycle: Clip[] | null;
  every: number;
  nextChange: number;
  // Children chasing the ball move about a centre.
  orbit: { cx: number; cz: number; r: number; speed: number; phase: number } | null;
  greeted: number;
};

const hash = (a: number, b: number) => {
  let x = Math.imul(Math.floor(a * 10) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.floor(b * 10), 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 13), 0x27d4eb2d);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

// Things people say when you pass (shown in a speech bubble).
export const GREETINGS = ['Chale!', 'Ei, my friend!', 'How far?', 'Akwaaba!', 'Boss, come and buy!', 'Charley, how be?', 'Bra, you dey?', 'Sister, come!', 'Ete sen?', 'Wo ho te sen?'];
const REPLIES = ['I dey, how about you?', 'Fine, fine!', 'Chale, I dey kraa!', 'Akwaaba!', 'We dey here oo!', 'Medaase!', 'God dey!'];
const SELLER_REPLIES = ['Welcome! What do you want?', 'My customer!', 'Everything dey, come!', 'Special price for you!'];
export type Nearby = { kind: 'seat' | 'music' | 'seller' | 'person'; x: number; z: number; face: number; d: number; who: number };
const SELLER_CALLS = ['Come and buy!', 'Pure water! Pure water!', 'Fresh bread!', 'Ice cold!', 'Credit dey!', 'Kenkey hot!', 'Waakye dey!'];

function plasticChair(): THREE.BufferGeometry {
  // The plastic chair seen at every chop bar: seat, back and four legs.
  return merge([
    box(0.46, 0.05, 0.44, 0, 0.44, 0),
    box(0.46, 0.45, 0.05, 0, 0.68, -0.21, -0.12),
    box(0.05, 0.44, 0.05, 0.19, 0.22, 0.18),
    box(0.05, 0.44, 0.05, -0.19, 0.22, 0.18),
    box(0.05, 0.44, 0.05, 0.19, 0.22, -0.18),
    box(0.05, 0.44, 0.05, -0.19, 0.22, -0.18),
  ]);
}

const CHAIR_COLOURS = [0xc8442e, 0x1f5fa8, 0xf2efe6, 0x2f8f57, 0xe3a92b];

export class StreetScenes {
  readonly group = new THREE.Group();
  private members: Member[] = [];
  private chairs: THREE.InstancedMesh;
  private ball: THREE.Mesh;
  private ballState = { from: new THREE.Vector3(), to: new THREE.Vector3(), start: 0, length: 1, target: -1, game: -1 };
  private football: { cx: number; cz: number; kids: number[] } | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private c = new THREE.Color();
  /** Where music is playing (for the sound of the street). */
  musicSpots: { x: number; z: number }[] = [];
  /** Empty plastic chairs the player can sit on to rest. */
  seats: { x: number; z: number; face: number }[] = [];
  /** Called when someone calls out to the player: position and words. */
  onSpeak: ((x: number, z: number, height: number, text: string) => void) | null = null;
  private lastSpoke = 0;

  constructor(
    private crowds: Record<CrowdBody, CrowdBatch>,
    private free: Record<CrowdBody, number[]>, // spare slots in each crowd batch
    capacity: number,
  ) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
    this.chairs = new THREE.InstancedMesh(plasticChair(), mat, capacity);
    this.chairs.count = 0;
    this.chairs.frustumCulled = false;
    this.chairs.castShadow = true;
    this.chairs.setColorAt(0, this.c.set(0xffffff));
    this.group.add(this.chairs);
    const ballGeo = new THREE.IcosahedronGeometry(0.11, 1);
    paint(ballGeo, '#f2efe6');
    this.ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    this.ball.castShadow = true;
    this.ball.visible = false;
    this.group.add(this.ball);
  }

  // Put a person into a scene: take a spare slot in the right batch and give them a look and a move.
  private add(kind: Kind, seed: number, x: number, z: number, face: number, clip: Clip, cycle: Clip[] | null = null, t = 0): Member | null {
    const look = lookFor(kind, (k) => hash(seed, 60 + k));
    const slot = this.free[look.body].pop();
    if (slot === undefined) return null;
    this.crowds[look.body].setLook(slot, look, clip, hash(seed, 3) * 10);
    const member: Member = { body: look.body, slot, look, x, z, face, clip, cycle, every: 4 + hash(seed, 5) * 5, nextChange: t + hash(seed, 6) * 5, orbit: null, greeted: 0 };
    this.members.push(member);
    return member;
  }

  /** Set up the scenes at the places near the player (call after moving a fair way). */
  rebuild(kiosks: Spot[], umbrellas: Spot[], footballSpots: { x: number; z: number }[], t: number) {
    // Hand every slot back, then fill the places again.
    for (const m of this.members) {
      this.free[m.body].push(m.slot);
      this.m.makeScale(0, 0, 0);
      this.crowds[m.body].mesh.setMatrixAt(m.slot, this.m);
    }
    this.members = [];
    this.musicSpots = [];
    this.seats = [];
    let chairs = 0;

    for (const k of kiosks) {
      const fx = Math.sin(k.angle);
      const fz = -Math.cos(k.angle);
      const seed = k.x * 7 + k.z * 3;
      const music = hash(seed, 1) < 0.22;
      // The seller, at the counter.
      this.add(hash(seed, 2) < 0.6 ? 'woman' : 'man', seed, k.x + fx * 1.55, k.z + fz * 1.55, k.angle, 'sell', ['sell', 'call', 'serve', 'hand', 'sell'], t);
      if (music) {
        // A kiosk playing music: people dancing in front of it.
        this.musicSpots.push({ x: k.x + fx * 3, z: k.z + fz * 3 });
        const dancers = 3 + Math.floor(hash(seed, 4) * 3);
        for (let d = 0; d < dancers; d++) {
          const a = (d / dancers) * Math.PI * 2 + hash(seed, d) * 0.5;
          const dx = k.x + fx * 3.6 + Math.sin(a) * 1.3;
          const dz = k.z + fz * 3.6 - Math.cos(a) * 1.3;
          this.add(hash(seed, 10 + d) < 0.5 ? 'woman' : 'man', seed + d * 13, dx, dz, a + Math.PI, 'dance', null, t);
        }
      } else {
        // Customers: one or two, chatting, nodding, paying, drinking.
        const n = 1 + Math.floor(hash(seed, 5) * 2);
        for (let c = 0; c < n; c++) {
          const side = (c - (n - 1) / 2) * 0.8;
          const cx = k.x + fx * 2.6 + Math.cos(k.angle) * side;
          const cz = k.z + fz * 2.6 + Math.sin(k.angle) * side;
          const kinds: Kind[] = ['man', 'woman', 'muslimMan', 'muslimWoman', 'church', 'pupil'];
          this.add(kinds[Math.floor(hash(seed, 20 + c) * kinds.length)], seed + 31 * c, cx, cz, k.angle + Math.PI, 'talk', ['talk', 'yes', 'hand', 'talk', 'eat', 'no'], t);
        }
      }
    }

    for (const u of umbrellas) {
      const seed = u.x * 5 + u.z * 11;
      // The seller beside the table, bending to the goods now and then.
      const sa = hash(seed, 1) * Math.PI * 2;
      this.add(hash(seed, 2) < 0.75 ? 'woman' : 'man', seed, u.x + Math.sin(sa) * 0.8, u.z - Math.cos(sa) * 0.8, sa + Math.PI, 'sell', ['sell', 'pick', 'call', 'sell', 'serve'], t);
      // Plastic chairs with people eating and chatting.
      const n = 1 + Math.floor(hash(seed, 3) * 3);
      for (let c = 0; c < n && chairs < this.chairs.instanceMatrix.count; c++) {
        const a = sa + Math.PI * (0.6 + c * 0.45);
        const cx = u.x + Math.sin(a) * 1.25;
        const cz = u.z - Math.cos(a) * 1.25;
        const face = a + Math.PI; // facing the table
        this.q.setFromAxisAngle(this.up, Math.PI - face);
        this.m.compose(this.p.set(cx, 0, cz), this.q, this.sc.setScalar(1));
        this.chairs.setMatrixAt(chairs, this.m);
        this.chairs.setColorAt(chairs, this.c.set(CHAIR_COLOURS[Math.floor(hash(seed, 7 + c) * CHAIR_COLOURS.length)]));
        chairs++;
        if (hash(seed, 9 + c) >= 0.72) this.seats.push({ x: cx - Math.sin(face) * 0.05, z: cz + Math.cos(face) * 0.05, face });
        else {
          const kinds: Kind[] = ['man', 'woman', 'muslimMan', 'church', 'woman'];
          // The chair seat is set a little back, so the person sits on it.
          this.add(kinds[Math.floor(hash(seed, 12 + c) * kinds.length)], seed + 17 * c, cx - Math.sin(face) * 0.05, cz + Math.cos(face) * 0.05, face, 'sit', ['sit', 'sitTalk', 'sitTalk', 'sit'], t);
        }
      }
    }
    this.chairs.count = chairs;
    this.chairs.instanceMatrix.needsUpdate = true;
    if (this.chairs.instanceColor) this.chairs.instanceColor.needsUpdate = true;

    // Children playing football at the nearest side-street spot.
    this.football = null;
    this.ball.visible = false;
    const pitch = footballSpots[0];
    if (pitch) {
      const kids: number[] = [];
      for (let k = 0; k < 5; k++) {
        const member = this.add('child', pitch.x * 3 + k * 7, pitch.x, pitch.z, 0, 'jog', null, t);
        if (!member) break;
        member.orbit = { cx: pitch.x, cz: pitch.z, r: 2 + hash(pitch.x, k) * 3.5, speed: 0.35 + hash(pitch.z, k) * 0.45, phase: (k / 5) * Math.PI * 2 };
        kids.push(this.members.length - 1);
      }
      if (kids.length) {
        this.football = { cx: pitch.x, cz: pitch.z, kids };
        this.ball.visible = true;
        this.ballState.start = -99;
      }
    }
    this.place(t, Infinity, Infinity);
  }

  /** The nearest thing within reach that the player can do something with (the action button). */
  nearest(px: number, pz: number): Nearby | null {
    let best: Nearby | null = null;
    const consider = (n: Nearby, reach: number) => {
      if (n.d < reach && (!best || n.d < best.d)) best = n;
    };
    for (const s of this.seats) consider({ kind: 'seat', x: s.x, z: s.z, face: s.face, d: Math.hypot(s.x - px, s.z - pz), who: -1 }, 1.6);
    for (const m of this.musicSpots) consider({ kind: 'music', x: m.x, z: m.z, face: 0, d: Math.hypot(m.x - px, m.z - pz) * 0.6, who: -1 }, 3);
    for (const [i, m] of this.members.entries()) {
      if (m.orbit || m.clip === 'dance') continue;
      const kind = m.cycle?.includes('sell') ? 'seller' : 'person';
      consider({ kind, x: m.x, z: m.z, face: m.face, d: Math.hypot(m.x - px, m.z - pz), who: i }, 2.6);
    }
    return best;
  }

  /** The player greets someone: they answer with a word and a nod or a wave. */
  answer(who: number, t: number, seller: boolean) {
    const m = this.members[who];
    if (!m) return;
    m.greeted = t;
    this.lastSpoke = t;
    this.switchTo(m, seller ? 'hand' : Math.random() < 0.5 ? 'yes' : 'call', t);
    m.nextChange = t + 2.5;
    const words = seller ? SELLER_REPLIES : REPLIES;
    this.onSpeak?.(m.x, m.z, 1.95 * m.look.scale, words[Math.floor(Math.random() * words.length)]);
  }

  /** Call every frame. */
  update(t: number, playerX: number, playerZ: number) {
    this.place(t, playerX, playerZ);
    this.kickBall(t);
  }

  private place(t: number, px: number, pz: number) {
    for (const [i, m] of this.members.entries()) {
      let x = m.x;
      let z = m.z;
      let face = m.face;
      if (m.orbit) {
        const a = m.orbit.phase + t * m.orbit.speed;
        x = m.orbit.cx + Math.cos(a) * m.orbit.r;
        z = m.orbit.cz + Math.sin(a) * m.orbit.r * 0.6;
        face = Math.atan2(-Math.sin(a) * m.orbit.r, -Math.cos(a) * m.orbit.r * 0.6); // facing the way they run
      }
      // People nearby notice you: they turn towards you, and now and then someone calls out.
      const d = Math.hypot(px - x, pz - z);
      if (d < 5 && !m.orbit && m.clip !== 'dance' && m.clip !== 'sit' && m.clip !== 'sitTalk') {
        face = Math.atan2(px - x, -(pz - z));
        if (t - m.greeted > 25 && t - this.lastSpoke > 3.5 && hash(i, Math.floor(t)) < 0.5) {
          m.greeted = t;
          this.lastSpoke = t;
          const seller = !!m.cycle?.includes('sell');
          this.switchTo(m, 'call', t);
          m.nextChange = t + 2.5;
          const words = seller ? SELLER_CALLS : GREETINGS;
          this.onSpeak?.(x, z, 1.95 * m.look.scale, words[Math.floor(hash(i, t) * words.length)]);
        }
      }
      // Change what they are doing every few seconds.
      if (m.cycle && t > m.nextChange) {
        m.nextChange = t + m.every;
        const next = m.cycle[Math.floor(hash(i, t) * m.cycle.length)];
        if (next !== m.clip) this.switchTo(m, next, t);
      }
      this.q.setFromAxisAngle(this.up, Math.PI - face);
      this.m.compose(this.p.set(x, 0, z), this.q, this.sc.setScalar(m.look.scale));
      this.crowds[m.body].mesh.setMatrixAt(m.slot, this.m);
    }
    this.crowds.male.mesh.instanceMatrix.needsUpdate = true;
    this.crowds.female.mesh.instanceMatrix.needsUpdate = true;
  }

  private switchTo(m: Member, clip: Clip, t: number) {
    m.clip = clip;
    // Start the new move from its beginning, now.
    this.crowds[m.body].setLook(m.slot, m.look, clip, t);
  }

  // The ball goes from child to child in short hops.
  private kickBall(t: number) {
    const f = this.football;
    if (!f) return;
    const b = this.ballState;
    const k = (t - b.start) / b.length;
    if (k >= 1) {
      // Kick to another child.
      const next = f.kids[Math.floor(hash(t, 3) * f.kids.length)];
      const kid = this.members[next];
      if (!kid?.orbit) return;
      b.from.copy(this.ball.position.lengthSq() ? this.ball.position : this.p.set(f.cx, 0.11, f.cz));
      const a = kid.orbit.phase + (t + 1.2) * kid.orbit.speed;
      b.to.set(kid.orbit.cx + Math.cos(a) * kid.orbit.r, 0.11, kid.orbit.cz + Math.sin(a) * kid.orbit.r * 0.6);
      b.start = t;
      b.length = 0.8 + hash(t, 5) * 0.7;
      return;
    }
    this.ball.position.lerpVectors(b.from, b.to, k);
    this.ball.position.y = 0.11 + Math.sin(k * Math.PI) * (0.4 + b.length * 0.5);
    this.ball.rotation.x += 0.3;
  }
}
