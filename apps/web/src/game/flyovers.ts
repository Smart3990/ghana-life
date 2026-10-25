// Flyovers: the map marks some roads as bridges (at Circle, the Kwame Nkrumah Interchange's ring
// road decks and slip roads). Here they are built in 3D: a concrete deck about 7 m up, with low
// walls along both edges, standing on round pillars, sloping down to the ground where a bridge ends
// without joining another one. Nothing drives on them yet; they are scenery that tells you where you are.
import * as THREE from 'three';
import { paint, merge } from './vehicles3d';

const HIGH = 7; // deck height, metres
const SLOPE = 0.11; // how steeply the ends come down
const PILLAR_EVERY = 24;

type Line = { pts: Float32Array; half: number; heights?: Float32Array };

export class Flyovers {
  readonly group = new THREE.Group();
  private lines: Line[] = [];
  private mesh: THREE.Mesh | null = null;
  private material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  private dirty = false;
  private bannerMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  private banners: THREE.Mesh | null = null;
  private seen = new Set<string>();

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

  /** Rebuild the flyovers if new ones arrived (cheap: a few dozen pieces). */
  update() {
    if (!this.dirty) return;
    this.dirty = false;
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
        // Pillars under the high parts.
        for (let s = Math.ceil(cum[i] / PILLAR_EVERY) * PILLAR_EVERY; s < cum[i + 1]; s += PILLAR_EVERY) {
          const k = (s - cum[i]) / len;
          const h = height(s);
          if (h < 3) continue;
          const px = x1 + (x2 - x1) * k;
          const pz = z1 + (z2 - z1) * k;
          const pillar = new THREE.CylinderGeometry(0.75, 0.85, h - 0.9, 12).translate(px, (h - 0.9) / 2, pz);
          parts.push(paint(pillar, '#b9b6ae'));
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

export function deckHeightAt(lines: Line[], x: number, z: number) {
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
    quad([P(0, -half, 0), P(1, -half, 0), P(1, half, 0), P(0, half, 0)], '#4d4b47'), // tarmac (seen from above)
    quad([P(0, half, -1), P(1, half, -1), P(1, -half, -1), P(0, -half, -1)], '#a9a59c'), // underside
    quad([P(0, half, 0), P(1, half, 0), P(1, half, -1), P(0, half, -1)], '#c4c0b6'), // edges
    quad([P(0, -half, -1), P(1, -half, -1), P(1, -half, 0), P(0, -half, 0)], '#c4c0b6'),
  ];
  // Low concrete walls on both edges (both faces, so they show from the road and from the deck).
  for (const side of [half, -half]) {
    const inner = side - Math.sign(side) * 0.3;
    parts.push(quad([P(0, side, 0), P(1, side, 0), P(1, side, 0.9), P(0, side, 0.9)], '#d2cec4'));
    parts.push(quad([P(0, inner, 0.9), P(1, inner, 0.9), P(1, inner, 0), P(0, inner, 0)], '#cfcbc1'));
    parts.push(quad([P(0, side, 0.9), P(1, side, 0.9), P(1, inner, 0.9), P(0, inner, 0.9)], '#dedad0'));
  }
  return merge(parts);
}
