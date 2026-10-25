// Street-level buildings: real 3D walls and roofs for the buildings near the player, built from the
// same map tiles the map already downloads (so nothing new to download). The windows, doors and shop
// shutters are drawn by the graphics card from each wall's size (no textures), in Accra wall colours,
// with a little dust near the ground. The footprints also stop the player walking through walls.
//
// Work is spread over frames (a few milliseconds each) so loading new streets never makes the game stutter.
import * as THREE from 'three';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const Z = 15; // the most detailed tiles
const EXTENT = 4096;
const CELL_M = 160; // buildings are grouped in squares this size: one draw each
const BUDGET_MS = 5; // time per frame for building new streets
const FLOOR_M = 3.2;

// Same colours and guessed heights as the overview map (style.ts), so both views agree.
const WALLS = ['#f1e3c8', '#faf7f0', '#f3dc9a', '#efc3a4', '#cfe2ee', '#d6e9cf', '#e6d2b3'];
const ROOFS = ['#8b5a43', '#a9afb5', '#6d7379', '#b75a3c', '#5d7f9b'];

type LngLat = [number, number];
type ToLocal = (lng: number, lat: number) => [number, number];
type Footprint = { ring: Float32Array; minX: number; maxX: number; minZ: number; maxZ: number };
/** A road from the tiles, in local metres: kind is the map's road kind (major_road, minor_road, ...). */
// edge: a lane, service road or flyover. It only keeps stalls and trees off its tarmac (no traffic, no pavements).
export type StreetLine = { kind: string; pts: Float32Array; edge?: boolean; bridge?: boolean; name?: string };
/** The middle of a roof: where tanks and signs can go. */
export type Roof = { x: number; z: number; top: number; id: number };
/** A place from the map (a filling station, bank, school...): its kind, name and where it is. */
export type Poi = { kind: string; name: string; x: number; z: number };
export type StreetsListener = (roads: StreetLine[], roofs: Roof[], pois: Poi[]) => void;

/** The part of the piece from (ax, ay) to (bx, by) inside the tile, and whether it leaves the tile at its end. */
function clipToTile(ax: number, ay: number, bx: number, by: number): [number, number, number, number, boolean] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  for (const [p, q] of [[-dx, ax], [dx, EXTENT - ax], [-dy, ay], [dy, EXTENT - ay]]) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  if (t0 > t1) return null;
  return [ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1, t1 < 1];
}
const tileX = (lng: number) => Math.floor(((lng + 180) / 360) * 2 ** Z);
const tileY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** Z);
};
const lngOf = (x: number) => (x / 2 ** Z) * 360 - 180;
const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z))) * 180) / Math.PI;

// Keeps the part of a ring inside the tile, so buildings repeated in a tile's border are not drawn twice.
function clip(ring: { x: number; y: number }[]) {
  let pts = ring.map((p) => [p.x, p.y]);
  const edges: [number, number, boolean][] = [[0, 0, true], [0, EXTENT, false], [1, 0, true], [1, EXTENT, false]];
  for (const [axis, value, keepAbove] of edges) {
    const out: number[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const inA = keepAbove ? a[axis] >= value : a[axis] <= value;
      const inB = keepAbove ? b[axis] >= value : b[axis] <= value;
      if (inA) out.push(a);
      if (inA !== inB) {
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts = out;
    if (pts.length < 3) return [];
  }
  return pts;
}

// A plot cleared of the map's buildings (Uncle Kwame's compound stands there): centre, its turn, and
// half its size. Buildings there are not drawn and do not block.
const CLEAR = { a: { value: new THREE.Vector4(0, 0, 1, 0) }, b: { value: new THREE.Vector4(0, 0, 0, 0) } };

// The wall material: lit like everything else, with windows, doors and shutters painted in by the shader.
function wallMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uClearA = CLEAR.a;
    shader.uniforms.uClearB = CLEAR.b;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute vec3 facade;\nvarying vec3 vFacade;\nvarying vec2 vClearP;\nvoid main() {\n  vFacade = facade;\n  vClearP = position.xz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying vec3 vFacade;
varying vec2 vClearP;
uniform vec4 uClearA;
uniform vec4 uClearB;
void main() {
  if (uClearB.z > 0.5) {
    vec2 d = vClearP - uClearA.xy;
    float cu = -(d.x * uClearA.z + d.y * uClearA.w);
    float cv = d.x * uClearA.w - d.y * uClearA.z;
    if (abs(cu) < uClearB.x && abs(cv) < uClearB.y) discard;
  }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  // facade: x = metres along the wall, y = metres up, z = wall length (0 = roof)
  float wallLen = vFacade.z;
  if (wallLen > 0.0) {
    float bays = floor(wallLen / ${FLOOR_M.toFixed(1)});
    float start = (wallLen - bays * ${FLOOR_M.toFixed(1)}) * 0.5;
    float u = vFacade.x - start;
    float cellU = fract(u / ${FLOOR_M.toFixed(1)}) * ${FLOOR_M.toFixed(1)};
    float bay = floor(u / ${FLOOR_M.toFixed(1)});
    float floorNo = floor(vFacade.y / ${FLOOR_M.toFixed(1)});
    float cellV = vFacade.y - floorNo * ${FLOOR_M.toFixed(1)};
    bool inBays = u > 0.0 && bay < bays && bays >= 1.0;
    vec3 wall = diffuseColor.rgb;
    // Dust and rain marks: darker near the ground, a little under each floor line.
    wall *= mix(0.72, 1.0, smoothstep(0.0, 0.9, vFacade.y));
    wall *= 1.0 - 0.06 * smoothstep(0.25, 0.0, abs(cellV - 0.1));
    if (inBays) {
      float hash = fract(sin(dot(vec2(bay, floorNo) + floor(wallLen * 7.0), vec2(12.9898, 78.233))) * 43758.5453);
      if (floorNo < 0.5) {
        // Ground floor: shop shutters or a door and window.
        if (hash < 0.55) {
          float shutter = step(0.35, cellU) * step(cellU, 2.85) * step(0.05, cellV) * step(cellV, 2.35);
          float ribs = 0.85 + 0.15 * step(0.5, fract(cellV * 9.0));
          vec3 metal = mix(vec3(0.42, 0.44, 0.46), vec3(0.55, 0.32, 0.22), step(0.3, hash)) * ribs;
          wall = mix(wall, metal, shutter);
        } else {
          float door = step(0.4, cellU) * step(cellU, 1.3) * step(0.0, cellV) * step(cellV, 2.2);
          float win = step(1.7, cellU) * step(cellU, 2.8) * step(1.0, cellV) * step(cellV, 2.1);
          wall = mix(wall, vec3(0.33, 0.2, 0.13), door);
          wall = mix(wall, vec3(0.12, 0.15, 0.17), win);
        }
      } else {
        // Upper floors: a window with a frame and louvres in most bays.
        float frame = step(0.7, cellU) * step(cellU, 2.5) * step(0.9, cellV) * step(cellV, 2.35);
        float glass = step(0.8, cellU) * step(cellU, 2.4) * step(1.0, cellV) * step(cellV, 2.25);
        float louvres = 0.75 + 0.25 * step(0.5, fract(cellV * 7.0));
        vec3 pane = hash < 0.5 ? vec3(0.13, 0.16, 0.19) : vec3(0.22, 0.27, 0.3) * louvres;
        wall = mix(wall, vec3(0.92, 0.92, 0.9), frame * step(0.15, hash));
        wall = mix(wall, pane, glass * step(0.15, hash));
      }
    }
    diffuseColor.rgb = wall;
  }`,
      );
  };
  m.customProgramCacheKey = () => 'ghanaverse-walls';
  return m;
}

type Cell = { key: string; mesh: THREE.Mesh | null; footprints: Footprint[] };

export class StreetBuildings {
  readonly group = new THREE.Group();
  private material = wallMaterial();
  private cells = new Map<string, Cell>();
  private tiles = new Set<string>();
  private queue: (() => void)[] = [];
  // Collected per cell while a tile is being built.
  private pending = new Map<string, { pos: number[]; nor: number[]; col: number[]; fac: number[]; footprints: Footprint[] }>();

  private roofs: Roof[] = [];

  constructor(
    private toLocal: ToLocal,
    private radiusM: number,
    private onStreets?: StreetsListener,
  ) {}

  /** Call every frame with the player's position. */
  update(lngLat: LngLat, x: number, z: number) {
    this.request(lngLat, x, z);
    const start = performance.now();
    while (this.queue.length && performance.now() - start < BUDGET_MS) this.queue.shift()!();
    // Only the nearby squares are drawn; the fog hides the edge.
    for (const cell of this.cells.values()) {
      if (!cell.mesh) continue;
      const c = cell.mesh.userData.centre as THREE.Vector2;
      cell.mesh.visible = Math.hypot(c.x - x, c.y - z) < this.radiusM + CELL_M * 0.75;
    }
  }

  // Loads the tile under the player, and its neighbours when the player is near an edge.
  private request([lng, lat]: LngLat, x: number, z: number) {
    const tx = tileX(lng);
    const ty = tileY(lat);
    const want = [[tx, ty]];
    const fx = ((lng + 180) / 360) * 2 ** Z - tx;
    const r = (lat * Math.PI) / 180;
    const fy = ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** Z - ty;
    const near = 0.35; // a z15 tile here is about 1.2 km, so this is about 400 m
    const dx = fx < near ? -1 : fx > 1 - near ? 1 : 0;
    const dy = fy < near ? -1 : fy > 1 - near ? 1 : 0;
    if (dx) want.push([tx + dx, ty]);
    if (dy) want.push([tx, ty + dy]);
    if (dx && dy) want.push([tx + dx, ty + dy]);
    for (const [wx, wy] of want) this.want(wx, wy);
    void x;
    void z;
  }
  private want(tx: number, ty: number) {
    const key = `${tx}/${ty}`;
    if (this.tiles.has(key)) return;
    this.tiles.add(key);
    this.inflight++;
    void this.load(tx, ty).finally(() => this.inflight--);
  }
  private inflight = 0;
  /** Loads every tile within `radiusM` of a place now (say, where the story is about to take you). */
  loadAround([lng, lat]: LngLat, radiusM: number) {
    const dLat = radiusM / 111195;
    const dLng = dLat / Math.cos((lat * Math.PI) / 180);
    for (let tx = tileX(lng - dLng); tx <= tileX(lng + dLng); tx++) for (let ty = tileY(lat + dLat); ty <= tileY(lat - dLat); ty++) this.want(tx, ty);
  }

  private async load(tx: number, ty: number) {
    let tile: VectorTile;
    try {
      const res = await fetch(`/tiles/accra/${Z}/${tx}/${ty}.pbf`);
      if (!res.ok) return;
      tile = new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer())));
    } catch {
      return; // no buildings here: the map still shows the streets
    }
    const layer = tile.layers.buildings;
    if (!layer) return;
    const west = lngOf(tx);
    const east = lngOf(tx + 1);
    const north = latOf(ty);
    const south = latOf(ty + 1);
    const toLngLat = (px: number, py: number): LngLat => [west + (px / EXTENT) * (east - west), north + (py / EXTENT) * (south - north)];
    // One small job per few buildings, run within the frame budget.
    const BATCH = 40;
    for (let i = 0; i < layer.length; i += BATCH) {
      this.queue.push(() => {
        for (let k = i; k < Math.min(layer.length, i + BATCH); k++) this.addBuilding(layer.feature(k), toLngLat);
      });
    }
    this.queue.push(() => this.finish());
    // Then the roads of this tile, for trees, lights, kiosks and people on the pavements.
    const roadsLayer = tile.layers.roads;
    if (roadsLayer && this.onStreets) {
      this.queue.push(() => {
        const roads: StreetLine[] = [];
        for (let i = 0; i < roadsLayer.length; i++) {
          const f = roadsLayer.feature(i);
          const kind = String(f.properties.kind);
          if (!['highway', 'major_road', 'minor_road', 'other'].includes(kind) || f.properties.is_tunnel) continue;
          const edge = kind === 'other' || !!f.properties.is_bridge;
          for (const line of f.loadGeometry()) {
            // Only the part inside this tile (the border is repeated in the next tile).
            let run: number[] = [];
            const flush = () => {
              if (run.length >= 4) roads.push({ kind, pts: new Float32Array(run), edge, bridge: !!f.properties.is_bridge, name: f.properties.name ? String(f.properties.name) : undefined });
              run = [];
            };
            // Each piece is cut exactly at the tile's border (a long straight road can cross it in
            // one piece, which would otherwise be lost from both tiles).
            const put = (x: number, y: number) => {
              const [lx, lz] = this.toLocal(...toLngLat(x, y));
              if (run.length < 2 || run[run.length - 2] !== lx || run[run.length - 1] !== lz) run.push(lx, lz);
            };
            for (let i = 1; i < line.length; i++) {
              const cut = clipToTile(line[i - 1].x, line[i - 1].y, line[i].x, line[i].y);
              if (!cut) {
                flush();
                continue;
              }
              put(cut[0], cut[1]);
              put(cut[2], cut[3]);
              if (cut[4]) flush(); // it leaves the tile here
            }
            flush();
          }
        }
        const roofs = this.roofs;
        this.roofs = [];
        const pois: Poi[] = [];
        const poiLayer = tile.layers.pois;
        if (poiLayer) {
          for (let i = 0; i < poiLayer.length; i++) {
            const f = poiLayer.feature(i);
            if (f.type !== 1) continue; // points only
            const p = f.loadGeometry()[0]?.[0];
            if (!p || p.x < 0 || p.y < 0 || p.x > EXTENT || p.y > EXTENT) continue;
            const [x, z] = this.toLocal(...toLngLat(p.x, p.y));
            pois.push({ kind: String(f.properties.kind), name: f.properties.name ? String(f.properties.name) : '', x, z });
          }
        }
        this.onStreets!(roads, roofs, pois);
      });
    }
  }

  private addBuilding(f: ReturnType<VectorTile['layers'][string]['feature']>, toLngLat: (x: number, y: number) => LngLat) {
    const id = typeof f.id === 'number' ? f.id : 0;
    const height = typeof f.properties.height === 'number' ? f.properties.height : 4 + 3 * (id % 3);
    const base = typeof f.properties.min_height === 'number' ? f.properties.min_height : 0;
    const wallColour = new THREE.Color(WALLS[id % 7]);
    const roofColour = new THREE.Color(ROOFS[Math.floor(id / 7) % 5]);
    for (const polygon of f.loadGeometry().length ? [f.loadGeometry()] : []) {
      const rings = polygon
        .map(clip)
        .filter((r) => r.length >= 3)
        .map((r) => r.map(([px, py]) => this.toLocal(...toLngLat(px, py))));
      if (!rings.length) continue;
      // Group the rings into outer shapes and their holes (a vector tile lists each outer ring before its holes).
      const shapes: { outer: [number, number][]; holes: [number, number][][] }[] = [];
      const area = (r: [number, number][]) => r.reduce((s, [x1, z1], i) => { const [x2, z2] = r[(i + 1) % r.length]; return s + (x1 * z2 - x2 * z1); }, 0) / 2;
      const outerSign = Math.sign(area(rings[0])) || 1;
      for (const r of rings) {
        if (Math.sign(area(r)) === outerSign || !shapes.length) shapes.push({ outer: r, holes: [] });
        else shapes[shapes.length - 1].holes.push(r);
      }
      for (const s of shapes) this.addShape(s.outer, s.holes, base, height, wallColour, roofColour);
    }
  }

  private addShape(outer: [number, number][], holes: [number, number][][], base: number, top: number, wall: THREE.Color, roof: THREE.Color) {
    let cx = 0;
    let cz = 0;
    for (const [x, z] of outer) [cx, cz] = [cx + x / outer.length, cz + z / outer.length];
    const key = `${Math.floor(cx / CELL_M)},${Math.floor(cz / CELL_M)}`;
    let p = this.pending.get(key);
    if (!p) this.pending.set(key, (p = { pos: [], nor: [], col: [], fac: [], footprints: [] }));

    const signedArea = (r: [number, number][]) => r.reduce((s, [x1, z1], i) => { const [x2, z2] = r[(i + 1) % r.length]; return s + (x1 * z2 - x2 * z1); }, 0);
    const walls = (ring: [number, number][], isHole: boolean) => {
      // Walls face away from the building's inside.
      const ccw = signedArea(ring) > 0;
      const flip = ccw !== isHole;
      for (let i = 0; i < ring.length; i++) {
        let [x1, z1] = ring[i];
        let [x2, z2] = ring[(i + 1) % ring.length];
        if (flip) [x1, z1, x2, z2] = [x2, z2, x1, z1];
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.05) continue;
        const nx = (z2 - z1) / len;
        const nz = -(x2 - x1) / len;
        const quad = [[x1, base, z1, 0, base], [x2, base, z2, len, base], [x2, top, z2, len, top], [x1, top, z1, 0, top]];
        for (const idx of [0, 2, 1, 0, 3, 2]) {
          const [x, y, z, u, v] = quad[idx];
          p!.pos.push(x, y, z);
          p!.nor.push(nx, 0, nz);
          p!.col.push(wall.r, wall.g, wall.b);
          p!.fac.push(u, v - base, len);
        }
      }
    };
    walls(outer, false);
    for (const h of holes) walls(h, true);

    // Flat roof (most Accra roofs read as flat from the street).
    const contour = outer.map(([x, z]) => new THREE.Vector2(x, z));
    const holeV = holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
    const pts = [...contour, ...holeV.flat()];
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, holeV)) {
      for (const idx of [a, c, b]) {
        p.pos.push(pts[idx].x, top, pts[idx].y);
        p.nor.push(0, 1, 0);
        p.col.push(roof.r, roof.g, roof.b);
        p.fac.push(0, 0, 0);
      }
    }
    // Remember the footprint for walking into walls (ground-floor buildings only).
    if (base < 1) {
      this.roofs.push({ x: cx, z: cz, top, id: Math.round(cx * 31 + cz * 17) });
      const ring = new Float32Array(outer.flat());
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of outer) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      p.footprints.push({ ring, minX, maxX, minZ, maxZ });
    }
  }

  // Turns everything collected for this tile into one mesh per square.
  private finish() {
    for (const [key, p] of this.pending) {
      let cell = this.cells.get(key);
      if (!cell) this.cells.set(key, (cell = { key, mesh: null, footprints: [] }));
      cell.footprints.push(...p.footprints);
      if (!p.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
      g.setAttribute('facade', new THREE.Float32BufferAttribute(p.fac, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.material);
      mesh.castShadow = mesh.receiveShadow = true; // used only where shadows are switched on
      const [cx, cz] = key.split(',').map((n) => (Number(n) + 0.5) * CELL_M);
      mesh.userData.centre = new THREE.Vector2(cx, cz);
      if (cell.mesh) {
        // A square that spans two tiles: keep both parts.
        this.group.add(mesh);
        mesh.userData.centre = cell.mesh.userData.centre;
      } else {
        cell.mesh = mesh;
        this.group.add(mesh);
      }
    }
    this.pending.clear();
  }

  /** Clear a plot of the map's buildings (centre, the way it faces, half width and half depth). */
  clearPlot(x: number, z: number, face: number, halfW: number, halfD: number) {
    CLEAR.a.value.set(x, z, Math.cos(face), Math.sin(face));
    CLEAR.b.value.set(halfW, halfD, 1, 0);
    this.plot = { x, z, c: Math.cos(face), s: Math.sin(face), hw: halfW, hd: halfD };
  }
  private plot: { x: number; z: number; c: number; s: number; hw: number; hd: number } | null = null;
  private inPlot(x: number, z: number) {
    const p = this.plot;
    if (!p) return false;
    const dx = x - p.x;
    const dz = z - p.z;
    return Math.abs(-(dx * p.c + dz * p.s)) < p.hw && Math.abs(dx * p.s - dz * p.c) < p.hd;
  }

  /** True if the point (metres) is inside a building. */
  blocked(x: number, z: number, margin = 0.3) {
    if (this.inPlot(x, z)) return false;
    const cx = Math.floor(x / CELL_M);
    const cz = Math.floor(z / CELL_M);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const cell = this.cells.get(`${cx + i},${cz + j}`);
        if (!cell) continue;
        for (const f of cell.footprints) {
          if (x < f.minX - margin || x > f.maxX + margin || z < f.minZ - margin || z > f.maxZ + margin) continue;
          if (inside(f.ring, x, z) || nearEdge(f.ring, x, z, margin)) return true;
        }
      }
    }
    return false;
  }

  /** True while new streets are still being built. */
  get loading() {
    return this.queue.length > 0 || this.inflight > 0;
  }
}

function inside(ring: Float32Array, x: number, z: number) {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, zi, xj, zj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function nearEdge(ring: Float32Array, x: number, z: number, margin: number) {
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [ax, az, bx, bz] = [ring[j], ring[j + 1], ring[i], ring[i + 1]];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(ax + dx * t - x, az + dz * t - z) < margin) return true;
  }
  return false;
}
