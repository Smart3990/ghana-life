// Flyovers: the map marks some roads as bridges (at Circle, the Kwame Nkrumah Interchange's ring
// road decks and slip roads). Here they are built in 3D: a concrete deck about 7 m up, with low
// walls along both edges, standing on round pillars, sloping down to the ground where a bridge ends
// without joining another one. Nothing drives on them yet; they are scenery that tells you where you are.
import * as THREE from 'three';
import { paint, merge } from './vehicles3d';

const HIGH = 7; // deck height, metres
const SLOPE = 0.11; // how steeply the ends come down
const PILLAR_EVERY = 24;

type Line = { pts: Float32Array; half: number };

export class Flyovers {
  readonly group = new THREE.Group();
  private lines: Line[] = [];
  private mesh: THREE.Mesh | null = null;
  private material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  private dirty = false;
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

  /** Rebuild the flyovers if new ones arrived (cheap: a few dozen pieces). */
  update() {
    if (!this.dirty) return;
    this.dirty = false;
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const parts: THREE.BufferGeometry[] = [];
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
      for (let i = 0; i + 1 < n; i++) {
        const [x1, z1, x2, z2] = [l.pts[i * 2], l.pts[i * 2 + 1], l.pts[i * 2 + 2], l.pts[i * 2 + 3]];
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.3) continue;
        const h1 = height(cum[i]);
        const h2 = height(cum[i + 1]);
        parts.push(deckPiece(x1, z1, h1, x2, z2, h2, half));
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
    if (!parts.length) return;
    this.mesh = new THREE.Mesh(merge(parts), this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
  }
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
