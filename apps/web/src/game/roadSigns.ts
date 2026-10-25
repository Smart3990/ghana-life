// Road signs, as in Accra:
//  - street-name plates on a pole at the pavement's edge (white on green, with the area below);
//  - big green direction signs before the main junctions, pointing to the nearest areas each way
//    ("← Kaneshie   ↑ Adabraka   Osu →").
// Each sign's words are painted on a small canvas, kept and reused; only the signs near the player
// are made (about twenty), so they cost very little.
import * as THREE from 'three';
import { box, merge, paint } from './vehicles3d';
import type { Junction } from './signals';

type Plate = { x: number; z: number; angle: number; name: string };
type Place = { name: string; x: number; z: number };

const textures = new Map<string, THREE.CanvasTexture>();
function signTexture(key: string, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  let t = textures.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!, w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textures.set(key, t);
  }
  return t;
}
const GREEN = '#0f6b3a';

function plateTexture(name: string, area: string) {
  return signTexture(`plate:${name}:${area}`, (g, w, h) => {
    g.fillStyle = GREEN;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2efe6';
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ffffff';
    g.font = '800 46px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(name, w / 2, 66, w - 40);
    g.font = '600 24px system-ui, sans-serif';
    g.fillStyle = '#d9efe0';
    g.fillText(area.toUpperCase(), w / 2, 104, w - 40);
  }, 512, 128);
}

function directionTexture(lines: [string, string][]) {
  return signTexture(`dir:${lines.map((l) => l.join('')).join('|')}`, (g, w, h) => {
    g.fillStyle = GREEN;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#ffffff';
    lines.forEach(([arrow, name], i) => {
      const y = 70 + i * 74;
      g.font = '900 54px system-ui, sans-serif';
      g.textAlign = 'left';
      g.fillText(arrow, 34, y);
      g.font = '800 50px system-ui, sans-serif';
      g.fillText(name, 110, y, w - 140);
    });
  }, 512, 60 + lines.length * 74);
}

const poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });

export class RoadSigns {
  readonly group = new THREE.Group();
  private last = { x: Infinity, z: Infinity, plates: -1, junctions: -1 };

  constructor(private places: Place[]) {}

  private nearestPlace(x: number, z: number, exclude = '') {
    let best = '';
    let bestD = Infinity;
    for (const p of this.places) {
      if (p.name === exclude) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) [best, bestD] = [p.name, d];
    }
    return best;
  }

  update(x: number, z: number, plates: Plate[], junctions: Junction[]) {
    if (Math.hypot(x - this.last.x, z - this.last.z) < 40 && plates.length === this.last.plates && junctions.length === this.last.junctions) return;
    this.last = { x, z, plates: plates.length, junctions: junctions.length };
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      (c as THREE.Mesh).geometry?.dispose();
    }
    // Street-name plates within 160 m (one per name per 120 m, so a street is not covered in them).
    const shown: Plate[] = [];
    for (const p of plates) {
      if (Math.hypot(p.x - x, p.z - z) > 160) continue;
      if (shown.some((o) => o.name === p.name && Math.hypot(o.x - p.x, o.z - p.z) < 120)) continue;
      shown.push(p);
      if (shown.length > 24) break;
    }
    for (const p of shown) {
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = Math.PI - p.angle;
      g.add(new THREE.Mesh(paint(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 6).translate(0, 1.45, 0), '#8a8f94'), poleMat));
      const map = plateTexture(p.name, this.nearestPlace(p.x, p.z));
      const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.6, side: THREE.DoubleSide });
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.33).translate(0, 2.7, 0.05), mat));
      this.group.add(g);
    }
    // Direction signs on the main arms of junctions within 250 m.
    for (const j of junctions) {
      if (Math.hypot(j.x - x, j.z - z) > 250) continue;
      for (const arm of j.arms) {
        if (Math.abs(Math.cos(arm.angle - j.axis)) <= 0.7) continue; // main road arms only
        // Drivers coming in along this arm face arm.angle + PI. What lies ahead, left and right?
        const facing = arm.angle + Math.PI;
        const look = (turn: number) => {
          const a = facing + turn;
          return this.nearestPlace(j.x + Math.sin(a) * 900, j.z - Math.cos(a) * 900);
        };
        const ahead = look(0);
        const left = look(-Math.PI / 2);
        const right = look(Math.PI / 2);
        const lines: [string, string][] = [];
        if (left) lines.push(['←', left]);
        if (ahead && ahead !== left) lines.push(['↑', ahead]);
        if (right && right !== left && right !== ahead) lines.push(['→', right]);
        if (!lines.length) continue;
        const map = directionTexture(lines);
        const w = 3.4;
        const h = (w * map.image.height) / map.image.width;
        // At the kerb on the drivers' right, about 45 m before the junction, facing them.
        const d = j.half + 45;
        const side = arm.half + 2.2;
        const sx = j.x + Math.sin(arm.angle) * d - Math.cos(arm.angle) * side;
        const sz = j.z - Math.cos(arm.angle) * d - Math.sin(arm.angle) * side;
        const g = new THREE.Group();
        g.position.set(sx, 0, sz);
        g.rotation.y = Math.PI - arm.angle; // its face looks back along the arm, at the traffic coming in
        g.add(new THREE.Mesh(merge([
          paint(box(0.1, 3.2 + h, 0.1, -w / 2 + 0.3, (3.2 + h) / 2, -0.06), '#8a8f94'),
          paint(box(0.1, 3.2 + h, 0.1, w / 2 - 0.3, (3.2 + h) / 2, -0.06), '#8a8f94'),
        ]), poleMat));
        g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, 3.2 + h / 2, 0), new THREE.MeshStandardMaterial({ map, roughness: 0.5, side: THREE.DoubleSide })));
        this.group.add(g);
      }
    }
  }
}
