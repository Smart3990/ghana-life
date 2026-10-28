// Riders and drivers for the vehicles you can see into (owner, 28 Oct 2026: "the motors ... there
// are no people on it"): okadas with their rider (and often a passenger behind), open jeeps, golf
// carts, pragyas, cargo tricycles, the formula car and the road machines with their driver. (Closed
// vehicles have no one drawn inside: the pack's windows are solid dark glass, so they could not be seen.) They are the Epic City pack's people, sat down: the
// pack's rigged person is posed (thighs forward, knees bent, hands forward on the handlebars or the
// wheel) and that pose is frozen into a plain shape, so hundreds can be drawn in one go. Their skin is
// moved to the pack's darker skin colours (Ghanaian skin tones).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Where riders sit on each vehicle type, in the vehicle's own metres (front is +z, its left is +x). */
export const SEATS: Record<string, { at: [number, number, number][]; extra?: number }> = {
  // The okada rider, and a passenger behind in about half of them.
  okada: { at: [[0, 0.72, -0.12], [0, 0.8, -0.62]], extra: 0.5 },
  golfcart: { at: [[0.27, 0.55, -0.25], [-0.27, 0.55, -0.25]], extra: 0.5 },
  jeep: { at: [[0.42, 0.62, -0.25], [-0.42, 0.62, -0.25]], extra: 0.6 },
  suvjeep: { at: [[0.42, 0.62, -0.25], [-0.42, 0.62, -0.25]], extra: 0.6 },
  roller: { at: [[0, 1.45, -0.7]] },
  bulldozer: { at: [[0, 1.35, -0.9]] },
  forklift: { at: [[0, 0.95, -0.45]] },
  // Our tricycles: the pragya's driver, and passengers on the bench behind in most of them; the
  // cargo tricycle's rider. The formula car's driver in the open cockpit.
  tricycle: { at: [[0, 1.0, 0.22], [0.3, 1.12, -0.8], [-0.3, 1.12, -0.8]], extra: 0.6 },
  motorking: { at: [[0, 1.0, 0.58]] },
  formula: { at: [[0, 0.3, -0.35]] },
};

// The pack's skin colour cells (the top row of the texture sheet): from the lightest, used by the
// pack's people, to Ghanaian tones (darkest, dark, medium).
const SKIN_FROM = 0.625; // the cell the pack's people use (u from 0.625 to 0.75)
const SKIN_TO = [0.0, 0.125, 0.25]; // darkest, dark, medium

const FILES = ['people/man-casual.glb', 'people/man-shirt.glb', 'people/woman-casual.glb', 'people/man-worker.glb'];

/** Point a bone so its child lies along `dir` (in the world). */
function aim(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) {
  bone.updateWorldMatrix(true, true);
  const a = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
  const b = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
  const now = b.sub(a).normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(now, dir.clone().normalize());
  const world = new THREE.Quaternion().setFromRotationMatrix(bone.matrixWorld);
  const parentWorld = new THREE.Quaternion();
  if (bone.parent) parentWorld.setFromRotationMatrix(bone.parent.matrixWorld);
  bone.quaternion.copy(parentWorld.invert().multiply(turn.multiply(world)));
  bone.updateWorldMatrix(false, true);
}

/** One sitting person, frozen into a plain shape with its seat (hips) at the origin, facing +z. */
async function sitting(file: string, skin: number): Promise<THREE.BufferGeometry | null> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const g = await loader.loadAsync('/models/epic/' + file);
  let mesh: THREE.SkinnedMesh | null = null;
  const bones = new Map<string, THREE.Bone>();
  g.scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
    if ((o as THREE.Bone).isBone) bones.set(o.name.replace(/[^A-Za-z_]/g, ''), o as THREE.Bone);
  });
  if (!mesh) return null;
  const m = mesh as THREE.SkinnedMesh;
  g.scene.updateMatrixWorld(true);
  const B = (n: string) => bones.get(n);
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // Sitting: thighs forward, shins down, a little lean, arms reaching forward to the handlebars.
  const pose: [string, string, THREE.Vector3][] = [
    ['Spine', 'Spine1', v(0, 1, 0.12)],
    ['LeftUpLeg', 'LeftLeg', v(0.12, -0.2, 1)],
    ['RightUpLeg', 'RightLeg', v(-0.12, -0.2, 1)],
    ['LeftLeg', 'LeftFoot', v(0.05, -1, 0.15)],
    ['RightLeg', 'RightFoot', v(-0.05, -1, 0.15)],
    ['LeftArm', 'LeftForeArm', v(0.25, -0.55, 0.8)],
    ['RightArm', 'RightForeArm', v(-0.25, -0.55, 0.8)],
    ['LeftForeArm', 'LeftHand', v(0.05, -0.15, 1)],
    ['RightForeArm', 'RightHand', v(-0.05, -0.15, 1)],
  ];
  for (const [a, b, dir] of pose) {
    const bone = B(a), child = B(b);
    if (bone && child) aim(bone, child, dir);
  }
  m.skeleton.update();
  // Freeze the pose: every corner moved by its bones.
  const src = m.geometry;
  const pos = src.getAttribute('position');
  const uv = src.getAttribute('uv');
  const index = src.index;
  const n = index ? index.count : pos.count;
  const p: number[] = [];
  const u: number[] = [];
  const tmp = new THREE.Vector3();
  const corner = (i: number) => {
    tmp.fromBufferAttribute(pos, i);
    m.applyBoneTransform(i, tmp);
    tmp.applyMatrix4(m.matrixWorld);
    return tmp.clone();
  };
  for (let k = 0; k < n; k++) {
    const i = index ? index.getX(k) : k;
    const c = corner(i);
    p.push(c.x, c.y, c.z);
    let uu = uv.getX(i);
    const vv = uv.getY(i);
    if (uu >= SKIN_FROM && uu < SKIN_FROM + 0.125 && vv > 0.875) uu = uu - SKIN_FROM + SKIN_TO[skin];
    u.push(uu, vv);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  out.computeVertexNormals();
  // The seat is where the hips are.
  const hips = B('Hips');
  if (hips) {
    const h = new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld);
    out.translate(-h.x, -h.y, -h.z);
  }
  out.computeBoundingSphere();
  return out;
}

let made: Promise<THREE.BufferGeometry[]> | null = null;
/** A few different sitting people (different clothes and skin tones). */
export function riderShapes(): Promise<THREE.BufferGeometry[]> {
  made ??= Promise.all(FILES.map((f, i) => sitting(f, i % 3).catch(() => null))).then((list) => list.filter((g): g is THREE.BufferGeometry => !!g));
  return made;
}
