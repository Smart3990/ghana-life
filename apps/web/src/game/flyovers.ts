// Flyovers: the map marks some roads as bridges (at Circle, the Kwame Nkrumah Interchange's ring
// road decks and slip roads). Here they are built in 3D: a concrete deck about 7 m up, with low
// walls along both edges, standing on blade piers, sloping down to the ground where a bridge ends
// without joining another one. Nothing drives on them yet; they are scenery that tells you where you are.
import * as THREE from 'three';
import { paint, merge } from './vehicles3d';
import { epicGeometry, epicLampMaterial, lightPoolGeometry, lightPoolMaterial } from './epicKit';
import { ROAD_DIP } from './epicRoads';

const HIGH = 7; // deck height, metres
const SLOPE = 0.11; // how steeply the ends come down
const PILLAR_EVERY = 24;
const LOW = 4.5; // below this a deck is a solid ramp, not a bridge you can pass under

type Line = { pts: Float32Array; half: number; heights?: Float32Array };
// The Epic City pack's bridge colours (measured from its bridge-mainroad piece).
const PACK = { tarmac: '#3f3c3c', concrete: '#a7a19e', barrier: '#eeeeec', yellow: '#fdcf24', white: '#dbdbda' };

export class Flyovers {
  readonly group = new THREE.Group();
  private lines: Line[] = [];
  private mesh: THREE.Mesh | null = null;
  private material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  private dirty = false;
  private bannerMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  private banners: THREE.Mesh | null = null;
  private seen = new Set<string>();
  // Street lights on the decks: the pack's road lamp in pairs inside the barriers, every 25 m.
  private lampSpots: { x: number; y: number; z: number; a: number; across: number; under?: boolean }[] = [];
  private lampGeo: THREE.BufferGeometry | null = null;
  private lamps: THREE.InstancedMesh | null = null;
  private pools: THREE.InstancedMesh | null = null;
  private night = 0;
  constructor() {
    void epicGeometry('props/lamp-road.glb', -Math.PI / 2).then((g) => {
      this.lampGeo = g;
      this.placeLamps();
    });
  }
  /** 0 by day, 1 at night (the decks are lit like the streets). */
  setNight(n: number) {
    this.night = n;
    if (this.pools) this.pools.visible = n > 0.02;
  }
  /** How many deck lamps are drawn (the nearest), and how far their light on the deck reaches. */
  maxLamps = 60;
  private lampsAt: [number, number] = [1e9, 1e9];
  private placeLamps() {
    if (!this.lampGeo) return;
    if (!this.lamps) {
      this.lamps = new THREE.InstancedMesh(this.lampGeo, epicLampMaterial(), this.maxLamps);
      this.pools = new THREE.InstancedMesh(lightPoolGeometry(), lightPoolMaterial(), 400);
      for (const m of [this.lamps, this.pools]) { m.count = 0; m.frustumCulled = false; }
      this.lamps.castShadow = true;
      this.group.add(this.lamps, this.pools);
    }
    this.pools!.visible = this.night > 0.02;
    this.lampsAt = [1e9, 1e9];
  }
  /** Draw the deck lamps near (x, z): the nearest ones, and the light of all within 250 m. */
  updateLamps(x: number, z: number) {
    if (!this.lamps || !this.pools || Math.hypot(x - this.lampsAt[0], z - this.lampsAt[1]) < 12) return;
    this.lampsAt = [x, z];
    const near = this.lampSpots.filter((sp) => Math.abs(sp.x - x) < 250 && Math.abs(sp.z - z) < 250).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pool = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    let n = 0, p = 0;
    for (const sp of near) {
      m.compose(new THREE.Vector3(sp.x, sp.y, sp.z), q.setFromAxisAngle(up, Math.PI - sp.a), one);
      if (!sp.under && n < this.maxLamps) this.lamps.setMatrixAt(n++, m);
      if (p < 400) {
        // A deck lamp lights from the barrier to past the middle; an under-deck light, all the road below.
        if (sp.under) pool.makeScale(30, 1, sp.across).setPosition(0, -ROAD_DIP + 0.01, 0);
        else pool.makeScale(36, 1, sp.across).setPosition(0, 0, sp.across / 2 - 1);
        this.pools.setMatrixAt(p++, m.multiply(pool));
      }
    }
    this.lamps.count = n;
    this.pools.count = p;
    this.lamps.instanceMatrix.needsUpdate = this.pools.instanceMatrix.needsUpdate = true;
  }
  /** Goes up each time the flyovers are rebuilt (so traffic re-checks its routes). */
  version = 0;

  add(lines: Line[]) {
    for (const l of lines) {
      // The same bridge can arrive twice (from neighbouring tiles): keep one copy.
      const key = `${Math.round(l.pts[0])},${Math.round(l.pts[1])},${Math.round(l.pts[l.pts.length - 2])},${Math.round(l.pts[l.pts.length - 1])}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      this.lines.push(l);
      this.dirty = true;
    }
  }

  /** The deck's height at a point on a flyover (0 if there is none there). */
  heightAt(x: number, z: number) {
    return deckHeightAt(this.lines, x, z);
  }

  /**
   * Where a flyover comes down low (under 4.5 m) it is a solid ramp with walls to the ground: nothing
   * can pass under it. Returns true at a point inside such a ramp (for traffic and for walking).
   */
  lowRampAt(x: number, z: number) {
    const h = deckHeightAt(this.lines, x, z, 0.4);
    return h > 0.05 && h < LOW;
  }

  /** Rebuild the flyovers if new ones arrived (cheap: a few dozen pieces). */
  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.version++;
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const parts: THREE.BufferGeometry[] = [];
    const bannerPos: number[] = [];
    const bannerUv: number[] = [];
    let bannerCount = 0;
    // An end of a bridge piece is "joined" if another bridge piece starts or ends there (tile borders
    // and junctions on the deck); a free end is where the flyover comes down to the ground.
    const ends: [number, number][] = [];
    for (const l of this.lines) ends.push([l.pts[0], l.pts[1]], [l.pts[l.pts.length - 2], l.pts[l.pts.length - 1]]);
    const joined = (x: number, z: number) => ends.filter(([ex, ez]) => Math.hypot(ex - x, ez - z) < 3).length > 1;
    this.lampSpots = [];
    for (const l of this.lines) {
      const n = l.pts.length / 2;
      const cum = [0];
      for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(l.pts[i * 2] - l.pts[i * 2 - 2], l.pts[i * 2 + 1] - l.pts[i * 2 - 1]));
      const total = cum[n - 1];
      const startFree = !joined(l.pts[0], l.pts[1]);
      const endFree = !joined(l.pts[n * 2 - 2], l.pts[n * 2 - 1]);
      const height = (s: number) => {
        let h = HIGH;
        if (startFree) h = Math.min(h, 0.6 + s * SLOPE);
        if (endFree) h = Math.min(h, 0.6 + (total - s) * SLOPE);
        return h;
      };
      const half = l.half + 0.6;
      l.heights = Float32Array.from(cum, (c) => height(c));
      for (let i = 0; i + 1 < n; i++) {
        const [x1, z1, x2, z2] = [l.pts[i * 2], l.pts[i * 2 + 1], l.pts[i * 2 + 2], l.pts[i * 2 + 3]];
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.3) continue;
        const h1 = height(cum[i]);
        const h2 = height(cum[i + 1]);
        parts.push(deckPiece(x1, z1, h1, x2, z2, h2, half));
        // Low parts: retaining walls down to the ground on both sides (a solid ramp, like the real ones).
        if (Math.min(h1, h2) < LOW) parts.push(rampWalls(x1, z1, Math.min(h1, LOW), x2, z2, Math.min(h2, LOW), half));
        // Long banners along the side of the deck on high, straight stretches (as on Circle's flyovers).
        if (len > 22 && Math.min(h1, h2) > 5.5 && bannerCount < 40 && (i + Math.round(x1)) % 2 === 0) {
          bannerCount++;
          const ux = (x2 - x1) / len;
          const uz = (z2 - z1) / len;
          const ax = -uz;
          const az = ux;
          const bl = Math.min(18, len - 4);
          const m0 = (len - bl) / 2;
          for (const side of [1, -1]) {
            const o = half + 0.02;
            const a = [x1 + ux * m0 + ax * o * side, z1 + uz * m0 + az * o * side];
            const b = [x1 + ux * (m0 + bl) + ax * o * side, z1 + uz * (m0 + bl) + az * o * side];
            const ha = h1 + ((h2 - h1) * m0) / len;
            const hb = h1 + ((h2 - h1) * (m0 + bl)) / len;
            const row = (bannerCount + (side > 0 ? 0 : 1)) % 3;
            const v0 = row / 3;
            const v1 = (row + 1) / 3;
            // From outside, the text reads left to right.
            const [u0, u1] = side > 0 ? [1, 0] : [0, 1];
            const quad = [[a[0], ha - 1.0, a[1], u0, v0], [b[0], hb - 1.0, b[1], u1, v0], [b[0], hb + 0.85, b[1], u1, v1], [a[0], ha + 0.85, a[1], u0, v1]];
            for (const k of [0, 1, 2, 0, 2, 3]) {
              bannerPos.push(quad[k][0], quad[k][1], quad[k][2]);
              bannerUv.push(quad[k][3], quad[k][4]);
            }
          }
        }
        // Street lights in pairs on the deck, just inside the barriers, their arms over the lanes.
        for (let s = Math.ceil(cum[i] / 25) * 25; s < cum[i + 1]; s += 25) {
          const k = (s - cum[i]) / len;
          const h = height(s);
          if (h < 1) continue;
          const ux = (x2 - x1) / len, uz = (z2 - z1) / len;
          for (const side of [1, -1]) {
            const o = (half - 0.45) * side;
            // Facing the deck's middle (bearing of the direction (-ax, -az) * side).
            const vx = uz * side, vz = -ux * side;
            this.lampSpots.push({ x: x1 + (x2 - x1) * k - uz * o, y: h, z: z1 + (z2 - z1) * k + ux * o, a: Math.atan2(vx, -vz), across: half + 1.2 });
          }
        }
        // Under the high parts, lights fixed under the deck light the road below (else it is the
        // darkest place in the city at night).
        for (let s = Math.ceil(cum[i] / 22) * 22 + 11; s < cum[i + 1]; s += 22) {
          if (height(s) < 4.5) continue;
          const k = (s - cum[i]) / len;
          const ux = (x2 - x1) / len, uz = (z2 - z1) / len;
          this.lampSpots.push({ x: x1 + (x2 - x1) * k, y: 0, z: z1 + (z2 - z1) * k, a: Math.atan2(-uz, -ux), across: half * 2 + 6, under: true });
        }
        // Pillars under the high parts.
        for (let s = Math.ceil(cum[i] / PILLAR_EVERY) * PILLAR_EVERY; s < cum[i + 1]; s += PILLAR_EVERY) {
          const k = (s - cum[i]) / len;
          const h = height(s);
          if (h < 3) continue;
          const px = x1 + (x2 - x1) * k;
          const pz = z1 + (z2 - z1) * k;
          // A flat blade pier across the deck, as the Epic City pack's bridges stand on.
          const pier = new THREE.BoxGeometry(Math.max(2, half * 2 - 3), h - 0.9, 1.3)
            .rotateY(-Math.atan2(z2 - z1, x2 - x1) + Math.PI / 2)
            .translate(px, (h - 0.9) / 2, pz);
          parts.push(paint(pier, PACK.concrete));
        }
      }
    }
    if (this.banners) {
      this.group.remove(this.banners);
      this.banners.geometry.dispose();
      this.banners = null;
    }
    if (bannerPos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(bannerPos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(bannerUv, 2));
      g.computeVertexNormals();
      this.banners = new THREE.Mesh(g, this.bannerMat);
      this.group.add(this.banners);
    }
    this.placeLamps();
    if (!parts.length) return;
    this.mesh = new THREE.Mesh(merge(parts), this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
  }
}

// Three long banners (one per row of the picture), the game's own placeholder adverts.
function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 3 * 200;
  const g = c.getContext('2d')!;
  const rows = [
    { bg: '#f2efe6', text: 'NO FEES. NO STRESS.  SIKA MOBILE MONEY', ink: '#0f6b3a', accent: '#f2c21a' },
    { bg: '#121a14', text: 'GHANAVERSE FM 98.5  ·  THE SOUND OF THE CITY', ink: '#e3a92b', accent: '#c8442e' },
    { bg: '#c8442e', text: 'YOUR AD HERE  ·  ADVERTISE IN GHANAVERSE', ink: '#ffffff', accent: '#121a14' },
  ];
  rows.forEach((r, i) => {
    const y = (2 - i) * 200; // row 0 at the bottom of the texture
    g.fillStyle = r.bg;
    g.fillRect(0, y, 2048, 200);
    g.fillStyle = r.accent;
    g.fillRect(0, y, 2048, 16);
    g.fillRect(0, y + 184, 2048, 16);
    g.fillStyle = r.ink;
    g.font = '900 110px system-ui, sans-serif';
    g.fillText(r.text, 60, y + 140, 1930);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// The two side walls of a low ramp, from the ground up to the deck.
function rampWalls(x1: number, z1: number, h1: number, x2: number, z2: number, h2: number, half: number) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ax = -(z2 - z1) / len;
  const az = (x2 - x1) / len;
  const pos: number[] = [];
  for (const side of [1, -1]) {
    const o = half * side;
    const a = [x1 + ax * o, 0, z1 + az * o];
    const b = [x2 + ax * o, 0, z2 + az * o];
    const c = [x2 + ax * o, Math.max(0, h2 - 0.9), z2 + az * o];
    const d = [x1 + ax * o, Math.max(0, h1 - 0.9), z1 + az * o];
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, PACK.concrete);
}

/** The deck height at a point (0 if none). With `edge`, only on the deck itself (its width plus edge metres). */
export function deckHeightAt(lines: Line[], x: number, z: number, edge?: number) {
  let best = 0;
  let bestD = Infinity;
  for (const l of lines) {
    if (!l.heights) continue;
    const n = l.pts.length / 2;
    for (let i = 0; i + 1 < n; i++) {
      const [x1, z1, x2, z2] = [l.pts[i * 2], l.pts[i * 2 + 1], l.pts[i * 2 + 2], l.pts[i * 2 + 3]];
      if (Math.min(x1, x2) - 12 > x || Math.max(x1, x2) + 12 < x || Math.min(z1, z2) - 12 > z || Math.max(z1, z2) + 12 < z) continue;
      const dx = x2 - x1;
      const dz = z2 - z1;
      const k = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(x1 + dx * k - x, z1 + dz * k - z);
      if (edge !== undefined && d > l.half + 0.6 + edge) continue;
      if (d < bestD) [bestD, best] = [d, l.heights[i] + (l.heights[i + 1] - l.heights[i]) * k];
    }
  }
  return bestD < 12 ? best : 0;
}

// One straight piece of deck from (x1, z1) at height h1 to (x2, z2) at h2: the slab (1 m thick,
// pale concrete underneath, dark tarmac on top) and a low wall on each edge.
function deckPiece(x1: number, z1: number, h1: number, x2: number, z2: number, h2: number, half: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const ax = -dz / len; // across the deck
  const az = dx / len;
  const quad = (pts: number[][], colour: string) => {
    const g = new THREE.BufferGeometry();
    const [a, b, c, d] = pts;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    g.computeVertexNormals();
    return paint(g, colour);
  };
  const P = (s: number, side: number, y: number) => [x1 + dx * s + ax * side, (s ? h2 : h1) + y, z1 + dz * s + az * side];
  const parts: THREE.BufferGeometry[] = [
    quad([P(0, -half, 0), P(1, -half, 0), P(1, half, 0), P(0, half, 0)], PACK.tarmac), // tarmac (seen from above)
    quad([P(0, half, -1), P(1, half, -1), P(1, -half, -1), P(0, -half, -1)], PACK.concrete), // underside
    quad([P(0, half, 0), P(1, half, 0), P(1, half, -1), P(0, half, -1)], PACK.concrete), // edges
    quad([P(0, -half, -1), P(1, -half, -1), P(1, -half, 0), P(0, -half, 0)], PACK.concrete),
  ];
  // The pack's lines on the deck: an unbroken yellow centre line and white lane dashes (1.67 m every 5 m).
  const across = (s0: number, s1: number, a: number, b: number, colour: string) => {
    const Q = (s: number, side: number) => [x1 + dx * s + ax * side, h1 + (h2 - h1) * s + 0.02, z1 + dz * s + az * side];
    parts.push(quad([Q(s0, a), Q(s1, a), Q(s1, b), Q(s0, b)], colour));
  };
  across(0, 1, -0.15, 0.15, PACK.yellow);
  for (let s = 1.66; s + 1.67 <= len; s += 5) for (const o of [(half - 0.6) / 2, -(half - 0.6) / 2]) across(s / len, (s + 1.67) / len, o - 0.1, o + 0.1, PACK.white);
  // White barriers on both edges (both faces, so they show from the road and from the deck).
  for (const side of [half, -half]) {
    const inner = side - Math.sign(side) * 0.3;
    parts.push(quad([P(0, side, 0), P(1, side, 0), P(1, side, 1.1), P(0, side, 1.1)], PACK.barrier));
    parts.push(quad([P(0, inner, 1.1), P(1, inner, 1.1), P(1, inner, 0), P(0, inner, 0)], PACK.barrier));
    parts.push(quad([P(0, side, 1.1), P(1, side, 1.1), P(1, inner, 1.1), P(0, inner, 1.1)], PACK.barrier));
  }
  return merge(parts);
}
