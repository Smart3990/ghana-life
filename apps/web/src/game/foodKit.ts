// The market's food (public/models/food/food.glb, built by scripts/food/build-food.mjs from the Low Poly
// Food Pack and Quaternius's Ultimate Food Pack, plus our own kelewele): goods on the stall tables, on
// the umbrella tables and on the sellers' heads, and the kelewele of Mission 1.
// Every piece has its colours painted on, so all copies of a piece are drawn at once with one material.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Goods on a table under the pack's market stand (front is +z). */
export const STALL_FOOD = ['stall-tomato', 'stall-plantain', 'stall-bread', 'stall-drinks', 'stall-eggs', 'stall-fruit', 'stall-chopbar', 'stall-kelewele'] as const;
/** Goods on the small umbrella tables. */
export const TABLE_FOOD = ['table-kelewele', 'table-tomato', 'table-plantain', 'table-oranges', 'table-bread', 'table-bofrot', 'table-chicken', 'table-drinks'] as const;
export type FoodName = (typeof STALL_FOOD)[number] | (typeof TABLE_FOOD)[number] | 'head-oranges' | 'head-tomato' | 'head-bread' | 'kelewele-wrap' | 'kelewele-pan';

let pieces: Promise<Map<string, THREE.BufferGeometry>> | null = null;
let material: THREE.MeshStandardMaterial | null = null;

/** The one material all food shares. */
export function foodMaterial() {
  material ??= new THREE.MeshStandardMaterial({ name: 'food', vertexColors: true, roughness: 0.75, metalness: 0 });
  return material;
}

/** All the food pieces, by name (loaded once). */
function load() {
  if (!pieces) {
    const gltf = new GLTFLoader();
    gltf.setMeshoptDecoder(MeshoptDecoder);
    pieces = gltf.loadAsync('/models/food/food.glb').then((g) => {
      const out = new Map<string, THREE.BufferGeometry>();
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Plain numbers first (the file stores small packed ones), then the packing's scale undone.
        const src = mesh.geometry;
        const geo = new THREE.BufferGeometry();
        for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3]] as const) {
          const a = src.getAttribute(name);
          const out = new Float32Array(a.count * size);
          for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
          geo.setAttribute(name, new THREE.BufferAttribute(out, size));
        }
        if (src.index) geo.setIndex(Array.from(src.index.array));
        geo.applyMatrix4(mesh.matrixWorld);
        geo.computeBoundingSphere();
        out.set(mesh.name, geo);
      });
      return out;
    });
  }
  return pieces;
}

/** One food piece's shape. */
export async function foodGeometry(name: FoodName): Promise<THREE.BufferGeometry> {
  const g = (await load()).get(name);
  if (!g) throw new Error('No food piece ' + name);
  return g;
}

/** Which of `count` goods a stall at this place sells (always the same for the same stall). */
export function foodPick(x: number, z: number, count: number) {
  const h = (Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(z * 10), 19349663)) >>> 0;
  return h % count;
}
