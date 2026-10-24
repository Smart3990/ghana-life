// 3D people: the player now, and the crowds later. Two model files, a man (public/models/person.glb)
// and a woman (public/models/person-female.glb); each is downloaded only when someone needs it.
// The body texture's alpha channel marks skin, shirt, trousers, shoes and soles, so each person gets their own
// skin tone and clothes colours from a few shader numbers: no extra textures or downloads per outfit.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const MOVES = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  ride: 'Driving_Loop',
  sit: 'Sitting_Idle_Loop',
  talk: 'Idle_Talking_Loop',
  dance: 'Dance_Loop',
  interact: 'Interact',
  jumpStart: 'Jump_Start',
  jumpLoop: 'Jump_Loop',
  jumpLand: 'Jump_Land',
} as const;
export type Move = keyof typeof MOVES;

// Skin tones multiply the texture's medium-brown skin. Deep is the default.
export const SKIN_TONES = { light: '#c2b6ad', medium: '#a0948b', deep: '#7f746d', veryDeep: '#665d58' };

export type Body = 'male' | 'female';
// For the woman, "trousers" is her skirt.
export type Outfit = { skin: string; shirt: string; trousers: string; shoes: string; hair: string };
export const DEFAULT_OUTFIT: Outfit = {
  skin: SKIN_TONES.deep,
  shirt: '#2f7d55', // green
  trousers: '#2a3446', // dark denim
  shoes: '#2b2b2e', // dark trainers (the soles stay white)
  hair: '#141110',
};

export type Person = {
  root: THREE.Group; // place and turn this
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<Move, THREE.AnimationAction>;
  bones: Record<string, THREE.Bone>;
  setOutfit: (outfit: Partial<Outfit>) => void;
};

type Loaded = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
const MODEL_URL: Record<Body, string> = { male: '/models/person.glb', female: '/models/person-female.glb' };
const loading: Partial<Record<Body, Promise<Loaded>>> = {};
function loadModel(body: Body): Promise<Loaded> {
  if (!loading[body]) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loading[body] = loader.loadAsync(MODEL_URL[body]);
  }
  return loading[body]!;
}

// The body material: the standard lit material, with the colour and shine of each part
// (skin, shirt, trousers, shoes) chosen from the mask in the texture's alpha channel.
function bodyMaterial(source: THREE.MeshStandardMaterial) {
  const material = source.clone();
  material.transparent = false;
  material.alphaTest = 0;
  material.metalness = 0;
  const uniforms = {
    uSkin: { value: new THREE.Color() },
    uShirt: { value: new THREE.Color() },
    uTrousers: { value: new THREE.Color() },
    uShoes: { value: new THREE.Color() },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 uSkin, uShirt, uTrousers, uShoes;\nvoid main() {\n  vec4 partWeights = vec4(1.0, 0.0, 0.0, 0.0);\n  float soleWeight = 0.0;',
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec4 texel = texture2D(map, vMapUv);
  // Mask codes (out of 255): skin 16, shirt 76, trousers 136, shoes 196, soles 255.
  // Neighbouring parts blend smoothly, so edges stay clean when the texture is filtered.
  vec4 centres = vec4(16.0, 76.0, 136.0, 196.0) / 255.0;
  partWeights = clamp(1.0 - abs(texel.a - centres) / (60.0 / 255.0), 0.0, 1.0);
  soleWeight = clamp(1.0 - abs(texel.a - 1.0) / (59.0 / 255.0), 0.0, 1.0);
  float total = max(dot(partWeights, vec4(1.0)) + soleWeight, 1e-4);
  partWeights /= total;
  soleWeight /= total;
  vec3 tint = uSkin * partWeights.x + uShirt * partWeights.y + uTrousers * partWeights.z + uShoes * partWeights.w
    + vec3(soleWeight); // soles keep their own off-white rubber
  diffuseColor.rgb *= texel.rgb * tint;
#endif`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = dot(partWeights, vec4(0.55, 0.85, 0.92, 0.6)) + soleWeight * 0.8;`,
      );
  };
  // Every person shares one compiled shader: the colours are uniforms, not shader code.
  material.customProgramCacheKey = () => 'ghanaverse-person';
  return { material, uniforms };
}

export async function createPerson(outfit: Partial<Outfit> = {}, bodyType: Body = 'male'): Promise<Person> {
  const gltf = await loadModel(bodyType);
  const model = cloneSkinned(gltf.scene);
  let body: ReturnType<typeof bodyMaterial> | null = null;
  const hairMaterials: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false; // animated people move away from their stored bounds
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (m.name === 'body') {
      body = bodyMaterial(m);
      mesh.material = body.material;
    } else if (m.name === 'hair') {
      const hair = m.clone();
      hair.roughness = 0.9;
      hair.metalness = 0;
      hairMaterials.push(hair);
      mesh.material = hair;
    }
  });

  const setOutfit = (change: Partial<Outfit>) => {
    Object.assign(current, change);
    if (body) {
      body.uniforms.uSkin.value.set(current.skin);
      body.uniforms.uShirt.value.set(current.shirt);
      body.uniforms.uTrousers.value.set(current.trousers);
      body.uniforms.uShoes.value.set(current.shoes);
    }
    for (const h of hairMaterials) h.color.set(current.hair);
  };
  const current: Outfit = { ...DEFAULT_OUTFIT };
  setOutfit(outfit);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {} as Record<Move, THREE.AnimationAction>;
  for (const [move, clipName] of Object.entries(MOVES) as [Move, string][]) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
    if (!clip) throw new Error(`person.glb has no "${clipName}" animation`);
    actions[move] = mixer.clipAction(clip);
  }
  const bones: Record<string, THREE.Bone> = {};
  model.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
  });

  const root = new THREE.Group();
  root.add(model);
  return { root, model, mixer, actions, bones, setOutfit };
}
