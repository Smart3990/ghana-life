// Street life: trees and palms, street lights, container kiosks, vendors' umbrellas, black polytanks
// on the roofs, and crowds of people on the pavements. Everything is placed from the real roads and
// buildings in the map tiles, the same way every time (fixed random numbers from positions).
//
// Cost: each kind of thing is one batched draw, refreshed only when the player has moved a fair way.
// People are drawn in big batches animated by the graphics card (crowd.ts).
import type { Arm, Junction } from './signals';
import * as THREE from 'three';
import { epicGeometry, epicGlowMaps, epicMaterial } from './epicKit';
import { slidingAdMaterial, twoSidedFace } from './adScreens';
import { AD_COUNT, adSheet } from './adPosters';
import { box, merge, paint, shadowTexture } from './vehicles3d';
import type { Roof, StreetLine } from './streetBuildings';
import { CrowdBatch, lookFor, MIX, type Clip, type CrowdBody, type Kind as PersonKind, type Look } from './crowd';
import { StreetScenes } from './streetScenes';

type Part = THREE.BufferGeometry;
type Spot = { x: number; z: number; angle: number; scale: number; colour: number };

// Road sizes (metres): must match the street style (src/map/streetStyle.ts).
const HALF: Record<string, { half: number; walk: number }> = {
  highway: { half: 7, walk: 2.5 },
  major_road: { half: 5, walk: 2.5 },
  minor_road: { half: 3.25, walk: 1.8 },
  other: { half: 2.4, walk: 0 }, // lanes and service roads (only kept clear, nothing placed along them)
};
const GUTTER = 0.55;

const hash = (a: number, b: number) => {
  let x = Math.imul(Math.floor(a * 10) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.floor(b * 10), 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 13), 0x27d4eb2d);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

// ---------- The things, built from simple shapes ----------

function neem(): Part {
  const leaf = ['#4f7a35', '#5e8a3c', '#476f30'];
  const parts: Part[] = [paint(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6).translate(0, 1.3, 0), '#6b4f37')];
  const blobs: [number, number, number, number][] = [[0, 3.6, 0, 1.7], [0.9, 3.2, 0.3, 1.2], [-0.8, 3.3, -0.4, 1.25], [0.2, 4.3, -0.5, 1.1]];
  blobs.forEach(([x, y, z, r], i) => parts.push(paint(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), leaf[i % 3])));
  return merge(parts);
}

function palm(): Part {
  const parts: Part[] = [];
  // A gently curved trunk from short sections.
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.CylinderGeometry(0.15, 0.19, 1.25, 6);
    seg.rotateZ(i * 0.035);
    seg.translate(i * 0.07, 0.62 + i * 1.2, 0);
    parts.push(paint(seg, i % 2 ? '#8a7356' : '#7c664b'));
  }
  for (let k = 0; k < 7; k++) {
    const frond = new THREE.ConeGeometry(0.35, 3.2, 3, 1);
    frond.rotateZ(Math.PI / 2 + 0.45);
    frond.translate(1.5, 0, 0);
    frond.rotateY((k / 7) * Math.PI * 2);
    frond.translate(0.42, 7.4, 0);
    parts.push(paint(frond, k % 2 ? '#5f8f3a' : '#4d7b31'));
  }
  return merge(parts);
}

// An electricity pole: a weathered concrete post with a crossbar and three insulators (the wires
// between poles are drawn separately).
function powerPole(): Part {
  return merge([
    paint(new THREE.CylinderGeometry(0.1, 0.14, 8.4, 6).translate(0, 4.2, 0), '#9a958b'),
    paint(box(1.5, 0.1, 0.1, 0, 7.6, 0), '#6b665e'),
    paint(box(0.08, 0.18, 0.08, -0.6, 7.74, 0), '#e9e5dc'),
    paint(box(0.08, 0.18, 0.08, 0, 7.74, 0), '#e9e5dc'),
    paint(box(0.08, 0.18, 0.08, 0.6, 7.74, 0), '#e9e5dc'),
  ]);
}

// A billboard: a wide screen (16:9, 7.2 x 4.05 m) in a thick dark frame on two strong legs, low
// enough to read from the street, with a small gold maker's tag on top. The adverts are separate
// pictures on both faces.
function billboardFrame(): Part {
  return merge([
    paint(box(0.36, 3.2, 0.36, -2.3, 1.6, -0.12), '#3a3b3e'),
    paint(box(0.36, 3.2, 0.36, 2.3, 1.6, -0.12), '#3a3b3e'),
    paint(box(0.9, 0.12, 0.9, -2.3, 0.06, -0.12), '#2a2b2e'), // the feet
    paint(box(0.9, 0.12, 0.9, 2.3, 0.06, -0.12), '#2a2b2e'),
    paint(box(7.7, 4.55, 0.3, 0, 5.0, -0.12), '#16171a'), // the frame
    paint(box(7.8, 0.14, 0.42, 0, 2.7, -0.12), '#2a2b2e'), // its bottom rail
    paint(box(1.1, 0.3, 0.34, 2.9, 7.4, -0.12), '#e3a92b'), // the tag on top
  ]);
}

const POSTERS = AD_COUNT;
// A rooftop billboard: steel legs and a walkway on the roof, the poster above.
function roofFrame(): Part {
  return merge([
    paint(box(0.18, 3.4, 0.18, -3.8, 1.7, 0.6), '#4a4844'),
    paint(box(0.18, 3.4, 0.18, 3.8, 1.7, 0.6), '#4a4844'),
    paint(box(0.18, 3.4, 0.18, 0, 1.7, 0.6), '#4a4844'),
    paint(box(9.3, 4.8, 0.16, 0, 5.6, -0.12), '#2f2e2c'),
    paint(box(9.3, 0.1, 0.8, 0, 3.3, 0.25), '#4a4844'),
  ]);
}
// A short pole with a small vertical poster (the posters are a separate picture).
function bannerPole(): Part {
  return merge([paint(new THREE.CylinderGeometry(0.04, 0.05, 2.9, 6).translate(0, 1.45, 0), '#6b665e')]);
}

// Posters for the game's own made-up brands (painted in code; no real brands in the city). These are
// the in-world ad spaces of design brief 18.1: real advertisers' posters can replace them later.
function streetLight(): Part {
  return merge([
    paint(new THREE.CylinderGeometry(0.07, 0.1, 7.5, 6).translate(0, 3.75, 0), '#7d8287'),
    paint(box(0.08, 0.08, 1.6, 0, 7.45, 0.75), '#7d8287'),
    paint(box(0.3, 0.12, 0.55, 0, 7.38, 1.55), '#e9e3cf'),
  ]);
}

function kiosk(): Part {
  // A container shop: painted box, dark open front with a counter, and a sloping awning.
  return merge([
    paint(box(2.4, 2.5, 2.4, 0, 1.25, 0), '#ffffff'),
    paint(box(1.9, 1.3, 0.04, 0, 1.45, 1.21), '#2b2620'),
    paint(box(2.0, 0.08, 0.35, 0, 0.82, 1.35), '#d9d2c2'),
    paint(box(2.7, 0.06, 1.1, 0, 2.6, 1.6, 0.25), '#ffffff'),
    paint(box(2.5, 0.12, 2.5, 0, 2.55, 0), '#8f959b'),
  ]);
}

function umbrella(): Part {
  return merge([
    paint(new THREE.ConeGeometry(1.4, 0.55, 8).translate(0, 2.25, 0), '#ffffff'),
    paint(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5).translate(0, 1.1, 0), '#d0d0d0'),
    paint(box(0.9, 0.06, 0.6, 0, 0.75, 0), '#6b4f37'),
    paint(box(0.06, 0.75, 0.06, 0.4, 0.37, 0.25), '#6b4f37'),
    paint(box(0.06, 0.75, 0.06, -0.4, 0.37, -0.25), '#6b4f37'),
  ]);
}

function polytank(): Part {
  return merge([
    paint(new THREE.CylinderGeometry(0.62, 0.62, 1.25, 10).translate(0, 0.9, 0), '#1d1e20'),
    paint(new THREE.CylinderGeometry(0.2, 0.62, 0.18, 10).translate(0, 1.6, 0), '#26282a'),
    paint(box(1.3, 0.28, 1.3, 0, 0.14, 0), '#9a9590'),
  ]);
}

const KIOSK_COLOURS = [0x2f8f57, 0xe3a92b, 0xc8442e, 0x1f5fa8, 0xf2efe6, 0x7a3e9d];
const UMBRELLA_COLOURS = [0xe3a92b, 0xc8442e, 0x2f8f57, 0x1f5fa8, 0xf2efe6];

type Batch = { mesh: THREE.InstancedMesh; all: Spot[]; tint: boolean };

/** A soft round spot of light (bright in the middle, fading out), for the lamps' pools on the ground. */
function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- People on the pavements ----------

/** A pavement: a line of points (x, z pairs) with the distance along it at each point. */
type Walkway = { pts: Float32Array; cum: Float32Array; total: number; cx: number; cz: number };
type Agent = {
  kind: PersonKind;
  look: Look & { load: 'basin' | 'tray' | null };
  batch: CrowdBody;
  slot: number;
  run: Walkway | null;
  spot: { x: number; z: number; face: number } | null;
  s0: number;
  speed: number;
  lateral: number;
  still: boolean;
  leader: number; // school children walk in groups behind a leader (-1 = no group)
  // Waiting for a vehicle to pass: how many seconds they are behind their own timetable.
  held?: number;
  waiting?: boolean;
  talkUntil?: number; // talking with the player until this time
  faceX?: number;
  faceZ?: number;
  lastX?: number;
  lastZ?: number;
  lastH?: number;
  // Walking on and on (never back and forth): along which way, from which time, and the bit of road
  // being crossed to the next pavement.
  rev?: boolean;
  legT?: number;
  cross?: { ax: number; az: number; bx: number; bz: number; len: number } | null;
};

// A phone stand: a table with a glass case of phones, chargers hanging on a board, and a small
// blue umbrella over it.
function phoneStand(): Part {
  const parts: Part[] = [
    paint(box(1.3, 0.06, 0.7, 0, 0.82, 0), '#6b4a2e'),
    paint(box(0.06, 0.8, 0.06, 0.6, 0.4, 0.3), '#4a3420'),
    paint(box(0.06, 0.8, 0.06, -0.6, 0.4, 0.3), '#4a3420'),
    paint(box(0.06, 0.8, 0.06, 0.6, 0.4, -0.3), '#4a3420'),
    paint(box(0.06, 0.8, 0.06, -0.6, 0.4, -0.3), '#4a3420'),
    paint(box(1.1, 0.22, 0.5, 0, 0.96, 0.02), '#9fd6e8'), // the glass case
    paint(box(1.2, 0.7, 0.04, 0, 1.4, -0.33), '#d9d2c2'), // board behind
    paint(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6).translate(0.62, 1.1, -0.33), '#d9d2c2'),
    paint(new THREE.ConeGeometry(1.05, 0.35, 8).translate(0.62, 2.35, -0.33), '#1f5fa8'),
  ];
  // Phones in the case and chargers on the board.
  for (let i = 0; i < 6; i++) parts.push(paint(box(0.09, 0.02, 0.16, -0.42 + i * 0.17, 1.08, 0.04), i % 2 ? '#111111' : '#3a3d42'));
  for (let i = 0; i < 5; i++) parts.push(paint(box(0.12, 0.2, 0.03, -0.45 + i * 0.22, 1.45, -0.3), ['#f2efe6', '#e3a92b', '#c8442e', '#2f8f57', '#111111'][i]));
  return merge(parts);
}

// A school bag / backpack, worn on the back (local -z is behind the person), sized for a 1.8 m body.
function backpack(): Part {
  return merge([
    paint(box(0.32, 0.4, 0.15, 0, 1.17, -0.2), '#ffffff'), // the bag (tinted per person)
    paint(box(0.26, 0.14, 0.05, 0, 1.06, -0.29), '#dddddd'), // front pocket
    paint(box(0.04, 0.42, 0.03, 0.11, 1.22, -0.115), '#2a2a2a'), // straps
    paint(box(0.04, 0.42, 0.03, -0.11, 1.22, -0.115), '#2a2a2a'),
  ]);
}
const BAG_COLOURS = [0x1f3f8a, 0xc8442e, 0x2f2f33, 0x2f8f57, 0x7a3fb0, 0xe3a92b, 0x8e1b1b, 0x3d7cc0];

function headLoad(kind: 'basin' | 'tray'): Part {
  if (kind === 'basin') {
    // An aluminium basin piled with goods.
    return merge([
      paint(new THREE.CylinderGeometry(0.34, 0.2, 0.15, 12, 1, true).translate(0, 0.075, 0), '#c9ccd0'),
      paint(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12).translate(0, 0.01, 0), '#b8bbbf'),
      paint(new THREE.SphereGeometry(0.28, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1).translate(0, 0.13, 0), '#d98a3a'),
    ]);
  }
  // A wooden tray of small goods.
  return merge([
    paint(box(0.62, 0.05, 0.46, 0, 0.025, 0), '#8a6a4a'),
    paint(box(0.18, 0.12, 0.14, -0.16, 0.11, -0.1), '#e3a92b'),
    paint(box(0.18, 0.1, 0.14, 0.12, 0.1, 0.08), '#c8442e'),
    paint(box(0.14, 0.14, 0.12, 0.15, 0.12, -0.12), '#f2efe6'),
    paint(box(0.16, 0.09, 0.14, -0.12, 0.095, 0.12), '#2f7d55'),
  ]);
}

export class StreetLife {
  readonly group = new THREE.Group();
  private batches: Batch[] = [];
  private walkways: Walkway[] = [];
  // The middle of the big roads, where hawkers walk between the queuing cars.
  private centreWays: Walkway[] = [];
  private nearCentre: Walkway[] = [];
  private agents: Agent[] = [];
  private crowds: Partial<Record<CrowdBody, CrowdBatch>> = {};
  private loads: Record<'basin' | 'tray', THREE.InstancedMesh>;
  private bags!: THREE.InstancedMesh;
  private gatherings: { x: number; z: number; face: number }[] = [];
  private time = { value: 0 };
  private density = 1;

  /** Share of the crowd to show (1 = everyone): lowered automatically when the phone struggles. */
  setDensity(d: number) {
    this.density = Math.max(0.2, Math.min(1, d));
    // The places' people (the first slots) always stay; walkers thin out.
    for (const [body, b] of Object.entries(this.crowds) as [CrowdBody, CrowdBatch][]) {
      const reserved = this.sceneSlots[body];
      b.mesh.count = reserved + Math.floor((b.count - reserved) * this.density);
    }
  }
  /** People at places: sellers, customers, people sitting, dancers, children playing football. */
  scenes: StreetScenes | null = null;
  private sceneSlots: Record<CrowdBody, number> = { male: 0, female: 0 };
  private footballSpots: { x: number; z: number }[] = [];
  private lastRefresh = { x: Infinity, z: Infinity };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private colour = new THREE.Color();
  private shadowBatch: THREE.InstancedMesh;

  constructor(
    private blocked: (x: number, z: number, margin: number) => boolean,
    private opts: { radiusM: number; people: number; props: number; scenes: number; smoothCrowd?: boolean },
  ) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
    const make = (geometry: Part, tint: boolean) => {
      const mesh = new THREE.InstancedMesh(geometry, mat, opts.props);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      if (tint) mesh.setColorAt(0, this.colour.set(0xffffff));
      this.group.add(mesh);
      const b: Batch = { mesh, all: [], tint };
      this.batches.push(b);
      return b;
    };
    this.trees = make(neem(), true);
    this.palms = make(palm(), true);
    this.lights = make(streetLight(), false);
    this.walkLights = make(streetLight(), false);
    // The pack's road lamp in place of ours once it has loaded (its arm turned to reach over the road),
    // and its city lamp on the pavements. They glow yellow at night, like sodium street lights.
    this.lampMat = epicMaterial().clone();
    void epicGeometry('props/lamp-road.glb', -Math.PI / 2).then((g) => {
      this.lights.mesh.geometry = g;
      this.lights.mesh.material = this.lampMat;
    });
    void epicGeometry('props/lamp-city.glb').then((g) => {
      this.walkLights.mesh.geometry = g;
      this.walkLights.mesh.material = epicMaterial();
    });
    // The pavement lamps' glass globes, lit yellow at night.
    this.globes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.36, 0).translate(0, 6.35, 0), new THREE.MeshBasicMaterial({ color: 0xffb54d, toneMapped: false }), opts.props);
    this.globes.count = 0;
    this.globes.frustumCulled = false;
    this.globes.visible = false;
    this.group.add(this.globes);
    // At night: a pool of light on the ground under every lamp near you, and real lights on the few nearest.
    this.pools = new THREE.InstancedMesh(
      new THREE.CircleGeometry(6.5, 20).rotateX(-Math.PI / 2).translate(0, 0.03, 3.4),
      new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0xffa83c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
      opts.props * 2,
    );
    this.pools.count = 0;
    this.pools.frustumCulled = false;
    this.pools.visible = false;
    this.group.add(this.pools);
    for (let i = 0; i < (opts.people < 150 ? 0 : opts.people < 500 ? 4 : 8); i++) {
      const l = new THREE.PointLight(0xffb45a, 0, 22, 1.6);
      this.lampLights.push(l);
      this.group.add(l);
    }
    this.kiosks = make(kiosk(), true);
    this.umbrellas = make(umbrella(), true);
    this.tanks = make(polytank(), false);
    this.phones = make(phoneStand(), false);
    this.poles = make(powerPole(), false);
    this.boards = make(billboardFrame(), false);
    this.roofBoards = make(roofFrame(), false);
    this.banners = make(bannerPole(), false);
    // Advert faces: every billboard is two-sided and changes advert every few seconds (sliding),
    // all from one picture of the adverts (one draw for all the billboards of each kind).
    // The advert sheet: photos and graphics like real campaigns (adPosters.ts); smaller on Light phones.
    const atlas = adSheet(opts.people < 150 ? 512 : 768, () => (atlasTex.needsUpdate = true));
    const atlasTex = new THREE.CanvasTexture(atlas);
    this.adSheetCanvas = atlas;
    this.adTex = atlasTex;
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    atlasTex.anisotropy = 4;
    const adMat = slidingAdMaterial(atlasTex, POSTERS, 7, true); // bright, like a screen
    const face = (g: THREE.BufferGeometry, n: number) => {
      g.setAttribute('aAd', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
      const mesh = new THREE.InstancedMesh(g, adMat, n);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    };
    this.posterMesh = face(twoSidedFace(7.2, 4.05, 5.0, -0.12, 0.17), 320);
    this.roofMesh = face(twoSidedFace(8.6, 4.84, 5.6, -0.12, 0.1), 60);
    this.bannerMesh = face(twoSidedFace(1.0, 0.5, 0, 0, 0.02).rotateZ(Math.PI / 2).translate(0, 2.35, 0), 160);
    this.wires = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x1d1d1d, transparent: true, opacity: 0.85 }));
    this.wires.frustumCulled = false;
    this.group.add(this.wires);
    this.shadowBatch = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
      opts.props + opts.people,
    );
    this.shadowBatch.count = 0;
    this.shadowBatch.frustumCulled = false;
    this.group.add(this.shadowBatch);
    const loadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
    this.loads = { basin: new THREE.InstancedMesh(headLoad('basin'), loadMat, opts.people), tray: new THREE.InstancedMesh(headLoad('tray'), loadMat, opts.people) };
    this.bags = new THREE.InstancedMesh(backpack(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), opts.people);
    this.bags.count = 0;
    this.bags.frustumCulled = false;
    this.bags.setColorAt(0, this.colour.set(0xffffff));
    this.group.add(this.bags);
    for (const l of Object.values(this.loads)) {
      l.count = 0;
      l.frustumCulled = false;
      this.group.add(l);
    }
    this.makePeople();
  }
  private trees: Batch;
  private palms: Batch;
  private lights: Batch;
  private kiosks: Batch;
  private umbrellas: Batch;
  private tanks: Batch;
  private phones!: Batch;
  private poles!: Batch;
  boards!: Batch;
  private posterMesh!: THREE.InstancedMesh;
  private adSheetCanvas!: HTMLCanvasElement;
  private adTex!: THREE.CanvasTexture;
  /** Show the player's own advert in one of the advert places on the billboards (a preview, only for them). */
  previewAd(row: number, draw: (g: CanvasRenderingContext2D, top: number, W: number, H: number) => void) {
    const W = this.adSheetCanvas.width;
    const H = Math.round((W * 9) / 16);
    draw(this.adSheetCanvas.getContext('2d')!, (POSTERS - 1 - row) * H, W, H);
    this.adTex.needsUpdate = true;
  }
  private roofMesh!: THREE.InstancedMesh;
  private bannerMesh!: THREE.InstancedMesh;
  private roofBoards!: Batch;
  private banners!: Batch;

  private wires!: THREE.LineSegments;
  private spans: number[] = []; // wires between neighbouring poles: x1, z1, x2, z2, angle

  // Everyone who will be out on the streets, with their looks fixed for the session.
  private async makePeople() {
    // The first slots of each batch are kept for the people at places (scenes), the rest walk.
    const reserve = Math.ceil(this.opts.scenes * 0.65);
    const [male, female] = await Promise.all([
      CrowdBatch.create('male', this.opts.people + reserve, this.time, this.opts.smoothCrowd),
      CrowdBatch.create('female', this.opts.people + reserve, this.time, this.opts.smoothCrowd),
    ]);
    this.crowds = { male, female };
    this.group.add(male.mesh, female.mesh);
    this.sceneSlots = { male: reserve, female: reserve };
    male.count = female.count = reserve;
    const freeSlots = { male: Array.from({ length: reserve }, (_, i) => reserve - 1 - i), female: Array.from({ length: reserve }, (_, i) => reserve - 1 - i) };
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < reserve; i++) {
      male.mesh.setMatrixAt(i, hidden);
      female.mesh.setMatrixAt(i, hidden);
    }
    this.scenes = new StreetScenes({ male, female }, freeSlots, this.opts.scenes);
    this.scenes.clear = (x, z) => !this.onRoad(x, z, 0.25) && !this.blocked(x, z, 0.2);
    this.group.add(this.scenes.group);
    const total = MIX.reduce((n, [, w]) => n + w, 0);
    for (let i = 0; i < this.opts.people; i++) {
      // School children come in groups of three or four; friends walk together in twos and threes.
      const prev = this.agents[i - 1];
      const head = prev ? (prev.leader === -1 ? i - 1 : prev.leader) : -1;
      const size = prev ? i - head : 0;
      const groupKind = prev && !prev.still && ['pupil', 'man', 'woman', 'church', 'muslimWoman'].includes(prev.kind) ? prev.kind : null;
      const wantGroup = groupKind && (groupKind === 'pupil' ? size < 3 + Math.floor(hash(head, 1) * 2) : hash(head, 12) < 0.45 && size < 2 + Math.floor(hash(head, 13) * 2));
      const inGroup = !!wantGroup;
      let kind: PersonKind = groupKind && inGroup ? (groupKind as PersonKind) : 'pupil';
      if (!inGroup) {
        let r = hash(i, 2) * total;
        kind = MIX.find(([, w]) => (r -= w) < 0)?.[0] ?? 'man';
      }
      const look = lookFor(kind, (k) => hash(i, 40 + k));
      const batch = this.crowds[look.body]!;
      const slot = batch.count++;
      const still = !inGroup && kind !== 'pupil' && kind !== 'kayayo' && kind !== 'hawker' && hash(i, 3) < 0.3;
      const speed = (kind === 'pupil' || kind === 'child' ? 1.0 : 1.15) + hash(i, 4) * 0.45;
      const clip: Clip = still ? (hash(i, 5) < 0.6 ? 'talk' : 'idle') : 'walk';
      // Feet match the ground: play the walk faster or slower with speed and size.
      const rate = clip === 'walk' ? speed / (1.35 * look.scale) : 1;
      batch.setLook(slot, look, clip, hash(i, 6) * 10, rate);
      this.agents.push({
        kind, look, batch: look.body, slot, run: null, spot: null,
        s0: hash(i, 7) * 500, speed, lateral: (hash(i, 8) - 0.5) * 1.1, still,
        leader: inGroup ? head : -1,
      });
    }
    this.setDensity(this.density);
    this.lastRefresh = { x: Infinity, z: Infinity }; // set up the places' people straight away
  }

  // Road pieces in a grid of 25 m squares, so things are never put on a road.
  private roadGrid = new Map<string, number[]>();
  private addToGrid(x1: number, z1: number, x2: number, z2: number, half: number) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    for (let s = 0; s <= len; s += 10) {
      const k = `${Math.floor((x1 + ((x2 - x1) * s) / (len || 1)) / 25)},${Math.floor((z1 + ((z2 - z1) * s) / (len || 1)) / 25)}`;
      const list = this.roadGrid.get(k) ?? [];
      if (list.length && list[list.length - 5] === x1 && list[list.length - 4] === z1) continue;
      list.push(x1, z1, x2, z2, half);
      this.roadGrid.set(k, list);
    }
  }
  private onRoad(x: number, z: number, margin: number) {
    const cx = Math.floor(x / 25);
    const cz = Math.floor(z / 25);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.roadGrid.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (let k = 0; k < list.length; k += 5) {
        const [ax, az, bx, bz, half] = [list[k], list[k + 1], list[k + 2], list[k + 3], list[k + 4]];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        if (Math.hypot(ax + dx * t - x, az + dz * t - z) < half + margin) return true;
      }
    }
    return false;
  }
  private free(x: number, z: number, margin: number) {
    return !this.blocked(x, z, margin) && !this.onRoad(x, z, margin) && !this.keptClear(x, z, margin);
  }
  /** Places kept clear for the story (where you start, the bus stop, Auntie's stall, the compound). */
  private keepClear: { x: number; z: number; r: number }[] = [];
  private keptClear(x: number, z: number, margin: number) {
    return this.keepClear.some((k) => Math.hypot(k.x - x, k.z - z) < k.r + margin);
  }

  /** New roads and roofs from a tile: place things along them. */
  add(allRoads: StreetLine[], roofs: Roof[]) {
    let roads = allRoads;
    for (const road of roads) {
      const size = HALF[road.kind];
      if (!size) continue;
      for (let i = 0; i + 3 < road.pts.length; i += 2) this.addToGrid(road.pts[i], road.pts[i + 1], road.pts[i + 2], road.pts[i + 3], size.half + GUTTER);
    }
    // Roads arrive tile by tile: anything placed earlier that is on one of these new roads goes,
    // so sellers, kiosks and trees always stand beside the road, never on it.
    const clear = (list: Spot[], margin: number) => list.filter((p) => !this.onRoad(p.x, p.z, margin));
    this.kiosks.all = clear(this.kiosks.all, 1.3);
    this.umbrellas.all = clear(this.umbrellas.all, 0.9);
    this.phones.all = clear(this.phones.all, 0.8);
    this.trees.all = clear(this.trees.all, 0.5);
    this.palms.all = clear(this.palms.all, 0.5);
    this.poles.all = clear(this.poles.all, 0.3);
    this.boards.all = clear(this.boards.all, 2.5);
    this.banners.all = clear(this.banners.all, 0.25);
    this.namePlates = this.namePlates.filter((n) => !this.onRoad(n.x, n.z, 0.2));
    const spans: number[] = [];
    for (let i = 0; i < this.spans.length; i += 5) {
      // A wire whose pole is now on a road goes too.
      if (this.onRoad(this.spans[i], this.spans[i + 1], 0.3) || this.onRoad(this.spans[i + 2], this.spans[i + 3], 0.3)) continue;
      spans.push(...this.spans.slice(i, i + 5));
    }
    this.spans = spans;
    this.gatherings = this.gatherings.filter((g) => !this.onRoad(g.x, g.z, 0.9));
    this.footballSpots = this.footballSpots.filter((g) => !this.onRoad(g.x, g.z, 2));
    // Lanes, service roads and flyovers only keep the tarmac clear; everything else is placed along
    // the ground-level streets.
    roads = roads.filter((r) => !r.edge);
    this.findJunctions(roads);
    for (const road of roads) {
      const size = HALF[road.kind];
      if (!size) continue;
      const pts = road.pts;
      let carried = 0;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const [x1, z1, x2, z2] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.5) continue;
        const dx = (x2 - x1) / len;
        const dz = (z2 - z1) / len;
        const angle = Math.atan2(dx, -dz); // clockwise from north, along the road
        const spacing = road.kind === 'minor_road' ? 9 : 10;
        for (let s = (spacing - carried) % spacing; s < len; s += spacing) {
          const x = x1 + dx * s;
          const z = z1 + dz * s;
          const r = hash(x, z);
          const side = hash(z, x) < 0.5 ? 1 : -1;
          const edge = size.half + GUTTER + size.walk;
          const at = (extra: number) => [x - dz * (edge + extra) * side, z + dx * (edge + extra) * side] as const;
          const facing = angle + (side > 0 ? -Math.PI / 2 : Math.PI / 2); // facing the road
          if (Math.round(s / spacing) % 2 === 1) {
            // Electricity poles along one side of every street, with wires from pole to pole.
            const off = size.half + GUTTER + size.walk + 0.35;
            const [px, pz] = [x + dz * off, z - dx * off];
            if (this.free(px, pz, 0.3)) {
              this.poles.all.push({ x: px, z: pz, angle, scale: 1, colour: 0 });
              const last = this.lastPole.get(road);
              if (last && Math.hypot(last[0] - px, last[1] - pz) < 45) this.spans.push(last[0], last[1], px, pz, angle);
              this.lastPole.set(road, [px, pz]);
            }
          }
          // Rows of small posters on poles along the kerb of main roads (election-style banners).
          if (road.kind !== 'minor_road' && Math.round(s / spacing) % 14 === 7 && hash(x * 2, z) < 0.5) {
            const kerb = size.half + GUTTER + 0.45;
            for (let k = 0; k < 6; k++) {
              const along = k * 11;
              if (along > len - s) break;
              const [rx, rz] = [x + dx * along - dz * kerb * -side, z + dz * along + dx * kerb * -side];
              if (this.free(rx, rz, 0.25)) this.banners.all.push({ x: rx, z: rz, angle: facing + Math.PI, scale: 1, colour: Math.floor(hash(x, z) * POSTERS) });
            }
          }
          // A street-name plate now and then on named streets, at the edge of the pavement.
          if (road.name && Math.round(s / spacing) % 14 === 3) {
            const off = size.half + GUTTER + size.walk + 0.25;
            const [nx, nz] = [x - dz * off * side, z + dx * off * side];
            if (this.free(nx, nz, 0.2)) this.namePlates.push({ x: nx, z: nz, angle: angle + Math.PI / 2, name: road.name });
          }
          if (Math.round(s / spacing) % (road.kind === 'minor_road' ? 7 : 3) === 2) {
            // Billboards all over the city (design brief 18.1): about every 30 m along the main roads
            // and every 60 m on side streets, set back behind the pavement and facing the traffic.
            // Tried at a few distances back, so one still fits where buildings are close.
            for (const extra of [2.2, 3.6, 5.2]) {
              const back = size.half + GUTTER + size.walk + extra;
              const [bx, bz] = [x - dz * back * side, z + dx * back * side];
              if (this.free(bx, bz, 2.4) && !this.boards.all.some((o) => Math.abs(o.x - bx) < 22 && Math.abs(o.z - bz) < 22)) {
                // Turned a little towards the traffic coming along this side, so drivers see it face on.
                this.boards.all.push({ x: bx, z: bz, angle: facing + side * 0.45, scale: 1, colour: Math.floor(hash(bx, bz) * POSTERS) });
                break;
              }
            }
          }
          // Street lights all round the city, in pairs facing each other across the road (the Epic City
          // pack's road lamp at the kerb, its arm over the road): every 20 m on main roads, every 27 m on
          // side roads. Half way between the pairs, a pavement lamp on each side lights the walkway.
          const lampAt = Math.round(s / spacing);
          const every = road.kind === 'minor_road' ? 3 : 2;
          for (const ls of [1, -1]) {
            const lf = angle + (ls > 0 ? -Math.PI / 2 : Math.PI / 2);
            if (lampAt % every === 0) {
              const [lx, lz] = [x - dz * (size.half + GUTTER + 0.3) * ls, z + dx * (size.half + GUTTER + 0.3) * ls];
              if (!this.onRoad(lx, lz, 0.1)) this.lights.all.push({ x: lx, z: lz, angle: lf + Math.PI, scale: 1, colour: 0 });
            } else if (lampAt % every === 1) {
              const back = size.half + GUTTER + size.walk - 0.35;
              const [wx, wz] = [x - dz * back * ls, z + dx * back * ls];
              if (!this.onRoad(wx, wz, 0.3)) this.walkLights.all.push({ x: wx, z: wz, angle: lf, scale: 1, colour: 0 });
            }
          }
          // Accra's roadsides: trees, then kiosks and umbrella stalls almost everywhere.
          // Accra's roadsides, on both sides: hardly a gap. Kiosks in rows (shops behind shops),
          // umbrella stalls and phone stands on the pavement's edge, a tree now and then.
          void r;
          void at;
          for (const sd of [1, -1]) {
            const rr = hash(x + sd * 3.1, z - sd * 1.7);
            const put = (extra: number) => [x - dz * (edge + extra) * sd, z + dx * (edge + extra) * sd] as const;
            const face = angle + (sd > 0 ? -Math.PI / 2 : Math.PI / 2);
            if (rr < 0.07) {
              const [tx, tz] = put(1.2);
              if (this.free(tx, tz, 1.2)) {
                const b = rr < 0.045 ? this.palms : this.trees;
                b.all.push({ x: tx, z: tz, angle: rr * 40, scale: 0.85 + hash(tx, tz) * 0.45, colour: 0xffffff });
              }
            } else if (rr < 0.58) {
              // A row of container shops, and more behind it where there is open ground.
              for (const [extra, chance] of [[1.5, 1], [4.4, 0.95], [7.3, 0.85], [10.2, 0.72], [13.1, 0.58], [16, 0.42]] as const) {
                if (hash(x * 1.3 + extra, z + sd) > chance) break;
                const [kx, kz] = put(extra);
                if (!this.free(kx, kz, 1.4)) break;
                this.kiosks.all.push({ x: kx, z: kz, angle: face, scale: 1, colour: KIOSK_COLOURS[Math.floor(hash(kx, kz) * KIOSK_COLOURS.length)] });
              }
            } else if (rr < 0.72) {
              // A phone and accessories stand: the "Circle boys" selling phones, chargers and earpieces.
              const [px, pz] = put(-size.walk / 2);
              if (size.walk && this.free(px, pz, 0.8)) this.phones.all.push({ x: px, z: pz, angle: face, scale: 1, colour: 0 });
            } else {
              // Market stalls fill the open ground behind the pavement too.
              for (const extra of [2.2, 5.4, 8.6, 11.8]) {
                if (hash(x + extra, z * 1.7 + sd) > 0.82) break;
                const [mx, mz] = put(extra);
                if (!this.free(mx, mz, 1)) break;
                this.umbrellas.all.push({ x: mx, z: mz, angle: hash(mx, mz) * 30, scale: 1, colour: UMBRELLA_COLOURS[Math.floor(hash(mx, mz) * UMBRELLA_COLOURS.length)] });
              }
              const [ux, uz] = put(-size.walk / 2);
              if (size.walk && this.free(ux, uz, 0.9)) this.umbrellas.all.push({ x: ux, z: uz, angle: rr * 30, scale: 1, colour: UMBRELLA_COLOURS[Math.floor(hash(ux, uz) * UMBRELLA_COLOURS.length)] });
            }
          }
        }
        carried = (carried + len) % spacing;
      }
    }
    // A pavement on each side of each road, for people to walk on (split where a building or another road is in the way).
    for (const road of roads) {
      const size = HALF[road.kind];
      if (!size?.walk) continue;
      for (const side of [1, -1]) this.addWalkways(road.pts, (size.half + GUTTER + size.walk / 2) * side);
      if (road.kind !== 'minor_road' && road.pts.length >= 4) {
        const cum = new Float32Array(road.pts.length / 2);
        for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(road.pts[i * 2] - road.pts[i * 2 - 2], road.pts[i * 2 + 1] - road.pts[i * 2 - 1]);
        const total = cum[cum.length - 1];
        if (total > 15) this.centreWays.push({ pts: road.pts, cum, total, cx: road.pts[0], cz: road.pts[1] });
      }
    }
    this.gatherings = [];
    for (const k of this.kiosks.all.concat(this.umbrellas.all, this.phones.all)) this.gatherings.push({ x: k.x, z: k.z, face: k.angle });
    // Open ground beside side streets, where children kick a ball about.
    for (const road of roads) {
      if (road.kind !== 'minor_road') continue;
      for (let i = 0; i + 3 < road.pts.length; i += 8) {
        const [x1, z1, x2, z2] = [road.pts[i], road.pts[i + 1], road.pts[i + 2], road.pts[i + 3]];
        const len = Math.hypot(x2 - x1, z2 - z1) || 1;
        const off = HALF.minor_road.half + GUTTER + HALF.minor_road.walk + 4;
        const x = x1 - ((z2 - z1) / len) * off;
        const z = z1 + ((x2 - x1) / len) * off;
        if (hash(x, z) < 0.6 && this.free(x, z, 2.5)) this.footballSpots.push({ x, z });
      }
    }
    for (const roof of roofs) {
      // Billboards on the roofs of buildings next to the big roads, facing the road.
      if (roof.top > 5 && hash(roof.z, roof.x) < 0.3) {
        const dir = this.roadDirNear(roof.x, roof.z, 28);
        if (dir !== null && !this.roofBoards.all.some((o) => Math.abs(o.x - roof.x) < 40 && Math.abs(o.z - roof.z) < 40))
          this.roofBoards.all.push({ x: roof.x, z: roof.z, angle: dir, scale: 1, colour: Math.floor(hash(roof.x, roof.top) * POSTERS), y: roof.top } as Spot & { y: number });
      }
      if (hash(roof.x, roof.z) < 0.35) this.tanks.all.push({ x: roof.x, z: roof.z, angle: roof.id, scale: 1, colour: 0, y: roof.top } as Spot & { y: number });
    }
    this.lastRefresh = { x: Infinity, z: Infinity }; // show the new things straight away
  }

  private addWalkways(pts: Float32Array, off: number) {
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 4) {
        const cum = new Float32Array(run.length / 2);
        for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(run[i * 2] - run[i * 2 - 2], run[i * 2 + 1] - run[i * 2 - 1]);
        const total = cum[cum.length - 1];
        if (total > 8) this.walkways.push({ pts: new Float32Array(run), cum, total, cx: run[0], cz: run[1] });
      }
      run = [];
    };
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      // Sideways from the road, using the road's direction at this point.
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      const dx = pts[b * 2] - pts[a * 2];
      const dz = pts[b * 2 + 1] - pts[a * 2 + 1];
      const len = Math.hypot(dx, dz) || 1;
      const x = pts[i * 2] - (dz / len) * off;
      const z = pts[i * 2 + 1] + (dx / len) * off;
      if (!this.free(x, z, 0.15)) {
        flush();
        continue;
      }
      // Long road pieces get extra points, so a blocked stretch only cuts out a little.
      if (run.length) {
        const [px, pz] = [run[run.length - 2], run[run.length - 1]];
        const gap = Math.hypot(x - px, z - pz);
        let broke = false;
        for (let s = 6; s < gap; s += 6) {
          const mx = px + ((x - px) * s) / gap;
          const mz = pz + ((z - pz) * s) / gap;
          if (!this.free(mx, mz, 0.15)) {
            flush();
            broke = true;
            break;
          }
          run.push(mx, mz);
        }
        if (broke) continue;
      }
      run.push(x, z);
    }
    flush();
  }

  /** Call every frame. */
  update(x: number, z: number, dt: number, t: number) {
    this.time.value = t;
    if (Math.hypot(x - this.lastRefresh.x, z - this.lastRefresh.z) > 30) this.refresh(x, z);
    this.movePeople(x, z, t, dt);
    this.scenes?.update(t, x, z);
  }

  // Draw only the things near the player (rebuilt after moving 30 m).
  private nearWalkways: Walkway[] = [];
  private nearLength = 0;
  private nearSpots: { x: number; z: number; face: number }[] = [];
  private refresh(x: number, z: number) {
    this.lastRefresh = { x, z };
    // People stay close to the player (within about 65 m), so the streets around you are packed.
    const reach = Math.min(65, this.opts.radiusM * 0.75);
    this.nearWalkways = this.walkways.filter((w) => {
      for (let i = 0; i < w.pts.length; i += 2) if (Math.abs(w.pts[i] - x) < reach && Math.abs(w.pts[i + 1] - z) < reach) return true;
      return false;
    });
    this.nearLength = this.nearWalkways.reduce((n, w) => n + w.total, 0);
    this.nearCentre = this.centreWays.filter((w) => {
      for (let i = 0; i < w.pts.length; i += 2) if (Math.abs(w.pts[i] - x) < reach && Math.abs(w.pts[i + 1] - z) < reach) return true;
      return false;
    });
    this.nearSpots = this.gatherings.filter((g) => Math.hypot(g.x - x, g.z - z) < reach);
    // The places nearest the player get their people (sellers, customers, chairs, dancers, football).
    if (this.scenes) {
      const byDistance = <T extends { x: number; z: number }>(list: T[], max: number) =>
        list.filter((s) => Math.hypot(s.x - x, s.z - z) < 70).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, max);
      const share = Math.max(2, Math.floor(this.opts.scenes / 6));
      this.scenes.rebuild(byDistance(this.kiosks.all, share), byDistance(this.umbrellas.all, share), byDistance(this.footballSpots, 1), this.time.value, byDistance(this.phones.all, Math.ceil(share / 2)));
    }
    const r2 = this.opts.radiusM ** 2;
    let shadows = 0;
    const boardR2 = Math.max(r2, (this.opts.people < 150 ? 250 : 320) ** 2); // (a little nearer on Light phones)
    for (const b of this.batches) {
      let n = 0;
      // The nearest ones first, so a full batch never leaves gaps close to the player.
      const far0 = b === this.boards || b === this.roofBoards ? boardR2 : r2;
      let list = b.all.filter((q) => (q.x - x) ** 2 + (q.z - z) ** 2 <= far0);
      if (list.length > this.opts.props) list = list.sort((a, c) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((c.x - x) ** 2 + (c.z - z) ** 2));
      for (const s of list) {
        const far = b === this.boards || b === this.roofBoards ? boardR2 : r2; // billboards are tall: seen from much further
        if ((s.x - x) ** 2 + (s.z - z) ** 2 > far || n >= this.opts.props) continue;
        const y = (s as Spot & { y?: number }).y ?? 0;
        this.q.setFromAxisAngle(this.up, Math.PI - s.angle);
        this.m.compose(this.p.set(s.x, y, s.z), this.q, this.sc.setScalar(s.scale));
        b.mesh.setMatrixAt(n, this.m);
        if (b.tint) b.mesh.setColorAt(n, this.colour.set(s.colour));
        n++;
        if (y === 0 && b !== this.lights && b !== this.poles && b !== this.boards && b !== this.banners && shadows < this.opts.props) {
          const size = b === this.kiosks ? 3.4 : b === this.umbrellas ? 2.6 : b === this.phones ? 2 : 3.2 * s.scale;
          this.m.compose(this.p.set(s.x, 0.04, s.z), this.q, this.sc.set(size, 1, size));
          this.shadowBatch.setMatrixAt(shadows++, this.m);
        }
      }
      b.mesh.count = n;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      if (b === this.walkLights && this.night > 0.02) {
        // Pavement lamps: a smaller pool on the walkway under each, and the glowing globe.
        for (let k = 0; k < n; k++) {
          b.mesh.getMatrixAt(k, this.m);
          this.globes.setMatrixAt(k, this.m);
          this.m.multiply(this.poolSmall);
          this.pools.setMatrixAt(this.poolCount++, this.m);
        }
        this.globes.count = n;
        this.globes.instanceMatrix.needsUpdate = true;
        this.pools.count = this.poolCount;
        this.pools.instanceMatrix.needsUpdate = true;
      }
      if (b === this.lights && this.night > 0.02) {
        // The pools of light go where the lamps are drawn (the same matrices).
        this.poolCount = 0;
        for (let k = 0; k < n; k++) {
          b.mesh.getMatrixAt(k, this.m);
          this.pools.setMatrixAt(this.poolCount++, this.m);
        }
        this.pools.count = this.poolCount;
        this.pools.instanceMatrix.needsUpdate = true;
        // Real light from the few lamps nearest you (warm white, on the road under the lamp head).
        const near = list.filter((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < 60 * 60).sort((a, c) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((c.x - x) ** 2 + (c.z - z) ** 2));
        this.lampLights.forEach((l, k) => {
          const q = near[k];
          if (!q) { l.intensity = 0; return; }
          const a = Math.PI - q.angle;
          l.position.set(q.x + Math.sin(a) * 3.4, 8.6, q.z + Math.cos(a) * 3.4);
          l.intensity = 60 * this.night;
        });
      }
    }
    this.propShadows = shadows;
    // Advert faces on the billboards near the player.
    const fill = (spots: Spot[], mesh: THREE.InstancedMesh, range2: number) => {
      const ads = mesh.geometry.getAttribute('aAd') as THREE.InstancedBufferAttribute;
      let n = 0;
      // The nearest first (the same ones as the frames when there are more than fit).
      let list = spots.filter((sp) => (sp.x - x) ** 2 + (sp.z - z) ** 2 <= range2);
      if (list.length > mesh.instanceMatrix.count) list = list.sort((a, c) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((c.x - x) ** 2 + (c.z - z) ** 2));
      for (const sp of list) {
        if (n >= mesh.instanceMatrix.count) break;
        this.q.setFromAxisAngle(this.up, Math.PI - sp.angle);
        this.m.compose(this.p.set(sp.x, (sp as Spot & { y?: number }).y ?? 0, sp.z), this.q, this.sc.setScalar(1));
        mesh.setMatrixAt(n, this.m);
        ads.setX(n++, sp.colour % POSTERS);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      ads.needsUpdate = true;
    };
    fill(this.boards.all, this.posterMesh, boardR2);
    fill(this.roofBoards.all, this.roofMesh, boardR2);
    fill(this.banners.all, this.bannerMesh, r2);
    // Wires: three per span, sagging a little in the middle.
    const w: number[] = [];
    const wireReach = Math.min(160, this.opts.radiusM);
    for (let i = 0; i < this.spans.length; i += 5) {
      const [x1, z1, x2, z2, a] = [this.spans[i], this.spans[i + 1], this.spans[i + 2], this.spans[i + 3], this.spans[i + 4]];
      if (Math.abs(x1 - x) > wireReach || Math.abs(z1 - z) > wireReach) continue;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      for (const o of [-0.6, 0, 0.6]) {
        let px = x1 + cx * o;
        let pz = z1 + cz * o;
        let py = 7.82;
        for (let k = 1; k <= 4; k++) {
          const f = k / 4;
          const nx = x1 + (x2 - x1) * f + cx * o;
          const nz = z1 + (z2 - z1) * f + cz * o;
          const ny = 7.82 - Math.sin(f * Math.PI) * 0.45;
          w.push(px, py, pz, nx, ny, nz);
          [px, py, pz] = [nx, ny, nz];
        }
      }
    }
    this.wires.geometry.dispose();
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(w, 3));
    this.wires.geometry = wg;
    // The solid things near the player: you cannot walk or ride through them.
    this.solids = [];
    const near = (list: Spot[], r: number, box = false) => {
      for (const s of list) if (Math.abs(s.x - x) < 70 && Math.abs(s.z - z) < 70) this.solids.push({ x: s.x, z: s.z, r: r * s.scale, angle: s.angle, box });
    };
    near(this.kiosks.all, 1.25, true);
    near(this.trees.all, 0.3);
    near(this.palms.all, 0.25);
    near(this.lights.all, 0.12);
    near(this.tanks.all, 0.6);
    near(this.umbrellas.all, 0.45);
    near(this.phones.all, 0.55);
    near(this.poles.all, 0.18);
    near(this.boards.all, 0.2); // only the legs matter; the posters are high up
    near(this.banners.all, 0.08);
    // A grid of the solid things (4 m squares), so asking "is something here?" stays quick.
    this.solidGrid.clear();
    for (const o of this.solids) {
      const reach = o.box ? o.r * 1.42 : o.r;
      for (let gx = Math.floor((o.x - reach - 0.6) / 4); gx <= Math.floor((o.x + reach + 0.6) / 4); gx++)
        for (let gz = Math.floor((o.z - reach - 0.6) / 4); gz <= Math.floor((o.z + reach + 0.6) / 4); gz++) {
          const k = gx * 100003 + gz;
          const cell = this.solidGrid.get(k);
          if (cell) cell.push(o);
          else this.solidGrid.set(k, [o]);
        }
    }
    // What blocks the camera's view: kiosks, containers and umbrella tops (thin poles and trees do not).
    this.viewGrid.clear();
    const view = (list: Spot[], r: number, h: number, box: boolean) => {
      for (const s of list) {
        if (Math.abs(s.x - x) > 70 || Math.abs(s.z - z) > 70) continue;
        const o = { x: s.x, z: s.z, r: r * s.scale, angle: s.angle, box, h: h * s.scale };
        const k = Math.floor(s.x / 4) * 100003 + Math.floor(s.z / 4);
        const cell = this.viewGrid.get(k);
        if (cell) cell.push(o);
        else this.viewGrid.set(k, [o]);
      }
    };
    view(this.kiosks.all, 1.35, 2.9, true);
    view(this.umbrellas.all, 1.2, 2.5, false);
    view(this.phones.all, 0.6, 2.1, false);
    view(this.tanks.all, 0.7, 2.2, false);
  }
  private solidGrid = new Map<number, { x: number; z: number; r: number; angle: number; box: boolean }[]>();
  private viewGrid = new Map<number, { x: number; z: number; r: number; angle: number; box: boolean; h: number }[]>();

  /** How tall the kiosk, container or umbrella at this point is (0: none), for the camera. */
  viewHeight(x: number, z: number) {
    let top = 0;
    const gx = Math.floor(x / 4);
    const gz = Math.floor(z / 4);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const cell = this.viewGrid.get((gx + i) * 100003 + gz + j);
        if (!cell) continue;
        for (const o of cell) {
          if (o.h <= top) continue;
          const dx = x - o.x;
          const dz = z - o.z;
          if (o.box) {
            const c = Math.cos(o.angle);
            const sn = Math.sin(o.angle);
            if (Math.abs(dx * c + dz * sn) < o.r && Math.abs(-dx * sn + dz * c) < o.r) top = o.h;
          } else if (dx * dx + dz * dz < o.r * o.r) top = o.h;
        }
      }
    return top;
  }
  private propShadows = 0;
  private solids: { x: number; z: number; r: number; angle: number; box: boolean }[] = [];
  private lastPole = new Map<StreetLine, [number, number]>();

  /** Is there a kiosk, tree, pole or tank at this point (with room around it)? */
  solid(x: number, z: number, room: number) {
    const cell = this.solidGrid.get(Math.floor(x / 4) * 100003 + Math.floor(z / 4));
    if (room > 0.6 || !cell) {
      if (room <= 0.6 && this.solidGrid.size) return false;
    }
    for (const o of room <= 0.6 && this.solidGrid.size ? cell! : this.solids) {
      const dx = x - o.x;
      const dz = z - o.z;
      if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
      if (o.box) {
        // The container is a square turned to face the street.
        const c = Math.cos(o.angle);
        const sn = Math.sin(o.angle);
        if (Math.abs(dx * c + dz * sn) < o.r + room && Math.abs(-dx * sn + dz * c) < o.r + room) return true;
      } else if (dx * dx + dz * dz < (o.r + room) ** 2) return true;
    }
    return false;
  }

  /** The nearest spot on a pavement (off the road, clear of buildings and kiosks), for placing the player. */
  pavementNear(x: number, z: number, clear = 0.6): { x: number; z: number } | null {
    for (let r = 0; r <= 40; r += 1.5) {
      const steps = Math.max(1, Math.round(r * 2));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (!this.onRoad(px, pz, clear) && !this.blocked(px, pz, 0.6) && !this.solid(px, pz, 0.5)) return { x: px, z: pz };
      }
    }
    return null;
  }

  /** Junctions where a main road meets another road: they get traffic lights and zebra crossings. */
  junctions: Junction[] = [];
  private ends = new Map<string, { x: number; z: number; arms: Arm[]; major: boolean }>();
  private findJunctions(roads: StreetLine[]) {
    // Every point where roads meet: collect the directions leaving it. Three or more directions is a junction.
    for (const road of roads) {
      const size = HALF[road.kind];
      if (!size) continue;
      const pts = road.pts;
      const n = pts.length / 2;
      for (let i = 0; i < n; i++) {
        const x = pts[i * 2];
        const z = pts[i * 2 + 1];
        const key = `${Math.round(x * 2)},${Math.round(z * 2)}`;
        const e = this.ends.get(key) ?? { x, z, arms: [], major: false };
        for (const k of [i - 1, i + 1]) {
          if (k < 0 || k >= n) continue;
          const angle = Math.atan2(pts[k * 2] - x, -(pts[k * 2 + 1] - z));
          if (!e.arms.some((a) => Math.abs(Math.atan2(Math.sin(a.angle - angle), Math.cos(a.angle - angle))) < 0.35)) e.arms.push({ angle, half: size.half });
        }
        if (road.kind !== 'minor_road') e.major = true;
        this.ends.set(key, e);
      }
    }
    const found: Junction[] = [];
    for (const e of this.ends.values()) {
      // Traffic lights only where two main roads meet (as in Accra), one set per 60 m.
      if (!e.major || e.arms.length < 3 || e.arms.filter((a) => a.half >= 5).length < 2) continue;
      if (found.some((j) => Math.hypot(j.x - e.x, j.z - e.z) < 60)) continue;
      const half = Math.max(...e.arms.map((a) => a.half));
      // The main axis: the widest arm's direction.
      const axis = e.arms.reduce((a, b) => (b.half > a.half ? b : a)).angle;
      found.push({ x: e.x, z: e.z, axis, arms: e.arms.slice(0, 4), half, phase: hash(e.x, e.z) * 36 });
    }
    this.junctions = found;
  }

  /** The billboard spot nearest a point (for the big screen at Circle). */
  boardNear(x: number, z: number) {
    let best: Spot | null = null;
    for (const b of this.boards.all) if (!best || Math.hypot(b.x - x, b.z - z) < Math.hypot(best.x - x, best.z - z)) best = b;
    return best;
  }
  /** Billboard spots within reach of a point. */
  boardsNear(x: number, z: number, reach: number) {
    return this.boards.all.filter((b) => Math.hypot(b.x - x, b.z - z) < reach);
  }
  /** Set up the places' people again soon (after adding fixed people). */
  refreshSoon() {
    this.lastRefresh = { x: Infinity, z: Infinity };
  }
  /** Is anything solid here (kiosks, trees, stalls)? */
  solidHere(x: number, z: number, room: number) {
    return this.solid(x, z, room) || this.kiosks.all.some((k) => Math.abs(k.x - x) < 1.4 + room && Math.abs(k.z - z) < 1.4 + room);
  }
  /** Take things away from an area (to make room for the trotro station). */
  clearArea(x: number, z: number, r: number) {
    this.keepClear.push({ x, z, r }); // (and nothing new is put there when more streets arrive)
    const keep = (p: Spot) => Math.hypot(p.x - x, p.z - z) > r;
    for (const b of this.batches) if (b !== this.poles && b !== this.lights && b !== this.walkLights) b.all = b.all.filter(keep);
    this.gatherings = this.gatherings.filter((g) => Math.hypot(g.x - x, g.z - z) > r);
    this.refreshSoon();
  }
  /** Take a billboard away (its place is used by something else). */
  removeBoard(b: Spot) {
    this.boards.all = this.boards.all.filter((o) => o !== b);
    this.lastRefresh = { x: Infinity, z: Infinity };
  }

  /** The direction (clockwise from north) from a point towards the nearest main road within reach, or null. */
  roadDirNear(x: number, z: number, reach: number, minHalf = 4.5): number | null {
    const cx = Math.floor(x / 25);
    const cz = Math.floor(z / 25);
    let best: [number, number] | null = null;
    let bestD = reach;
    const n = Math.max(1, Math.ceil(reach / 25));
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const list = this.roadGrid.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (let k = 0; k < list.length; k += 5) {
        const [ax, az, bx, bz, half] = [list[k], list[k + 1], list[k + 2], list[k + 3], list[k + 4]];
        if (half < minHalf) continue; // main roads only (by default)
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        const px = ax + dx * t;
        const pz = az + dz * t;
        const d = Math.hypot(px - x, pz - z);
        if (d < bestD) [bestD, best] = [d, [px, pz]];
      }
    }
    return best ? Math.atan2(best[0] - x, -(best[1] - z)) : null;
  }

  /** Street-name plates (drawn by roadSigns.ts). */
  namePlates: { x: number; z: number; angle: number; name: string }[] = [];

  private pools: THREE.InstancedMesh;
  private walkLights: Batch;
  private globes: THREE.InstancedMesh;
  private lampMat: THREE.MeshStandardMaterial;
  private lampLights: THREE.PointLight[] = [];
  private poolCount = 0;
  private lampsLit = false;
  // A pavement lamp's pool: smaller, right under the lamp (the road lamp's pool is 3.4 m out over the road).
  private poolSmall = new THREE.Matrix4().makeTranslation(0, 0, -3.4 * 0.62).multiply(new THREE.Matrix4().makeScale(0.62, 1, 0.62));
  private night = 0;
  /** 0 by day, 1 at night: lamp pools on the ground and the nearest lamps' real light. */
  setNight(n: number) {
    this.night = n;
    this.pools.visible = this.globes.visible = n > 0.02;
    (this.pools.material as THREE.MeshBasicMaterial).opacity = 0.9 * n;
    // Road lamp heads: the pack's night glow, tinted sodium yellow.
    if ((n > 0.5) !== this.lampsLit) {
      this.lampsLit = n > 0.5;
      const glow = epicGlowMaps();
      this.lampMat.emissiveMap = this.lampsLit ? glow.night : glow.day;
      if (this.lampsLit) this.lampMat.emissive.setRGB(1.5, 0.9, 0.32);
      else this.lampMat.emissive.setRGB(0.58, 0.58, 0.58);
      this.lampMat.needsUpdate = true;
    }
    for (const l of this.lampLights) l.intensity = 0;
  }

  /** How far the ground dips here (the sunk tarmac of the pack's roads); walkers step down onto it. */
  groundDip: ((x: number, z: number) => number) | null = null;

  /** Is this point on a road? */
  roadAt(x: number, z: number, margin = 0) {
    return this.onRoad(x, z, margin);
  }

  // Picks a pavement near the player, longer ones more often (so people spread evenly).
  private pickWalkway(r: number) {
    let left = r * this.nearLength;
    for (const w of this.nearWalkways) if ((left -= w.total) < 0) return w;
    return this.nearWalkways[this.nearWalkways.length - 1] ?? null;
  }

  private pointOn(w: Walkway, s: number): [number, number, number] {
    let lo = 0;
    let hi = w.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (w.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = w.cum[hi] - w.cum[lo] || 1;
    const k = (s - w.cum[lo]) / seg;
    const [x1, z1, x2, z2] = [w.pts[lo * 2], w.pts[lo * 2 + 1], w.pts[hi * 2], w.pts[hi * 2 + 1]];
    return [x1 + (x2 - x1) * k, z1 + (z2 - z1) * k, Math.atan2(x2 - x1, -(z2 - z1))];
  }

  /** How many walkers are within 25 m of the player (for the crowd's sound). */
  nearCount = 0;

  /** The nearest person walking or standing on the pavement, within reach (for greeting them). */
  nearestWalker(px: number, pz: number, reach: number) {
    let best: { i: number; x: number; z: number; kind: PersonKind; height: number; body: 'male' | 'female' | 'child' } | null = null;
    let bestD = reach;
    for (const [i, a] of this.agents.entries()) {
      if (a.lastX === undefined || a.spot) continue;
      const batch = this.crowds[a.batch];
      if (!batch || a.slot >= batch.mesh.count) continue;
      const d = Math.hypot(a.lastX - px, a.lastZ! - pz);
      if (d < bestD) [best, bestD] = [{ i, x: a.lastX, z: a.lastZ!, kind: a.kind, height: (a.look.body === 'female' ? 1.85 : 1.95) * a.look.scale, body: a.look.scale < 0.85 ? 'child' : a.look.body }, d];
    }
    return best;
  }

  /** Someone on the pavement stops and talks with the player for a few seconds. */
  holdWalker(i: number, seconds: number, faceX: number, faceZ: number) {
    const a = this.agents[i];
    if (!a) return;
    a.talkUntil = this.time.value + seconds;
    a.faceX = faceX;
    a.faceZ = faceZ;
  }

  /** Is a vehicle at this point? (Set by the street test, so people wait instead of walking through cars.) */
  vehicleAt: ((x: number, z: number, room: number) => { x: number; z: number; fx: number; fz: number; half: number; halfW: number } | null) | null = null;

  private movePeople(x: number, z: number, t: number, dt: number) {
    let shadows = this.propShadows;
    let close = 0;
    const loadCount = { basin: 0, tray: 0 };
    let bagCount = 0;
    const far = Math.min(85, this.opts.radiusM * 0.8);
    for (const [i, a] of this.agents.entries()) {
      const batch = this.crowds[a.batch];
      if (!batch || a.slot >= batch.mesh.count) continue; // not shown at the current density
      const leader = a.leader >= 0 ? this.agents[a.leader] : null;
      // Someone who has fallen far behind the player moves to a pavement (or a kiosk) nearby.
      if (leader) {
        a.run = leader.run;
        a.s0 = leader.s0;
      } else if (!a.run || this.tooFar(a, x, z, t, far)) {
        // Hawkers (and some kayayei) work the traffic, walking between the lanes.
        // Everyone, hawkers too, keeps to the pavements (owner, 2026-10-25: sellers by the road, not on it).
        const inTraffic = false;
        a.run = inTraffic ? this.nearCentre[Math.floor(hash(i, t) * this.nearCentre.length)] : this.pickWalkway(hash(i, Math.floor(t)));
        a.legT = undefined; // (starts somewhere along it)
        a.spot = a.still && this.nearSpots.length && hash(i, 9) < 0.7 ? this.nearSpots[Math.floor(hash(i, t) * this.nearSpots.length)] : null;
      }
      let px: number;
      let pz: number;
      let heading: number;
      if (a.spot) {
        // Standing at a kiosk or a vendor's umbrella, facing it.
        const ang = hash(i, 21) * Math.PI * 2;
        px = a.spot.x + Math.sin(ang) * 1.6;
        pz = a.spot.z - Math.cos(ang) * 1.6;
        heading = ang + Math.PI;
      } else if (a.run) {
        const held = leader ? (leader.held ?? 0) : (a.held ?? 0);
        let dir: number;
        let qx: number;
        let qz: number;
        let forward = true;
        if (a.still) {
          const w = a.run;
          [qx, qz, dir] = this.pointOn(w, a.s0 % w.total);
        } else if (leader && leader.lastX !== undefined) {
          // In a group: a step or two behind the leader, the same way.
          const lh = leader.lastH ?? 0;
          const back = 1 + ((i - a.leader) % 3) * 0.9;
          [qx, qz, dir] = [leader.lastX - Math.sin(lh) * back, leader.lastZ! + Math.cos(lh) * back, lh];
        } else {
          // On and on along the pavements: at the end of one, across to the next that carries on
          // (over a side road if need be); back the other way only at a real dead end.
          const tt = t - held;
          if (a.legT === undefined) {
            a.rev = hash(i, 41) < 0.5;
            a.legT = tt - (a.s0 % a.run.total) / a.speed;
            a.cross = null;
          }
          let d = (tt - a.legT) * a.speed;
          for (let guard = 0; guard < 4; guard++) {
            if (a.cross) {
              if (d < a.cross.len) break;
              a.legT += a.cross.len / a.speed;
              a.cross = null;
              d = (tt - a.legT) * a.speed;
              continue;
            }
            if (d <= a.run.total) break;
            this.nextLeg(a);
            d = (tt - a.legT!) * a.speed;
          }
          if (a.cross) {
            const c = a.cross;
            // At the kerb: wait until no vehicle is on the way across, then go.
            if (d < 0.6 && this.vehicleAt && Math.abs(c.ax - x) < 70 && Math.abs(c.az - z) < 70) {
              let busy = false;
              for (const k of [0.2, 0.5, 0.8]) if (this.vehicleAt(c.ax + (c.bx - c.ax) * k, c.az + (c.bz - c.az) * k, 3)) busy = true;
              if (busy && !leader) {
                a.held = (a.held ?? 0) + dt;
                d = Math.max(0, d - a.speed * dt);
              }
            }
            const k = Math.max(0, Math.min(1, d / (c.len || 1)));
            [qx, qz] = [c.ax + (c.bx - c.ax) * k, c.az + (c.bz - c.az) * k];
            dir = Math.atan2(c.bx - c.ax, -(c.bz - c.az));
          } else {
            const w = a.run;
            const sAt = Math.max(0, Math.min(w.total, a.rev ? w.total - d : d));
            [qx, qz, dir] = this.pointOn(w, sAt);
            if (a.rev) forward = false;
          }
        }
        heading = forward ? dir : dir + Math.PI;
        if (a.still) heading = dir;
        // Keep to the right of the pavement a little, so people pass each other.
        const side = (a.still ? a.lateral : 0.45 * (forward ? 1 : -1) + a.lateral * 0.5) * (leader ? 0.6 : 1);
        px = qx + Math.cos(dir) * side;
        pz = qz + Math.sin(dir) * side;
        if (a.still) heading = dir + (a.lateral > 0 ? Math.PI / 2 : -Math.PI / 2);
        a.lastH = heading;
        // Talking with the player: stand still, face them, talk with the hands.
        if ((a.talkUntil ?? 0) > t) {
          if (!a.still) a.held = (a.held ?? 0) + dt;
          if (a.lastX !== undefined) [px, pz] = [a.lastX, a.lastZ!];
          heading = Math.atan2(a.faceX! - px, -(a.faceZ! - pz));
          if (!a.waiting) {
            a.waiting = true;
            batch.setLook(a.slot, a.look, 'talk', t);
          }
        }
        // A vehicle in the way: wait where you are (standing, not walking on the spot) until it moves.
        else if (!a.still && this.vehicleAt && Math.abs(px - x) < 60 && Math.abs(pz - z) < 60 && this.vehicleAt(px, pz, 0.35)) {
          if (!leader) a.held = (a.held ?? 0) + dt;
          if (a.lastX !== undefined) [px, pz] = [a.lastX, a.lastZ!];
          // If the vehicle comes right up to where they stand, they step aside out of its way.
          const b = this.vehicleAt(px, pz, 0.2);
          if (b) {
            const side = (px - b.x) * -b.fz + (pz - b.z) * b.fx;
            const out = b.halfW + 0.3 - Math.abs(side);
            px += -b.fz * out * Math.sign(side || 1);
            pz += b.fx * out * Math.sign(side || 1);
          }
          if (!a.waiting) {
            a.waiting = true;
            batch.setLook(a.slot, a.look, 'idle', t);
          }
        } else if (a.waiting) {
          a.waiting = false;
          if (a.still) batch.setLook(a.slot, a.look, hash(i, 5) < 0.6 ? 'talk' : 'idle', t);
          else batch.setLook(a.slot, a.look, 'walk', t, a.speed / (1.35 * a.look.scale));
        }
        a.lastX = px;
        a.lastZ = pz;
      } else {
        // No pavements nearby yet: hide.
        this.m.makeScale(0, 0, 0);
        batch.mesh.setMatrixAt(a.slot, this.m);
        continue;
      }
      this.q.setFromAxisAngle(this.up, Math.PI - heading);
      const gy = this.groundDip ? -this.groundDip(px, pz) : 0;
      this.m.compose(this.p.set(px, gy, pz), this.q, this.sc.setScalar(a.look.scale));
      batch.mesh.setMatrixAt(a.slot, this.m);
      if (Math.abs(px - x) < 25 && Math.abs(pz - z) < 25) close++;
      // School children always carry a bag on their back; some grown-ups too.
      const bag = !a.look.load && (a.kind === 'pupil' || (a.kind === 'child' && hash(i, 31) < 0.6) || ((a.kind === 'man' || a.kind === 'woman') && hash(i, 31) < 0.22));
      if (bag) {
        const bob = a.still ? 0 : Math.abs(Math.sin(t * Math.PI * 2 * (a.speed / 1.35))) * 0.02;
        this.m.compose(this.p.set(px, bob + gy, pz), this.q, this.sc.setScalar(a.look.scale * (a.look.body === 'female' ? 0.96 : 1)));
        this.bags.setMatrixAt(bagCount, this.m);
        this.bags.setColorAt(bagCount++, this.colour.setHex(BAG_COLOURS[Math.floor(hash(i, 32) * BAG_COLOURS.length)]));
      }
      if (a.look.load) {
        const top = (a.look.body === 'female' ? 1.74 : 1.8) * a.look.scale;
        const bob = a.still ? 0 : Math.abs(Math.sin(t * Math.PI * 2 * (a.speed / 1.35))) * 0.025;
        this.m.compose(this.p.set(px, top + bob + gy, pz), this.q, this.sc.setScalar(1));
        this.loads[a.look.load].setMatrixAt(loadCount[a.look.load]++, this.m);
      }
      if (shadows < this.shadowBatch.instanceMatrix.count) {
        const r = 0.75 * a.look.scale;
        this.m.compose(this.p.set(px, 0.03 + gy, pz), this.q, this.sc.set(r, 1, r));
        this.shadowBatch.setMatrixAt(shadows++, this.m);
      }
    }
    for (const b of Object.values(this.crowds)) b!.mesh.instanceMatrix.needsUpdate = true;
    this.bags.count = bagCount;
    this.bags.instanceMatrix.needsUpdate = true;
    if (this.bags.instanceColor) this.bags.instanceColor.needsUpdate = true;
    for (const k of ['basin', 'tray'] as const) {
      this.loads[k].count = loadCount[k];
      this.loads[k].instanceMatrix.needsUpdate = true;
    }
    this.shadowBatch.count = shadows;
    this.shadowBatch.instanceMatrix.needsUpdate = true;
    this.nearCount = close;
  }

  // Far from the player now (checked a few times a second per person, not every frame).
  private tooFar(a: Agent, x: number, z: number, t: number, far: number) {
    if (Math.floor(t * 3) % 7 !== a.slot % 7) return false;
    if (a.lastX !== undefined) return Math.hypot(a.lastX - x, a.lastZ! - z) > far;
    const w = a.run!;
    const [px, pz] = this.pointOn(w, a.s0 % w.total);
    return Math.hypot(px - x, pz - z) > far;
  }

  /** At the end of a pavement: the next one that carries on (crossing to it), or back the way they came. */
  private nextLeg(a: Agent) {
    const w = a.run!;
    a.legT! += w.total / a.speed;
    const n = w.pts.length;
    const [ex, ez] = a.rev ? [w.pts[0], w.pts[1]] : [w.pts[n - 2], w.pts[n - 1]];
    // The way they were going at the end.
    const [px, pz] = a.rev ? [w.pts[2], w.pts[3]] : [w.pts[n - 4], w.pts[n - 3]];
    const gx = ex - px;
    const gz = ez - pz;
    const gl = Math.hypot(gx, gz) || 1;
    let best: { w: Walkway; rev: boolean; x: number; z: number; score: number } | null = null;
    for (const o of this.nearWalkways) {
      if (o === w || o.total < 6) continue;
      const m = o.pts.length;
      for (const [atEnd, ox, oz] of [[false, o.pts[0], o.pts[1]], [true, o.pts[m - 2], o.pts[m - 1]]] as const) {
        const d = Math.hypot(ox - ex, oz - ez);
        if (d > 13) continue;
        // Which way the next one goes from there, compared with the way they were walking.
        const [nx, nz] = atEnd ? [o.pts[m - 4], o.pts[m - 3]] : [o.pts[2], o.pts[3]];
        const dot = ((nx - ox) * gx + (nz - oz) * gz) / ((Math.hypot(nx - ox, nz - oz) || 1) * gl);
        if (dot < -0.3) continue; // that would send them back
        const score = d - dot * 6 + hash(ox, oz + a.slot) * 3;
        if (!best || score < best.score) best = { w: o, rev: atEnd, x: ox, z: oz, score };
      }
    }
    if (best) {
      a.cross = { ax: ex, az: ez, bx: best.x, bz: best.z, len: Math.hypot(best.x - ex, best.z - ez) };
      a.run = best.w;
      a.rev = best.rev;
    } else a.rev = !a.rev; // a real dead end: back the way they came
  }
}
