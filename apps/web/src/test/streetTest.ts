// Street test (Ghanaverse design brief, section 22.1, prototype A).
// Can the existing map carry a close, third-person view: a 3D person you steer with a joystick,
// keyboard or controller, who can get on an okada and ride through Accra, while staying smooth
// on a cheap phone? The map, buildings and traffic are the game's own; this page adds the
// follow camera, the 3D player and okada (through a three.js layer inside the map) and the controls.
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createMap } from '../map/createMap';
import { detectTier, measureFps } from '../map/tier';
import type { Traffic } from '../game/traffic';
import { createStreetNetwork } from '../game/streetNetwork';
import { StreetTraffic } from '../game/vehicles3d';
import { StreetBuildings } from '../game/streetBuildings';
import { applyStreetStyle } from '../map/streetStyle';
import { StreetLife } from '../game/streetLife';
import type { Nearby } from '../game/streetScenes';
import { Signals, lightFor } from '../game/signals';
import { Flyovers } from '../game/flyovers';
import { BigScreen } from '../game/bigScreen';
import { RoadSigns } from '../game/roadSigns';
import { planStation } from '../game/trotroStation';
import { Places } from '../game/places';
import { AD_CLOCK } from '../game/adScreens';
import { Voices, mateCall } from '../game/voices';
import { TALKS, asNode, type TalkNode } from '../game/talks';
import { box, merge, paint } from '../game/vehicles3d';
import { SkyTraffic } from '../game/sky3d';
import { StreetSound } from '../game/streetSound';
import { createPerson, type Move, type Person } from '../game/person';
import { Minimap } from '../hud/minimap';
import { FullMap } from '../hud/fullMap';
import { AdCard } from '../hud/adCard';
import { forPlayer } from '../game/address';
import { COMPOUND, compoundHouse, compoundSolid } from '../game/compound';
import { AD_COUNT, adThumb } from '../game/adPosters';
import type { PlaceAt } from '../game/places';
import { Phone, type MissionRow, type Destination } from '../hud/phone';
import { TouchControls } from '../hud/touchControls';
import { landscapeGate } from '../hud/landscape';
import { Cinema, startScreen, type StartChoice } from '../hud/cinema';

// ---------- Where and how big ----------

const START: [number, number] = [-0.2166, 5.5694]; // Kwame Nkrumah Circle
const M_LAT = 110574;
const M_LON = 111320 * Math.cos((START[1] * Math.PI) / 180);
const OKADA_SEAT = new THREE.Vector3(0, 0.86, -0.24); // top of the seat, in the bike's space

// Camera: close and low behind the player on foot, a little higher on the okada.
const VIEW = {
  walk: { zoom: 23.1, pitch: 74 },
  okada: { zoom: 22.3, pitch: 72 },
};
// The player sits in the lower part of the screen, with the street ahead in view.
const PLAYER_SCREEN_DROP = 0.3;

// Movement, in metres and seconds.
const WALK_SPEED = 1.7;
const RUN_SPEED = 4.6;
const WALK_TURN = 2.8; // radians per second at full stick
const OKADA_TOP_SPEED = 15; // about 54 km/h
const OKADA_ACCEL = 4;
const OKADA_BRAKE = 9;
const OKADA_TURN = 1.5;
const MOUNT_DISTANCE_M = 3;

// Places whose names fade in as you pass.
const PLACES: { name: string; at: [number, number] }[] = [
  { name: 'Kwame Nkrumah Circle', at: [-0.2166, 5.5694] },
  { name: 'Adabraka', at: [-0.2105, 5.5605] },
  { name: 'Asylum Down', at: [-0.2035, 5.5672] },
  { name: 'Kokomlemle', at: [-0.2078, 5.5795] },
  { name: 'Ridge', at: [-0.1985, 5.5625] },
  { name: 'Makola', at: [-0.2069, 5.5481] },
  { name: 'Osu', at: [-0.1812, 5.5566] },
  { name: 'Kaneshie', at: [-0.2365, 5.5665] },
  { name: 'Tesano', at: [-0.231, 5.597] },
  { name: 'Alajo', at: [-0.216, 5.592] },
  { name: 'Achimota', at: [-0.229, 5.615] },
  { name: 'Lapaz', at: [-0.251, 5.608] },
  { name: 'Abossey Okai', at: [-0.238, 5.559] },
  { name: 'Odorkor', at: [-0.27, 5.572] },
  { name: 'Dzorwulu', at: [-0.201, 5.608] },
];

const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const autoTest = params.has('auto');
// ?closer=0.8 moves the camera in (for checking the characters up close).
const closer = Math.min(1, Number(params.get('closer')) || 0);
VIEW.walk.zoom += closer;
VIEW.okada.zoom += closer;
const { tier, reason } = detectTier();

// ---------- The map ----------

const map = createMap(document.getElementById('map')!, tier, {
  center: START,
  zoom: VIEW.walk.zoom,
  pitch: VIEW.walk.pitch,
  bearing: 0,
});
if (debug) (window as unknown as { __map: maplibregl.Map }).__map = map; // for test scripts
map.setMaxZoom(24);
map.setMaxPitch(85); // looking up at the sky
// The camera belongs to the player, so the usual map gestures are switched off.
for (const handler of [map.dragPan, map.scrollZoom, map.boxZoom, map.dragRotate, map.keyboard, map.doubleClickZoom, map.touchZoomRotate, map.touchPitch]) {
  handler.disable();
}

// Local metres (x east, z south, y up) around START, and back to longitude and latitude.
const toLngLat = (x: number, z: number): [number, number] => [START[0] + x / M_LON, START[1] - z / M_LAT];

// ---------- The 3D scene ----------

// Quality presets, per tier: pixel density is set by the map (createMap.ts); here, the frame-rate cap
// and the sun's shadows. A steady 30 frames a second feels smoother on a cheap phone than a
// jumpy 40 to 60, and saves battery.
const PRESET = {
  light: { fps: 30, shadows: false, shadowMap: 0, smoothCrowd: false, skyLight: false },
  standard: { fps: 60, shadows: true, shadowMap: 1024, smoothCrowd: true, skyLight: true },
  ultra: { fps: 60, shadows: true, shadowMap: 2048, smoothCrowd: true, skyLight: true },
}[tier];

const scene = new THREE.Scene();
// Late-afternoon Accra light. The sky itself lights everything (image-based light, made in code
// from a sky model when the game starts), plus a warm low sun that casts shadows.
const SUN_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 16), THREE.MathUtils.degToRad(-115));
// Light phones skip the sky light (it costs a little on every pixel) and use a brighter simple fill instead.
const hemi = new THREE.HemisphereLight(0xfff1dc, 0x6b4f3a, PRESET.skyLight ? 0.9 : 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffcb94, 2.3);
sun.position.copy(SUN_DIR).multiplyScalar(80);
scene.add(sun, sun.target);
if (PRESET.shadows) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(PRESET.shadowMap, PRESET.shadowMap);
  const c = sun.shadow.camera;
  [c.left, c.right, c.top, c.bottom, c.near, c.far] = [-45, 45, 45, -45, 1, 220];
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
}
// The street itself is drawn by the map, so shadows fall on an invisible sheet that only shows shadow.
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.3 }));
shadowCatcher.position.y = 0.025;
shadowCatcher.receiveShadow = true;
shadowCatcher.visible = PRESET.shadows;
scene.add(shadowCatcher);

// Keeps the sun's shadow area centred on the player.
function followSun(x: number, z: number) {
  sun.target.position.set(x, 0, z);
  sun.position.set(x + SUN_DIR.x * 90, SUN_DIR.y * 90, z + SUN_DIR.z * 90);
  shadowCatcher.position.x = x;
  shadowCatcher.position.z = z;
}

// A soft round shadow under people and the okada: cheap, and it grounds them on the street.
function blobShadow(width: number, length: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(width, length, 1);
  mesh.position.y = 0.02;
  return mesh;
}

// The okada, built from simple shapes (no model file to download): red tank, black seat,
// chrome fork and exhaust, and a warm headlight. It faces +z, like the person.
type Okada = { root: THREE.Group; lean: THREE.Group; steer: THREE.Group; wheels: THREE.Object3D[] };
function buildOkada(): Okada {
  const paint = new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.35, metalness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd6d9de, roughness: 0.2, metalness: 0.9 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.5, metalness: 0.6 });
  const light = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe08a, emissiveIntensity: 1.2 });

  const root = new THREE.Group();
  const lean = new THREE.Group();
  root.add(lean);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = lean) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const wheel = (z: number, parent: THREE.Object3D, y = 0.29) => {
    const spin = new THREE.Group();
    spin.position.set(0, y, z);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 10, 28), rubber);
    tyre.rotation.y = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), chrome);
    rim.rotation.z = Math.PI / 2;
    spin.add(tyre, rim);
    parent.add(spin);
    return spin;
  };
  const rear = wheel(-0.62, lean);

  // Frame, engine, tank, seat, rack and exhaust.
  add(new THREE.BoxGeometry(0.1, 0.1, 1.05), paint, 0, 0.55, 0.0).rotation.x = -0.12;
  add(new THREE.BoxGeometry(0.26, 0.26, 0.34), engineMat, 0, 0.42, 0.08);
  const tank = add(new THREE.CapsuleGeometry(0.15, 0.32, 6, 14), paint, 0, 0.82, 0.22);
  tank.rotation.x = Math.PI / 2 - 0.15;
  tank.scale.set(1.1, 1, 0.9);
  add(new THREE.BoxGeometry(0.28, 0.09, 0.62), black, 0, 0.8, -0.22);
  add(new THREE.BoxGeometry(0.26, 0.03, 0.34), black, 0, 0.84, -0.62);
  const pipe = add(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 10), chrome, 0.17, 0.34, -0.32);
  pipe.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.16, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }), 0, 0.62, -0.8);

  // Steering: fork, front wheel, handlebar and headlight turn together around the steering head.
  const steer = new THREE.Group();
  steer.position.set(0, 0.98, 0.46);
  steer.rotation.x = 0.0;
  lean.add(steer);
  const forkLength = 0.78;
  for (const side of [-0.09, 0.09]) {
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, forkLength, 8), chrome);
    fork.position.set(side, -forkLength / 2 + 0.05, 0.1);
    fork.rotation.x = -0.32;
    steer.add(fork);
  }
  const front = wheel(0.2, steer, -0.69);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 8), black);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.1, -0.02);
  steer.add(bar);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), light);
  lamp.position.set(0, -0.05, 0.14);
  steer.add(lamp);

  root.add(blobShadow(0.7, 2.1));
  return { root, lean, steer, wheels: [front, rear] };
}

const okada = buildOkada();
// In the story you arrive with nothing: no okada. It stays for tests (?okada, ?auto).
const hasOkada = params.has('okada') || params.has('auto');
okada.root.visible = hasOkada;
okada.lean.traverse((o) => (o.castShadow = PRESET.shadows));
scene.add(okada.root);

// ---------- The player ----------

type Player = Person & { seat: THREE.Vector3; shadow: THREE.Object3D };

// Blended moves: walking and running mix by speed, riding fades in on the okada.
const BLENDED: Move[] = ['idle', 'walk', 'run', 'ride', 'sit', 'talk', 'dance', 'sitTalk', 'eat', 'interact', 'yes'];
const POSES = ['sit', 'talk', 'dance', 'sitTalk', 'eat', 'interact', 'yes'] as const;

async function loadPlayer(body: 'male' | 'female'): Promise<Player> {
  const person = await createPerson({}, body, tier === 'light' ? 'lite' : 'full');
  for (const move of BLENDED) {
    person.actions[move].play();
    person.actions[move].setEffectiveWeight(move === 'idle' ? 1 : 0);
  }
  const shadow = blobShadow(0.55, 0.55);
  person.root.add(shadow);
  // With real sun shadows the player casts their own; the soft round one stays only on Light.
  person.model.traverse((o) => (o.castShadow = PRESET.shadows));
  shadow.visible = !PRESET.shadows;

  // Where the hips are in the riding pose, so the rider can be put exactly on the seat.
  const ride = person.actions.ride;
  ride.setEffectiveWeight(1);
  person.actions.idle.setEffectiveWeight(0);
  person.mixer.update(0);
  person.root.updateMatrixWorld(true);
  const seat = person.bones.pelvis.getWorldPosition(new THREE.Vector3());
  person.root.worldToLocal(seat);
  ride.setEffectiveWeight(0);
  person.actions.idle.setEffectiveWeight(1);
  return { ...person, seat, shadow };
}

// ---------- Drawing the 3D scene inside the map ----------

const origin = maplibregl.MercatorCoordinate.fromLngLat(START, 0);
const metre = origin.meterInMercatorCoordinateUnits();
const placeMatrix = new THREE.Matrix4()
  .makeTranslation(origin.x, origin.y, origin.z)
  .scale(new THREE.Vector3(metre, -metre, metre))
  .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
const camera3d = new THREE.Camera();
let renderer: THREE.WebGLRenderer;

const layer: maplibregl.CustomLayerInterface = {
  id: 'street-3d',
  type: 'custom',
  renderingMode: '3d',
  onAdd(m, gl) {
    renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: tier !== 'light' });
    renderer.autoClear = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    if (PRESET.shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    // Light from the sky: render a sky model once into a small "environment" that every surface reflects.
    if (!PRESET.skyLight) return;
    const skyScene = new THREE.Scene();
    const skyDome = new Sky();
    skyDome.scale.setScalar(1000);
    const u = skyDome.material.uniforms;
    u.turbidity.value = 7;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.82;
    u.sunPosition.value.copy(SUN_DIR);
    skyScene.add(skyDome);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(skyScene, 0.02).texture;
    scene.environmentIntensity = 0.16; // the sky model is very bright: a little goes a long way
    pmrem.dispose();
    renderer.resetState();
  },
  render(_gl, args) {
    const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
    camera3d.projectionMatrix = projection.multiply(placeMatrix);
    // The camera's position in the scene (for keeping the player in view): the point the projection
    // sends to infinity.
    camEye.set(0, 0, 1, 0).applyMatrix4(camInverse.copy(camera3d.projectionMatrix).invert());
    if (Math.abs(camEye.w) > 1e-9) camAt.set(camEye.x / camEye.w, camEye.y / camEye.w, camEye.z / camEye.w);
    renderer.resetState();
    renderer.render(scene, camera3d);
  },
};

const camEye = new THREE.Vector4();
const camInverse = new THREE.Matrix4();
const camAt = new THREE.Vector3(0, -1, 0); // y < 0: not known yet

// ---------- Keeping the player in view ----------
// Nothing is ever cut away. When a shop, kiosk, building or bus stands between the camera and you,
// the camera swings round to the nearest clear side (all the way round to your front if it must),
// or comes in closer. When the view behind you is clear again, it swings back.
const camAvoid = { yaw: 0, pitch: 0, zoom: 0, want: null as [number, number, number] | null, check: 0, clearFor: 0 };
/** How tall what stands at (x, z) is, in metres (0: nothing there). */
function heightAtView(x: number, z: number) {
  if (buildings.blocked(x, z, 0.1)) return 9;
  if (vehicleAt(x, z, 0.05)) return 2.7;
  if (places.solid(x, z, 0.1)) return 4.5;
  return life?.viewHeight(x, z) ?? 0;
}
/** Is the line from the player's chest to a camera at this place blocked? */
function viewBlocked(px: number, pz: number, ex: number, ey: number, ez: number) {
  const len = Math.hypot(ex - px, ez - pz);
  const steps = Math.max(4, Math.ceil(len / 0.6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (t * len < 0.8) continue; // right beside the player (his own shoulder) does not count
    const y = 1.3 + (ey - 1.3) * t;
    const sx = px + (ex - px) * t;
    const sz = pz + (ez - pz) * t;
    if (heightAtView(sx, sz) > y) return true;
    // A flyover deck overhead (about 1.2 m thick) is in the way too.
    if (deckNear) {
      const deck = flyovers.heightAt(sx, sz);
      if (deck > 2 && y > deck - 1.4 && y < deck + 0.4) return true;
    }
  }
  return false;
}
// Ways to move the camera, best first: [swing round (degrees), look down more (degrees), distance].
const VIEW_TRIES: [number, number, number][] = [];
{
  const add = (swings: number[], down: number, k: number) => {
    for (const a of swings) for (const sgn of a ? [1, -1] : [1]) VIEW_TRIES.push([sgn * a, down, k]);
  };
  add([25, 50, 75], 0, 1);
  add([0, 30, 60], 16, 1);
  add([100, 130, 160, 180], 0, 1);
  add([0, 40, 80, 120, 180], 28, 0.75);
  add([0, 45, 90, 135, 180], 34, 0.55);
}
let deckNear = false; // is a flyover close (only then are decks checked: it saves work)
function keepPlayerInView(dt: number, baseBearing: number, basePitch: number) {
  camAvoid.check -= dt;
  if (camAt.y > 0 && camAvoid.check <= 0) {
    camAvoid.check = 0.12;
    deckNear = flyovers.heightAt(state.x, state.z) > 0 || flyovers.heightAt(camAt.x, camAt.z) > 0;
    // How far the camera is with no swing, from where it is now.
    const reach = Math.hypot(camAt.x - state.x, camAt.y, camAt.z - state.z) * 2 ** camAvoid.zoom;
    const clear = (yawDeg: number, downDeg: number, k: number) => {
      const b = baseBearing + (yawDeg * Math.PI) / 180;
      const p = ((basePitch - downDeg) * Math.PI) / 180;
      const r = reach * k;
      return !viewBlocked(state.x, state.z, state.x - Math.sin(b) * r * Math.sin(p), r * Math.cos(p), state.z + Math.cos(b) * r * Math.sin(p));
    };
    if (clear(0, 0, 1)) {
      camAvoid.clearFor += 0.12;
      if (camAvoid.clearFor > 0.6) camAvoid.want = null;
    } else {
      camAvoid.clearFor = 0;
      const w = camAvoid.want;
      if (!w || !clear(w[0], w[1], w[2])) {
        camAvoid.want = VIEW_TRIES.find((t) => clear(t[0], t[1], t[2])) ?? [0, 36, 0.42]; // boxed in: high and close
      }
    }
  }
  const [yaw, down, k] = camAvoid.want ?? [0, 0, 1];
  const ease = Math.min(1, dt * 3);
  camAvoid.yaw += angleDiff((yaw * Math.PI) / 180, camAvoid.yaw) * ease;
  camAvoid.pitch += (-down - camAvoid.pitch) * ease;
  camAvoid.zoom += (-Math.log2(k) - camAvoid.zoom) * ease;
}

// ---------- Controls: touch, keyboard and game controllers ----------

const input = { x: 0, y: 0, sprint: false, brake: false };
const keys = new Set<string>();
const tapped = new Set<'act' | 'jump' | 'horn'>(); // one-off actions, used once per press

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyF' || e.code === 'KeyE') tapped.add('act');
  if (e.code === 'Space') tapped.add('jump');
  if (e.code === 'KeyH') tapped.add('horn');
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const btn = (id: string) => document.getElementById(id) as HTMLButtonElement;
const actButton = btn('btn-act');
const touch = new TouchControls(document.getElementById('stick-zone')!, document.getElementById('stick')!, document.getElementById('knob')!, {
  sprint: btn('btn-sprint'),
  jump: btn('btn-jump'),
  act: actButton,
  brake: btn('btn-brake'),
});
btn('btn-phone').addEventListener('click', () => {
  if (document.body.classList.contains('cine')) return;
  phone.toggle();
  document.getElementById('btn-phone')?.classList.remove('dot');
});
// The energy chip opens the full "you" card (energy, vibe, money, heat); tap again or anywhere to close.
const meCard = document.getElementById('me')!;
const meButton = btn('btn-me');
function toggleMe(open = meCard.classList.contains('hidden')) {
  meCard.classList.toggle('hidden', !open);
  meButton.setAttribute('aria-expanded', String(open));
}
meButton.addEventListener('click', () => toggleMe());
window.addEventListener('pointerdown', (e) => {
  if (!meCard.classList.contains('hidden') && !meCard.contains(e.target as Node) && !meButton.contains(e.target as Node)) toggleMe(false);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    toggleMe();
  }
});

// Looking around: drag on the right side (touch) or anywhere (mouse); the right stick on a controller.
// The view turns and tilts, then settles back behind the player a moment after you let go.
const look = { yaw: 0, pitch: 0, id: -1, lastX: 0, lastY: 0, idle: 0 };
const lookZone = document.getElementById('look-zone')!;
lookZone.addEventListener('pointerdown', (e) => {
  look.id = e.pointerId;
  lookZone.setPointerCapture(e.pointerId);
  [look.lastX, look.lastY] = [e.clientX, e.clientY];
});
lookZone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== look.id) return;
  look.yaw += (e.clientX - look.lastX) * 0.006;
  look.pitch = Math.max(-16, Math.min(11, look.pitch - (e.clientY - look.lastY) * 0.12));
  [look.lastX, look.lastY] = [e.clientX, e.clientY];
  look.idle = 0;
});
for (const ev of ['pointerup', 'pointercancel']) lookZone.addEventListener(ev, (e) => (e as PointerEvent).pointerId === look.id && (look.id = -1));
// A quick tap (not a drag) on the street: did you tap a vehicle with an advert on it?
const tapStart = { x: 0, y: 0, t: 0 };
lookZone.addEventListener('pointerdown', (e) => Object.assign(tapStart, { x: e.clientX, y: e.clientY, t: performance.now() }));
lookZone.addEventListener('pointerup', (e) => {
  if (performance.now() - tapStart.t < 350 && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 10) tapVehicle(e.clientX, e.clientY);
});
// Pinch with two fingers (or the mouse wheel) to bring the camera closer or further.
const pinch = { zoom: 0, start: 0, base: 0 };
const fingers = new Map<number, { x: number; y: number }>();
const spread = () => {
  const [a, b] = [...fingers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
for (const zone of [lookZone, document.getElementById('stick-zone')!]) {
  zone.addEventListener('pointerdown', (e) => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) [pinch.start, pinch.base] = [spread(), pinch.zoom];
  });
  zone.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2 && pinch.start > 0) pinch.zoom = Math.max(-1.6, Math.min(0.8, pinch.base + Math.log2(spread() / pinch.start)));
  });
  for (const ev of ['pointerup', 'pointercancel']) zone.addEventListener(ev, (e) => fingers.delete((e as PointerEvent).pointerId));
}
window.addEventListener('wheel', (e) => (pinch.zoom = Math.max(-1.6, Math.min(0.8, pinch.zoom - e.deltaY * 0.0015))), { passive: true });

// Controllers (standard mapping, Xbox / PlayStation): left stick moves, right trigger accelerates,
// left trigger brakes, A / ✕ jumps, B / ○ sprints (hold), X / □ or Y / △ is the action button (ride, get off, greet, sit, dance), left stick press sounds the horn.
const padWas: Record<string, boolean> = {};
function padTap(pad: Gamepad, index: number, name: 'act' | 'jump' | 'horn') {
  const down = !!pad.buttons[index]?.pressed;
  const key = `${pad.index}:${index}`;
  if (down && !padWas[key]) tapped.add(name);
  padWas[key] = down;
}
function readInput() {
  let x = 0;
  let y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  let sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.isHeld('sprint');
  // On the okada, pulling the stick back brakes too.
  let brake = keys.has('KeyS') || keys.has('ArrowDown') || touch.isHeld('brake') || (state.onOkada && touch.y < -0.4);
  if (Math.hypot(touch.x, touch.y) > Math.hypot(x, y)) [x, y] = [touch.x, touch.y];
  for (const name of ['act', 'jump'] as const) if (touch.took(name)) tapped.add(name);

  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue;
    const dead = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    const [px, py] = [dead(pad.axes[0] ?? 0), dead(-(pad.axes[1] ?? 0))];
    const gas = pad.buttons[7]?.value ?? 0;
    const stop = pad.buttons[6]?.value ?? 0;
    const forward = state.onOkada && gas > Math.abs(py) ? gas : py;
    if (Math.hypot(px, forward) > Math.hypot(x, y)) [x, y] = [px, forward];
    if (stop > 0.2) brake = true;
    if (pad.buttons[1]?.pressed) sprint = true;
    const rx = dead(pad.axes[2] ?? 0);
    const ry = dead(pad.axes[3] ?? 0);
    if (rx || ry) {
      look.yaw += rx * 0.04;
      look.pitch = Math.max(-16, Math.min(11, look.pitch - ry * 1.2));
      look.idle = 0;
    }
    padTap(pad, 0, 'jump');
    padTap(pad, 3, 'act');
    padTap(pad, 2, 'act'); // X / □ too
    padTap(pad, 10, 'horn');
  }
  input.x = Math.max(-1, Math.min(1, x));
  input.y = Math.max(-1, Math.min(1, y));
  input.sprint = sprint;
  input.brake = brake;
}

// An okada horn, made in code (two short beeps, no sound file to download).
// distance: how far away the horn is (quieter further away); car: a deeper car horn.
let lastHoot = 0;
function honk(distance = 0, car = false) {
  try {
    if (car && performance.now() - lastHoot < 1500) return;
    if (car) lastHoot = performance.now();
    const audio = streetSound.context;
    const out = streetSound.output;
    if (!audio || !out) return;
    const t = audio.currentTime;
    const loud = 0.12 / (1 + distance / 8);
    for (const start of car ? [0, 0.3] : [0, 0.16]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(car ? 340 : 430, t + start);
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(loud, t + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + (car ? 0.22 : 0.12));
      osc.connect(gain).connect(out);
      osc.start(t + start);
      osc.stop(t + start + (car ? 0.23 : 0.13));
    }
  } catch {
    // No sound available: the horn is silent.
  }
}

// ---------- On-screen bits: clock, place names, help, debug ----------

const clock = document.getElementById('clock')!;
const placeLabel = document.getElementById('place')!;
const debugLine = document.getElementById('debug')!;
const help = document.getElementById('help')!;

const updateClock = () => {
  const now = new Date(); // Ghana time is UTC
  clock.textContent = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
};
updateClock();
setInterval(updateClock, 10_000);

let currentPlace = '';
let placeTimer = 0;
function checkPlace(lngLat: [number, number]) {
  let best = '';
  let bestD = 450;
  for (const p of PLACES) {
    const d = Math.hypot((p.at[0] - lngLat[0]) * M_LON, (p.at[1] - lngLat[1]) * M_LAT);
    if (d < bestD) [best, bestD] = [p.name, d];
  }
  if (!best || best === currentPlace) return;
  currentPlace = best;
  placeLabel.textContent = best;
  placeLabel.classList.add('on');
  clearTimeout(placeTimer);
  placeTimer = window.setTimeout(() => placeLabel.classList.remove('on'), 3500);
}

// ---------- The game loop ----------

const state = {
  x: 2.5, // the player starts beside the okada
  z: 1.5,
  heading: 0, // radians clockwise from north
  y: 0, // height above the street while jumping
  vy: 0,
  speed: 0,
  onOkada: false,
  okadaX: 0,
  okadaZ: 0,
  okadaHeading: 0,
  lean: 0,
  camHeading: 0,
  zoom: VIEW.walk.zoom,
  pitch: VIEW.walk.pitch,
};

let rideBlend = 0;
let poseBlend = 0;
let poseMove: (typeof POSES)[number] = 'talk';
let airBlend = 0;
let landing = 0; // fades from 1 to 0 after touching down
const JUMP_SPEED = 3.4; // about half a metre high
const GRAVITY = 11;
const LEG_OUT_AXIS = new THREE.Vector3(0, 0, 1);
const RIDE_KNEES_OUT = 0.3;

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function step(player: Player, dt: number, t: number) {
  gameClock += dt;
  readInput();
  if (story.frozen) {
    // During a film scene the player does not move.
    input.x = input.y = 0;
    input.sprint = input.brake = false;
    tapped.clear();
  }
  if (story.autoRun) {
    // The story runs the player (chasing the thief): straight for the target, round anything in the way.
    const a = story.autoRun;
    input.x = 0;
    input.y = a.stop || Math.hypot(a.x - state.x, a.z - state.z) < 0.6 ? 0 : 1;
    input.sprint = !a.walk;
    input.brake = false;
    tapped.clear();
    me.energy = Math.max(me.energy, 60);
    const want = Math.atan2(a.x - state.x, -(a.z - state.z));
    let h = state.heading + Math.max(-5 * dt, Math.min(5 * dt, angleDiff(want, state.heading)));
    for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3]) {
      if (!solidAt(state.x + Math.sin(h + off) * 1.1, state.z - Math.cos(h + off) * 1.1, 0.3)) {
        h += off;
        break;
      }
    }
    state.heading = h;
    playerMoved = true;
  }
  if (!story.frozen && Math.hypot(input.x, input.y) > 0.2) playerMoved = true; // after this, never move the player for them
  if (!startPlaced) startPlaced = placeOnPavement();
  // Streets keep loading for a while: if the start turns out to be on a road after all, step onto
  // the pavement again (only while standing still near the start).
  else if (life && !playerMoved && performance.now() - startedAt < 30000 && ++placeCheck % 20 === 0 && !state.onOkada && Math.abs(state.speed) < 0.1 && life.roadAt(state.x, state.z, 0.4)) placeOnPavement();

  // The action button: what it does depends on what is next to you.
  const nearOkada = hasOkada && !state.onOkada && Math.hypot(state.x - state.okadaX, state.z - state.okadaZ) < MOUNT_DISTANCE_M;
  const action = chooseAction(nearOkada, state.onOkada || me.doing !== 'none' ? null : life?.scenes?.nearest(state.x, state.z) ?? null);
  showAction(action);
  if (tapped.delete('act')) doAction(action, t);
  // Moving the stick stands you up from a chair or stops the dance.
  if ((me.doing === 'sit' || me.doing === 'dance') && Math.hypot(input.x, input.y) > 0.35) stopDoing();
  if (me.doing === 'greet' && (t > me.until || (chatting && Math.hypot(input.x, input.y) > 0.5))) me.doing = 'none';
  checkTalkAway();
  updateEnergy(dt);
  if (tapped.delete('horn') && state.onOkada) honk();
  if (tapped.delete('jump') && !state.onOkada && state.y === 0) {
    state.vy = JUMP_SPEED;
    landing = 0;
  }
  // In the air: rise and fall; landing plays a short "land" move.
  if (state.y > 0 || state.vy > 0) {
    state.vy -= GRAVITY * dt;
    state.y = Math.max(0, state.y + state.vy * dt);
    if (state.y === 0) {
      state.vy = 0;
      landing = 1;
      player.actions.jumpLand.reset().play();
    }
  }

  if (state.onOkada) {
    const target = input.y > 0 && !input.brake ? input.y * OKADA_TOP_SPEED : 0;
    const rate = input.brake ? OKADA_BRAKE : state.speed < target ? OKADA_ACCEL : 2.5; // engine braking
    state.speed += Math.sign(target - state.speed) * Math.min(Math.abs(target - state.speed), rate * dt);
    const grip = Math.min(1, Math.max(0.25, state.speed / 4));
    state.heading += input.x * OKADA_TURN * grip * dt;
    state.lean += (-input.x * 0.38 * Math.min(1, state.speed / 7) - state.lean) * Math.min(1, dt * 6);
  } else {
    const sprinting = input.sprint && me.energy > 0;
    const top = sprinting ? RUN_SPEED : me.energy < 1 ? WALK_SPEED * 0.8 : WALK_SPEED;
    const target = input.y >= 0 ? Math.hypot(input.x, input.y) > 0.2 ? Math.max(input.y, Math.abs(input.x) * 0.4) * top : 0 : input.y * 1.0;
    state.speed += (target - state.speed) * Math.min(1, dt * 8);
    state.heading += input.x * WALK_TURN * dt;
    state.lean = 0;
    if (me.doing === 'sit' || me.doing === 'dance') state.speed = 0;
    if (me.doing === 'sit' && me.seat) [state.x, state.z, state.heading] = [me.seat.x, me.seat.z, me.seat.face];
  }

  // Move, but not into buildings: slide along the wall when walking into one at an angle.
  const stepX = Math.sin(state.heading) * state.speed * dt;
  const stepZ = -Math.cos(state.heading) * state.speed * dt;
  const room = state.onOkada ? 0.7 : 0.3;
  if (!solidAt(state.x + stepX, state.z + stepZ, room)) {
    state.x += stepX;
    state.z += stepZ;
  } else if (!solidAt(state.x + stepX, state.z, room)) {
    state.x += stepX;
    state.speed *= 0.9;
  } else if (!solidAt(state.x, state.z + stepZ, room)) {
    state.z += stepZ;
    state.speed *= 0.9;
  } else {
    if (state.onOkada && Math.abs(state.speed) > 3) bump();
    state.speed = state.onOkada ? 0 : state.speed * 0.5;
  }
  // A vehicle that moved into you pushes you aside (you never end up inside it).
  pushOutOfVehicles(room);
  if (state.onOkada) {
    did.ride += Math.abs(state.speed) * dt;
    [state.okadaX, state.okadaZ, state.okadaHeading] = [state.x, state.z, state.heading];
  }
  checkGoal();

  // Place the okada and the player in the scene.
  okada.root.position.set(state.okadaX, 0, state.okadaZ);
  okada.root.rotation.y = Math.PI - state.okadaHeading;
  okada.lean.rotation.z = state.onOkada ? state.lean : 0;
  okada.steer.rotation.y = state.onOkada ? input.x * -0.25 : 0;
  const wheelSpin = (state.onOkada ? state.speed : 0) * dt / 0.3;
  for (const w of okada.wheels) w.rotation.x += wheelSpin;

  if (state.onOkada) {
    // Seated on the bike: the player rides with it, leaning into corners.
    if (player.root.parent !== okada.lean) okada.lean.add(player.root);
    player.root.position.copy(OKADA_SEAT).sub(player.seat); // hips on the seat
    player.root.rotation.set(0, 0, 0);
    player.shadow.visible = false; // the bike's shadow is enough
  } else {
    if (player.root.parent !== scene) scene.add(player.root);
    player.root.position.set(state.x, state.y, state.z);
    player.root.visible = !story.hidePlayer;
    player.root.rotation.set(0, Math.PI - state.heading, 0);
    player.shadow.visible = !PRESET.shadows;
  }

  // Animation: blend idle, walk and run by speed; on the okada, ride.
  const s = state.onOkada ? 0 : Math.abs(state.speed);
  rideBlend += ((state.onOkada ? 1 : 0) - rideBlend) * Math.min(1, dt * 8);
  const onFoot = 1 - rideBlend;
  const w = {
    idle: Math.max(0, 1 - s / 1.0),
    walk: s < WALK_SPEED ? Math.min(1, s / 1.0) : Math.max(0, 1 - (s - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)),
    run: Math.max(0, Math.min(1, (s - WALK_SPEED) / (RUN_SPEED - WALK_SPEED))),
  };
  airBlend += ((state.y > 0 ? 1 : 0) - airBlend) * Math.min(1, dt * 14);
  landing = Math.max(0, landing - dt * 3);
  // Sitting, dancing or greeting someone take over from walking.
  if (me.doing !== 'none') poseMove = me.doing === 'greet' ? 'talk' : me.doing;
  if (story.pose) poseMove = story.pose; // a scene's move: talking in the chair, eating, handing over
  poseBlend += ((me.doing !== 'none' || story.pose ? 1 : 0) - poseBlend) * Math.min(1, dt * 7);
  for (const m of POSES) player.actions[m].setEffectiveWeight(m === poseMove ? poseBlend * onFoot : 0);
  const ground = onFoot * (1 - airBlend) * (1 - landing) * (1 - poseBlend);
  player.actions.idle.setEffectiveWeight(w.idle * ground);
  player.actions.walk.setEffectiveWeight(w.walk * ground);
  player.actions.run.setEffectiveWeight(w.run * ground);
  player.actions.ride.setEffectiveWeight(rideBlend);
  player.actions.jumpLoop.setEffectiveWeight(airBlend * onFoot);
  player.actions.jumpLand.setEffectiveWeight(landing * onFoot * (1 - airBlend));
  // The clips are made for about 1.4 m/s walking and 3.8 m/s jogging: match the feet to the ground.
  player.actions.walk.setEffectiveTimeScale(Math.max(0.6, s / 1.4));
  player.actions.run.setEffectiveTimeScale(Math.max(0.7, s / 3.8));
  player.mixer.update(dt);
  if (rideBlend > 0.01) ridePose(player, rideBlend);
  player.root.updateMatrixWorld(true);
  thief.person?.root.updateMatrixWorld(true);
  placeBag(player);

  // Camera: follows behind the player, turning a little after them, closer on foot.
  state.camHeading += angleDiff(state.heading, state.camHeading) * Math.min(1, dt * (state.onOkada ? 2.6 : 3.2));
  const view = state.onOkada ? VIEW.okada : VIEW.walk;
  const speedPull = state.onOkada ? Math.min(0.5, state.speed / 30) : 0; // pull back a little at speed
  state.zoom += (view.zoom - speedPull - state.zoom) * Math.min(1, dt * 2.5);
  state.pitch += (view.pitch - state.pitch) * Math.min(1, dt * 2.5);
  // After looking around, the view drifts back behind the player (sooner when moving).
  if (look.id === -1) {
    look.idle += dt;
    const settle = look.idle > (Math.abs(state.speed) > 0.5 ? 0.8 : 2.5) ? Math.min(1, dt * 2) : 0;
    look.yaw *= 1 - settle;
    look.pitch *= 1 - settle;
  }
  const here = toLngLat(state.x, state.z);
  const height = map.getContainer().clientHeight;
  // Keep the player the same share of the screen on short (sideways) and tall screens.
  const fit = Math.log2(Math.max(280, height) / 820);
  if (!story.shot && !story.fly) keepPlayerInView(dt, state.camHeading + look.yaw, Math.min(85, state.pitch + look.pitch));
  const cam = {
    center: here,
    bearing: ((state.camHeading + look.yaw + camAvoid.yaw) * 180) / Math.PI,
    zoom: state.zoom + fit + pinch.zoom + camAvoid.zoom,
    pitch: Math.min(85, state.pitch + look.pitch + camAvoid.pitch),
    padding: { top: height * PLAYER_SCREEN_DROP, bottom: 0, left: 0, right: 0 },
  };
  if (story.shot) {
    // A film shot set by the story: looking at two people from the side.
    const sh = story.shot;
    cam.center = toLngLat(sh.x, sh.z);
    cam.bearing = sh.bearing;
    cam.zoom = sh.zoom + fit;
    cam.pitch = sh.pitch;
    cam.padding.top = height * 0.12;
  }
  if (story.fly) {
    // The opening film: the camera comes down out of the sky over Accra and settles behind you.
    // Film time runs on the clock, not on frames, so it lasts the same on slow and fast phones.
    const k = Math.min(1, (performance.now() / 1000 - story.fly.t) / story.fly.length);
    const e = k * k * (3 - 2 * k);
    cam.zoom = 13.4 + (cam.zoom - 13.4) * e;
    cam.pitch = 20 + (cam.pitch - 20) * e;
    cam.bearing -= 140 * (1 - e);
    cam.padding.top *= e;
    // From high up the map's own blocks show the city; close to the street our 3D buildings take over.
    const blocks = cam.zoom < 17.2 ? 'visible' : 'none';
    for (const id of ['buildings', 'roofs']) if (map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== blocks) map.setLayoutProperty(id, 'visibility', blocks);
    if (k >= 1) story.fly = null;
  }
  map.jumpTo(cam);
  checkPlace(here);
  buildings.update(here, state.x, state.z);
  followSun(state.x, state.z);
  life?.update(state.x, state.z, dt, performance.now() / 1000);
  sky.update(Date.now() / 1000);
  placeBubbles(performance.now() / 1000);
  streetSound.update({
    x: state.x,
    z: state.z,
    heading: state.camHeading + look.yaw,
    riding: state.onOkada,
    speed: Math.abs(state.speed),
    vehicles: (streetTraffic?.placed ?? []).map((p) => {
      const [vx, vz] = [(p.lon - START[0]) * M_LON, (START[1] - p.lat) * M_LAT];
      return { x: vx, z: vz };
    }),
    people: life?.nearCount ?? 0,
    music: life?.scenes?.musicSpots ?? [],
  });
  if (life?.scenes && !life.scenes.onSpeak) {
    life.scenes.onSpeak = (x, z, height, said, body, seed) => {
      // Calling out to the player: "Sister, come!" to a woman, "Bra, come!" to a man.
      const text = seed === 4242 || (x === state.x && z === state.z) ? said : toMe(said);
      showBubble(x, z, height, text);
      // Someone calling out near you: you hear them (quieter further away).
      if (body && !chatting) {
        const d = Math.hypot(x - state.x, z - state.z);
        void voices.say(text, { body, seed: seed ?? Math.round(x * 7 + z) }, 1 / (1 + d / 7), 1);
      }
    };
  }
  if (life) signals.junctions = life.junctions;
  signals.update(state.x, state.z, Date.now() / 1000);
  flyovers.update();
  if (!bigScreen.isPlaced && life && performance.now() - startedAt > 4000) {
    const spot = life.boardNear(0, 0); // the middle of Circle is the map's start point
    if (spot && Math.hypot(spot.x, spot.z) < 260) {
      life.removeBoard(spot);
      bigScreen.place(spot.x, spot.z, spot.angle);
    }
  }
  const screenEvery = tier === 'light' ? 0.25 : 0.1;
  bigScreen.update(Date.now() / 1000, state.x, state.z, screenEvery);
  if (!stationPlaced && life && streetTraffic && performance.now() - startedAt > 6000 && ++stationCheck % 30 === 0) stationPlaced = placeStation();
  if (life && bigScreen.isPlaced && moreScreens.length < 5 && ++screenCheck % 90 === 0) {
    const all = [bigScreen, ...moreScreens];
    const spot = life.boardsNear(state.x, state.z, 180).find((b) => all.every((sc) => Math.hypot(sc.group.position.x - b.x, sc.group.position.z - b.z) > 380));
    if (spot) {
      const sc = new BigScreen(moreScreens.length + 1);
      scene.add(sc.group);
      life.removeBoard(spot);
      sc.place(spot.x, spot.z, spot.angle);
      moreScreens.push(sc);
    }
  }
  for (const sc of moreScreens) sc.update(Date.now() / 1000, state.x, state.z, screenEvery);
  if (life) roadSigns.update(state.x, state.z, life.namePlates, life.junctions);
  places.update(state.x, state.z);
  // Places whose road was not loaded yet, or whose spot was tight: try again every 3 seconds.
  placeRetry -= dt;
  if (placeRetry <= 0) {
    placeRetry = 3;
    places.retry(placeFor, state.x, state.z);
  }
  streetTraffic?.update(here[0], here[1], Date.now() / 1000, TRAFFIC_LANE_M, story.hidePlayer ? undefined : state);
  updateStats(dt);
  updateButtons();
  AD_CLOCK.value = (Date.now() / 1000) % 86400; // small numbers: the GPU counts in low precision
  updateThief(dt);
  updateDriver(dt);
  updateUncle(dt);
  streetVoices(performance.now() / 1000);
  story.onFrame?.();
  if (auntie.group.visible) auntie.person?.mixer.update(dt);
  updateProps();
  updateMarker(t);
  const blips = state.onOkada || !hasOkada ? [] : [{ x: state.okadaX, z: state.okadaZ, color: '#c8442e', size: 5 }];
  if (story.target) blips.push({ x: story.target.x, z: story.target.z, color: '#e3a92b', size: 7 });
  if (thief.on) blips.push({ x: thief.x, z: thief.z, color: '#f2efe6', size: 4 });
  if (waypoint) {
    blips.push({ x: waypoint.x, z: waypoint.z, color: '#2dd4bf', size: 7 });
    if (Math.hypot(waypoint.x - state.x, waypoint.z - state.z) < 22) {
      toast('You have arrived', waypoint.name);
      waypoint = null;
      if (!story.goal) goalChip.classList.add('hidden');
    }
  }
  minimap?.update(state.x, state.z, state.camHeading + look.yaw, blips);
  void t;
}

// The riding clip is for a car seat; an okada is ridden astride, so open the knees a little.
const legOut = new THREE.Quaternion();
function ridePose(player: Player, amount: number) {
  for (const [name, side] of [['thigh_l', 1], ['thigh_r', -1]] as const) {
    const bone = player.bones[name];
    if (!bone) continue;
    legOut.setFromAxisAngle(LEG_OUT_AXIS, side * RIDE_KNEES_OUT * amount);
    bone.quaternion.premultiply(legOut);
  }
}


// ---------- Solid things: buildings, kiosks, trees, poles and vehicles ----------

function vehicleAt(x: number, z: number, room: number) {
  for (const b of streetTraffic?.boxes ?? []) {
    const dx = x - b.x;
    const dz = z - b.z;
    if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
    if (Math.abs(dx * b.fx + dz * b.fz) < b.half + room && Math.abs(dx * -b.fz + dz * b.fx) < b.halfW + room) return b;
  }
  return null;
}
function solidAt(x: number, z: number, room: number) {
  return buildings.blocked(x, z, room) || !!life?.solid(x, z, room) || !!vehicleAt(x, z, room) || places.solid(x, z, room) || compoundAt(x, z, room);
}
function pushOutOfVehicles(room: number) {
  for (let i = 0; i < 3; i++) {
    const b = vehicleAt(state.x, state.z, room);
    if (!b) return;
    // Out through the nearest side of the vehicle.
    const dx = state.x - b.x;
    const dz = state.z - b.z;
    const along = dx * b.fx + dz * b.fz;
    const side = dx * -b.fz + dz * b.fx;
    const outAlong = b.half + room - Math.abs(along);
    const outSide = b.halfW + room - Math.abs(side);
    let nx = state.x;
    let nz = state.z;
    if (outSide < outAlong) {
      const k = (outSide + 0.05) * Math.sign(side || 1);
      nx += -b.fz * k;
      nz += b.fx * k;
    } else {
      const k = (outAlong + 0.05) * Math.sign(along || 1);
      nx += b.fx * k;
      nz += b.fz * k;
    }
    if (buildings.blocked(nx, nz, room * 0.5)) return;
    state.x = nx;
    state.z = nz;
    if (state.onOkada) [state.okadaX, state.okadaZ] = [nx, nz];
  }
}
// Riding into something: a jolt and a buzz (where the phone can vibrate).
let lastBump = 0;
function bump() {
  if (performance.now() - lastBump < 800) return;
  lastBump = performance.now();
  navigator.vibrate?.(60);
  state.lean = 0.15;
}


// ---------- Talking with people, with real voices ----------
// Anyone you meet can talk with you: tap GREET (or CHAT with a seller). They speak first, often
// with a question; you pick an answer on the screen (or press 1, 2, 3) and they reply, out loud and
// in a bubble. Walking away ends it.
const voices = new Voices();
const talkEl = document.getElementById('talk')!;
let chatting = false;
let talkEnd: (() => void) | null = null;
let homeTown = 'Ada';
let dayName = 'Kwame';
const fill = (t: string) => t.replace(/\{home\}/g, homeTown).replace(/\{name\}/g, dayName);
type Who = { x: number; z: number; height: number; kind: string; seller: boolean; body: 'male' | 'female' | 'child'; seed: number; words?: string[] };
const playerVoice = () => ({ body: (playerBody === 'female' ? 'female' : 'male') as 'male' | 'female', seed: 4242 });
let playerBody: 'male' | 'female' = 'male';
let playerPerson: Person | null = null;
/** A line said to the player, in the form for a man or a woman ("my son" / "my daughter"). */
const toMe = (text: string) => forPlayer(text, playerBody);

function showChoices(node: TalkNode, pick: (i: number) => void) {
  talkEl.innerHTML = '';
  (node.choices ?? []).forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<kbd>${i + 1}</kbd>`;
    b.append(fill(c.you));
    b.addEventListener('click', () => pick(i));
    talkEl.append(b);
  });
  talkEl.classList.toggle('hidden', !node.choices?.length);
}
window.addEventListener('keydown', (e) => {
  if (!chatting || talkEl.classList.contains('hidden')) return;
  const n = Number(e.key);
  const btns = talkEl.querySelectorAll('button');
  if (n >= 1 && n <= btns.length) (btns[n - 1] as HTMLButtonElement).click();
});

async function chat(who: Who, t: number) {
  const kind = who.words?.some((w) => /!.*!/.test(w) && /Kaneshie|Madina|Circle|Accra|Lapaz|Kasoa|Tema/.test(w)) ? 'mate' : who.words?.some((w) => /Phone|Charger/i.test(w)) ? 'phones' : who.seller ? 'seller' : who.kind;
  const options = TALKS[kind] ?? TALKS.any;
  const pool = Math.random() < 0.3 && kind !== 'mate' && kind !== 'phones' && kind !== 'seller' ? TALKS.any : options;
  let node: TalkNode | null = pool[Math.floor(Math.random() * pool.length)];
  chatting = true;
  me.doing = 'greet';
  me.until = t + 120;
  const start = { x: state.x, z: state.z };
  const away = () => Math.hypot(state.x - start.x, state.z - start.z) > 2.5 || me.doing !== 'greet';
  const speak = async (text: string, mine: boolean) => {
    const line = mine ? fill(text) : toMe(fill(text));
    if (mine) life?.scenes?.onSpeak?.(state.x, state.z, 1.95, line);
    else showBubble(who.x, who.z, who.height, line, 3 + line.length * 0.05);
    const wait = new Promise((r) => setTimeout(r, Math.max(1600, 700 + line.length * 55)));
    await Promise.all([voices.say(line, mine ? playerVoice() : { body: who.body, seed: who.seed }, mine ? 0.8 : 1, 2), wait]);
  };
  // You say hello first.
  await speak(who.kind === 'muslimMan' || who.kind === 'muslimWoman' ? 'Salaam alaikum.' : ['Good afternoon!', 'Hello!', 'Chale, how far?'][Math.floor(Math.random() * 3)], true);
  while (node && !away()) {
    await speak(node.them, false);
    if (!node.choices?.length || away()) break;
    const choice = await new Promise<number>((resolve) => {
      talkEnd = () => resolve(-1);
      showChoices(node!, resolve);
    });
    talkEl.classList.add('hidden');
    if (choice < 0 || away()) break;
    const c: { you: string; next?: TalkNode | string } = node.choices[choice];
    await speak(c.you, true);
    node = asNode(c.next);
  }
  talkEl.classList.add('hidden');
  talkEnd = null;
  if (me.doing === 'greet') me.doing = 'none';
  chatting = false;
}
// Walking away closes the answer buttons.
function checkTalkAway() {
  if (chatting && talkEnd && me.doing !== 'greet') talkEnd();
}

// ---------- The action button, energy, vibe and the first goals ----------
// One gold button does the thing that makes sense where you stand, like a person would: get on the
// okada, get off, greet someone, chat to a seller, sit on a chop bar chair to rest, dance where music
// plays. It only shows when there is something to do, so the screen stays clean.

const me = { energy: 100, vibe: 0, doing: 'none' as 'none' | 'sit' | 'dance' | 'greet', until: 0, seat: null as { x: number; z: number; face: number } | null, tiredSaid: false };
type ActionId = 'ride' | 'off' | 'sit' | 'stand' | 'dance' | 'stop' | 'greet' | 'chat' | 'talk';
type Action = { id: ActionId; target?: Nearby; walker?: { i: number; x: number; z: number; kind: string; height: number; body: 'male' | 'female' | 'child' } };
const ACTIONS: Record<ActionId, { label: string; icon: string }> = {
  ride: { label: 'RIDE', icon: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5L9 10h6l3.5 6.5"/><path d="M15 10l-1.5-3H16"/><path d="M9 10l2.5 6.5h3"/>' },
  off: { label: 'GET OFF', icon: '<path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>' },
  sit: { label: 'SIT', icon: '<path d="M7 3v9h10"/><path d="M7 12l-1 9"/><path d="M17 12l1 9"/><path d="M7 7h9"/>' },
  stand: { label: 'STAND', icon: '<path d="M12 20V6"/><path d="M7 11l5-5 5 5"/>' },
  dance: { label: 'DANCE', icon: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>' },
  stop: { label: 'STOP', icon: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>' },
  greet: { label: 'GREET', icon: '<path d="M7 11V6.5a1.5 1.5 0 013 0V11"/><path d="M10 10V4.5a1.5 1.5 0 013 0V10"/><path d="M13 10V5.5a1.5 1.5 0 013 0V12"/><path d="M16 9.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-1a6 6 0 01-5-2.7L3.6 14a1.5 1.5 0 012.5-1.7L7 13.5"/>' },
  talk: { label: 'TALK', icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8"/><path d="M8 12.5h5"/>' },
  chat: { label: 'CHAT', icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8"/><path d="M8 12.5h5"/>' },
};
const actSvg = actButton.querySelector('svg')!;
const actLabel = actButton.querySelector('span')!;
actSvg.setAttribute('fill', 'none');
actSvg.setAttribute('stroke', 'currentColor');
actSvg.setAttribute('stroke-width', '2.2');
actSvg.setAttribute('stroke-linecap', 'round');
actSvg.setAttribute('stroke-linejoin', 'round');

function chooseAction(nearOkada: boolean, near: Nearby | null): Action | null {
  if (story.frozen) return null;
  if (state.onOkada) return { id: 'off' };
  if (me.doing === 'sit') return { id: 'stand' };
  // The story's kelewele auntie: talk to her.
  if (story.auntie && Math.hypot(story.auntie.x - state.x, story.auntie.z - state.z) < 2.8) return { id: 'talk' };
  if (me.doing === 'dance') return { id: 'stop' };
  if (nearOkada && state.y === 0) return { id: 'ride' };
  // People on the pavement can be greeted too: whoever is nearer, them or someone at a place.
  const walker = me.doing === 'none' && !chatting ? life?.nearestWalker(state.x, state.z, 2.4) : null;
  if (walker && (!near || Math.hypot(walker.x - state.x, walker.z - state.z) < near.d)) {
    return { id: 'greet', target: { kind: 'person', x: walker.x, z: walker.z, face: 0, d: 0, who: -1 }, walker };
  }
  if (!near) return null;
  const id = ({ seat: 'sit', music: 'dance', seller: 'chat', person: 'greet' } as const)[near.kind];
  return { id, target: near };
}

let shown = '';
function showAction(a: Action | null) {
  const id = a?.id ?? '';
  if (id === shown) return;
  shown = id;
  actButton.classList.toggle('hidden', !a);
  if (!a) return;
  actSvg.innerHTML = ACTIONS[a.id].icon;
  actLabel.textContent = ACTIONS[a.id].label;
  actButton.setAttribute('aria-label', ACTIONS[a.id].label.toLowerCase());
  actButton.style.animation = 'none';
  void actButton.offsetWidth; // restart the pop
  actButton.style.animation = '';
}

function stopDoing() {
  if (me.doing === 'sit' && me.seat) {
    // Step forward off the chair.
    state.x = me.seat.x + Math.sin(me.seat.face) * 0.6;
    state.z = me.seat.z - Math.cos(me.seat.face) * 0.6;
  }
  me.doing = 'none';
  me.seat = null;
}

function doAction(a: Action | null, t: number) {
  if (!a) {
    if (!state.onOkada) showHint('Walk up to the okada, a person, a chair or the music');
    return;
  }
  switch (a.id) {
    case 'ride':
      state.onOkada = true;
      state.speed = 0;
      state.heading = state.okadaHeading;
      break;
    case 'off':
      state.onOkada = false;
      state.speed = 0;
      // Step off to the left of the bike.
      state.x = state.okadaX - Math.cos(state.okadaHeading) * 0.9;
      state.z = state.okadaZ - Math.sin(state.okadaHeading) * 0.9;
      state.heading = state.okadaHeading;
      break;
    case 'sit':
      me.doing = 'sit';
      me.seat = a.target ? { x: a.target.x, z: a.target.z, face: a.target.face } : null;
      did.sit++;
      break;
    case 'dance':
      me.doing = 'dance';
      if (a.target) state.heading = Math.atan2(a.target.x - state.x, -(a.target.z - state.z));
      did.dance++;
      break;
    case 'talk':
      story.auntie?.reached();
      break;
    case 'stand':
    case 'stop':
      stopDoing();
      break;
    case 'greet':
    case 'chat': {
      const target = a.target!;
      state.heading = Math.atan2(target.x - state.x, -(target.z - state.z));
      state.speed = 0;
      // A short conversation: they stop, turn to you and talk.
      let who: Who | null = null;
      if (a.walker) {
        life?.holdWalker(a.walker.i, 40, state.x, state.z);
        who = { x: a.walker.x, z: a.walker.z, height: a.walker.height, kind: a.walker.kind, seller: a.walker.kind === 'hawker', body: a.walker.body, seed: a.walker.i * 13 };
      } else {
        const c = life?.scenes?.converse(target.who, performance.now() / 1000, 40);
        if (c) who = c;
      }
      if (who) void chat(who, t);
      // Saying hello lifts your vibe (not more than once every few seconds).
      if (t - lastGreet > 4) me.vibe += 1;
      lastGreet = t;
      did.greet++;
      break;
    }
  }
  document.body.classList.toggle('riding', state.onOkada);
}
let lastGreet = -10;

// Energy (design brief 11.3): running uses it up; resting on a chair brings it back fast, standing
// still slowly. With none left you cannot sprint and you walk a little slower.
function updateEnergy(dt: number) {
  const moving = Math.abs(state.speed);
  let change = 0;
  if (state.onOkada) change = 0;
  else if (me.doing === 'sit') change = 9;
  else if (me.doing === 'dance') {
    change = -0.5;
    me.vibe += dt * 0.3;
  } else if (input.sprint && moving > WALK_SPEED + 0.3) change = -1.8;
  else change = moving < 0.2 ? 0.8 : 0.25;
  me.energy = Math.max(0, Math.min(100, me.energy + change * dt));
  if (me.energy === 0 && !me.tiredSaid) {
    me.tiredSaid = true;
    toast('You are tired', 'Sit on a plastic chair at a chop bar to rest');
  }
  if (me.energy > 30) me.tiredSaid = false;
}

const energyNum = document.getElementById('energy-num')!;
const ring = document.getElementById('ring')!;
const sprintButton = btn('btn-sprint');
let statsTimer = 0;
function updateStats(dt: number) {
  statsTimer -= dt;
  if (statsTimer > 0) return;
  statsTimer = 0.2;
  const e = Math.round(me.energy);
  energyNum.textContent = String(e);
  ring.style.setProperty('--e', (me.energy / 100).toFixed(3));
  const low = me.energy < 25;
  ring.classList.toggle('low', low);
  meButton.classList.toggle('low', low);
  sprintButton.classList.toggle('off', me.energy < 1);
  if (!meCard.classList.contains('hidden')) {
    document.getElementById('me-energy')!.textContent = `${e} / 100`;
    (document.getElementById('me-energy-bar') as HTMLElement).style.width = `${e}%`;
    document.getElementById('me-vibe')!.textContent = String(Math.floor(me.vibe));
  }
}

// Buttons show only when they are any use: run while you walk, jump when you are on your feet,
// brake while the okada is moving.
const jumpButton = btn('btn-jump');
const brakeButton = btn('btn-brake');
function updateButtons() {
  const free = !state.onOkada && me.doing === 'none' && !story.frozen;
  sprintButton.classList.toggle('hidden', !(free && (Math.abs(state.speed) > 0.3 || touch.isHeld('sprint'))));
  jumpButton.classList.toggle('hidden', !free);
  brakeButton.classList.toggle('hidden', !(state.onOkada && (Math.abs(state.speed) > 1 || touch.isHeld('brake'))));
}

// The first goals: they teach the game by playing it. Real missions come with the phone.
const did = { ride: 0, greet: 0, sit: 0, dance: 0 };
const GOALS: { text: () => string; done: (from: typeof did) => boolean }[] = [
  { text: () => 'Greet someone on the street', done: (f) => did.greet > f.greet },
  { text: () => 'Rest on a chop bar chair', done: (f) => did.sit > f.sit },
  { text: () => 'Dance where the music plays', done: (f) => did.dance > f.dance },
];
let goalIndex = 0;
let goalFrom = { ...did, ride: -1 };
let goalShown = '';
const goalChip = document.getElementById('goal')!;
const goalText = document.getElementById('goal-text')!;
function checkGoal() {
  if (story.busy) return;
  if (goalFrom.ride < 0) goalFrom = { ...did }; // the first goals start after the story part
  const goal = GOALS[goalIndex];
  if (!goal) return;
  if (goal.done(goalFrom)) {
    goalIndex++;
    goalFrom = { ...did };
    me.vibe += 2;
    toast('Goal done!', '+2 Vibe');
    goalChip.classList.add('done');
    setTimeout(() => goalChip.classList.remove('done'), 1200);
    if (!GOALS[goalIndex]) {
      goalText.textContent = 'More goals come with your phone';
      setTimeout(() => goalChip.classList.add('hidden'), 8000);
      return;
    }
  }
  const text = GOALS[goalIndex].text();
  if (text !== goalShown) goalText.textContent = goalShown = text;
}

const toastEl = document.getElementById('toast')!;
let toastTimer = 0;
function toast(text: string, small = '') {
  toastEl.innerHTML = '';
  toastEl.append(text);
  if (small) {
    const s = document.createElement('small');
    s.textContent = small;
    toastEl.append(s);
  }
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 2200);
}


// ---------- The opening story (design brief 6 and 7, first part) ----------
// A short film made in the game itself: home, Grandma's goodbye and the bus, then the camera comes
// down over Accra to Circle. A boy snatches your bag; you chase him and lose him; the kelewele
// auntie calls your uncle. Then the city is yours to explore. ?nostory skips it (for tests).

const cine = new Cinema();
// The film's lines are spoken too (Grandma, the bus mate, Auntie Dede, Uncle Kwame, you).
const FILM_VOICES: Record<string, { body: 'male' | 'female' | 'child'; seed: number }> = {
  GRANDMA: { body: 'female', seed: 11 },
  'BUS MATE': { body: 'male', seed: 23 },
  'AUNTIE DEDE': { body: 'female', seed: 37 },
  'UNCLE KWAME': { body: 'male', seed: 41 },
};
cine.onLine = (who, line) => {
  const v = who === 'YOU' ? playerVoice() : FILM_VOICES[who];
  if (v) void voices.say(line, v, 1, 2);
};
// The film clip plays on Standard and Ultra phones with a good connection; others see the moving pictures.
const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const useFilmClip = tier !== 'light' && !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '4g');
const story = {
  busy: false, // the story is running (the first goals wait)
  frozen: false, // a film scene is playing: no control
  fly: null as { t: number; length: number } | null,
  goal: '',
  auntie: null as { x: number; z: number; reached: () => void } | null,
  shot: null as { x: number; z: number; bearing: number; zoom: number; pitch: number } | null,
  onFrame: null as (() => void) | null,
  /** Who or where the story is sending you (shown on the big map and the minimap). */
  target: null as null | { x: number; z: number; who?: string; role?: string; icon: string; label: string; mission: string },
  /** A move the scene gives the player (talking in the chair, eating...). */
  pose: null as null | (typeof POSES)[number],
  /** The player is out of sight (in Uncle Kwame's car). */
  hidePlayer: false,
  /** The story is running the player towards this point (the chase). */
  autoRun: null as { x: number; z: number; stop?: boolean; walk?: boolean } | null,
};

// ---------- Story people and the things in their hands ----------

const actorMove = new WeakMap<Person, Move>();
/** Change a story person's move, blending smoothly. */
function act(p: Person, move: Move, fade = 0.3) {
  const cur = actorMove.get(p);
  if (cur === move) return;
  const next = p.actions[move];
  next.reset();
  next.setEffectiveWeight(1);
  next.play();
  if (fade > 0) next.fadeIn(fade);
  if (cur) p.actions[cur].fadeOut(fade);
  actorMove.set(p, move);
}
// Small things passed from hand to hand: the paper with the number, the phone, the kelewele, money.
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
const mkProp = (g: THREE.BufferGeometry) => {
  const m = new THREE.Mesh(g, propMat);
  m.visible = false;
  scene.add(m);
  return m;
};
const props = {
  paper: mkProp(paint(box(0.13, 0.012, 0.09, 0, 0, 0), '#f6f1e3')),
  phone: mkProp(merge([paint(box(0.055, 0.12, 0.016, 0, 0, 0), '#26282c'), paint(box(0.045, 0.06, 0.018, 0, 0.02, 0), '#7fa3b8')])),
  food: mkProp(merge([paint(box(0.15, 0.1, 0.12, 0, 0, 0), '#c9a46a'), paint(box(0.13, 0.035, 0.1, 0, 0.06, 0), '#d88a1c')])),
  money: mkProp(merge([paint(box(0.15, 0.012, 0.07, 0, 0, 0), '#3f8f4f'), paint(box(0.15, 0.012, 0.07, 0.012, 0.014, 0.01), '#5aa66a')])),
};
type Carry = { prop: THREE.Mesh; from: Person; to: Person | null; t0: number; len: number };
const carries: Carry[] = [];
const rightHand = (p: Person, out: THREE.Vector3) => (p.bones.hand_r ?? p.root).getWorldPosition(out);
/** Put a thing in someone's right hand. */
function holdProp(prop: THREE.Mesh, who: Person) {
  for (let i = carries.length - 1; i >= 0; i--) if (carries[i].prop === prop) carries.splice(i, 1);
  carries.push({ prop, from: who, to: null, t0: 0, len: 0 });
  prop.visible = true;
}
/** Pass a thing from one person's hand to another's over a moment. */
function passProp(prop: THREE.Mesh, from: Person, to: Person, seconds = 0.9) {
  for (let i = carries.length - 1; i >= 0; i--) if (carries[i].prop === prop) carries.splice(i, 1);
  carries.push({ prop, from, to, t0: gameClock, len: seconds });
  prop.visible = true;
}
function dropProp(prop: THREE.Mesh) {
  for (let i = carries.length - 1; i >= 0; i--) if (carries[i].prop === prop) carries.splice(i, 1);
  prop.visible = false;
}
const ca = new THREE.Vector3();
const cb = new THREE.Vector3();
function updateProps() {
  for (const c of carries) {
    c.from.root.updateMatrixWorld(true);
    rightHand(c.from, ca);
    if (c.to) {
      c.to.root.updateMatrixWorld(true);
      rightHand(c.to, cb);
      const k = Math.min(1, (gameClock - c.t0) / c.len);
      ca.lerp(cb, k * k * (3 - 2 * k));
      if (k >= 1) [c.from, c.to] = [c.to, null];
    }
    c.prop.position.copy(ca);
    c.prop.rotation.y = c.from.root.rotation.y;
  }
}

// Uncle Kwame: about 55, grey at the temples, a blue shirt. He walks where the story sends him.
const uncle = {
  person: null as Person | null,
  on: false,
  x: 0,
  z: 0,
  heading: 0,
  target: null as { x: number; z: number } | null,
  async load() {
    const p = await createPerson({ shirt: '#4f6f8f', trousers: '#3a3430', shoes: '#2b2018', hair: '#3a3632', skin: '#6e625b' }, 'male', 'full');
    act(p, 'idle', 0);
    p.model.traverse((o) => (o.castShadow = PRESET.shadows));
    this.person = p;
  },
  show(x: number, z: number, heading: number) {
    if (!this.person) return;
    [this.x, this.z, this.heading, this.on] = [x, z, heading, true];
    scene.add(this.person.root);
  },
  hide() {
    this.on = false;
    if (this.person) scene.remove(this.person.root);
  },
  /** Walk to a point; resolves on arrival. */
  async walkTo(x: number, z: number) {
    this.target = { x, z };
    await waitUntil(() => !this.target, 12);
    this.target = null;
  },
  face(x: number, z: number) {
    this.heading = Math.atan2(x - this.x, -(z - this.z));
  },
};
function updateUncle(dt: number) {
  const p = uncle.person;
  if (!p || !uncle.on) return;
  if (uncle.target) {
    const dx = uncle.target.x - uncle.x;
    const dz = uncle.target.z - uncle.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      uncle.target = null;
      act(p, 'idle');
    } else {
      act(p, 'walk');
      uncle.heading = Math.atan2(dx, -dz);
      const step = Math.min(d, 1.7 * dt);
      uncle.x += (dx / d) * step;
      uncle.z += (dz / d) * step;
    }
  }
  p.root.position.set(uncle.x, 0, uncle.z);
  p.root.rotation.set(0, Math.PI - uncle.heading, 0);
  p.mixer.update(dt);
}

// The compound house: placed on open ground near where the ride ends, its gate facing the road.
const compound = { group: null as THREE.Group | null, x: 0, z: 0, face: 0, placed: false };
function compoundAt(x: number, z: number, room: number) {
  if (!compound.placed) return false;
  const dx = x - compound.x;
  const dz = z - compound.z;
  if (Math.abs(dx) > 14 || Math.abs(dz) > 14) return false;
  const c = Math.cos(compound.face);
  const sn = Math.sin(compound.face);
  return compoundSolid(-(dx * c + dz * sn), dx * sn - dz * c, room);
}
function placeCompound(nearX: number, nearZ: number) {
  if (!life) return null;
  compound.group ??= compoundHouse();
  const W = COMPOUND.w / 2 + 0.5;
  const D = COMPOUND.d / 2 + 0.5;
  let best: { x: number; z: number; face: number; bad: number } | null = null;
  for (let r = 14; r <= 130 && !(best && best.bad === 0); r += 6)
    for (let a = 0; a < Math.PI * 2; a += 8 / r) {
      const cx = nearX + Math.cos(a) * r;
      const cz = nearZ + Math.sin(a) * r;
      const face = life.roadDirNear(cx, cz, 40, 2);
      if (face === null) continue;
      const F = [Math.sin(face), -Math.cos(face)];
      const R = [Math.cos(face), Math.sin(face)];
      let bad = 0;
      for (let u = -W; u <= W; u += 2)
        for (let v = -D; v <= D; v += 2) {
          const px = cx + R[0] * u + F[0] * v;
          const pz = cz + R[1] * u + F[1] * v;
          if (life.roadAt(px, pz, 0.5)) bad += 100; // never on a road
          else if (buildings.blocked(px, pz, 0.2)) bad++;
        }
      // The gate must open onto the road side, close to it.
      const gx = cx + F[0] * (D + 3);
      const gz = cz + F[1] * (D + 3);
      if (!life.roadAt(gx, gz, 4)) bad += 20;
      if (!best || bad < best.bad) best = { x: cx, z: cz, face, bad };
    }
  if (!best || best.bad >= 100) return null;
  [compound.x, compound.z, compound.face, compound.placed] = [best.x, best.z, best.face, true];
  compound.group.position.set(best.x, 0, best.z);
  compound.group.rotation.y = Math.PI - best.face;
  scene.add(compound.group);
  life.clearArea(best.x, best.z, 11);
  const F = { x: Math.sin(best.face), z: -Math.cos(best.face) };
  return { x: best.x, z: best.z, face: best.face, gate: { x: best.x + F.x * (COMPOUND.d / 2 + 1.6), z: best.z + F.z * (COMPOUND.d / 2 + 1.6) }, F };
}

// The story's kelewele auntie (Auntie Dede): her own stall across the road from the nearest zebra.
const auntie = {
  group: new THREE.Group(),
  person: null as Person | null,
  x: 0,
  z: 0,
  async load() {
    // A woman in an orange top and a green wrap skirt with a matching head wrap colour.
    const p = await createPerson({ shirt: '#e2731f', trousers: '#2f8f57', shoes: '#3a2a20', hair: '#141110', skin: '#6e625b' }, 'female', 'full'); // story people: always full detail
    act(p, 'idle', 0);
    p.model.traverse((o) => (o.castShadow = PRESET.shadows));
    this.person = p;
    this.group.add(p.root);
    this.group.add(stallModel());
    this.group.visible = false;
    scene.add(this.group);
  },
  talk(on: boolean) {
    if (this.person) act(this.person, on ? 'talk' : 'idle');
  },
};
// Umbrella, table, coal pot with the pan of kelewele, and two plastic chairs. Built facing +z (the
// auntie stands at -z behind the table, the customer's chair is at +z).
function stallModel() {
  const g = new THREE.Group();
  const parts = [
    paint(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6).translate(0, 1.15, 0.1), '#d9d2c2'),
    paint(box(1.1, 0.06, 0.7, 0, 0.78, 0.1), '#7a5636'),
    paint(box(0.06, 0.76, 0.06, 0.5, 0.38, -0.2), '#5a3f28'),
    paint(box(0.06, 0.76, 0.06, -0.5, 0.38, -0.2), '#5a3f28'),
    paint(box(0.06, 0.76, 0.06, 0.5, 0.38, 0.4), '#5a3f28'),
    paint(box(0.06, 0.76, 0.06, -0.5, 0.38, 0.4), '#5a3f28'),
    paint(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 10).translate(0.75, 0.16, -0.25), '#2b2b2b'), // coal pot
    paint(new THREE.CylinderGeometry(0.3, 0.22, 0.08, 14).translate(0.75, 0.36, -0.25), '#1a1a1a'), // pan
    paint(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 14).translate(0.75, 0.39, -0.25), '#d88a1c'), // the kelewele
    paint(box(0.46, 0.05, 0.44, 0.2, 0.44, 1.05), '#1f5fa8'), // blue chair (the customer's)
    paint(box(0.46, 0.45, 0.05, 0.2, 0.68, 1.27), '#1f5fa8'),
    paint(box(0.46, 0.05, 0.44, -0.75, 0.44, 0.7), '#c8442e'), // red chair
    paint(box(0.46, 0.45, 0.05, -0.75, 0.68, 0.92), '#c8442e'),
  ];
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const solid = new THREE.Mesh(merge(parts), mat);
  solid.castShadow = true;
  g.add(solid);
  // Red and yellow umbrella.
  const canopy = new THREE.ConeGeometry(1.35, 0.45, 8, 1, true).translate(0, 2.35, 0.1);
  const cols: number[] = [];
  const pos = canopy.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i) - 0.1, pos.getX(i));
    const c = new THREE.Color(Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2 ? '#e3a92b' : '#c8442e');
    cols.push(c.r, c.g, c.b);
  }
  canopy.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const umbrella = new THREE.Mesh(canopy, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
  umbrella.castShadow = true;
  g.add(umbrella);
  return g;
}

// Put the stall on the pavement across the road from the player, beside the nearest zebra (or, with
// no zebra near, at the nearest clear pavement). Returns where the auntie and the chair are.
function placeAuntie() {
  const zebra = signals.nearestZebra(state.x, state.z, 250);
  const tries: { x: number; z: number; face: number }[] = [];
  if (zebra) {
    const rx = Math.cos(zebra.angle);
    const rz = Math.sin(zebra.angle);
    const mine = Math.sign((state.x - zebra.x) * rx + (state.z - zebra.z) * rz) || 1;
    const far = -mine; // the other side of the road
    for (const along of [4, 6, 8, 2.5, 10]) {
      const ox = Math.sin(zebra.angle) * along;
      const oz = -Math.cos(zebra.angle) * along;
      for (const out of [3.2, 4, 2.6]) {
        const face = zebra.angle + (far > 0 ? -Math.PI / 2 : Math.PI / 2); // her table faces the road
        tries.push({ x: zebra.x + ox + rx * (zebra.half + out) * far, z: zebra.z + oz + rz * (zebra.half + out) * far, face });
      }
    }
  }
  const pave = life?.pavementNear(state.x + 15, state.z, 2);
  if (pave) tries.push({ x: pave.x, z: pave.z, face: state.heading + Math.PI });
  for (const t of tries) {
    if (solidAt(t.x, t.z, 1.2) || life?.roadAt(t.x, t.z, 1.4)) continue;
    // The stall's model faces +z: turn it so the customer's chair is on the road side.
    auntie.group.position.set(t.x, 0, t.z);
    auntie.group.rotation.y = Math.PI - t.face;
    auntie.group.visible = true;
    const fx = Math.sin(t.face);
    const fz = -Math.cos(t.face);
    // She stands behind the table; the chair is in front of it.
    const ax = t.x - fx * 0.65;
    const az = t.z - fz * 0.65;
    auntie.person?.root.position.set(0, 0, -0.65);
    auntie.person?.root.rotation.set(0, 0, 0);
    const right = { x: Math.cos(t.face), z: Math.sin(t.face) };
    const chair = { x: t.x + fx * 1.05 - right.x * 0.2, z: t.z + fz * 1.05 - right.z * 0.2, face: t.face + Math.PI }; // the model's +x is to the left of where it faces
    return { x: ax, z: az, chair, zebra: zebra && Math.hypot(zebra.x - t.x, zebra.z - t.z) < 20 ? zebra : null };
  }
  return null;
}

// Mission card (title in big letters) and the "AYEKOO!" banner when a mission is done (brief 9.4).
const missionEl = document.getElementById('mission')!;
function missionCard(label: string, title: string, goal: string) {
  missionEl.innerHTML = '';
  const make = (cls: string, text: string) => {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    missionEl.append(d);
  };
  make('m-label', label.toUpperCase());
  make('m-title', title);
  make('m-goal', goal);
  missionEl.classList.remove('ayekoo');
  missionEl.classList.add('on');
  setTimeout(() => missionEl.classList.remove('on'), 4200);
}
function ayekoo(title: string, line: string) {
  missionCard('Ayekoo!', title, line);
  missionEl.classList.add('ayekoo');
}
const moneyEl = document.getElementById('money')!;
let cashNow = 0;
const cashLog: { what: string; amount: number; time: string }[] = [];
function setMoney(cedis: number, what = '') {
  // What the story says you have. Real money will always come from the server.
  if (what && cedis !== cashNow) cashLog.push({ what, amount: cedis - cashNow, time: new Date().toUTCString().slice(17, 22) });
  cashNow = cedis;
  const text = `₵ ${cedis.toLocaleString('en-GH')}`;
  moneyEl.textContent = text;
  document.getElementById('me-sika')!.textContent = text;
}
function storyGoal(text: string) {
  story.goal = text;
  goalChip.classList.toggle('hidden', !text);
  goalText.textContent = goalShown = text;
}

// Put the player (and the okada) on the pavement, not in the middle of the road, once the streets
// around the start have loaded.
let startPlaced = false;
let placeCheck = 0;
let playerMoved = false;
function placeOnPavement() {
  if (!life || performance.now() - startedAt < 1500) return false;
  let roads = false;
  for (let a = 0; a < 8 && !roads; a++) roads = life.roadAt(state.x + Math.cos(a) * 12, state.z + Math.sin(a) * 12);
  if (!roads) return performance.now() - startedAt > 20000; // give up after a while
  if (!life.junctions.length && performance.now() - startedAt < 6000) return false; // wait a moment for the junctions
  // Beside the nearest zebra crossing if there is one close by, so the first thing you see is
  // the traffic stopping at the lights; otherwise well clear of the road edge.
  const zebra = signals.nearestZebra(state.x, state.z, 220);
  let spot: { x: number; z: number } | null = null;
  if (zebra) {
    for (const side of [1, -1]) {
      const sx = zebra.x + Math.cos(zebra.angle) * (zebra.half + 2.2) * side;
      const sz = zebra.z + Math.sin(zebra.angle) * (zebra.half + 2.2) * side;
      if (!solidAt(sx, sz, 0.4) && !life.roadAt(sx, sz, 0.3)) {
        spot = { x: sx, z: sz };
        state.heading = state.camHeading = zebra.angle + (side > 0 ? -Math.PI / 2 : Math.PI / 2); // facing across the road
        break;
      }
    }
  }
  spot ??= life.pavementNear(state.x, state.z, 2.5) ?? life.pavementNear(state.x, state.z);
  if (!spot) return true;
  const ok = life.pavementNear(spot.x + 1.6, spot.z, 1.5) ?? spot;
  [state.okadaX, state.okadaZ] = [ok.x, ok.z];
  [state.x, state.z] = [spot.x, spot.z];
  return true;
}
let startedAt = performance.now();

// The thief: a boy with your bag, running away through the crowd and the traffic.
const thief = { path: [] as { x: number; z: number }[], grabAt: 0, escape: false, on: false, person: null as Person | null, x: 0, z: 0, heading: 0, speed: 0, time: 0, phase: 'pass' as 'pass' | 'run', done: null as (() => void) | null, grabbed: null as (() => void) | null };

// Your travel bag (the blue bag from the film): you hold it in your right hand until the boy
// snatches it; then it is in his hand as he runs.
const bag = (() => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(merge([
    paint(box(0.46, 0.3, 0.24, 0, -0.27, 0), '#2a4f86'),
    paint(box(0.47, 0.06, 0.25, 0, -0.36, 0), '#1d3760'),
    paint(box(0.3, 0.12, 0.02, 0, -0.25, 0.125), '#1d3760'), // front pocket
    paint(box(0.03, 0.14, 0.03, 0.08, -0.07, 0), '#141414'), // handles
    paint(box(0.03, 0.14, 0.03, -0.08, -0.07, 0), '#141414'),
    paint(box(0.19, 0.03, 0.03, 0, -0.01, 0), '#141414'),
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  body.castShadow = true;
  g.add(body);
  g.visible = false;
  scene.add(g);
  return { group: g, holder: 'none' as 'none' | 'player' | 'thief' };
})();
const handPos = new THREE.Vector3();
function placeBag(player: Player) {
  const who = bag.holder === 'player' ? player : bag.holder === 'thief' ? thief.person : null;
  bag.group.visible = !!who && (bag.holder !== 'thief' || thief.on) && !state.onOkada;
  if (!who || !bag.group.visible) return;
  const hand = who.bones.hand_r ?? who.bones.Hand_R ?? Object.values(who.bones).find((b) => /hand.?r/i.test(b.name));
  if (!hand) return;
  hand.getWorldPosition(handPos);
  bag.group.position.copy(handPos);
  bag.group.rotation.set(0, who.root.rotation.y, 0);
}
async function loadThief() {
  const boy = await createPerson({ shirt: '#c8442e', trousers: '#1b1b1d', shoes: '#2b2b2e', hair: '#141110', skin: '#665d58' }, 'male', 'lite');
  boy.root.scale.setScalar(0.86);
  boy.actions.run.play();
  boy.model.traverse((o) => (o.castShadow = PRESET.shadows));
  thief.person = boy;
}
function runThief(): { grabbed: Promise<void>; gone: Promise<void> } {
  const boy = thief.person;
  if (!boy) return { grabbed: Promise.resolve(), gone: Promise.resolve() };
  // He runs up from behind, on your right (the hand with the bag), snatches it and runs on ahead.
  thief.on = true;
  thief.phase = 'pass';
  thief.time = gameClock; // when the chase began (game time)
  thief.heading = state.heading;
  thief.x = state.x - Math.sin(state.heading) * 7 + Math.cos(state.heading) * 0.6;
  thief.z = state.z + Math.cos(state.heading) * 7 + Math.sin(state.heading) * 0.6;
  scene.add(boy.root);
  const grabbed = new Promise<void>((resolve) => (thief.grabbed = resolve));
  const gone = new Promise<void>((resolve) => (thief.done = resolve));
  return { grabbed, gone };
}
/** What stops the thief: walls, kiosks and stalls (he slips between vehicles). */
const thiefBlocked = (x: number, z: number, room: number) => buildings.blocked(x, z, room) || !!life?.solid(x, z, room) || places.solid(x, z, room);
function updateThief(dt: number) {
  const boy = thief.person;
  if (!thief.on || !boy) return;
  const d = Math.hypot(thief.x - state.x, thief.z - state.z);
  let want = thief.heading;
  if (thief.phase === 'pass') {
    thief.speed = 5.2;
    // Straight at your right hand, where the bag is.
    const tx = state.x + Math.cos(state.heading) * 0.55;
    const tz = state.z + Math.sin(state.heading) * 0.55;
    want = Math.atan2(tx - thief.x, -(tz - thief.z));
    if (Math.hypot(tx - thief.x, tz - thief.z) < 0.7 && bag.holder === 'player') {
      // The snatch: the bag goes from your hand to his.
      bag.holder = 'thief';
      thief.grabbed?.();
      thief.heading = state.heading;
      thief.grabAt = performance.now() / 1000;
    }
    const ahead = (thief.x - state.x) * Math.sin(state.heading) - (thief.z - state.z) * Math.cos(state.heading);
    if (bag.holder === 'thief' && (ahead > 3 || performance.now() / 1000 - thief.grabAt > 0.7)) thief.phase = 'run';
    if (bag.holder !== 'thief') {
      // On his way in: no steering round things (he comes straight for you).
      thief.heading = want;
      const nx = thief.x + Math.sin(want) * thief.speed * dt;
      const nz = thief.z - Math.cos(want) * thief.speed * dt;
      [thief.x, thief.z] = [nx, nz];
      boy.root.position.set(thief.x, 0, thief.z);
      boy.root.rotation.set(0, Math.PI - want, 0);
      boy.actions.run.setEffectiveTimeScale(thief.speed / 3.8);
      boy.mixer.update(dt);
      return;
    }
    want = state.heading; // then on ahead
  } else {
    // Away from you, a little faster than you; he always just gets away.
    want = Math.atan2(thief.x - state.x, -(thief.z - state.z));
    // The story's way for him (across the road, then down the far pavement).
    const next = thief.path[0];
    if (next) {
      if (Math.hypot(next.x - thief.x, next.z - thief.z) < 1.5) thief.path.shift();
      want = Math.atan2(next.x - thief.x, -(next.z - thief.z));
    }
    thief.speed = thief.escape ? 7.5 : d < 4 ? 6.2 : d < 9 ? 5.2 : 4.8;
  }
  // Steer round walls, kiosks and vehicles: try straight on first, then a little to each side.
  let turn = angleDiff(want, thief.heading);
  turn = Math.max(-2.5 * dt, Math.min(2.5 * dt, turn));
  let heading = thief.heading + turn;
  for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.2, -2.2, Math.PI]) {
    const h = heading + off;
    if (!thiefBlocked(thief.x + Math.sin(h) * 1.4, thief.z - Math.cos(h) * 1.4, 0.3)) {
      heading = h;
      break;
    }
  }
  thief.heading = heading;
  const nx = thief.x + Math.sin(heading) * thief.speed * dt;
  const nz = thief.z - Math.cos(heading) * thief.speed * dt;
  // (If he is somehow inside a stall, he may always move out of it.)
  if (!thiefBlocked(nx, nz, 0.25) || thiefBlocked(thief.x, thief.z, 0.1)) [thief.x, thief.z] = [nx, nz];
  boy.root.position.set(thief.x, 0, thief.z);
  boy.root.rotation.set(0, Math.PI - heading, 0);
  boy.actions.run.setEffectiveTimeScale(thief.speed / 3.8);
  boy.mixer.update(dt);
  // Gone: lost in the crowd.
  if (thief.phase === 'run' && (gameClock - thief.time > 24 || d > (thief.escape ? 20 : 28))) {
    thief.escape = false;
    thief.on = false;
    scene.remove(boy.root);
    thief.done?.();
  }
}

// ---------- Standing in the road ----------
// A vehicle never hits you. It stops; the mate or driver shouts at you, then hoots; if you still
// stand there, some drivers get down, walk up and push you out of the way (a push, never a blow),
// then get back in and drive on.
const SHOUTS = [
  'Chale, comot for road!',
  'Massa, move! You no see the car?',
  'Herh! Give way, my brother!',
  'Charley, wait ooo! Make I pass!',
  'Ei! You want make car jam you?',
  'Bra, abeg shift small!',
  'Jimmy! Move from the road!',
  'Mepa wo kyew, twe wo ho!',
  'Make way, make way! We dey go!',
  'Ah! You no hear horn? Move!',
];
const MATE_SHOUTS = ['Ah! My brother, move! Passengers dey wait!', 'Circle, Circle! Move, we dey go Circle!', 'Chale, you go pay our time? Move!'];
const PUSH_LINES = ['Massa, I beg, go side!', 'Chale, the road no be your room!', 'Herh, go the pavement!'];
const driver = {
  person: null as Person | null,
  loading: false,
  phase: 'none' as 'none' | 'out' | 'push' | 'back',
  car: null as null | { id: number; x: number; z: number; heading: number; halfW: number; half: number },
  x: 0,
  z: 0,
  heading: 0,
  time: 0,
};
const nagged = new Map<number, { shout: number; hoot: number }>();
const shove = { vx: 0, vz: 0, left: 0 };
const pick = <T,>(list: T[], seed: number) => list[Math.abs(Math.floor(seed)) % list.length];
async function loadDriver() {
  if (driver.person || driver.loading) return;
  driver.loading = true;
  const man = await createPerson({ shirt: '#1f5fa8', trousers: '#2a2a2e', shoes: '#2b2b2e', hair: '#141110', skin: '#6e625b' }, 'male', 'lite');
  man.actions.walk.play();
  man.actions.interact.setLoop(THREE.LoopOnce, 1);
  man.model.traverse((o) => (o.castShadow = PRESET.shadows));
  driver.person = man;
}
function onVehicleBlocked(v: { id: number; x: number; z: number; heading: number; kind: string; halfW: number; half: number; waited: number }) {
  if (story.busy) return;
  const now = performance.now() / 1000;
  const n = nagged.get(v.id) ?? { shout: 0, hoot: 0 };
  const mouthX = v.x + Math.sin(v.heading) * v.half * 0.6;
  const mouthZ = v.z - Math.cos(v.heading) * v.half * 0.6;
  // 1. A shout (the mate on a trotro, otherwise the driver), then again every few seconds.
  if (v.waited > 0.9 && now - n.shout > 5) {
    n.shout = now;
    const line = toMe(v.kind === 'trotro' && v.id % 2 ? pick(MATE_SHOUTS, v.id + now) : pick(SHOUTS, v.id * 7 + now));
    showBubble(mouthX, mouthZ, 2.3, line);
    void voices.say(line, { body: 'male', seed: v.id }, 1, 1);
  }
  // 2. The horn, again and again while you stay.
  if (v.waited > 2 && now - n.hoot > 2.5) {
    n.hoot = now;
    honk(Math.hypot(v.x - state.x, v.z - state.z), true);
  }
  nagged.set(v.id, n);
  if (nagged.size > 200) nagged.clear();
  // 3. Some drivers get down and push you aside (about half of them, after 7 seconds).
  if (v.waited > 7 && driver.phase === 'none' && driver.person && v.kind !== 'okada' && ((v.id * 2654435761) >>> 0) % 2 === 0 && !state.onOkada) {
    const side = Math.sign((state.x - v.x) * Math.cos(v.heading) + (state.z - v.z) * Math.sin(v.heading)) || 1;
    // He gets out on the side you are standing, so he walks straight to you.
    driver.car = { id: v.id, x: v.x, z: v.z, heading: v.heading, halfW: v.halfW, half: v.half };
    driver.x = v.x + Math.cos(v.heading) * (v.halfW + 0.45) * side;
    driver.z = v.z + Math.sin(v.heading) * (v.halfW + 0.45) * side;
    driver.phase = 'out';
    driver.time = 0; // seconds in this phase (game time, so slow phones work the same)
    streetTraffic?.hold.add(v.id);
    scene.add(driver.person.root);
    const line = toMe(pick(PUSH_LINES, v.id));
    showBubble(driver.x, driver.z, 1.9, line);
    void voices.say(line, { body: 'male', seed: v.id }, 1, 2);
  }
}
function updateDriver(dt: number) {
  // Being pushed: a short shove, slowing down, never into a wall or kiosk.
  if (shove.left > 0) {
    // Pushed: a quick stumble to the side, never into a wall, kiosk or vehicle.
    const len = Math.hypot(shove.vx, shove.vz) || 1;
    const step = Math.min(shove.left, Math.min(6, 1.5 + shove.left * 3) * dt);
    shove.left -= step;
    const nx = state.x + (shove.vx / len) * step;
    const nz = state.z + (shove.vz / len) * step;
    if (!solidAt(nx, nz, 0.3)) [state.x, state.z] = [nx, nz];
    else shove.left = 0;
  }
  const man = driver.person;
  if (!man || driver.phase === 'none' || !driver.car) return;
  driver.time += dt;
  const car = driver.car;
  let tx = state.x;
  let tz = state.z;
  if (driver.phase === 'back') {
    const side = Math.sign((driver.x - car.x) * Math.cos(car.heading) + (driver.z - car.z) * Math.sin(car.heading)) || 1;
    tx = car.x + Math.cos(car.heading) * (car.halfW + 0.4) * side;
    tz = car.z + Math.sin(car.heading) * (car.halfW + 0.4) * side;
  }
  const dx = tx - driver.x;
  const dz = tz - driver.z;
  const d = Math.hypot(dx, dz);
  if (driver.phase === 'out') {
    if (d < 0.85) {
      // The push: you are moved off the lane, away from the vehicle's path.
      driver.phase = 'push';
      driver.time = 0;
      man.actions.walk.stop();
      man.actions.push.reset().play();
      // Far enough to the side that the vehicle can pass (its half width plus 2 m), not more.
      const sideNow = (state.x - car.x) * Math.cos(car.heading) + (state.z - car.z) * Math.sin(car.heading);
      let across = Math.sign(sideNow) || 1;
      let need = Math.max(1.2, car.halfW + 2 - Math.abs(sideNow));
      // If that side is blocked (a kiosk, a wall), push to the other side instead.
      const free = (dir: number, m: number) => {
        for (let k = 0.5; k <= m; k += 0.5) if (solidAt(state.x + Math.cos(car.heading) * dir * k, state.z + Math.sin(car.heading) * dir * k, 0.3)) return false;
        return true;
      };
      if (!free(across, need)) {
        const other = car.halfW + 2 + Math.abs(sideNow);
        if (free(-across, other)) [across, need] = [-across, other];
      }
      shove.vx = Math.cos(car.heading) * across * need;
      shove.vz = Math.sin(car.heading) * across * need;
      shove.left = need; // metres still to go
      // Best of all: towards the nearest pavement, so you end up off the road.
      const pave = life?.pavementNear(state.x, state.z, 0.5);
      if (pave) {
        const d2 = Math.hypot(pave.x - state.x, pave.z - state.z);
        if (d2 > 0.3 && d2 < 7) [shove.vx, shove.vz, shove.left] = [pave.x - state.x, pave.z - state.z, d2];
      }
    } else if (driver.time > 12) [driver.phase, driver.time] = ['back', 0];
  } else if (driver.phase === 'push') {
    if (driver.time > 1.1) {
      [driver.phase, driver.time] = ['back', 0];
      man.actions.push.stop();
      man.actions.walk.reset().play();
    }
  } else if (driver.phase === 'back' && (d < 0.4 || driver.time > 10)) {
    // Back in the car: on his way.
    scene.remove(man.root);
    streetTraffic?.hold.delete(car.id);
    driver.phase = 'none';
    driver.car = null;
    return;
  }
  if (driver.phase !== 'push' && d > 0.05) {
    driver.heading = Math.atan2(dx, -dz);
    const step = Math.min(d, 1.5 * dt);
    driver.x += (dx / d) * step;
    driver.z += (dz / d) * step;
  }
  man.root.position.set(driver.x, 0, driver.z);
  man.root.rotation.set(0, Math.PI - driver.heading, 0);
  man.mixer.update(dt);
}

// A gold marker over the person the story wants you to find.
const marker = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 4), new THREE.MeshBasicMaterial({ color: 0xe3a92b }));
marker.rotation.x = Math.PI;
marker.visible = false;
scene.add(marker);
function updateMarker(t: number) {
  marker.visible = !!story.auntie;
  if (!story.auntie) return;
  marker.position.set(story.auntie.x, 2.35 + Math.sin(t * 3) * 0.12, story.auntie.z);
  marker.rotation.y = t * 1.5;
}

const placeCard = (name: string) => {
  placeLabel.textContent = name;
  placeLabel.classList.add('on');
  clearTimeout(placeTimer);
  placeTimer = window.setTimeout(() => placeLabel.classList.remove('on'), 3200);
};

// The chase: you run after the thief at once (the story runs you). He darts across the road; a taxi
// coming along it brakes hard right in front of you; by the time you are round the back of it, he is
// gone down the far pavement.
async function runChase(gone: Promise<void>) {
  story.frozen = false;
  document.body.classList.add('auto');
  // The road: which way it is, where its near and far edges are.
  const toRoad = life?.roadDirNear(state.x, state.z, 45) ?? life?.roadDirNear(state.x, state.z, 60, 2) ?? state.heading;
  const F = { x: Math.sin(toRoad), z: -Math.cos(toRoad) };
  const T = { x: -F.z, z: F.x }; // along the road
  let near = { x: state.x, z: state.z };
  for (let k = 0; k < 60 && !life?.roadAt(near.x, near.z, 0); k++) near = { x: near.x + F.x * 0.5, z: near.z + F.z * 0.5 };
  let far = { ...near };
  for (let k = 0; k < 60 && life?.roadAt(far.x, far.z, 0); k++) far = { x: far.x + F.x * 0.5, z: far.z + F.z * 0.5 };
  const across = { x: far.x + F.x * 2, z: far.z + F.z * 2 };
  const runSide = (life?.roadAt(across.x + T.x * 20, across.z + T.z * 20, 0) ? -1 : 1) * (Math.random() < 0.5 ? 1 : -1);
  const away = { x: across.x + T.x * 30 * runSide, z: across.z + T.z * 30 * runSide };
  thief.path = [across, away];
  story.onFrame = () => {
    if (thief.on && story.autoRun && !story.autoRun.stop && !blocker.on) [story.autoRun.x, story.autoRun.z] = [thief.x, thief.z];
  };
  story.autoRun = { x: thief.x, z: thief.z };
  cine.begin(); // a new scene: Skip from the film does not cut this short
  void cine.say('', 'A boy grabs your bag: your money, your phone and Grandma’s letter!', 3);
  await pause(1.2);
  cine.end();
  storyGoal('Catch the thief!');
  // After a short chase, when you reach the road, the taxi comes.
  await pause(2);
  await waitUntil(() => Math.hypot(near.x - state.x, near.z - state.z) < 2.2, 6);
  // It cuts straight across your path, 3 m in front of you, from the side away from the thief.
  const H = { x: Math.sin(state.heading), z: -Math.cos(state.heading) };
  const stopAt = { x: state.x + H.x * 3.2, z: state.z + H.z * 3.2 };
  T.x = -H.z;
  T.z = H.x;
  const thiefSide = Math.sign((thief.x - state.x) * T.x + (thief.z - state.z) * T.z) || 1;
  const from = -thiefSide;
  F.x = H.x;
  F.z = H.z;
  const car = { key: 'taxi' as const, kind: 'taxi' as const, id: 900001, x: stopAt.x - T.x * 26 * from, z: stopAt.z - T.z * 26 * from, heading: Math.atan2(T.x * from, -T.z * from), colour: '#f2efe6', shown: true, moving: true };
  streetTraffic?.story.push(car);
  blocker.on = true;
  story.autoRun = { x: stopAt.x + H.x * 4, z: stopAt.z + H.z * 4 }; // straight on, into its way
  honk(8, true);
  const t0 = gameClock;
  await new Promise<void>((done) => {
    const drive = () => {
      const k = Math.min(1, (gameClock - t0) / 1.4);
      const e = 1 - (1 - k) * (1 - k); // brakes hard at the end
      car.x = stopAt.x - T.x * 26 * from * (1 - e);
      car.z = stopAt.z - T.z * 26 * from * (1 - e);
      if (k < 1) requestAnimationFrame(drive);
      else done();
    };
    drive();
  });
  car.moving = false;
  story.autoRun.stop = true;
  showBubble(car.x, car.z, 2.2, toMe('Ei! Massa, watch the road!'));
  void voices.say(toMe('Ei! Massa, watch the road!'), { body: 'male', seed: 77 }, 1, 2);
  thief.escape = true;
  await pause(1.3);
  life?.scenes?.onSpeak?.(state.x, state.z, 1.9, 'Move! Move! My bag!', playerBody, 4242);
  // Round the back of the taxi and across, but he is already far down the pavement.
  const back = { x: car.x - T.x * 4.3 * from, z: car.z - T.z * 4.3 * from };
  story.autoRun = { x: back.x - F.x * 1.2, z: back.z - F.z * 1.2 };
  await waitUntil(() => Math.hypot(story.autoRun!.x - state.x, story.autoRun!.z - state.z) < 1, 3);
  story.autoRun = { x: back.x + F.x * 4, z: back.z + F.z * 4 };
  await waitUntil(() => Math.hypot(story.autoRun!.x - state.x, story.autoRun!.z - state.z) < 1, 3);
  story.autoRun = null;
  story.onFrame = null;
  state.speed = 0;
  document.body.classList.remove('auto');
  // The taxi drives on.
  car.moving = true;
  const t1 = gameClock;
  const on = () => {
    const k = (gameClock - t1) * 8;
    car.x = stopAt.x + T.x * k * from;
    car.z = stopAt.z + T.z * k * from;
    if (k < 70) requestAnimationFrame(on);
    else if (streetTraffic) streetTraffic.story = streetTraffic.story.filter((q) => q !== car);
  };
  on();
  blocker.on = false;
  await Promise.race([gone, pause(3)]);
  if (thief.on && thief.person) {
    thief.on = false;
    scene.remove(thief.person.root);
  }
}
const blocker = { on: false };
async function waitUntil(test: () => boolean, seconds: number) {
  const end = gameClock + seconds;
  while (!test() && gameClock < end) await pause(0.05);
}
/** Wait in game time (not cut short by the film's Skip; slow phones wait as long as their game takes). */
let gameClock = 0;
const pause = (seconds: number) =>
  new Promise<void>((resolve) => {
    const until = gameClock + seconds;
    const tick = () => (gameClock >= until ? resolve() : setTimeout(tick, 50));
    tick();
  });

async function playOpening(start: StartChoice) {
  const home = start.hometown;
  homeTown = home;
  bag.holder = 'player'; // you arrive holding your travel bag
  cine.preload(useFilmClip ? ['/film/circle.webp'] : ['/film/village.webp', '/film/hands.webp', '/film/bus.webp', '/film/circle.webp']);
  story.busy = story.frozen = true;
  goalChip.classList.add('hidden');
  setMoney(50, 'From Grandma for the journey');
  // 1. Home: title cards on black.
  cine.begin();
  await cine.black(true, 0.01);
  // Film pictures (made with ImagineArt, public/film): home at dawn, Grandma's goodbye, the bus,
  // arriving in Accra. Each one moves slowly while the lines are spoken.
  await cine.title(home, 'Dawn. The cockerels are crowing.', 2.4);
  // Give the clip a few more seconds to download if it needs them; if it is still not ready, use the pictures.
  for (let i = 0; useFilmClip && i < 40 && !cine.videoReady() && !cine.skipped; i++) await cine.wait(0.1);
  if (useFilmClip && cine.videoReady()) {
    // The film clip (made with ImagineArt, public/film/journey-480.mp4, 640 KB): waking up,
    // Grandma, the ₵50 and her letter, the bus leaving for Accra.
    await cine.video([
      [0.4, '', `${home}. The big morning.`],
      [3.0, 'GRANDMA', 'My child, go and make us proud.'],
      [5.4, '', 'She folds ₵50 and her letter into your hand.'],
      [7.9, '', 'The bus leaves for Accra.'],
    ]);
  } else {
    // Cheap phones, saved data or a slow connection: the moving pictures instead (330 KB).
    await cine.picture('/film/village.webp', 'in', [['', `${home}. Grandma has been up since before the cockerels.`]], 0.6);
    await cine.picture('/film/hands.webp', 'in', [['', 'She folds ₵50 into your hand.'], ['GRANDMA', 'Go and make us proud.']], 0.4);
    await cine.picture('/film/bus.webp', 'left', [['BUS MATE', 'Accra! Accra! Accra! Last seat, come, come!']], 0.3);
  }
  await cine.picture('/film/circle.webp', 'out', [['', 'Hours later. Accra. Kwame Nkrumah Circle.']], 0.3);
  // 2. The camera comes down over the city to Circle.
  if (!cine.skipped) {
    story.fly = { t: performance.now() / 1000, length: 9 };
    await cine.black(false, 1.2);
    placeCard('Accra');
    await cine.wait(4.5);
    placeCard('Kwame Nkrumah Circle');
    while (story.fly && !cine.skipped) await cine.wait(0.1);
  }
  story.fly = null;
  for (const id of ['buildings', 'roofs']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  await cine.black(false, 0.3);
  await cine.say('', 'Circle. Noise, crowds, hawkers everywhere. You made it to Accra.');
  // 3. The bag. (First make sure you are standing on the pavement where the scene happens.)
  await waitUntil(() => startPlaced, 15);
  if (life?.roadAt(state.x, state.z, 0.4)) placeOnPavement();
  playerMoved = true; // from here the story decides where you are
  const { grabbed, gone: chase } = runThief();
  await Promise.race([grabbed, new Promise((r) => setTimeout(r, 6000))]);
  bag.holder = 'thief';
  life?.scenes?.onSpeak?.(state.x, state.z, 1.9, 'Hey! My bag!', playerBody, 4242);
  setMoney(0, 'Bag stolen at Circle');
  await runChase(chase);
  toast('You lost him…', 'He is gone, into the crowd');
  // 4. Mission 1: find the kelewele auntie. Her stall is across the road at the nearest zebra:
  // wait for the lights to stop the cars, cross, and talk to her. (After the "You lost him" message.)
  await new Promise((r) => setTimeout(r, 2600));
  const stall = placeAuntie();
  missionCard('Mission 1', 'Find the kelewele auntie', stall?.zebra ? 'Cross at the zebra when the cars stop' : 'Follow the gold marker');
  if (stall) {
    storyGoal(stall.zebra ? 'Cross at the zebra, find the kelewele auntie' : 'Find the kelewele auntie (gold marker)');
    let called = false;
    let toldToCross = false;
    story.onFrame = () => {
      const d = Math.hypot(stall.x - state.x, stall.z - state.z);
      // She sees you coming and calls you over.
      if (!called && d < 16) {
        called = true;
        life?.scenes?.onSpeak?.(stall.x, stall.z, 1.95, start.body === 'female' ? 'Hey! My daughter! Come, come here!' : 'Hey! My son! Come, come here!');
      }
      // At the zebra: tell the player when the cars have stopped for them.
      const z = stall.zebra;
      if (z && !toldToCross && Math.hypot(z.x - state.x, z.z - state.z) < 9 && lightFor(z.j, z.angle, Date.now() / 1000) === 'red') {
        toldToCross = true;
        toast('The light is red: the cars have stopped', 'Cross now on the zebra');
      }
    };
    story.target = { x: stall.x, z: stall.z, who: 'Auntie Dede', role: 'Kelewele seller at Circle', icon: '🍲', label: 'Find the kelewele auntie', mission: 'MISSION 1' };
    await new Promise<void>((reached) => (story.auntie = { x: stall.x, z: stall.z, reached }));
    story.auntie = null;
    story.target = null;
    story.onFrame = null;
    // 5. The talk: she sits you down, takes your uncle's number and calls him, then feeds you.
    story.frozen = true;
    state.speed = 0;
    me.doing = 'sit';
    me.seat = { x: stall.chair.x, z: stall.chair.z, face: stall.chair.face };
    [state.x, state.z, state.heading] = [stall.chair.x, stall.chair.z, stall.chair.face];
    storyGoal('');
    const sharp = map.getPixelRatio();
    map.setPixelRatio(Math.min(devicePixelRatio, 2)); // sharper picture for the scene
    const you = playerPerson;
    const dede = auntie.person;
    // Camera shots: side-on two-shot, and closer on each of you.
    const across = stall.chair.face + Math.PI / 2;
    const mid = { x: (stall.chair.x + stall.x) / 2, z: (stall.chair.z + stall.z) / 2 };
    const clear = (side: number) => !solidAt(mid.x + Math.sin(across) * 4 * side, mid.z - Math.cos(across) * 4 * side, 0.5);
    const side = clear(1) ? 1 : -1;
    const sideBearing = ((across + (side > 0 ? Math.PI : 0)) * 180) / Math.PI;
    const twoShot = () => (story.shot = frameShot(mid.x, mid.z, sideBearing, 4.6, 75));
    const onHer = () => (story.shot = frameShot(stall.x, stall.z, (stall.chair.face * 180) / Math.PI + 180 + 30 * side, 2.6, 76));
    const onYou = () => (story.shot = frameShot(stall.chair.x, stall.chair.z, (stall.chair.face * 180) / Math.PI + 30 * side, 2.6, 76));
    cine.begin();
    twoShot();
    auntie.talk(true);
    await cine.say('AUNTIE DEDE', 'Ei! Sit down, my child. What happened?');
    auntie.talk(false);
    onYou();
    story.pose = 'sitTalk';
    await cine.say('YOU', 'A boy took my bag. My money, my phone… everything.');
    story.pose = null;
    onHer();
    auntie.talk(true);
    await cine.say('AUNTIE DEDE', 'Sorry, ooo. Who do you know in Accra?');
    auntie.talk(false);
    onYou();
    story.pose = 'sitTalk';
    await cine.say('YOU', 'My uncle. Uncle Kwame.');
    story.pose = null;
    twoShot();
    auntie.talk(true);
    await cine.say('AUNTIE DEDE', 'Give me his number. I will call him on my phone.');
    auntie.talk(false);
    // You hand her the slip of paper with his number (it was in your pocket, not in the bag).
    if (you && dede) {
      story.pose = 'sitTalk'; // you hold it out from your chair
      holdProp(props.paper, you);
      void cine.say('', 'You give her the paper with Uncle Kwame’s number. It was in your pocket.', 2.6);
      await pause(0.5);
      act(dede, 'interact');
      passProp(props.paper, you, dede, 1);
      await pause(1.4);
      story.pose = null;
      dropProp(props.paper);
      // She calls: phone at her ear.
      act(dede, 'phone');
      holdProp(props.phone, dede);
    }
    onHer();
    cine.call('Uncle Kwame');
    await pause(1.6);
    const girl = playerBody === 'female';
    await cine.say('AUNTIE DEDE', girl ? 'Hello? Is this Uncle Kwame? Your niece is here with me at Circle. A boy took her bag.' : 'Hello? Is this Uncle Kwame? Your nephew is here with me at Circle. A boy took his bag.');
    await cine.say('UNCLE KWAME', girl ? 'Ei! Okay, no problem. Tell her to stay there. I am coming very soon.' : 'Ei! Okay, no problem. Tell him to stay there. I am coming very soon.');
    await cine.say('AUNTIE DEDE', 'By the lorry station, the kelewele umbrella. Okay, okay. Bye bye.');
    cine.call(null);
    dropProp(props.phone);
    if (dede) act(dede, 'idle');
    twoShot();
    auntie.talk(true);
    await cine.say('AUNTIE DEDE', 'He is coming. Don’t worry, Accra will not swallow you. Here, eat!');
    auntie.talk(false);
    // You stand up; she gives you a wrap of hot kelewele, and you eat.
    const standX = stall.chair.x + Math.sin(stall.chair.face) * 0.7;
    const standZ = stall.chair.z - Math.cos(stall.chair.face) * 0.7;
    me.doing = 'none';
    me.seat = null;
    [state.x, state.z, state.heading] = [standX, standZ, stall.chair.face];
    if (you && dede) {
      act(dede, 'pickUp');
      await pause(0.9);
      holdProp(props.food, dede);
      act(dede, 'interact');
      story.pose = 'interact';
      passProp(props.food, dede, you, 1);
      await pause(1.2);
      act(dede, 'idle');
      story.pose = 'eat';
    }
    onYou();
    await cine.say('', 'Hot, sweet and peppery. For the first time today, you smile.', 3.4);
    ayekoo('Mission 1 complete', 'You found Auntie Dede. Uncle Kwame is on his way.');
    storyStep.auntie = true;
    me.vibe += 5;
    twoShot();
    await pause(3);

    // 6. Uncle Kwame arrives in his car, thanks her, gives her something, and takes you.
    const route = routeNear(stall.x, stall.z);
    await cine.black(true, 0.6);
    await cine.title('Forty minutes later…', '', 1.6);
    dropProp(props.food);
    story.pose = null;
    let uCar: NonNullable<typeof streetTraffic>['story'][number] | null = null;
    if (route && streetTraffic) {
      streetTraffic.hide.add(route.v.id);
      uCar = { key: 'car', kind: 'car', id: 900002, x: 0, z: 0, heading: 0, colour: '#1e3a5f', shown: true, moving: true };
      streetTraffic.story.push(uCar);
      const at = (k: number) => {
        const p = streetTraffic!.routeAt(route.v, route.s + k);
        [uCar!.x, uCar!.z, uCar!.heading] = [p.x, p.z, p.heading];
      };
      at(-40);
      story.shot = frameShot(stall.chair.x, stall.chair.z, sideBearing, 11, 72);
      await cine.black(false, 0.6);
      const t0 = gameClock;
      while (gameClock - t0 < 4.5) {
        const k = Math.min(1, (gameClock - t0) / 4.5);
        const e = 1 - (1 - k) * (1 - k); // slows to a stop
        at(-40 * (1 - e));
        await pause(0.02);
      }
      uCar.moving = false;
      honk(5, true);
    } else await cine.black(false, 0.6);
    // He gets out and walks to the stall.
    const door = uCar ? { x: uCar.x + Math.cos(uCar.heading) * 1.3, z: uCar.z + Math.sin(uCar.heading) * 1.3 } : { x: stall.chair.x + 3, z: stall.chair.z };
    uncle.show(door.x, door.z, 0);
    const meetX = (stall.x + standX) / 2 + Math.cos(stall.chair.face) * 1.1;
    const meetZ = (stall.z + standZ) / 2 + Math.sin(stall.chair.face) * 1.1;
    story.shot = frameShot((meetX + door.x) / 2, (meetZ + door.z) / 2, sideBearing, 9, 74);
    await uncle.walkTo(meetX, meetZ);
    uncle.face(stall.x, stall.z);
    story.shot = frameShot(mid.x, mid.z, sideBearing, 5.2, 75);
    if (uncle.person) act(uncle.person, 'talk');
    await cine.say('UNCLE KWAME', girl ? 'Auntie, thank you oo! God bless you for looking after my niece.' : 'Auntie, thank you oo! God bless you for looking after my nephew.');
    if (uncle.person && dede) {
      act(uncle.person, 'interact');
      holdProp(props.money, uncle.person);
      await pause(0.5);
      act(dede, 'interact');
      passProp(props.money, uncle.person, dede, 1);
      await pause(1.3);
      dropProp(props.money);
      act(dede, 'yes');
    }
    await cine.say('AUNTIE DEDE', 'Ah, no, no… okay, thank you. Take good care of this one!');
    if (dede) act(dede, 'idle');
    uncle.face(standX, standZ);
    if (uncle.person) act(uncle.person, 'talk');
    await cine.say('UNCLE KWAME', `${dayName}! Welcome to Accra. Come, let us go home.`);
    if (uncle.person) act(uncle.person, 'idle');
    // You both walk to the car and get in.
    story.autoRun = { x: door.x - Math.cos(uCar?.heading ?? 0) * 2.6, z: door.z - Math.sin(uCar?.heading ?? 0) * 2.6, walk: true };
    void uncle.walkTo(door.x, door.z);
    await waitUntil(() => !story.autoRun || Math.hypot(story.autoRun.x - state.x, story.autoRun.z - state.z) < 0.7, 8);
    story.autoRun = null;
    uncle.hide();
    story.hidePlayer = true;

    // 7. The ride home: through Accra, looking out of your window (about 14 seconds).
    if (route && uCar && streetTraffic) {
      const t0 = gameClock;
      const LEN = 14;
      let line = 0;
      const lines: [number, string, string][] = [
        [1.0, '', 'Uncle Kwame drives you home through Accra.'],
        [4.5, 'UNCLE KWAME', 'This is Accra. Busy, busy. You will learn it fast.'],
        [8.5, 'YOU', 'Everything is moving so fast…'],
        [11.0, 'UNCLE KWAME', 'Ha! Tomorrow I will show you around. Today, you rest.'],
      ];
      uCar.moving = true;
      let lastSeat = false;
      while (gameClock - t0 < LEN) {
        const t = gameClock - t0;
        const k = t < 3 ? 1.5 * t * t : 13.5 + (t - 3) * 9; // pulls away, then about 9 m/s
        const p = streetTraffic.routeAt(route.v, route.s + k);
        [uCar.x, uCar.z, uCar.heading] = [p.x, p.z, p.heading];
        [state.x, state.z, state.heading] = [p.x, p.z, p.heading]; // the city loads around you
        const right = { x: Math.cos(p.heading), z: Math.sin(p.heading) };
        if (t < 6 || t > 10.5) {
          // Out of your window, from your seat: the roadside going past. The camera sits a set
          // distance from the point it looks at, so look at a point that far out from your seat.
          const shot: { x: number; z: number } | null = story.shot && lastSeat ? story.shot : null;
          const out: number = shot ? Math.hypot(camAt.x - shot.x, camAt.z - shot.z) : 9;
          lastSeat = true;
          story.shot = { x: p.x + right.x * (0.4 + out), z: p.z + right.z * (0.4 + out), bearing: ((p.heading + Math.PI / 2) * 180) / Math.PI, zoom: 22.8, pitch: 84 };
        } else {
          lastSeat = false;
          // From behind and above: the car in the traffic.
          story.shot = { x: p.x, z: p.z, bearing: (p.heading * 180) / Math.PI, zoom: 20.6, pitch: 62 };
        }
        if (line < lines.length && t >= lines[line][0]) {
          void cine.say(lines[line][1], lines[line][2], 3);
          line++;
        }
        await pause(0.02);
      }
      streetTraffic.hide.delete(route.v.id);
    }

    // 8. The compound house.
    await cine.black(true, 0.7);
    const home = placeCompound(state.x, state.z);
    if (home) {
      if (uCar) {
        const right = { x: Math.cos(home.face), z: Math.sin(home.face) };
        uCar.x = home.gate.x + home.F.x * 2.5 + right.x * 6;
        uCar.z = home.gate.z + home.F.z * 2.5 + right.z * 6;
        uCar.heading = home.face + Math.PI / 2;
        uCar.moving = false;
      }
      [state.x, state.z, state.heading, state.camHeading] = [home.gate.x + home.F.x * 1.2, home.gate.z + home.F.z * 1.2, home.face + Math.PI, home.face + Math.PI];
      uncle.show(home.gate.x - home.F.x * 2.4, home.gate.z - home.F.z * 2.4, home.face);
      story.shot = frameShot(home.gate.x, home.gate.z, ((home.face + Math.PI) * 180) / Math.PI, 15, 64);
    }
    story.hidePlayer = false;
    await cine.title(`Chapter 1 · From ${start.hometown} to Accra`, 'Uncle Kwame’s compound house', 3);
    await cine.black(false, 0.9);
    if (uncle.person) act(uncle.person, 'talk');
    await cine.say('UNCLE KWAME', 'Welcome home. This is our compound. Come in, let me show you your corner.');
    if (uncle.person) act(uncle.person, 'idle');
    story.shot = null;
    cine.end();
    map.setPixelRatio(sharp);
    stopDoing();
    if (home) {
      storyGoal('Walk into the compound');
      story.target = { x: home.x, z: home.z, who: 'Uncle Kwame', role: 'Your uncle · his compound house', icon: '🏠', label: 'Walk into the compound', mission: 'CHAPTER 1' };
      await waitUntil(() => Math.hypot(home.x - state.x, home.z - state.z) < COMPOUND.d / 2 - 1, 120);
      story.target = null;
      missionCard('Chapter 1', 'Fresh in Accra', 'Coming soon: Welcome Chop, your first mission in the compound');
      storyStep.home = true;
    }
  }
  story.frozen = false;
  story.busy = false;
  storyGoal('');
  toast('Explore the city', 'Your first goals are top left');
}
/**
 * A film shot of people standing at (x, z), seen from `distance` metres away along `bearing`, the
 * camera tilted to `pitch`. The map's camera looks at a point on the ground from a set distance (about
 * 10.7 m at zoom 23.1, halving with each zoom step, whatever the screen size), so: aim beyond them by
 * just enough that the middle of the picture is at chest height, and pick the zoom that puts the
 * camera the right distance from them.
 */
function frameShot(x: number, z: number, bearing: number, distance: number, pitch: number) {
  const b = (bearing * Math.PI) / 180;
  const down = ((90 - pitch) * Math.PI) / 180;
  const k = 1.3 / Math.tan(down); // from the person to where the camera's line meets the ground
  const R = (distance + k) / Math.sin((pitch * Math.PI) / 180); // camera to that point
  const zoom = 23.1 - Math.log2(R / 10.7);
  return { x: x + Math.sin(b) * k, z: z - Math.cos(b) * k, bearing, zoom, pitch };
}
/** A traffic route that passes close to a point (Uncle Kwame drives along it), and where on it. */
function routeNear(x: number, z: number) {
  if (!streetTraffic) return null;
  const cands = streetTraffic.placed
    .filter((p) => !p.bridge && (p.v.kind === 'car' || p.v.kind === 'taxi'))
    .map((p) => {
      const at = streetTraffic!.routeAt(p.v, p.s);
      return { p, d: Math.hypot(at.x - x, at.z - z) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, 14);
  let best: { v: (typeof cands)[number]['p']['v']; s: number; d: number } | null = null;
  for (const { p } of cands)
    for (let k = -220; k <= 220; k += 4) {
      const at = streetTraffic.routeAt(p.v, p.s + k);
      const d = Math.hypot(at.x - x, at.z - z);
      if (!at.bridge && (!best || d < best.d)) best = { v: p.v, s: p.s + k, d };
    }
  return best && best.d < 16 ? best : null;
}
let hintTimer = 0;
function showHint(text: string) {
  help.textContent = text;
  help.hidden = false;
  help.style.opacity = '1';
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => (help.style.opacity = '0'), 2500);
}

// Automatic test (?auto): ride the okada in a long gentle curve and measure the frame rate.
async function runAutoTest() {
  state.x = state.okadaX + 1;
  state.z = state.okadaZ;
  tapped.add('act');
  keys.add('KeyW');
  setTimeout(() => keys.add('KeyD'), 4000);
  setTimeout(() => keys.delete('KeyD'), 6000);
  await new Promise((r) => setTimeout(r, 3000));
  const riding = await measureFps(8);
  keys.clear();
  tapped.add('act');
  await new Promise((r) => setTimeout(r, 1500));
  keys.add('KeyW');
  keys.add('ShiftLeft');
  const walking = await measureFps(5);
  keys.clear();
  const result = { tier, riding: Math.round(riding), walking: Math.round(walking), triangles: renderer.info.render.triangles };
  document.body.dataset.result = JSON.stringify(result);
  console.log('street-test result', result);
}

let minimap: Minimap | null = null;
// ---------- Adverts: tap a vehicle in the street, or a billboard on the big map ----------
const adCard = new AdCard();
const KIND_NAME: Record<string, string> = { trotro: 'Trotro', bus: 'City bus', truck: 'Truck', taxi: 'Taxi', car: 'Car', pickup: 'Pickup', suv: 'SUV', tricycle: 'Tricycle', okada: 'Okada' };
const tapPoint = new THREE.Vector4();
function tapVehicle(sx: number, sy: number) {
  if (!streetTraffic || story.busy || adCard.isOpen) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let best: { p: (typeof streetTraffic.placed)[number]; d: number } | null = null;
  for (const p of streetTraffic.placed) {
    if (p.bridge) continue;
    const [x, z] = [(p.lon - START[0]) * M_LON, (START[1] - p.lat) * M_LAT];
    if (Math.hypot(x - state.x, z - state.z) > 70) continue;
    tapPoint.set(x, 1.3, z, 1).applyMatrix4(camera3d.projectionMatrix);
    if (tapPoint.w <= 0) continue;
    const px = ((tapPoint.x / tapPoint.w + 1) / 2) * w;
    const py = ((1 - tapPoint.y / tapPoint.w) / 2) * h;
    const d = Math.hypot(px - sx, py - sy);
    if (d < 90 && (!best || d < best.d)) best = { p, d };
  }
  if (!best) return;
  const info = streetTraffic.vehicleInfo(best.p.v);
  const name = KIND_NAME[best.p.v.kind] ?? 'Vehicle';
  if (info.ad === null) {
    toast(name, 'No advert space on this one');
    return;
  }
  // It stops while you look, its advert still sliding.
  const id = best.p.v.id;
  streetTraffic.hold.add(id);
  const [vx, vz] = [(best.p.lon - START[0]) * M_LON, (START[1] - best.p.lat) * M_LAT];
  showBubble(vx, vz, 2.4, toMe(best.p.v.kind === 'trotro' ? 'Chale, you want put your advert for my trotro?' : 'Boss, you like the advert?'));
  const row = info.ad;
  adCard.open({
    kind: 'vehicle',
    title: `${name} · advert on both sides and the back`,
    picture: streetTraffic.vehicleAdPicture(row),
    price: best.p.v.kind === 'bus' ? '₵900 a week (citywide fleet)' : '₵250 a week (trotro route pack)',
    note: 'It drives its real route all day, past everyone on the road. The advert changes every few seconds.',
    preview: (d) => streetTraffic?.previewAd(row, { title: d.brand, line: d.head, bg: d.bg, accent: d.accent }),
    onClose: () => streetTraffic?.hold.delete(id),
  });
  setTimeout(() => streetTraffic?.hold.delete(id), 30000); // never held for long
}
function openBoardCard(ad: number, place: string) {
  fullMap.close();
  adCard.open({
    kind: 'billboard',
    title: `Billboard · ${place || 'Accra'}`,
    picture: adThumb(ad, 512),
    price: '₵350 a week (big billboard at a busy spot)',
    note: `Shared with ${AD_COUNT - 1} other adverts: each shows for 7 seconds, then slides to the next. Seen from both sides of the road.`,
    preview: (d, photo) => life?.previewAd(ad, d, photo),
  });
}

// The part of the city open now: Circle (the rest of Accra opens with the story; brief 9).
const OPEN_RADIUS_M = 1100;
// The big map: tap the minimap. Shows the real streets, you, your goal and every place found.
const lngLatOf = (x: number, z: number) => ({ lng: START[0] + x / M_LON, lat: START[1] - z / M_LAT });
const fullMap = new FullMap(tier, () => {
  const list = places.list().map((p) => ({ ...lngLatOf(p.x, p.z), kind: p.kind }));
  if (station) list.push({ ...lngLatOf(station.x, station.z), kind: 'LORRY STATION' });
  // The story's target first (who you are going to meet), then a place picked in the Ride app.
  const t = story.target;
  const goal = t
    ? { ...lngLatOf(t.x, t.z), label: story.goal || t.label, who: t.who, role: t.role, icon: t.icon }
    : waypoint
      ? { ...lngLatOf(waypoint.x, waypoint.z), label: waypoint.name, icon: '📍' }
      : null;
  return {
    you: { ...lngLatOf(state.x, state.z), heading: state.heading },
    goal,
    open: { ...lngLatOf(0, 0), radius: OPEN_RADIUS_M, name: 'Circle' },
    player: { name: dayName, home: homeTown, energy: me.energy, vibe: me.vibe, money: cashNow, mission: t?.mission ?? '' },
    places: list,
    areas: PLACES.map((a) => ({ name: a.name, lng: a.at[0], lat: a.at[1] })),
    cars: () => (streetTraffic?.placed ?? []).map((p) => ({ id: p.v.id, lng: p.lon, lat: p.lat, kind: p.v.kind, heading: p.heading })),
    here: placeLabel.textContent ?? '',
    boards: (life?.boards.all ?? []).filter((b) => Math.hypot(b.x - state.x, b.z - state.z) < 700).map((b) => ({ ...lngLatOf(b.x, b.z), ad: b.colour % AD_COUNT })),
    adPicture: (n) => adThumb(n, 160),
    openAd: (n) => openBoardCard(n, placeLabel.textContent ?? ''),
  };
});
// Where the Ride app is taking you (a teal marker on the maps).
let waypoint: Destination | null = null;
const storyStep = { auntie: false, home: false };
const CHAPTER_1 = ['Welcome Chop', 'Get Connected', 'Mate for a Day', 'Lights Off', 'Two Years Advance', 'Your Own Key'];
// City Feed: what is happening in the city (fictional people and businesses only).
const feedPosts: { who: string; text: string; time: string; gold?: boolean }[] = [];
const FEED = [
  { who: 'Ghanaverse News', text: 'Auntie Akos: “Chale, this one too!” A goat stopped traffic at Circle for ten minutes this morning.', gold: true },
  { who: 'Circle Traffic', text: 'Heavy traffic on the Ring Road towards Kaneshie. Okadas are moving, trotros are not.' },
  { who: 'SIKA OIL', text: 'Fuel price board updated at every SIKA OIL filling station today.' },
  { who: 'Ghanaverse Weather', text: 'Hot and dusty this afternoon, 32°C. Rain clouds over Madina later.' },
  { who: 'Kokomlemle Market', text: 'Fresh tomatoes just arrived. The market women say: come early, they will finish.' },
  { who: 'Ghanaverse News', text: 'Chidi from Lagos: “Wahala dey!” Bag snatchers seen near the lorry station. Hold your things well.', gold: true },
  { who: 'Adabraka Chop Bar', text: 'Waakye is ready. Banku and tilapia from 6 pm.' },
  { who: 'Ghanaverse Police', text: 'Officers on foot patrol at Circle tonight. Report thieves to the police station near you.' },
  { who: 'Asylum Down Youth', text: 'Street football at the park this evening. Everybody is welcome.' },
];
let feedNext = 0;
const postFeed = () => {
  const f = FEED[feedNext++ % FEED.length];
  feedPosts.push({ ...f, time: new Date().toUTCString().slice(17, 22) });
  if (feedPosts.length > 30) feedPosts.shift();
  document.getElementById('btn-phone')?.classList.toggle('dot', !!phone?.newPosts());
};

const phone: Phone = new Phone({
  money: () => cashNow,
  history: () => cashLog,
  goal: () => story.goal || (waypoint ? `Go to ${waypoint.name}` : goalChip.classList.contains('hidden') ? '' : goalText.textContent ?? ''),
  missions: () => {
    const rows: MissionRow[] = [
      { title: 'Arrive in Accra', goal: 'The trotro to Circle', state: 'done' },
      { title: 'Mission 1 · Find the kelewele auntie', goal: 'Cross at the zebra and find Auntie Dede', state: storyStep.auntie ? 'done' : 'now' },
    ];
    CHAPTER_1.forEach((t, i) => rows.push({ title: `Chapter 1 · ${t}`, goal: '', state: storyStep.auntie && i === 0 ? 'next' : 'locked' }));
    if (storyStep.auntie) rows[2].goal = 'Uncle Kwame will call you about this';
    return rows;
  },
  openMap: () => fullMap.open(),
  destinations: () => {
    const list: Destination[] = PLACES.map((a) => ({ name: a.name, x: (a.at[0] - START[0]) * M_LON, z: (START[1] - a.at[1]) * M_LAT, kind: 'AREA' }));
    for (const f of places.fuelNear(state.x, state.z, 2500).slice(0, 4)) list.push({ name: 'SIKA OIL filling station', x: f.x, z: f.z, kind: 'FILLING STATION' });
    if (station) list.push({ name: 'Circle lorry station', x: station.x, z: station.z, kind: 'LORRY STATION' });
    return list
      .map((d) => ({ ...d, dist: Math.hypot(d.x - state.x, d.z - state.z) }))
      .filter((d) => d.dist > 40)
      .sort((a, b) => a.dist - b.dist)
      .filter((d, i, all) => d.kind !== 'FILLING STATION' || all.findIndex((o) => o.kind === 'FILLING STATION') === i || d.dist > 600);
  },
  setWaypoint: (d) => {
    waypoint = d;
    if (d) {
      toast('Marked on your map', d.name);
      if (!story.goal) {
        goalChip.classList.remove('hidden');
        goalText.textContent = `Go to ${d.name}`;
      }
    }
  },
  waypoint: () => waypoint,
  feed: () => feedPosts,
  say: (text, who) => voices.say(text, who, 1, 2),
  toMe,
  stopTalking: () => voices.stop(),
  nickname: () => 'Newcomer',
  storyDone: (step) => (step === 'auntie' ? storyStep.auntie : false),
  muted: () => voices.muted,
  toggleSound: () => document.getElementById('btn-sound')?.click(),
  tier: () => tier,
});
for (let i = 0; i < 4; i++) postFeed();
setInterval(postFeed, 90_000);
document.getElementById('minimap')!.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!document.body.classList.contains('cine')) fullMap.open();
});
addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') fullMap.toggle();
  if (e.key === 'Escape') {
    adCard.close();
    fullMap.close();
    phone.close();
  }
  if (e.key === 'p' || e.key === 'P') phone.toggle();
});
// Real 3D buildings near the player (the map's own blocks are switched off at street level).
// Trees, lights, kiosks, umbrellas, polytanks and people, placed along the same streets.
let life: StreetLife | null = null;
let trafficModel: Traffic | null = null;
const pendingBatches: { pts: [number, number][]; lanes: 1 | 2; half: number; bridge: boolean }[][] = [];
const buildings = new StreetBuildings(
  (lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT],
  { light: 220, standard: 320, ultra: 450 }[tier],
  (roads, roofs, pois) => {
    life?.add(roads, roofs);
    // The real places from the map: filling stations, bus stops, banks, churches, schools...
    places.add(pois, placeFor);
    // Bridges become real flyovers (the Kwame Nkrumah Interchange at Circle).
    const ROAD_HALF: Record<string, number> = { highway: 7, major_road: 5, minor_road: 3.25, other: 2.4 };
    flyovers.add(roads.filter((r) => r.bridge).map((r) => ({ pts: r.pts, half: ROAD_HALF[r.kind] ?? 4 })));
    // Every street the map loads gets traffic too: two lanes each way on main roads, one on others.
    const toLngLat = (x: number, z: number): [number, number] => [START[0] + x / M_LON, START[1] - z / M_LAT];
    // Traffic drives on exactly these streets (one tile at a time), flyovers included; not on lanes
    // and service roads.
    const batch = roads
      .filter((r) => r.kind !== 'other')
      .map((r) => ({
        pts: Array.from({ length: r.pts.length / 2 }, (_, i) => toLngLat(r.pts[i * 2], r.pts[i * 2 + 1])),
        lanes: (r.kind === 'minor_road' ? 1 : 2) as 1 | 2,
        half: ROAD_HALF[r.kind] ?? 4,
        bridge: !!r.bridge,
      }));
    if (trafficModel) trafficModel.addRoads(batch);
    else pendingBatches.push(batch);
  },
);
scene.add(buildings.group);
life = new StreetLife((x, z, m) => buildings.blocked(x, z, m), { ...{
  // Busy but not packed (owner, 2026-10-25: the earlier 110 / 320 / 560 walkers was too much).
  // Circle is packed (owner, 2026-10-25): many more people on the pavements, and shops everywhere.
  // On a struggling phone the walkers thin out automatically (busy %), the shops stay.
  light: { radiusM: 140, people: 95, props: 450, scenes: 36 },
  standard: { radiusM: 200, people: 250, props: 1000, scenes: 80 },
  ultra: { radiusM: 280, people: 480, props: 1600, scenes: 130 },
}[tier], smoothCrowd: PRESET.smoothCrowd });
scene.add(life.group);
// The sound of Accra (starts on the first tap), with a button to switch it off.
const streetSound = new StreetSound();
const soundButton = document.getElementById('btn-sound')!;
soundButton.addEventListener('click', () => {
  streetSound.setMuted(!streetSound.muted);
  voices.muted = streetSound.muted;
  if (voices.muted) voices.stop();
  soundButton.classList.toggle('off', streetSound.muted);
});

function showBubble(x: number, z: number, height: number, text: string, seconds = 2.6) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  document.body.appendChild(el);
  bubbles.push({ el, at: new THREE.Vector3(x, height + 0.25, z), until: performance.now() / 1000 + seconds });
}

// The street's voices: bus mates hanging out of passing trotros shout their routes, the station's
// mates call, and now and then someone nearby calls out.
let nextShout = 0;
function streetVoices(t: number) {
  if (t < nextShout || chatting || story.frozen || voices.busy) return;
  nextShout = t + 2.5 + Math.random() * 3.5;
  // A trotro passing close by: its mate shouts where it is going.
  let best: { x: number; z: number; id: number } | null = null;
  let bestD = 40;
  for (const p of streetTraffic?.placed ?? []) {
    if (p.v.kind !== 'trotro' || p.bridge) continue;
    const [x, z] = [(p.lon - START[0]) * M_LON, (START[1] - p.lat) * M_LAT];
    const d = Math.hypot(x - state.x, z - state.z);
    if (d < bestD) [best, bestD] = [{ x, z, id: p.v.id }, d];
  }
  if (best) {
    const line = mateCall(best.id * 31 + Math.floor(Math.random() * 1000));
    showBubble(best.x, best.z, 2.6, line);
    void voices.say(line, { body: 'male', seed: best.id }, 1 / (1 + bestD / 9), 1);
    return;
  }
  // Near the station: one of its mates.
  if (station && Math.hypot(station.x - state.x, station.z - state.z) < 45) {
    const mates = station.people.filter((q) => q.words);
    const m = mates[Math.floor(Math.random() * mates.length)];
    if (m?.words) {
      const line = m.words[Math.floor(Math.random() * m.words.length)];
      showBubble(m.x, m.z, 1.95, line);
      void voices.say(line, { body: 'male', seed: Math.round(m.x * 3) }, 1 / (1 + Math.hypot(m.x - state.x, m.z - state.z) / 9), 1);
      return;
    }
  }
  // Otherwise: people chatting as they pass.
  const w = life?.nearestWalker(state.x, state.z, 14);
  if (w) {
    const line = CHATTER[Math.floor(Math.random() * CHATTER.length)];
    showBubble(w.x, w.z, w.height, line);
    void voices.say(line, { body: w.body, seed: w.i * 13 }, 0.55 / (1 + Math.hypot(w.x - state.x, w.z - state.z) / 8), 0);
  }
}
const CHATTER = [
  'Chale, the traffic today!', 'I am coming, I am coming!', 'Did you watch the match yesterday?', 'Charley, how be?', 'Mummy, wait for me!',
  'Ei, the sun is hot oo!', 'Where are you? I am at Circle.', 'Let us go and buy waakye.', 'This trotro is too slow!', 'Hello? I can’t hear you!',
  'Ei, look at that one!', 'Tomorrow we go to Kaneshie market.', 'My brother, how far?', 'I will call you back.', 'Ah, see this price!',
];

// Speech bubbles: people at places call out to you as you pass.
const bubbles: { el: HTMLElement; at: THREE.Vector3; until: number }[] = [];
const projected = new THREE.Vector4();
function placeBubbles(now: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (now > b.until) {
      b.el.remove();
      bubbles.splice(i, 1);
      continue;
    }
    projected.set(b.at.x, b.at.y, b.at.z, 1).applyMatrix4(camera3d.projectionMatrix);
    const visible = projected.w > 0;
    b.el.style.opacity = visible && now < b.until - 0.3 ? '1' : '0';
    if (visible) b.el.style.transform = `translate(${((projected.x / projected.w + 1) / 2) * w}px, ${((1 - projected.y / projected.w) / 2) * h}px) translate(-50%, -100%)`;
  }
}

// Real places (filling stations, bus stops and signboards for banks, pharmacies, churches...).
const places = new Places();
const fuelWhy: string[] = [];
let placeRetry = 3;
scene.add(places.group);
function placeFor(x: number, z: number, kind: 'fuel' | 'stop' | 'sign', tries = 0): PlaceAt {
  if (!life) return null;
  // The map sometimes puts the point on the road itself: start from the pavement beside it.
  if (life.roadAt(x, z, 0.5)) {
    const pave = life.pavementNear(x, z, 0.5);
    if (pave && Math.hypot(pave.x - x, pave.z - z) < 20) [x, z] = [pave.x, pave.z];
  }
  // Main roads first; any street (a side road) if there is none, and further on later tries.
  const reach = (kind === 'fuel' ? 45 : 60) + tries * 8;
  const toRoad = life.roadDirNear(x, z, reach) ?? life.roadDirNear(x, z, reach, 2);
  if (kind === 'fuel') fuelWhy.push(toRoad === null ? 'no road' : 'ok?');
  if (toRoad === null) return null;
  if (kind === 'fuel') {
    // The forecourt must be open ground with its front at the road. Tried full size first, then
    // smaller (a roadside station), and slid along the road a little, so every real one fits.
    const F = [Math.sin(toRoad), -Math.cos(toRoad)];
    const R = [Math.cos(toRoad), Math.sin(toRoad)];
    for (const scale of [1, 0.82, 0.66]) {
      for (const slide of [0, 5, -5, 10, -10, 16, -16]) {
        let cx = x + R[0] * slide;
        let cz = z + R[1] * slide;
        const front = 10 * scale;
        for (let k = 0; k < 45 && !life.roadAt(cx + F[0] * (front + 0.5), cz + F[1] * (front + 0.5), 0.3); k++) [cx, cz] = [cx + F[0], cz + F[1]];
        for (let k = 0; k < 45 && life.roadAt(cx + F[0] * (front - 0.5), cz + F[1] * (front - 0.5), 0.3); k++) [cx, cz] = [cx - F[0], cz - F[1]];
        let blockedN = 0;
        let n = 0;
        let road = false;
        for (let u = -10; u <= 10 && !road; u += 2.5)
          for (let v = -9; v <= 8; v += 2.5) {
            const px = cx + (R[0] * u + F[0] * v) * scale;
            const pz = cz + (R[1] * u + F[1] * v) * scale;
            n++;
            if (v < 6 && life.roadAt(px, pz, 0)) {
              road = true;
              break;
            }
            if (buildings.blocked(px, pz, 0.1)) blockedN++;
          }
        if (road) {
          fuelWhy.push('road in yard');
          continue;
        }
        // The map often draws the station's own shop as a building: some is fine (more on later tries).
        if (blockedN > n * (tries >= 4 ? 0.5 : 0.3)) {
          fuelWhy.push('buildings ' + blockedN + '/' + n);
          continue;
        }
        life.clearArea(cx, cz, 13 * scale);
        return { x: cx, z: cz, face: toRoad, scale };
      }
    }
    return null;
  }
  // A shelter or signboard: at the roadside in front of the place, facing the road.
  const F = [Math.sin(toRoad), -Math.cos(toRoad)];
  let px = x;
  let pz = z;
  for (let k = 0; k < 60; k++) {
    const nx = px + F[0];
    const nz = pz + F[1];
    if (life.roadAt(nx, nz, kind === 'stop' ? 1.6 : 1.1)) break;
    [px, pz] = [nx, nz];
  }
  // Blocked right in front (a wall, the road itself)? Slide along the road a little to find room.
  const R = [Math.cos(toRoad), Math.sin(toRoad)];
  for (const slide of [0, 2.5, -2.5, 5, -5, 8, -8]) {
    let sx = px + R[0] * slide;
    let sz = pz + R[1] * slide;
    for (let k = 0; k < 6 && life.roadAt(sx, sz, 0.6); k++) [sx, sz] = [sx - F[0] * 0.7, sz - F[1] * 0.7]; // back off the road
    if (!life.roadAt(sx, sz, 0.6) && !buildings.blocked(sx, sz, 0.2) && !places.solid(sx, sz, 0.3)) return { x: sx, z: sz, face: toRoad };
  }
  return null;
}

// The trotro station at Circle: the nearest open ground (no buildings, no roads) big enough for
// the yard, 40 to 250 m from the middle of Circle, facing the nearest main road.
let stationPlaced = false;
let stationCheck = 0;
function placeStation() {
  if (!life || !streetTraffic) return false;
  const clearYard = (cx: number, cz: number, face: number) => {
    const R = [Math.cos(face), Math.sin(face)];
    const F = [Math.sin(face), -Math.cos(face)];
    for (let u = -17; u <= 17; u += 3)
      for (let v = -12; v <= 12; v += 3) {
        const px = cx + R[0] * u + F[0] * v;
        const pz = cz + R[1] * u + F[1] * v;
        if (buildings.blocked(px, pz, 0.5) || life!.roadAt(px, pz, 0.8)) return false;
      }
    return true;
  };
  const tries: [number, number][] = [];
  for (let r = 40; r <= 250; r += 12) for (let a = 0; a < Math.PI * 2; a += 12 / r) tries.push([Math.cos(a) * r, Math.sin(a) * r]);
  for (const [cx, cz] of tries) {
    if (Math.hypot(cx - state.x, cz - state.z) < 30) continue; // not on top of the player
    const toRoad = life.roadDirNear(cx, cz, 26);
    if (toRoad === null || !clearYard(cx, cz, toRoad)) continue;
    const plan = planStation(cx, cz, toRoad);
    life.clearArea(cx, cz, 21);
    scene.add(plan.group);
    streetTraffic.parked = plan.parked;
    if (life.scenes) life.scenes.fixed = plan.people;
    life.refreshSoon();
    station = plan;
    return true;
  }
  return performance.now() - startedAt > 30000; // nothing found: stop looking
}
let station: ReturnType<typeof planStation> | null = null;

// Street-name plates and green direction signs to the nearby areas.
const roadSigns = new RoadSigns(PLACES.map((p) => ({ name: p.name, x: (p.at[0] - START[0]) * M_LON, z: (START[1] - p.at[1]) * M_LAT })));
scene.add(roadSigns.group);

// The big screen at Circle (brief 17): put on the billboard spot nearest the middle of Circle.
const bigScreen = new BigScreen(0);
scene.add(bigScreen.group);
// More LED screens along the main roads, each showing the pages at a different moment.
const moreScreens: BigScreen[] = [];
let screenCheck = 0;

// Flyovers built from the map's bridges.
const flyovers = new Flyovers();
scene.add(flyovers.group);

// Traffic lights and zebra crossings at the big junctions (vehicles stop on red).
const signals = new Signals();
scene.add(signals.group);

// Planes on the Kotoka flight paths and helicopters circling over the city.
const sky = new SkyTraffic((lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT]);
scene.add(sky.group);
let streetTraffic: StreetTraffic | null = null;
const TRAFFIC_LANE_M = 1.35; // the inner lane; the kerb lane is further out (traffic.ts) // from the middle of the road to the middle of the lane (Ghana drives on the right)

async function start() {
  const skipStory = autoTest || params.has('nostory');
  const [choice] = await Promise.all([
    (async (): Promise<StartChoice> => {
      await landscapeGate(document.getElementById('gate')!, autoTest);
      const female = params.has('female') ? 'female' : undefined;
      return skipStory ? { body: female ?? 'male', hometown: 'Ada' } : startScreen({ body: female }, () => useFilmClip && cine.prepareVideo('/film/journey-480.mp4', '/film/journey-poster.jpg'));
    })(),
    new Promise<void>((r) => map.once('load', () => r())),
  ]);
  playerBody = choice.body;
  homeTown = choice.hometown;
  // Day name from the day you arrive (brief 5.3).
  dayName = (choice.body === 'female' ? ['Akosua', 'Adwoa', 'Abenaa', 'Akua', 'Yaa', 'Afua', 'Ama'] : ['Kwasi', 'Kwadwo', 'Kwabena', 'Kwaku', 'Yaw', 'Kofi', 'Kwame'])[new Date().getDay()];
  const [player] = await Promise.all([loadPlayer(choice.body), skipStory ? null : loadThief(), skipStory ? null : auntie.load(), skipStory ? null : uncle.load()]);
  playerPerson = player;
  for (const move of ['jumpLoop', 'jumpLand'] as const) {
    player.actions[move].play();
    player.actions[move].setEffectiveWeight(0);
  }
  player.actions.jumpLand.setLoop(THREE.LoopOnce, 1);
  player.actions.jumpLand.clampWhenFinished = true;
  minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement, map, (lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT], {
    buildings: tier !== 'light',
    pixelRatio: Math.min(devicePixelRatio, tier === 'light' ? 1 : 2),
  });
  scene.add(player.root);
  applyStreetStyle(map);
  for (const id of ['buildings', 'roofs']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  map.addLayer(layer);
  // Sunset over Accra for this test: warm sky, light on the buildings from the west.
  map.setSky({
    'sky-color': '#f2b36b',
    'horizon-color': '#f7d9b0',
    'sky-horizon-blend': 0.7,
    'horizon-fog-blend': 0.6,
    'fog-color': '#f1d7b6',
    'fog-ground-blend': 0.9,
  });
  map.setLight({ anchor: 'map', color: '#ffe2bd', intensity: 0.45, position: [1.4, 265, 35] });
  // Real 3D vehicles at street level (the overview map's blocks are not used here).
  {
    // Spacing and drawing distance are set so the vehicles near you stay well under the limit:
    // nothing pops in or out close by (it only happens far away, out of sight).
    const traffic = createStreetNetwork({ light: 4.2, standard: 3, ultra: 2.3 }[tier]);
    trafficModel = traffic;
    for (const b of pendingBatches.splice(0)) traffic.addRoads(b);
    // Busy roads (raised from the first budget of 15 / 40 / 100: they are drawn in batches, so they cost little).
    const limit = { light: 100, standard: 170, ultra: 260 }[tier];
    streetTraffic = new StreetTraffic(traffic, (lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT], limit, { light: 140, standard: 180, ultra: 230 }[tier]);
    scene.add(streetTraffic.group);
    streetTraffic.deckHeight = (x, z) => flyovers.heightAt(x, z);
    streetTraffic.signals = signals;
    if (life) life.vehicleAt = vehicleAt;
    streetTraffic.onBlocked = onVehicleBlocked;
    void loadDriver();
    if (debug) Object.assign(window, { __street: { state, sky, look, life, story, thief, signals, lightFor, flyovers, pinch, bigScreen, roadSigns, getStation: () => station, places, fuelWhy, bag, driver, shove, uncle, compound, props, camera3d, adCard, frameShot, fullMap, phone, camAvoid, camAt, viewBlocked, heightAtView, solidAt, traffic: streetTraffic, toLocal: (lng: number, lat: number) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT] } });
  }

  document.getElementById('loading')!.remove();
  startedAt = performance.now();
  if (skipStory) {
    setMoney(0);
    storyStep.auntie = true;
    setTimeout(() => (help.style.opacity = '0'), 7000);
  } else {
    help.style.opacity = '0';
    void playOpening(choice);
  }
  let last = performance.now();
  const frameMs = 1000 / PRESET.fps;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    // Light phones run at a steady 30 frames a second: skip every other screen refresh.
    if (now - last < frameMs - 2) return;
    // While the big map is open, the street behind it runs slowly (8 times a second): the traffic
    // on the map still moves, and the phone does not draw two maps at full speed.
    if (fullMap.isOpen && now - last < 120) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(player, dt, now / 1000);
  };
  requestAnimationFrame(loop);

  if (autoTest) runAutoTest();
  // Busy, but never slow: every 2 seconds, if the frame rate is low, show fewer people and vehicles;
  // if there is room to spare, bring them back (master plan: draw less when a phone struggles).
  if (debug) debugLine.hidden = false;
  if (!params.has('full')) {
    let density = 1;
    const baseLimit = { light: 100, standard: 170, ultra: 260 }[tier];
    for (;;) {
      const fps = await measureFps(2);
      if (fps < 26 && density > 0.25) density *= 0.75;
      else if (fps > 48 && density < 1) density = Math.min(1, density * 1.15);
      life?.setDensity(density);
      if (streetTraffic) streetTraffic.density = density;
      void baseLimit;
      if (debug) debugLine.textContent = `${tier} (${reason}) · ${Math.round(fps)} fps · ${renderer.info.render.triangles} tris · busy ${Math.round(density * 100)}%`;
    }
  } else if (debug) {
    for (;;) {
      const fps = await measureFps(2);
      debugLine.textContent = `${tier} (${reason}) · ${Math.round(fps)} fps · ${renderer.info.render.triangles} tris`;
    }
  }

}

start();
