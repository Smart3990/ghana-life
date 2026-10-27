// The Low Poly Epic City pack's look, shared by everything built from it (public/models/epic).
// Every pack model uses one texture sheet (the atlas) of flat colours, plus a glow sheet: by day the
// glow is dim, at night the pack's night glow sheet lights the windows, lamps and signs.
// The game switches between them by the real time in Accra (dayNight.ts).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BASE = '/models/epic/tex/';
const loader = new THREE.TextureLoader();
function tex(name: string) {
  const t = loader.load(BASE + name);
  t.colorSpace = THREE.SRGBColorSpace;
  // The atlas is mostly flat colour cells: no blurring between cells far away.
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapNearestFilter;
  t.anisotropy = 4;
  return t;
}
let atlas: THREE.Texture | null = null;
let dayGlow: THREE.Texture | null = null;
let nightGlow: THREE.Texture | null = null;
let material: THREE.MeshStandardMaterial | null = null;

/** The one material all pack pieces share (one material = fewer draw calls on the phone). */
export function epicMaterial() {
  if (!material) {
    atlas = tex('albedo.png');
    dayGlow = tex('emission.png');
    nightGlow = tex('emission-night.png');
    material = new THREE.MeshStandardMaterial({ name: 'epic-atlas', map: atlas, emissiveMap: dayGlow, emissive: new THREE.Color(0.58, 0.58, 0.58), roughness: 0.9, metalness: 0 });
  }
  return material;
}

/** The pack's two glow sheets (by day, at night), for materials made from the pack's. */
export function epicGlowMaps() {
  epicMaterial();
  return { day: dayGlow!, night: nightGlow! };
}

/** Day or night look of the pack (the night glow sheet and the pack's night glow colour). */
export function setEpicNight(on: boolean) {
  const m = epicMaterial();
  m.emissiveMap = on ? nightGlow : dayGlow;
  m.emissive.setRGB(on ? 1.24 : 0.58, on ? 0.68 : 0.58, on ? 0.68 : 0.58);
  m.emissiveIntensity = on ? 1.6 : 1;
  m.needsUpdate = true;
}

/**
 * Places on the atlas for the colours the pack's roads use (measured from its road pieces:
 * tile-road-straight and tile-mainroad-straight). A shape given this texture position gets exactly
 * the pack's colour, by day and by night.
 */
export const EPIC_UV = {
  asphalt: [0.172, 0.665], // #3f3c3c
  pavement: [0.5666, 0.6348], // #a7a19e
  kerb: [0.6046, 0.7336], // #a7a19e, the kerb's face
  yellow: [0.6641, 0.5587], // #fdcf24, the main road's centre line
  white: [0.8159, 0.6861], // #dbdbda, lane dashes
  grass: [0.4245, 0.3819], // #508e34
} as const;

const gltf = new GLTFLoader();
gltf.setMeshoptDecoder(MeshoptDecoder);
const geometries = new Map<string, Promise<THREE.BufferGeometry>>();
/** A plain number copy of an attribute (the files store small packed numbers). */
function toFloat(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: number) {
  const out = new Float32Array(a.count * size);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
  return new THREE.BufferAttribute(out, size);
}
/**
 * One pack model as a single shape (all its parts joined, in metres), for drawing many copies at once
 * with the pack's material. `turn` turns it about the up axis (radians) first.
 */
export function epicGeometry(file: string, turn = 0): Promise<THREE.BufferGeometry> {
  const k = file + '@' + turn;
  if (!geometries.has(k)) {
    geometries.set(k, gltf.loadAsync('/models/epic/' + file).then((g) => {
      const parts: THREE.BufferGeometry[] = [];
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.geometry;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', toFloat(src.getAttribute('position'), 3));
        geo.setAttribute('normal', toFloat(src.getAttribute('normal'), 3));
        geo.setAttribute('uv', toFloat(src.getAttribute('uv'), 2));
        if (src.index) geo.setIndex(Array.from(src.index.array));
        geo.applyMatrix4(mesh.matrixWorld);
        parts.push(geo);
      });
      const merged = mergeGeometries(parts)!;
      if (turn) merged.rotateY(turn);
      merged.computeBoundingSphere();
      return merged;
    }));
  }
  return geometries.get(k)!;
}

// ---------- Street lights at night (shared by the streets and the flyovers) ----------
let lampMat: THREE.MeshStandardMaterial | null = null;
let poolMat: THREE.MeshBasicMaterial | null = null;
let lampsLit = false;
/** The road lamps' material: the pack's, with the lamp heads glowing sodium yellow at night. */
export function epicLampMaterial() {
  if (!lampMat) lampMat = epicMaterial().clone();
  return lampMat;
}
/** A flat square of light (soft at the edges, even in the middle), stretched to the area a lamp lights. */
export function lightPoolGeometry() {
  return new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
}
export function lightPoolMaterial() {
  if (!poolMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    poolMat = new THREE.MeshBasicMaterial({ map: t, color: 0xffa83c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  }
  return poolMat;
}
/** 0 by day, 1 at night: lamp heads yellow, the ground lit under them. */
export function setEpicLampNight(n: number) {
  lightPoolMaterial().opacity = 0.48 * n;
  const lit = n > 0.5;
  if (lit === lampsLit && lampMat) return;
  lampsLit = lit;
  const m = epicLampMaterial();
  const glow = epicGlowMaps();
  m.emissiveMap = lit ? glow.night : glow.day;
  if (lit) m.emissive.setRGB(1.5, 0.9, 0.32);
  else m.emissive.setRGB(0.58, 0.58, 0.58);
  m.needsUpdate = true;
}
