// The real places of the city, from the map: filling stations, bus stops, banks, pharmacies,
// churches, mosques, schools, clinics, hotels, chop bars, markets, police stations and more, where
// they really are. Filling stations are built in 3D (canopy, pumps, price board); bus stops get a
// shelter; the rest get a signboard at the roadside in front of the place, saying what it is.
// Names on signs are what the place is ("PHARMACY", "CHURCH") or our own made-up brands, never the
// real business's name or logo (no real brands without permission).
import * as THREE from 'three';
import { addCutout } from './cutout';
import { box, merge, paint } from './vehicles3d';
import type { Poi } from './streetBuildings';

// Map kinds -> what the sign says (and its colours).
const SIGNS: { kinds: string[]; label: string; sub: string; bg: string; ink: string }[] = [
  { kinds: ['bank', 'bureau_de_change', 'money_transfer'], label: 'ADINKRA BANK', sub: 'Banking · Forex', bg: '#1f3f8a', ink: '#ffffff' },
  { kinds: ['atm'], label: 'ATM', sub: 'Cash 24 hours', bg: '#1f3f8a', ink: '#f2c21a' },
  { kinds: ['pharmacy', 'chemist'], label: 'PHARMACY', sub: 'Drugs · Health care', bg: '#ffffff', ink: '#0f8a3a' },
  { kinds: ['church'], label: 'CHURCH', sub: 'All are welcome', bg: '#5a2a7a', ink: '#ffffff' },
  { kinds: ['mosque'], label: 'MOSQUE', sub: 'Masjid', bg: '#0f6b3a', ink: '#ffffff' },
  { kinds: ['school', 'kindergarten', 'college', 'university', 'driving_school'], label: 'SCHOOL', sub: 'Knowledge is power', bg: '#8e1b1b', ink: '#ffffff' },
  { kinds: ['hospital', 'clinic', 'doctors', 'dentist'], label: 'CLINIC', sub: 'Outpatients · Lab', bg: '#ffffff', ink: '#c8102e' },
  { kinds: ['hotel', 'guest_house', 'hostel'], label: 'HOTEL', sub: 'Rooms available', bg: '#121a14', ink: '#e3a92b' },
  { kinds: ['fast_food', 'restaurant', 'cafe', 'bakery', 'pastry'], label: 'CHOP BAR', sub: 'Waakye · Banku · Fufu', bg: '#c2410c', ink: '#ffffff' },
  { kinds: ['hairdresser', 'beauty'], label: 'BARBERING & SALON', sub: 'Haircut · Braids', bg: '#2a2c33', ink: '#ffffff' },
  { kinds: ['marketplace'], label: 'MARKET', sub: 'Foodstuff · Provisions', bg: '#e3a92b', ink: '#121a14' },
  { kinds: ['police'], label: 'POLICE STATION', sub: 'Ghanaverse Police Service', bg: '#0b2a5a', ink: '#ffffff' },
  { kinds: ['fire_station'], label: 'FIRE STATION', sub: 'Emergency', bg: '#c8102e', ink: '#ffffff' },
  { kinds: ['supermarket', 'convenience', 'department_store'], label: 'SUPERMARKET', sub: 'Provisions · Drinks', bg: '#2f8f57', ink: '#ffffff' },
  { kinds: ['mobile_money_agent'], label: 'MOBILE MONEY', sub: 'Cash in · Cash out', bg: '#f2c21a', ink: '#121a14' },
  { kinds: ['electronics', 'mobile_phone', 'computer'], label: 'PHONES & ELECTRONICS', sub: 'Repairs · Accessories', bg: '#121a14', ink: '#2dd4bf' },
  { kinds: ['clothes', 'tailor', 'boutique', 'shoes', 'fabric'], label: 'FASHION HOUSE', sub: 'Kente · Wax print · Sewing', bg: '#7a3fb0', ink: '#ffffff' },
  { kinds: ['post_office'], label: 'POST OFFICE', sub: 'Letters · Parcels', bg: '#c8442e', ink: '#ffffff' },
  { kinds: ['bus_station'], label: 'BUS TERMINAL', sub: 'Intercity buses', bg: '#0f6b3a', ink: '#ffffff' },
  { kinds: ['car_repair', 'tyres', 'car_parts', 'car'], label: 'FITTING SHOP', sub: 'Mechanic · Tyres · Spare parts', bg: '#3a3d42', ink: '#f2c21a' },
  { kinds: ['lottery', 'bookmaker', 'gambling'], label: 'LOTTO KIOSK', sub: 'Results daily', bg: '#e3a92b', ink: '#8e1b1b' },
  { kinds: ['bar', 'pub', 'nightclub'], label: 'DRINKING SPOT', sub: 'Cold drinks · Music', bg: '#121a14', ink: '#ff5a3c' },
  { kinds: ['copyshop', 'print_shop', 'stationery', 'books'], label: 'PRINTING & BOOKS', sub: 'Photocopy · Printing', bg: '#1f5fa8', ink: '#ffffff' },
  { kinds: ['hardware', 'paint', 'electrician'], label: 'HARDWARE', sub: 'Building materials', bg: '#e3a92b', ink: '#121a14' },
];
const ROWS = SIGNS.length;
const signFor = (p: Poi) => {
  let kind = p.kind;
  if (kind === 'place_of_worship') kind = /mosque|masjid|islam|jamia|muslim/i.test(p.name) ? 'mosque' : 'church';
  return SIGNS.findIndex((s) => s.kinds.includes(kind));
};

function signAtlas() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128 * ROWS;
  const g = c.getContext('2d')!;
  SIGNS.forEach((s, r) => {
    const y = (ROWS - 1 - r) * 128;
    g.fillStyle = s.bg;
    g.fillRect(0, y, 512, 128);
    g.strokeStyle = s.ink;
    g.lineWidth = 6;
    g.strokeRect(6, y + 6, 500, 116);
    g.fillStyle = s.ink;
    g.textAlign = 'center';
    g.font = '900 50px system-ui, sans-serif';
    g.fillText(s.label, 256, y + 64, 480);
    g.font = '700 24px system-ui, sans-serif';
    g.fillText(s.sub, 256, y + 102, 480);
    if (s.label === 'PHARMACY' || s.label === 'CLINIC') {
      g.fillStyle = s.ink;
      g.fillRect(28, y + 40, 44, 14);
      g.fillRect(43, y + 25, 14, 44);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function fuelSignTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0f6b3a';
  g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#f2c21a';
  g.beginPath();
  g.arc(128, 96, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0f6b3a';
  g.font = '900 46px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('SIKA', 128, 92);
  g.font = '900 30px system-ui, sans-serif';
  g.fillText('OIL', 128, 126);
  g.fillStyle = '#121a14';
  g.fillRect(16, 190, 224, 300);
  g.font = '800 30px system-ui, sans-serif';
  g.fillStyle = '#f2efe6';
  g.textAlign = 'left';
  [['SUPER', '14.90'], ['DIESEL', '15.20'], ['GAS', '11.40']].forEach(([n, v], i) => {
    g.fillStyle = '#f2efe6';
    g.fillText(n, 30, 250 + i * 90);
    g.fillStyle = '#ff9f1c';
    g.font = '900 34px ui-monospace, monospace';
    g.fillText('₵' + v, 120, 250 + i * 90);
    g.font = '800 30px system-ui, sans-serif';
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A filling station, its front (+z) facing the road: canopy on four columns, two pump islands,
// a small shop at the back, and a tall price board at the roadside corner.
function fuelStation() {
  const parts: THREE.BufferGeometry[] = [
    paint(new THREE.PlaneGeometry(22, 18).rotateX(-Math.PI / 2).translate(0, 0.03, 1), '#9a958c'), // forecourt
    paint(box(14, 0.6, 9, 0, 5.3, 1), '#f2efe6'), // canopy
    paint(box(14.05, 0.25, 9.05, 0, 5.05, 1), '#0f6b3a'), // its green band
    paint(box(14.06, 0.12, 9.06, 0, 5.32, 1), '#f2c21a'),
    paint(box(8, 3.4, 4, 0, 1.7, -7), '#e9e4d6'), // the shop
    paint(box(8.2, 0.3, 4.2, 0, 3.55, -7), '#0f6b3a'),
    paint(box(3, 2.2, 0.05, 0, 1.3, -4.97), '#26343e'), // its window
  ];
  for (const x of [-5, 5]) for (const z of [-2, 4]) parts.push(paint(box(0.4, 5, 0.4, x, 2.5, z), '#d9d2c2'));
  for (const x of [-3, 3]) {
    parts.push(paint(box(1.2, 0.25, 5, x, 0.12, 1), '#c9c4b8')); // island
    for (const z of [-0.5, 2.5]) {
      parts.push(paint(box(0.7, 1.6, 0.5, x, 1.05, z), '#f2efe6')); // pump
      parts.push(paint(box(0.72, 0.35, 0.52, x, 1.7, z), '#0f6b3a'));
      parts.push(paint(box(0.4, 0.25, 0.02, x, 1.3, z + 0.26), '#121a14')); // its display
    }
  }
  parts.push(paint(box(0.3, 7, 0.3, 9, 3.5, 8.5), '#5d5a55')); // price board pole
  return merge(parts);
}

function busShelter() {
  return merge([
    paint(box(3.4, 0.08, 1.6, 0, 2.5, 0, -0.05), '#8f959b'),
    paint(box(0.08, 2.5, 0.08, -1.6, 1.25, -0.6), '#5d5a55'),
    paint(box(0.08, 2.5, 0.08, 1.6, 1.25, -0.6), '#5d5a55'),
    paint(box(3.2, 1.6, 0.05, 0, 1.3, -0.7), '#2f8f57'), // the back panel
    paint(box(2.8, 0.1, 0.4, 0, 0.5, -0.4), '#6b4a2e'), // bench
    paint(box(0.06, 2.9, 0.06, 1.9, 1.45, 0.4), '#8a8f94'), // the stop sign pole
    paint(box(0.5, 0.5, 0.04, 1.9, 2.95, 0.4), '#1f5fa8'),
  ]);
}

const SIGN_POSTS = merge([paint(box(0.12, 2.4, 0.12, -1.3, 1.2, -0.05), '#5d5a55'), paint(box(0.12, 2.4, 0.12, 1.3, 1.2, -0.05), '#5d5a55')]);

type Placed = { kind: 'fuel' | 'stop' | 'sign'; x: number; z: number; face: number; row: number };

export class Places {
  readonly group = new THREE.Group();
  private all: Placed[] = [];
  private seen = new Set<string>();
  private fuel: THREE.InstancedMesh;
  private fuelBoards: THREE.InstancedMesh;
  private stops: THREE.InstancedMesh;
  private posts: THREE.InstancedMesh;
  private boards: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private last = { x: Infinity, z: Infinity, n: -1 };

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
    addCutout(mat);
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, n: number) => {
      const mesh = new THREE.InstancedMesh(g, m, n);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    this.fuel = mk(fuelStation(), mat, 12);
    this.fuelBoards = mk(new THREE.PlaneGeometry(2.4, 4.8).translate(9, 5.4, 8.68), new THREE.MeshBasicMaterial({ map: fuelSignTexture(), side: THREE.DoubleSide }), 12);
    this.stops = mk(busShelter(), mat, 40);
    this.posts = mk(SIGN_POSTS, mat, 80);
    // The signs: one picture with every kind of sign, one row each; double-sided so it reads from both ways.
    const sg = new THREE.BufferGeometry();
    const pos: number[] = [];
    const uv: number[] = [];
    for (const side of [1, -1]) {
      const z = side * 0.03;
      const q = [[-1.5, 1.8], [1.5, 1.8], [1.5, 2.7], [-1.5, 2.7]];
      const u = side > 0 ? [0, 1, 1, 0] : [1, 0, 0, 1];
      const order = side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of order) {
        pos.push(q[k][0], q[k][1], z);
        uv.push(u[k], k >= 2 ? 1 : 0);
      }
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    sg.computeVertexNormals();
    sg.setAttribute('aRow', new THREE.InstancedBufferAttribute(new Float32Array(80), 1));
    const boardMat = new THREE.MeshStandardMaterial({ map: signAtlas(), roughness: 0.6 });
    boardMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aRow;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv.y = (vMapUv.y + aRow) / ' + ROWS.toFixed(1) + ';');
    };
    this.boards = mk(sg, boardMat, 80);
  }

  /**
   * New places from a tile. place(x, z) finds where the thing can stand (at the roadside in front
   * of the place) and which way it faces, or null.
   */
  add(pois: Poi[], place: (x: number, z: number, kind: 'fuel' | 'stop' | 'sign') => { x: number; z: number; face: number } | null) {
    for (const p of pois) {
      const key = `${p.kind}:${Math.round(p.x)}:${Math.round(p.z)}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      const kind = p.kind === 'fuel' ? 'fuel' : p.kind === 'bus_stop' ? 'stop' : signFor(p) >= 0 ? 'sign' : null;
      if (!kind) continue;
      // Not two of the same too close together (the map often has a place twice).
      if (this.all.some((o) => o.kind === kind && Math.hypot(o.x - p.x, o.z - p.z) < (kind === 'fuel' ? 40 : 12))) continue;
      const at = place(p.x, p.z, kind);
      if (!at) continue;
      this.all.push({ kind, x: at.x, z: at.z, face: at.face, row: kind === 'sign' ? signFor(p) : 0 });
    }
    this.last.n = -1;
  }

  /** Every place found so far, with what it is (for the big map). */
  list() {
    return this.all.map((p) => ({ x: p.x, z: p.z, kind: p.kind === 'fuel' ? 'FILLING STATION' : p.kind === 'stop' ? 'BUS STOP' : SIGNS[p.row].label }));
  }

  /** Filling stations near a point (to keep other things off their forecourts). */
  fuelNear(x: number, z: number, r: number) {
    return this.all.filter((p) => p.kind === 'fuel' && Math.hypot(p.x - x, p.z - z) < r);
  }

  /** Is something solid here (the canopy columns, pumps and the shop of a filling station, shelters)? */
  solid(x: number, z: number, room: number) {
    for (const p of this.all) {
      const dx = x - p.x;
      const dz = z - p.z;
      if (Math.abs(dx) > 14 || Math.abs(dz) > 14) continue;
      // Into the place's own directions: u across, v towards the road.
      const c = Math.cos(p.face);
      const s = Math.sin(p.face);
      const u = -(dx * c + dz * s); // across (the model's +x)
      const v = dx * s - dz * c; // towards the road (the model's +z)
      if (p.kind === 'fuel') {
        if (Math.abs(u) < 4 + room && v > -9 - room && v < -5 + room) return true; // shop
        for (const ix of [-3, 3]) if (Math.abs(u - ix) < 0.6 + room && Math.abs(v - 1) < 2.5 + room) return true; // pump islands
        for (const cx of [-5, 5]) for (const cz of [-2, 4]) if (Math.hypot(u - cx, v - cz) < 0.3 + room) return true;
      } else if (p.kind === 'stop') {
        if (Math.abs(u) < 1.7 + room && Math.abs(v + 0.6) < 0.2 + room) return true;
      }
    }
    return false;
  }

  update(x: number, z: number) {
    if (Math.hypot(x - this.last.x, z - this.last.z) < 30 && this.last.n === this.all.length) return;
    this.last = { x, z, n: this.all.length };
    const near = this.all.filter((p) => Math.hypot(p.x - x, p.z - z) < 320).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const c = { fuel: 0, stop: 0, sign: 0 };
    const rows = this.boards.geometry.getAttribute('aRow') as THREE.InstancedBufferAttribute;
    for (const p of near) {
      this.q.setFromAxisAngle(this.up, Math.PI - p.face);
      this.m.compose(this.p.set(p.x, 0, p.z), this.q, this.one);
      if (p.kind === 'fuel' && c.fuel < 12) {
        this.fuel.setMatrixAt(c.fuel, this.m);
        this.fuelBoards.setMatrixAt(c.fuel++, this.m);
      } else if (p.kind === 'stop' && c.stop < 40) this.stops.setMatrixAt(c.stop++, this.m);
      else if (p.kind === 'sign' && c.sign < 80) {
        this.posts.setMatrixAt(c.sign, this.m);
        this.boards.setMatrixAt(c.sign, this.m);
        rows.setX(c.sign++, p.row);
      }
    }
    this.fuel.count = this.fuelBoards.count = c.fuel;
    this.stops.count = c.stop;
    this.posts.count = this.boards.count = c.sign;
    for (const m of [this.fuel, this.fuelBoards, this.stops, this.posts, this.boards]) m.instanceMatrix.needsUpdate = true;
    rows.needsUpdate = true;
  }
}
