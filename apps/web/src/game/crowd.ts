// Big crowds: hundreds of people drawn in one go per body (man, woman). Their walking, standing and
// chatting moves are worked out once when the game starts and stored in a small texture; the graphics
// card then animates every person from it, each at their own moment. The phone's processor only moves
// people along the pavements. Each person has their own skin tone, clothes and size.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { SKIN_TONES } from './person';

export type CrowdBody = 'male' | 'female';
// Everything people in the street can be seen doing.
const CLIP_NAMES = {
  walk: 'Walk_Loop',
  idle: 'Idle_Loop',
  talk: 'Idle_Talking_Loop',
  jog: 'Jog_Fwd_Loop',
  phone: 'Idle_TalkingPhone_Loop',
  eat: 'Consume', // eating or drinking
  sell: 'Idle_FoldArms_Loop', // a seller waiting for customers
  carry: 'Walk_Carry_Loop',
  yes: 'Yes',
  no: 'Idle_No_Loop',
  call: 'Idle_Rail_Call', // calling out, waving someone over
  sit: 'Sitting_Idle_Loop',
  sitTalk: 'Sitting_Talking_Loop',
  dance: 'Dance_Loop',
  serve: 'PickUp_Table', // picking something up from a table
  pick: 'Farm_Harvest', // bending down to pick up goods
  push: 'Push_Loop', // pushing a cart
  fix: 'Fixing_Kneeling',
  hand: 'Interact', // handing something over
} as const;
export type Clip = keyof typeof CLIP_NAMES;
// Moving clips need smooth frames; standing ones look fine with fewer (saves memory).
const CLIP_FPS = (clip: Clip) => (clip === 'walk' || clip === 'jog' || clip === 'carry' || clip === 'push' || clip === 'dance' ? 30 : 12);
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
    // Parts: 0 skin and clothes (the body texture's mask), 1 hair (and eyebrows, caps, scarves), 2 eyes.
    const name = (m.material as THREE.Material).name;
    const part = name === 'body' ? 0 : name === 'eyes' ? 2 : 1;
    g.setAttribute('part', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(part), 1));
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
    const fps = CLIP_FPS(clip);
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
  // Half-precision numbers: half the memory, and still accurate to about a millimetre here.
  const data = new Uint16Array(width * rows.length * 4);
  rows.forEach((r, y) => {
    for (let i = 0; i < r.length; i++) data[y * width * 4 + i] = THREE.DataUtils.toHalfFloat(r[i]);
  });
  const tex = new THREE.DataTexture(data, width, rows.length, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  const map = (bodyMesh.material as THREE.MeshStandardMaterial).map;
  return { geometry, bones: tex, clips, map };
}

// The shared crowd material: the body texture's clothes mask, coloured per person.
function crowdMaterial(baked: Baked, time: { value: number }, smooth: boolean) {
  const material = new THREE.MeshStandardMaterial({ map: baked.map, roughness: 0.8, metalness: 0 });
  if (smooth) material.defines = { SMOOTH_FRAMES: '' };
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
  float f = (uTime - aAnim.w) * aAnim.z;
  float frame = mod(floor(f), aAnim.y);
  float row = aAnim.x + frame;
  mat4 skin = boneAt(row, skinIndex.x) * skinWeight.x + boneAt(row, skinIndex.y) * skinWeight.y
            + boneAt(row, skinIndex.z) * skinWeight.z + boneAt(row, skinIndex.w) * skinWeight.w;
#ifdef SMOOTH_FRAMES
  // Blend towards the next stored frame, so movement is smooth at 60 frames a second.
  float row2 = aAnim.x + mod(frame + 1.0, aAnim.y);
  mat4 skin2 = boneAt(row2, skinIndex.x) * skinWeight.x + boneAt(row2, skinIndex.y) * skinWeight.y
             + boneAt(row2, skinIndex.z) * skinWeight.z + boneAt(row2, skinIndex.w) * skinWeight.w;
  skin = skin + (skin2 - skin) * fract(f);
#endif`,
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
  if (vPart > 1.5) {
    // The eyes (owner, 28 Oct 2026: close up, everyone has a face): drawn here from the eye's own
    // map position, the same picture as the pack's eye: a dark brown iris with a black pupil and a
    // glint, the white round it, and the eyelids in the person's own skin tone.
    vec2 e = fract(vMapUv) - vec2(0.492, 0.497);
    float iris = length(e) / 0.112;
    float white = length(e / vec2(0.3, 0.14));
    vec3 col = vSkinC * 0.82; // eyelids, a little darker than the face
    if (white < 1.0) col = vec3(0.80, 0.76, 0.70);
    if (iris < 1.0) col = mix(vec3(0.045, 0.022, 0.01), vec3(0.11, 0.055, 0.025), smoothstep(0.35, 0.9, iris));
    if (iris < 0.42) col = vec3(0.008);
    if (length(e - vec2(0.026, 0.028)) < 0.02) col = vec3(0.9); // the glint
    diffuseColor.rgb = col;
  } else if (vPart > 0.5) {
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
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = vPart > 1.5 ? 0.25 : vPart > 0.5 ? 0.9 : dot(partWeights, vec4(0.55, 0.85, 0.92, 0.6)) + soleWeight * 0.8;');
  };
  material.customProgramCacheKey = () => `ghanaverse-crowd-${smooth}`;
  return material;
}

const packColour = (css: string, c = new THREE.Color()) => {
  c.set(css); // three.js turns CSS colours into the linear colours the shader works in
  return Math.round(c.r * 255) * 65536 + Math.round(c.g * 255) * 256 + Math.round(c.b * 255);
};

/** The same person with fewer triangles (for far away): only the triangle list changes, so every
 *  point keeps its bones, its part and its map position. */
async function farShape(g: THREE.BufferGeometry, ratio: number) {
  await MeshoptSimplifier.ready;
  const pos = g.getAttribute('position');
  const positions = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) positions.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
  const index = g.index ? new Uint32Array(g.index.array as ArrayLike<number>) : Uint32Array.from({ length: pos.count }, (_, i) => i);
  const target = Math.max(3, Math.floor((index.length * ratio) / 3) * 3);
  let [kept] = MeshoptSimplifier.simplify(index, positions, 3, target, 0.05, ['LockBorder']);
  // Open edges (a skirt's hem, a sleeve) held the women's far shape at about 62% of the triangles
  // instead of 40%: far away a hairline gap at an edge cannot be seen, so let the edges go too.
  if (kept.length > target * 1.2) [kept] = MeshoptSimplifier.simplify(index, positions, 3, target, 0.12, []);
  // Still too many (the body is made of separate pieces, which the careful way cannot join): the rough
  // way, which joins nearby points whatever the pieces (fine at a distance).
  // (three.js ships this function but its type list leaves it out.)
  const sloppy = (MeshoptSimplifier as unknown as { simplifySloppy: (i: Uint32Array, p: Float32Array, s: number, lock: null, target: number, error: number) => [Uint32Array, number] }).simplifySloppy;
  if (kept.length > target * 1.2) [kept] = sloppy(index, positions, 3, null, target, 0.2);
  const out = g.clone();
  out.setIndex(new THREE.BufferAttribute(kept, 1));
  return out;
}

type Draw = { mesh: THREE.InstancedMesh; anim: THREE.InstancedBufferAttribute; colA: THREE.InstancedBufferAttribute; hair: THREE.InstancedBufferAttribute; n: number };

/**
 * One body's crowd: up to `capacity` people. The first `fixed` slots are drawn where they are (the
 * people at places, streetScenes.ts, set with mesh.setMatrixAt). Everyone else is drawn each frame
 * with draw(): only the people actually out (no hidden ones costing the graphics card), near ones in
 * full and far ones (draw(..., true)) with about 40% of the triangles.
 */
export class CrowdBatch {
  readonly mesh: THREE.InstancedMesh;
  private near: Draw;
  private far: Draw | null = null;
  // Each person's look and move, by slot (copied into the frame's list when drawn).
  private sAnim: Float32Array;
  private sCol: Float32Array;
  private sHair: Float32Array;
  count = 0;
  /** Slots drawn where they are (the people at places). */
  fixed = 0;

  private constructor(private baked: Baked, private capacity: number, time: { value: number }, smooth: boolean) {
    this.sAnim = new Float32Array(capacity * 4);
    this.sCol = new Float32Array(capacity * 4);
    this.sHair = new Float32Array(capacity);
    const material = crowdMaterial(baked, time, smooth);
    this.near = this.drawList(baked.geometry, material, capacity);
    this.mesh = this.near.mesh;
    void farShape(baked.geometry, 0.4)
      .then((g) => {
        this.far = this.drawList(g, material, capacity);
        this.farReady?.(this.far.mesh);
      })
      .catch(() => undefined);
  }
  /** Called with the far mesh once it is made (to add it to the scene). */
  farReady: ((mesh: THREE.InstancedMesh) => void) | null = null;
  get farMesh() {
    return this.far?.mesh ?? null;
  }

  private drawList(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number): Draw {
    const g = geometry.clone();
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const colA = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const hair = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    for (const a of [anim, colA, hair]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aAnim', anim);
    g.setAttribute('aColA', colA);
    g.setAttribute('aHair', hair);
    const mesh = new THREE.InstancedMesh(g, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { mesh, anim, colA, hair, n: 0 };
  }

  /** smooth: blend between stored frames (costs twice the bone lookups; off on Light phones). */
  static async create(body: CrowdBody, capacity: number, time: { value: number }, smooth = false) {
    return new CrowdBatch(await bake(body), capacity, time, smooth);
  }

  /** Sets person i's look and move (only when they change). */
  setLook(i: number, look: Look, clip: Clip, startTime: number, rate = 1) {
    const c = this.baked.clips[clip];
    this.sAnim.set([c.row, c.frames, c.fps * rate, startTime], i * 4);
    this.sCol.set([packColour(look.skin), packColour(look.top), packColour(look.bottom), packColour(look.shoes)], i * 4);
    this.sHair[i] = packColour(look.hair);
    if (i < this.fixed) {
      // A person at a place: straight into their own slot.
      this.copy(this.near, i, i);
      this.near.anim.needsUpdate = this.near.colA.needsUpdate = this.near.hair.needsUpdate = true;
    }
  }
  private copy(d: Draw, to: number, from: number) {
    d.anim.setXYZW(to, this.sAnim[from * 4], this.sAnim[from * 4 + 1], this.sAnim[from * 4 + 2], this.sAnim[from * 4 + 3]);
    d.colA.setXYZW(to, this.sCol[from * 4], this.sCol[from * 4 + 1], this.sCol[from * 4 + 2], this.sCol[from * 4 + 3]);
    d.hair.setX(to, this.sHair[from]);
  }

  /** Start the frame's list of walkers (after the people at places). */
  begin() {
    this.near.n = this.fixed;
    if (this.far) this.far.n = 0;
  }
  /** Draw person `slot` this frame at `matrix` (far: with the simpler shape, if it is ready). */
  draw(slot: number, matrix: THREE.Matrix4, far = false) {
    const d = far && this.far ? this.far : this.near;
    if (d.n >= this.capacity) return;
    const i = d.n++;
    d.mesh.setMatrixAt(i, matrix);
    this.copy(d, i, slot);
  }
  /** Done: send the frame's lists to the graphics card. */
  end() {
    for (const d of this.far ? [this.near, this.far] : [this.near]) {
      d.mesh.count = d.n;
      d.mesh.instanceMatrix.needsUpdate = true;
      d.anim.needsUpdate = d.colA.needsUpdate = d.hair.needsUpdate = true;
    }
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
