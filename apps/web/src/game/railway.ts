// The railway (owner, 28 Oct 2026: "i cant see the rail way at circle"): the real Accra lines from the
// map tiles (the same tiles the buildings come from, so nothing new to download), as track on the
// ground: a gravel bed, sleepers across it and two steel rails. One shape per map tile, flat colours,
// no textures, about 2 triangles a metre: cheap enough for the Light tier.
import * as THREE from 'three';
import type { StreetLine } from './streetBuildings';

const BED_HALF = 1.6; // the gravel bed, metres either side of the middle
const GAUGE_HALF = 0.53; // Ghana's lines are 1.067 m gauge
const RAIL_W = 0.07;
const RAIL_H = 0.14;
const SLEEPER_EVERY = 0.7;
const SLEEPER_HALF = 1.15;
const SLEEPER_W = 0.24;

const BED = new THREE.Color('#7a6f66');
const SLEEPER = new THREE.Color('#5b5048');
const STEEL = new THREE.Color('#8d8f93');
const STEEL_TOP = new THREE.Color('#c9ccd1');

export class Railway {
  readonly group = new THREE.Group();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  /** Track pieces in local metres (for tests and for keeping things off the line). */
  readonly lines: Float32Array[] = [];

  add(rails: StreetLine[]) {
    const pos: number[] = [];
    const col: number[] = [];
    const quad = (a: number[], b: number[], c: number[], d: number[], colour: THREE.Color) => {
      for (const p of [a, b, c, a, c, d]) {
        pos.push(p[0], p[1], p[2]);
        col.push(colour.r, colour.g, colour.b);
      }
    };
    for (const line of rails) {
      const p = line.pts;
      if (p.length < 4) continue;
      this.lines.push(p);
      let carry = 0; // how far into the sleeper spacing the next piece starts
      for (let i = 0; i + 3 < p.length; i += 2) {
        const [ax, az, bx, bz] = [p[i], p[i + 1], p[i + 2], p[i + 3]];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        const fx = (bx - ax) / len, fz = (bz - az) / len; // along
        const rx = -fz, rz = fx; // across
        const at = (s: number, off: number, y: number) => [ax + fx * s + rx * off, y, az + fz * s + rz * off];
        // The gravel bed (a little longer each end, so the bends have no gaps).
        const e = Math.min(0.4, len / 2);
        quad(at(-e, -BED_HALF, 0.03), at(-e, BED_HALF, 0.03), at(len + e, BED_HALF, 0.03), at(len + e, -BED_HALF, 0.03), BED);
        // Sleepers across it.
        for (let s = SLEEPER_EVERY - carry; s < len; s += SLEEPER_EVERY) {
          quad(at(s - SLEEPER_W / 2, -SLEEPER_HALF, 0.07), at(s - SLEEPER_W / 2, SLEEPER_HALF, 0.07), at(s + SLEEPER_W / 2, SLEEPER_HALF, 0.07), at(s + SLEEPER_W / 2, -SLEEPER_HALF, 0.07), SLEEPER);
        }
        carry = (carry + len) % SLEEPER_EVERY;
        // The two rails: a bright worn top and the two sides.
        for (const side of [-GAUGE_HALF, GAUGE_HALF]) {
          const l = side - RAIL_W / 2, r = side + RAIL_W / 2, top = 0.07 + RAIL_H, low = 0.07;
          const s0 = -Math.min(0.05, e), s1 = len + Math.min(0.05, e);
          quad(at(s0, l, top), at(s0, r, top), at(s1, r, top), at(s1, l, top), STEEL_TOP);
          quad(at(s0, l, low), at(s0, l, top), at(s1, l, top), at(s1, l, low), STEEL);
          quad(at(s0, r, top), at(s0, r, low), at(s1, r, low), at(s1, r, top), STEEL);
        }
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, this.mat);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  /** How far a point is from the nearest track middle (metres), up to `max`. */
  distance(x: number, z: number, max = 50) {
    let best = max;
    for (const p of this.lines) {
      for (let i = 0; i + 3 < p.length; i += 2) {
        const [ax, az, bx, bz] = [p[i], p[i + 1], p[i + 2], p[i + 3]];
        if (Math.min(ax, bx) - best > x || Math.max(ax, bx) + best < x || Math.min(az, bz) - best > z || Math.max(az, bz) + best < z) continue;
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
      }
    }
    return best;
  }
}
