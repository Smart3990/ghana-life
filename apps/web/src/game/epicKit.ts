// The Low Poly Epic City pack's look, shared by everything built from it (public/models/epic).
// Every pack model uses one texture sheet (the atlas) of flat colours, plus a glow sheet: by day the
// glow is dim, at night the pack's night glow sheet lights the windows, lamps and signs.
// Day and night by real Accra time come in step 3; for now `setEpicNight` switches by hand.
import * as THREE from 'three';

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
