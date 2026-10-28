// The still crowd (step 5 of the Epic City plan; owner, 28 Oct 2026): people standing, hands on hips,
// waving, looking up at the billboards, covering their eyes, picking something up, sitting and
// cheering. They are the "Posed Background Characters" by Quaternius (CC0), built by
// scripts/person/build-posed.mjs with a hairstyle and a face (eyes and brows) on every head. They do
// not move, so they cost the phone almost nothing to keep in the street: one draw per pose, coloured
// per person on the graphics card (Ghanaian skin tones, Accra clothes; the same looks as the moving
// crowd, crowd.ts). Further away, each pose is drawn with about a third of its triangles.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import type { CrowdBody, Look } from './crowd';

export const POSES = ['Standing', 'Standing_Hips', 'Standing_Waving', 'LookingUp', 'Standing_CoveringEyes', 'PickingUp', 'Sitting', 'Sitting_Cheering'] as const;
export type Pose = (typeof POSES)[number];
/** Poses for someone standing on a pavement (sitting needs a seat). */
export const STANDING_POSES: Pose[] = ['Standing', 'Standing_Hips', 'Standing_Waving', 'LookingUp', 'Standing_CoveringEyes', 'PickingUp'];
const FAR_M = 26; // beyond this, the lighter shape

const packColour = (css: string, c = new THREE.Color()) => {
  c.set(css);
  return Math.round(c.r * 255) * 65536 + Math.round(c.g * 255) * 256 + Math.round(c.b * 255);
};

function material() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `attribute float part;
attribute vec4 aColA; // skin, top, bottom, shoes (packed 0xRRGGBB)
attribute float aHair;
varying vec3 vPosedC;
varying float vPosedPart;
vec3 unpackPosed(float f) {
  float r = floor(f / 65536.0);
  float g = floor((f - r * 65536.0) / 256.0);
  float b = f - r * 65536.0 - g * 256.0;
  return vec3(r, g, b) / 255.0;
}
void main() {
  vPosedPart = part;
  vPosedC = part < 0.5 ? unpackPosed(aColA.x) : part < 1.5 ? unpackPosed(aColA.y) : part < 2.5 ? unpackPosed(aColA.z)
          : part < 3.5 ? unpackPosed(aColA.w) : part < 4.5 ? unpackPosed(aHair)
          : part < 5.5 ? vec3(0.80, 0.76, 0.70) : part < 6.5 ? vec3(0.03, 0.016, 0.008)
          : unpackPosed(aColA.x) * vec3(0.62, 0.42, 0.4); // the lips, a deeper shade of the skin`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying vec3 vPosedC;\nvarying float vPosedPart;\nvoid main() {')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vPosedC;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = vPosedPart > 6.5 ? 0.5 : vPosedPart > 4.5 ? 0.25 : vPosedPart > 3.5 ? 0.9 : vPosedPart > 2.5 ? 0.6 : vPosedPart < 0.5 ? 0.55 : 0.85;');
  };
  m.customProgramCacheKey = () => 'ghanaverse-posed';
  return m;
}

/** A lighter shape: each part simplified on its own (edges kept, so the parts still meet). */
async function lighter(g: THREE.BufferGeometry, ratio: number) {
  await MeshoptSimplifier.ready;
  const pos = g.getAttribute('position');
  const part = g.getAttribute('part');
  const index = g.index ? Array.from(g.index.array as ArrayLike<number>) : Array.from({ length: pos.count }, (_, i) => i);
  const positions = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) positions.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
  const byPart = new Map<number, number[]>();
  for (let t = 0; t < index.length; t += 3) {
    const p = Math.round(part.getX(index[t]));
    (byPart.get(p) ?? byPart.set(p, []).get(p)!).push(index[t], index[t + 1], index[t + 2]);
  }
  const out: number[] = [];
  for (const [p, idx] of byPart) {
    // The face's small pieces are kept whole (they are a few triangles).
    if (p >= 5 || idx.length < 60) {
      out.push(...idx);
      continue;
    }
    const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3);
    const [kept] = MeshoptSimplifier.simplify(new Uint32Array(idx), positions, 3, target, 0.02, ['LockBorder']);
    out.push(...kept);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', pos);
  g2.setAttribute('normal', g.getAttribute('normal'));
  g2.setAttribute('part', part);
  g2.setIndex(out);
  return g2;
}

type Batch = { mesh: THREE.InstancedMesh; colA: THREE.InstancedBufferAttribute; hair: THREE.InstancedBufferAttribute; n: number };

export class PosedCrowd {
  readonly group = new THREE.Group();
  private batches = new Map<string, { near: Batch; far: Batch | null }>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private colours = new Map<string, [number, number, number, number, number]>();
  /** How many were drawn last time, and their triangles (for the budget). */
  stats = { drawn: 0, triangles: 0 };
  ready = false;

  constructor(private capacity: number) {}

  async load() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const mat = material();
    for (const body of ['male', 'female'] as const) {
      let gltf;
      try {
        gltf = await loader.loadAsync(`/models/posed/posed-${body}.glb`);
      } catch {
        continue;
      }
      for (const pose of POSES) {
        const node = gltf.scene.getObjectByName(pose) as THREE.Mesh | undefined;
        if (!node?.geometry) continue;
        // Plain numbers (the file packs them small), in the person's own metres (the node's scale).
        gltf.scene.updateMatrixWorld(true);
        const src = node.geometry as THREE.BufferGeometry;
        const partSrc = src.getAttribute('_part');
        if (!partSrc) continue;
        const plain = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
          const out = new Float32Array(a.count * a.itemSize);
          for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
          return new THREE.BufferAttribute(out, a.itemSize);
        };
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', plain(src.getAttribute('position')));
        g.setAttribute('part', plain(partSrc));
        if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
        g.applyMatrix4(node.matrixWorld);
        g.computeVertexNormals();
        const make = (geo: THREE.BufferGeometry, cap: number): Batch => {
          const gg = geo.clone();
          const colA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
          const hair = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
          colA.setUsage(THREE.DynamicDrawUsage);
          hair.setUsage(THREE.DynamicDrawUsage);
          gg.setAttribute('aColA', colA);
          gg.setAttribute('aHair', hair);
          const mesh = new THREE.InstancedMesh(gg, mat, cap);
          mesh.count = 0;
          mesh.frustumCulled = false;
          mesh.castShadow = false;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          this.group.add(mesh);
          return { mesh, colA, hair, n: 0 };
        };
        const far = await lighter(g, 0.34).catch(() => null);
        this.batches.set(`${body}:${pose}`, { near: make(g, this.capacity), far: far ? make(far, this.capacity) : null });
      }
    }
    this.ready = this.batches.size > 0;
  }

  /** Start a new frame's list. */
  begin() {
    for (const b of this.batches.values()) {
      b.near.n = 0;
      if (b.far) b.far.n = 0;
    }
    this.stats = { drawn: 0, triangles: 0 };
  }

  /** One still person: where, which way (heading, clockwise from north), the pose and the look. */
  place(body: CrowdBody, pose: Pose, x: number, y: number, z: number, heading: number, look: Look, distance: number) {
    const b = this.batches.get(`${body}:${pose}`);
    if (!b) return false;
    const batch = distance > FAR_M && b.far ? b.far : b.near;
    if (batch.n >= this.capacity) return false;
    const i = batch.n++;
    this.q.setFromAxisAngle(this.up, Math.PI - heading);
    this.m.compose(this.v.set(x, y, z), this.q, this.s.setScalar(look.scale));
    batch.mesh.setMatrixAt(i, this.m);
    const key = `${look.skin}|${look.top}|${look.bottom}|${look.shoes}|${look.hair}`;
    let c = this.colours.get(key);
    if (!c) {
      c = [packColour(look.skin), packColour(look.top), packColour(look.bottom), packColour(look.shoes), packColour(look.hair)];
      if (this.colours.size < 4000) this.colours.set(key, c);
    }
    batch.colA.setXYZW(i, c[0], c[1], c[2], c[3]);
    batch.hair.setX(i, c[4]);
    this.stats.drawn++;
    this.stats.triangles += (batch.mesh.geometry.index ? batch.mesh.geometry.index.count : batch.mesh.geometry.getAttribute('position').count) / 3;
    return true;
  }

  /** Done placing: send the frame's list to the graphics card. */
  end() {
    for (const b of this.batches.values()) {
      for (const batch of b.far ? [b.near, b.far] : [b.near]) {
        batch.mesh.count = batch.n;
        if (batch.n) {
          batch.mesh.instanceMatrix.needsUpdate = true;
          batch.colA.needsUpdate = true;
          batch.hair.needsUpdate = true;
        }
      }
    }
  }
}
