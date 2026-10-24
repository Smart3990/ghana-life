// Big crowds: hundreds of people drawn in one go per body (man, woman). Their walking, standing and
// chatting moves are worked out once when the game starts and stored in a small texture; the graphics
// card then animates every person from it, each at their own moment. The phone's processor only moves
// people along the pavements. Each person has their own skin tone, clothes and size.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKIN_TONES } from './person';

export type CrowdBody = 'male' | 'female';
export type Clip = 'walk' | 'idle' | 'talk';
const CLIP_NAMES: Record<Clip, string> = { walk: 'Walk_Loop', idle: 'Idle_Loop', talk: 'Idle_Talking_Loop' };
const CLIP_FPS: Record<Clip, number> = { walk: 30, idle: 12, talk: 12 };
const URL: Record<CrowdBody, string> = { male: '/models/person-mass.glb', female: '/models/person-female-mass.glb' };

/** How one person looks. Colours are CSS colours; scale 1 is an adult (children about 0.62). */
export type Look = { body: CrowdBody; skin: string; top: string; bottom: string; shoes: string; hair: string; scale: number };

type Baked = { geometry: THREE.BufferGeometry; bones: THREE.DataTexture; clips: Record<Clip, { row: number; frames: number; fps: number; length: number }>; map: THREE.Texture | null };

// Works out every bone's matrix for every frame of the three moves, and joins the model's parts
// (body, hair, eyebrows) into one shape.
async function bake(body: CrowdBody): Promise<Baked> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(URL[body]);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && meshes.push(o as THREE.SkinnedMesh));
  const bodyMesh = meshes.find((m) => (m.material as THREE.Material).name === 'body') ?? meshes[0];
  const bones = bodyMesh.skeleton.bones;
  const boneIndex = new Map(bones.map((b, i) => [b, i]));

  // Each part in the body's skeleton order, with "part" = 0 for skin and clothes, 1 for hair.
  const parts = meshes.map((m) => {
    const g = m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(name)) g.deleteAttribute(name);
    // The file stores positions, normals and UVs as compressed whole numbers: unpack them into plain
    // numbers first, or moving them into bind space would clip them.
    for (const name of ['position', 'normal', 'uv']) {
      const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (!a || a.array instanceof Float32Array) continue;
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    // Into bind space, and into the body's bone numbering.
    g.applyMatrix4(m.bindMatrix);
    if (m !== bodyMesh) {
      // Each part's skeleton data includes its own compression scale: convert into the body's.
      const own = m.skeleton.bones[0];
      const k = boneIndex.get(own) ?? 0;
      const toBody = bodyMesh.skeleton.boneInverses[k].clone().invert().multiply(m.skeleton.boneInverses[0]);
      g.applyMatrix4(toBody);
    }
    const si = g.getAttribute('skinIndex');
    const remapped = new Float32Array(si.count * 4);
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) remapped[i * 4 + k] = boneIndex.get(m.skeleton.bones[si.getComponent(i, k)]) ?? 0;
    g.setAttribute('skinIndex', new THREE.Float32BufferAttribute(remapped, 4));
    const sw = g.getAttribute('skinWeight');
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Float32Array.from({ length: sw.count * 4 }, (_, i) => sw.getComponent(Math.floor(i / 4), i % 4)), 4));
    const isHair = (m.material as THREE.Material).name !== 'body';
    g.setAttribute('part', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(isHair ? 1 : 0), 1));
    return g;
  });
  const geometry = mergeGeometries(parts, false)!;

  // Bake: root-space matrix of each bone, per frame.
  const mixer = new THREE.AnimationMixer(root);
  const clips = {} as Baked['clips'];
  const rows: Float32Array[] = [];
  const meshWorld = bodyMesh.matrixWorld.clone().multiply(bodyMesh.bindMatrixInverse);
  const m = new THREE.Matrix4();
  for (const clip of Object.keys(CLIP_NAMES) as Clip[]) {
    const source = THREE.AnimationClip.findByName(gltf.animations, CLIP_NAMES[clip]) ?? gltf.animations[0];
    const action = mixer.clipAction(source);
    mixer.stopAllAction();
    action.play();
    const fps = CLIP_FPS[clip];
    const frames = Math.max(1, Math.round(source.duration * fps));
    clips[clip] = { row: rows.length, frames, fps, length: source.duration };
    for (let f = 0; f < frames; f++) {
      mixer.setTime(f / fps);
      root.updateMatrixWorld(true);
      const row = new Float32Array(bones.length * 16);
      bones.forEach((b, i) => {
        m.multiplyMatrices(meshWorld, b.matrixWorld).multiply(bodyMesh.skeleton.boneInverses[i]);
        m.toArray(row, i * 16);
      });
      rows.push(row);
    }
  }
  const width = bones.length * 4;
  const data = new Float32Array(width * rows.length * 4);
  rows.forEach((r, y) => data.set(r, y * width * 4));
  const tex = new THREE.DataTexture(data, width, rows.length, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  const map = (bodyMesh.material as THREE.MeshStandardMaterial).map;
  return { geometry, bones: tex, clips, map };
}

// The shared crowd material: the body texture's clothes mask, coloured per person.
function crowdMaterial(baked: Baked, time: { value: number }) {
  const material = new THREE.MeshStandardMaterial({ map: baked.map, roughness: 0.8, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBones = { value: baked.bones };
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute float part;
attribute vec4 aAnim; // first row, frames, frames per second, start time
attribute vec4 aColA; // skin, top, bottom, shoes (packed 0xRRGGBB)
attribute float aHair;
uniform highp sampler2D uBones;
uniform float uTime;
varying vec3 vSkinC; varying vec3 vTopC; varying vec3 vBottomC; varying vec3 vShoesC; varying vec3 vHairC;
varying float vPart;
vec3 unpackColour(float f) {
  float r = floor(f / 65536.0);
  float g = floor((f - r * 65536.0) / 256.0);
  float b = f - r * 65536.0 - g * 256.0;
  return vec3(r, g, b) / 255.0;
}
mat4 boneAt(float row, float bone) {
  int x = int(bone) * 4;
  int y = int(row);
  return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0),
              texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0));
}
void main() {
  vSkinC = unpackColour(aColA.x); vTopC = unpackColour(aColA.y); vBottomC = unpackColour(aColA.z);
  vShoesC = unpackColour(aColA.w); vHairC = unpackColour(aHair); vPart = part;
  float frame = mod(floor((uTime - aAnim.w) * aAnim.z), aAnim.y);
  float row = aAnim.x + frame;
  mat4 skin = boneAt(row, skinIndex.x) * skinWeight.x + boneAt(row, skinIndex.y) * skinWeight.y
            + boneAt(row, skinIndex.z) * skinWeight.z + boneAt(row, skinIndex.w) * skinWeight.w;`,
      )
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  // The bone matrices carry the file\'s compression scale (not the same on every axis), so normals\n  // need the inverse-transpose to stay at right angles to the surface.\n  objectNormal = normalize(transpose(inverse(mat3(skin))) * objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = (skin * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'varying vec3 vSkinC; varying vec3 vTopC; varying vec3 vBottomC; varying vec3 vShoesC; varying vec3 vHairC;\nvarying float vPart;\nvoid main() {\n  vec4 partWeights = vec4(1.0, 0.0, 0.0, 0.0);\n  float soleWeight = 0.0;',
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  if (vPart > 0.5) {
    diffuseColor.rgb *= vHairC; // hair, caps and headscarves
  } else {
    vec4 texel = texture2D(map, vMapUv);
    vec4 centres = vec4(16.0, 76.0, 136.0, 196.0) / 255.0;
    partWeights = clamp(1.0 - abs(texel.a - centres) / (60.0 / 255.0), 0.0, 1.0);
    soleWeight = clamp(1.0 - abs(texel.a - 1.0) / (59.0 / 255.0), 0.0, 1.0);
    float total = max(dot(partWeights, vec4(1.0)) + soleWeight, 1e-4);
    partWeights /= total;
    soleWeight /= total;
    vec3 tint = vSkinC * partWeights.x + vTopC * partWeights.y + vBottomC * partWeights.z + vShoesC * partWeights.w + vec3(soleWeight);
    diffuseColor.rgb *= texel.rgb * tint;
  }
#endif`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = vPart > 0.5 ? 0.9 : dot(partWeights, vec4(0.55, 0.85, 0.92, 0.6)) + soleWeight * 0.8;');
  };
  material.customProgramCacheKey = () => 'ghanaverse-crowd';
  return material;
}

const packColour = (css: string, c = new THREE.Color()) => {
  c.set(css); // three.js turns CSS colours into the linear colours the shader works in
  return Math.round(c.r * 255) * 65536 + Math.round(c.g * 255) * 256 + Math.round(c.b * 255);
};

/** One body's crowd: up to `capacity` people. */
export class CrowdBatch {
  readonly mesh: THREE.InstancedMesh;
  private anim: THREE.InstancedBufferAttribute;
  private colA: THREE.InstancedBufferAttribute;
  private hair: THREE.InstancedBufferAttribute;
  count = 0;

  private constructor(private baked: Baked, capacity: number, time: { value: number }) {
    const g = baked.geometry.clone();
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.colA = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.hair = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    g.setAttribute('aAnim', this.anim);
    g.setAttribute('aColA', this.colA);
    g.setAttribute('aHair', this.hair);
    this.mesh = new THREE.InstancedMesh(g, crowdMaterial(baked, time), capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  static async create(body: CrowdBody, capacity: number, time: { value: number }) {
    return new CrowdBatch(await bake(body), capacity, time);
  }

  /** Sets person i's look and move (only when they change: it's a buffer upload). */
  setLook(i: number, look: Look, clip: Clip, startTime: number, rate = 1) {
    const c = this.baked.clips[clip];
    this.anim.setXYZW(i, c.row, c.frames, c.fps * rate, startTime);
    this.colA.setXYZW(i, packColour(look.skin), packColour(look.top), packColour(look.bottom), packColour(look.shoes));
    this.hair.setX(i, packColour(look.hair));
    this.anim.needsUpdate = this.colA.needsUpdate = this.hair.needsUpdate = true;
  }

  /** How many seconds one walking step cycle lasts (to match feet to speed). */
  get walkLength() {
    return this.baked.clips.walk.length;
  }
}

// ---------- Who is out on the streets of Accra ----------

const pick = <T,>(list: T[], r: number) => list[Math.floor(r * list.length) % list.length];
const SKINS = [SKIN_TONES.deep, SKIN_TONES.veryDeep, SKIN_TONES.medium, SKIN_TONES.deep, SKIN_TONES.veryDeep];
const BRIGHT = ['#2f7d55', '#e3a92b', '#c8442e', '#1f5fa8', '#f2efe6', '#6b4f93', '#151515', '#d98a3a', '#0e8f8a', '#b8325a'];
const DARK = ['#2a3446', '#3b3b3b', '#1d1d1f', '#4a3a2a', '#2f3f5f'];
const PRINTS = ['#c8442e', '#e3a92b', '#2f7d55', '#7a3e9d', '#1f5fa8', '#d65a1f', '#0e8f8a'];

export type Kind = 'man' | 'woman' | 'muslimMan' | 'muslimWoman' | 'church' | 'child' | 'pupil' | 'kayayo' | 'hawker';
/** Roughly how Accra's pavements mix (out of 100). */
export const MIX: [Kind, number][] = [
  ['man', 24], ['woman', 22], ['muslimMan', 8], ['muslimWoman', 8], ['church', 7], ['child', 8], ['pupil', 12], ['kayayo', 6], ['hawker', 5],
];

/** A person's look from their kind and some fixed random numbers. */
export function lookFor(kind: Kind, r: (k: number) => number): Look & { load: 'basin' | 'tray' | null } {
  const skin = pick(SKINS, r(1));
  const shoes = pick(['#2b2b2e', '#5a3a22', '#ecebe6', '#8a6a4a'], r(2));
  switch (kind) {
    case 'man':
      return { body: 'male', skin, top: pick(BRIGHT, r(3)), bottom: pick([...DARK, '#c9b48a', '#1f5fa8'], r(4)), shoes, hair: '#141110', scale: 0.95 + r(5) * 0.1, load: null };
    case 'woman':
      return { body: 'female', skin, top: pick(BRIGHT, r(3)), bottom: pick(PRINTS, r(4)), shoes, hair: '#141110', scale: 0.94 + r(5) * 0.08, load: null };
    case 'muslimMan': {
      // A long kaftan (top and trousers the same pale colour) and a white cap.
      const robe = pick(['#f2efe6', '#e8e4d8', '#cfd8dc', '#d9cfb8', '#ffffff'], r(3));
      return { body: 'male', skin, top: robe, bottom: robe, shoes: '#5a3a22', hair: '#f4f2ea', scale: 0.96 + r(5) * 0.08, load: null };
    }
    case 'muslimWoman': {
      // A headscarf and a long dress in the same or matching colour.
      const scarf = pick(['#1d1d1f', '#2f3f5f', '#6b1f2b', '#2f5f3a', '#7a5a8a', '#c9b48a'], r(3));
      return { body: 'female', skin, top: scarf, bottom: r(4) < 0.6 ? scarf : pick(DARK, r(6)), shoes: '#2b2b2e', hair: scarf, scale: 0.94 + r(5) * 0.08, load: null };
    }
    case 'church': {
      // Smart clothes: a white shirt and dark trousers, or a bright print top and skirt.
      if (r(3) < 0.5) return { body: 'male', skin, top: '#f7f7f4', bottom: '#1d1d1f', shoes: '#1a1a1a', hair: '#141110', scale: 0.97 + r(5) * 0.07, load: null };
      const print = pick(PRINTS, r(4));
      return { body: 'female', skin, top: print, bottom: print, shoes: '#1a1a1a', hair: '#141110', scale: 0.95 + r(5) * 0.07, load: null };
    }
    case 'child':
      return { body: r(3) < 0.5 ? 'male' : 'female', skin, top: pick(BRIGHT, r(4)), bottom: pick([...BRIGHT, ...DARK], r(6)), shoes, hair: '#141110', scale: 0.55 + r(5) * 0.12, load: null };
    case 'pupil':
      // Public basic school uniform: mustard top, brown shorts or skirt.
      return { body: r(3) < 0.5 ? 'male' : 'female', skin, top: '#d7a227', bottom: '#6b4423', shoes: '#1a1a1a', hair: '#141110', scale: 0.6 + r(5) * 0.12, load: null };
    case 'kayayo':
      return { body: 'female', skin, top: pick(BRIGHT, r(3)), bottom: pick(PRINTS, r(4)), shoes: '#5a3a22', hair: pick(PRINTS, r(6)), scale: 0.92 + r(5) * 0.08, load: 'basin' };
    case 'hawker':
      return { body: r(3) < 0.6 ? 'female' : 'male', skin, top: pick(BRIGHT, r(4)), bottom: pick([...DARK, ...PRINTS], r(6)), shoes, hair: '#141110', scale: 0.95 + r(5) * 0.08, load: 'tray' };
  }
}
