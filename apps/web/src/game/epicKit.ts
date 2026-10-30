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
/** The pack's own glow by day (0.58 before 30 Oct 2026; the owner found the city too bright and flat:
 *  less glow lets the sun's light and shade model the shapes). */
export const DAY_GLOW = 0.3;

/** The one material all pack pieces share (one material = fewer draw calls on the phone). */
export function epicMaterial() {
  if (!material) material = makeEpic(false);
  return material;
}
let roadMaterial: THREE.MeshStandardMaterial | null = null;
/**
 * The pack's material for the roads (epicRoads.ts): the same colours, plus the look of an Accra road
 * drawn on top by the graphics card (owner, 30 Oct 2026: "it has to look Ghanaian… very beautiful"):
 * warm sun-faded tarmac with a fine grain, darker patches of newer tarmac, red laterite dust blown
 * over it, worn lines, and dusty, weathered pavements. No pictures to download.
 */
export function epicRoadMaterial() {
  if (!roadMaterial) roadMaterial = makeEpic(true);
  return roadMaterial;
}
/** Light phones have no blue sky light: their tarmac is drawn a little cooler to stay grey. */
export function setRoadLite(on: boolean) {
  const m = epicRoadMaterial();
  m.defines = on ? { EPIC_ROAD: '', EPIC_ROAD_LITE: '' } : { EPIC_ROAD: '' };
  m.needsUpdate = true;
}
function makeEpic(road: boolean) {
  {
    atlas ??= tex('albedo.png');
    dayGlow ??= tex('emission.png');
    nightGlow ??= tex('emission-night.png');
    const material = new THREE.MeshStandardMaterial({ name: road ? 'epic-road' : 'epic-atlas', map: atlas, emissiveMap: dayGlow, emissive: new THREE.Color(DAY_GLOW, DAY_GLOW, DAY_GLOW), roughness: 0.9, metalness: 0 });
    if (road) material.defines = { EPIC_ROAD: '' };
    // At night the lit windows and signs glow block by block: mostly warm lamplight, a few softly
    // pink, violet or cyan (owner, 29 Oct 2026: neon "very slightly, not too bulky"). By day: the
    // pack's own glow, untouched.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uNeon = neon;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
varying vec3 vNeonPos;`)
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 neonP = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            neonP = instanceMatrix * neonP;
          #endif
          vNeonPos = (modelMatrix * neonP).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vNeonPos;
uniform float uNeon;
#ifdef EPIC_ROAD
float roadHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float roadNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(roadHash(i), roadHash(i + vec2(1.0, 0.0)), f.x), mix(roadHash(i + vec2(0.0, 1.0)), roadHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
#endif`)
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          #ifdef EPIC_ROAD
          {
            vec3 c = diffuseColor.rgb;
            vec2 w = vNeonPos.xz;
            float lum = dot(c, vec3(0.299, 0.587, 0.114));
            float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
            float big = roadNoise(w * 0.3);              // blotches of about 3 m
            float wide = roadNoise(w * 0.07 + 7.3);      // about 14 m: where the dust lies
            float grain = roadHash(floor(w * 9.0));      // 11 cm grain
            if (lum < 0.09 && sat < 0.03) {
              // The tarmac: sun-faded grey with grain and blotches (a touch cool, so the warm Accra sun
              // leaves it grey, not brown, also on Light phones that have no blue sky light).
              c *= vec3(1.14, 1.2, 1.32) * (0.86 + 0.22 * big + 0.12 * (grain - 0.5));
              #ifdef EPIC_ROAD_LITE
              c *= vec3(0.86, 1.0, 1.34); // (no blue sky light on Light phones: cooler still, or it reads brown)
              #endif
              // Patches of newer, darker tarmac where the road was mended.
              if (roadNoise(floor(w / 2.4) * 0.41 + 3.1) > 0.8) c *= 0.7;
              // Red laterite dust blown over it.
              c = mix(c, vec3(0.32, 0.14, 0.06), smoothstep(0.62, 0.98, wide) * 0.22); // (a hint: more read as mud)
            } else if (lum > 0.2 && lum < 0.55 && sat < 0.06) {
              // Pavements and kerbs: weathered concrete, dusty in places.
              c *= 0.88 + 0.18 * big + 0.1 * (grain - 0.5);
              c = mix(c, vec3(0.5, 0.27, 0.14), smoothstep(0.55, 0.95, wide) * 0.2);
            } else {
              // The painted lines: worn by the traffic.
              c = mix(c, vec3(0.08), (1.0 - smoothstep(0.15, 0.6, big)) * 0.25 + 0.1 * grain);
            }
            diffuseColor.rgb = c;
          }
          #endif`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          if (uNeon > 0.0) {
            vec2 cell = floor(vNeonPos.xz / 13.0);
            float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            // Mostly warm lamplight; now and then a soft neon (only a hint: owner, 29 Oct 2026).
            vec3 tint = h < 0.08 ? vec3(1.0, 0.45, 0.8) : h < 0.14 ? vec3(0.75, 0.5, 1.0) : h < 0.2 ? vec3(0.45, 0.9, 1.0)
              : h < 0.6 ? vec3(1.0, 0.8, 0.55) : vec3(1.0, 0.92, 0.78);
            totalEmissiveRadiance *= mix(vec3(1.0), tint * 1.15, uNeon);
          }`,
        );
    };
    material.customProgramCacheKey = () => (road ? 'epic-road' + ('EPIC_ROAD_LITE' in (material.defines ?? {}) ? '-lite' : '') : 'epic-neon');
    return material;
  }
}
const neon = { value: 0 };

/** The pack's two glow sheets (by day, at night), for materials made from the pack's. */
export function epicGlowMaps() {
  epicMaterial();
  return { day: dayGlow!, night: nightGlow! };
}

/** Day or night look of the pack (the night glow sheet and the pack's night glow colour). */
export function setEpicNight(on: boolean) {
  for (const m of [epicMaterial(), epicRoadMaterial()]) {
    m.emissiveMap = on ? nightGlow : dayGlow;
    m.emissive.setRGB(on ? 1.3 : DAY_GLOW, on ? 1.15 : DAY_GLOW, on ? 1.05 : DAY_GLOW); // (white: the neon colours tint it)
    m.emissiveIntensity = on ? 1.6 : 1;
    m.needsUpdate = true;
  }
  neon.value = on ? 1 : 0;
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
  else m.emissive.setRGB(DAY_GLOW, DAY_GLOW, DAY_GLOW);
  m.needsUpdate = true;
}
