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
import { box, merge, paint } from '../game/vehicles3d';
import { SkyTraffic } from '../game/sky3d';
import { StreetSound } from '../game/streetSound';
import { createPerson, type Move, type Person } from '../game/person';
import { Minimap } from '../hud/minimap';
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
const BLENDED: Move[] = ['idle', 'walk', 'run', 'ride', 'sit', 'talk', 'dance'];

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
    renderer.resetState();
    renderer.render(scene, camera3d);
  },
};

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
btn('btn-phone').addEventListener('click', () => toast('Your phone is coming soon', 'Missions, map, friends and the ride app'));
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
let poseMove: 'sit' | 'talk' | 'dance' = 'talk';
let airBlend = 0;
let landing = 0; // fades from 1 to 0 after touching down
const JUMP_SPEED = 3.4; // about half a metre high
const GRAVITY = 11;
const LEG_OUT_AXIS = new THREE.Vector3(0, 0, 1);
const RIDE_KNEES_OUT = 0.3;

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function step(player: Player, dt: number, t: number) {
  readInput();
  if (story.frozen) {
    // During a film scene the player does not move.
    input.x = input.y = 0;
    input.sprint = input.brake = false;
    tapped.clear();
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
  if (me.doing === 'greet' && t > me.until) me.doing = 'none';
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
  poseBlend += ((me.doing !== 'none' ? 1 : 0) - poseBlend) * Math.min(1, dt * 7);
  for (const m of ['sit', 'talk', 'dance'] as const) player.actions[m].setEffectiveWeight(m === poseMove ? poseBlend * onFoot : 0);
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
  const cam = {
    center: here,
    bearing: ((state.camHeading + look.yaw) * 180) / Math.PI,
    zoom: state.zoom + fit + pinch.zoom,
    pitch: Math.min(85, state.pitch + look.pitch),
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
    life.scenes.onSpeak = (x, z, height, text) => {
      const el = document.createElement('div');
      el.className = 'bubble';
      el.textContent = text;
      document.body.appendChild(el);
      bubbles.push({ el, at: new THREE.Vector3(x, height + 0.25, z), until: performance.now() / 1000 + 2.6 });
    };
  }
  if (life) signals.junctions = life.junctions;
  signals.update(state.x, state.z, Date.now() / 1000);
  flyovers.update();
  streetTraffic?.update(here[0], here[1], Date.now() / 1000, TRAFFIC_LANE_M, state);
  updateStats(dt);
  updateButtons();
  updateThief(dt);
  story.onFrame?.();
  if (auntie.group.visible) auntie.person?.mixer.update(dt);
  updateMarker(t);
  const blips = state.onOkada || !hasOkada ? [] : [{ x: state.okadaX, z: state.okadaZ, color: '#c8442e', size: 5 }];
  if (story.auntie) blips.push({ x: story.auntie.x, z: story.auntie.z, color: '#e3a92b', size: 7 });
  if (thief.on) blips.push({ x: thief.x, z: thief.z, color: '#f2efe6', size: 4 });
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
  return buildings.blocked(x, z, room) || !!life?.solid(x, z, room) || !!vehicleAt(x, z, room);
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


// ---------- Talking with people ----------
// Anyone you meet can talk with you: tap GREET (or CHAT with a seller) and you have a short
// conversation, in bubbles over your heads. What they say depends on who they are. Moving the
// stick walks away and ends it.
type Line = [who: 'me' | 'them', text: string];
const TALKS: Record<string, Line[][]> = {
  any: [
    [['me', 'Good afternoon!'], ['them', 'Afternoon oo! You are new here?'], ['me', 'Yes, I just came to Accra.'], ['them', 'Akwaaba! Accra is sweet, but hold your pocket well.']],
    [['me', 'Hello, how are you?'], ['them', 'I dey, by His grace. And you?'], ['me', 'I’m fine. Is Circle always this busy?'], ['them', 'Ha! This one is small. Come back at closing time.']],
    [['me', 'Chale, how far?'], ['them', 'Charley, I dey kraa! You?'], ['me', 'I’m trying to find my way.'], ['them', 'Ask anybody. Accra people go help you.']],
    [['me', 'Please, is this the way to the station?'], ['them', 'Yes, go straight, then cross at the zebra.'], ['me', 'Thank you!'], ['them', 'You’re welcome. Safe journey!']],
  ],
  muslimMan: [[['me', 'Salaam alaikum.'], ['them', 'Alaikum salaam, my brother. Welcome.'], ['me', 'Thank you. Accra is very big.'], ['them', 'Take your time. You will know it small small.']]],
  muslimWoman: [[['me', 'Salaam alaikum.'], ['them', 'Alaikum salaam. How is your day?'], ['me', 'Long! I just arrived.'], ['them', 'Ah, welcome. Rest a little, eh.']]],
  church: [[['me', 'Good afternoon.'], ['them', 'God bless you, my dear!'], ['me', 'Amen. Are you going to church?'], ['them', 'Yes, choir practice. Come and visit on Sunday!']]],
  child: [[['me', 'Hello!'], ['them', 'Good afternoon, please!'], ['me', 'What is your name?'], ['them', 'Kofi! I’m going home to eat.']]],
  pupil: [
    [['me', 'Hello! School is over?'], ['them', 'Yes, please! We are going home.'], ['me', 'Did you learn well?'], ['them', 'We did maths. It was hard!']],
    [['me', 'Good afternoon.'], ['them', 'Good afternoon, please!'], ['me', 'Which school?'], ['them', 'The one behind the market!']],
  ],
  kayayo: [[['me', 'Hello, auntie.'], ['them', 'You want somebody to carry your load?'], ['me', 'No load today. They took my bag.'], ['them', 'Ei, sorry! Be careful at the station.']]],
  hawker: [[['me', 'What are you selling?'], ['them', 'Pure water, ice cold! Gari biscuit too!'], ['me', 'Not today, thank you.'], ['them', 'No problem. Next time, my customer!']]],
  seller: [
    [['me', 'Good afternoon, auntie.'], ['them', 'My customer! What do you want?'], ['me', 'Just looking for now.'], ['them', 'Look well. Everything is fresh!']],
    [['me', 'How much for this?'], ['them', 'For you, special price!'], ['me', 'I have no money now.'], ['them', 'Ah. Come back when you have, eh.']],
  ],
};
let chatting = false;
async function chat(who: { x: number; z: number; height: number; kind: string; seller: boolean }, t: number) {
  const sets = TALKS[who.seller ? 'seller' : who.kind] ?? TALKS.any;
  const pick = Math.random() < 0.35 && TALKS[who.kind] && !who.seller ? TALKS.any : sets;
  const lines = pick[Math.floor(Math.random() * pick.length)];
  chatting = true;
  me.doing = 'greet';
  me.until = t + 30;
  const start = { x: state.x, z: state.z };
  for (const [speaker, text] of lines) {
    // Walking away ends the conversation.
    if (Math.hypot(state.x - start.x, state.z - start.z) > 1.2 || me.doing !== 'greet') break;
    if (speaker === 'me') life?.scenes?.onSpeak?.(state.x, state.z, 1.95, text);
    else life?.scenes?.onSpeak?.(who.x, who.z, who.height, text);
    await new Promise((r) => setTimeout(r, Math.max(1700, 900 + text.length * 45)));
  }
  if (me.doing === 'greet') me.doing = 'none';
  chatting = false;
}
// ---------- The action button, energy, vibe and the first goals ----------
// One gold button does the thing that makes sense where you stand, like a person would: get on the
// okada, get off, greet someone, chat to a seller, sit on a chop bar chair to rest, dance where music
// plays. It only shows when there is something to do, so the screen stays clean.

const me = { energy: 100, vibe: 0, doing: 'none' as 'none' | 'sit' | 'dance' | 'greet', until: 0, seat: null as { x: number; z: number; face: number } | null, tiredSaid: false };
type ActionId = 'ride' | 'off' | 'sit' | 'stand' | 'dance' | 'stop' | 'greet' | 'chat' | 'talk';
type Action = { id: ActionId; target?: Nearby; walker?: { i: number; x: number; z: number; kind: string; height: number } };
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
      let who: { x: number; z: number; height: number; kind: string; seller: boolean } | null = null;
      if (a.walker) {
        life?.holdWalker(a.walker.i, 11, state.x, state.z);
        who = { x: a.walker.x, z: a.walker.z, height: a.walker.height, kind: a.walker.kind, seller: a.walker.kind === 'hawker' };
      } else {
        const c = life?.scenes?.converse(target.who, performance.now() / 1000, 11);
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
};

// The story's kelewele auntie (Auntie Akos): her own stall across the road from the nearest zebra.
const auntie = {
  group: new THREE.Group(),
  person: null as Person | null,
  x: 0,
  z: 0,
  async load() {
    // A woman in an orange top and a green wrap skirt with a matching head wrap colour.
    const p = await createPerson({ shirt: '#e2731f', trousers: '#2f8f57', shoes: '#3a2a20', hair: '#141110', skin: '#6e625b' }, 'female', tier === 'light' ? 'lite' : 'full');
    p.actions.idle.play();
    p.actions.talk.play();
    p.actions.talk.setEffectiveWeight(0);
    p.model.traverse((o) => (o.castShadow = PRESET.shadows));
    this.person = p;
    this.group.add(p.root);
    this.group.add(stallModel());
    this.group.visible = false;
    scene.add(this.group);
  },
  talk(on: boolean) {
    if (!this.person) return;
    this.person.actions.talk.setEffectiveWeight(on ? 1 : 0);
    this.person.actions.idle.setEffectiveWeight(on ? 0 : 1);
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
function setMoney(cedis: number) {
  // What the story says you have. Real money will always come from the server.
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
const thief = { on: false, person: null as Person | null, x: 0, z: 0, heading: 0, speed: 0, time: 0, phase: 'pass' as 'pass' | 'run', done: null as (() => void) | null };
async function loadThief() {
  const boy = await createPerson({ shirt: '#c8442e', trousers: '#1b1b1d', shoes: '#2b2b2e', hair: '#141110', skin: '#665d58' }, 'male', 'lite');
  boy.root.scale.setScalar(0.86);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.14), new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 }));
  bag.position.set(0.28, 0.95, 0.05);
  boy.root.add(bag);
  boy.actions.run.play();
  boy.model.traverse((o) => (o.castShadow = PRESET.shadows));
  thief.person = boy;
}
function runThief(): Promise<void> {
  const boy = thief.person;
  if (!boy) return Promise.resolve();
  // He comes from behind, brushes past you and runs on ahead.
  thief.on = true;
  thief.phase = 'pass';
  thief.time = performance.now() / 1000; // when the chase began (clock time)
  thief.heading = state.heading;
  thief.x = state.x - Math.sin(state.heading) * 5 + Math.cos(state.heading) * 0.7;
  thief.z = state.z + Math.cos(state.heading) * 5 + Math.sin(state.heading) * 0.7;
  scene.add(boy.root);
  return new Promise((resolve) => (thief.done = resolve));
}
function updateThief(dt: number) {
  const boy = thief.person;
  if (!thief.on || !boy) return;
  const d = Math.hypot(thief.x - state.x, thief.z - state.z);
  let want = thief.heading;
  if (thief.phase === 'pass') {
    thief.speed = 5.2;
    const ahead = (thief.x - state.x) * Math.sin(state.heading) - (thief.z - state.z) * Math.cos(state.heading);
    if (ahead > 4) thief.phase = 'run';
  } else {
    // Away from you, faster when you get close; he always just gets away.
    want = Math.atan2(thief.x - state.x, -(thief.z - state.z));
    thief.speed = d < 4 ? 6.4 : d < 9 ? 5.3 : 4.4;
  }
  // Steer round walls, kiosks and vehicles: try straight on first, then a little to each side.
  let turn = angleDiff(want, thief.heading);
  turn = Math.max(-2.5 * dt, Math.min(2.5 * dt, turn));
  let heading = thief.heading + turn;
  for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.2, -2.2, Math.PI]) {
    const h = heading + off;
    if (!solidAt(thief.x + Math.sin(h) * 1.4, thief.z - Math.cos(h) * 1.4, 0.3)) {
      heading = h;
      break;
    }
  }
  thief.heading = heading;
  const nx = thief.x + Math.sin(heading) * thief.speed * dt;
  const nz = thief.z - Math.cos(heading) * thief.speed * dt;
  if (!solidAt(nx, nz, 0.25)) [thief.x, thief.z] = [nx, nz];
  boy.root.position.set(thief.x, 0, thief.z);
  boy.root.rotation.set(0, Math.PI - heading, 0);
  boy.actions.run.setEffectiveTimeScale(thief.speed / 3.8);
  boy.mixer.update(dt);
  // Gone: lost in the crowd.
  if (thief.phase === 'run' && (performance.now() / 1000 - thief.time > 24 || d > 28)) {
    thief.on = false;
    scene.remove(boy.root);
    thief.done?.();
  }
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

async function playOpening(start: StartChoice) {
  const home = start.hometown;
  cine.preload(useFilmClip ? ['/film/circle.webp'] : ['/film/village.webp', '/film/hands.webp', '/film/bus.webp', '/film/circle.webp']);
  story.busy = story.frozen = true;
  goalChip.classList.add('hidden');
  setMoney(50);
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
  // 3. The bag.
  const chase = runThief();
  await cine.wait(1.3);
  life?.scenes?.onSpeak?.(state.x, state.z, 1.9, 'Hey! My bag!');
  setMoney(0);
  await cine.say('', 'A boy grabs your bag: your money, your phone and Grandma’s letter!', 3);
  cine.end();
  story.frozen = false;
  storyGoal('Catch the thief!');
  toast('Catch the thief!', 'Hold RUN to sprint');
  await chase;
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
    await new Promise<void>((reached) => (story.auntie = { x: stall.x, z: stall.z, reached }));
    story.auntie = null;
    story.onFrame = null;
    // 5. The talk: she sits you down, feeds you and calls your uncle.
    story.frozen = true;
    state.speed = 0;
    me.doing = 'sit';
    me.seat = { x: stall.chair.x, z: stall.chair.z, face: stall.chair.face };
    [state.x, state.z, state.heading] = [stall.chair.x, stall.chair.z, stall.chair.face];
    storyGoal('');
    // Side-on shot of you and the auntie (on whichever side has no wall in the way).
    const across = stall.chair.face + Math.PI / 2;
    const mid = { x: (stall.chair.x + stall.x) / 2, z: (stall.chair.z + stall.z) / 2 };
    const clear = (side: number) => !solidAt(mid.x + Math.sin(across) * 4 * side, mid.z - Math.cos(across) * 4 * side, 0.5);
    const side = clear(1) ? 1 : -1;
    story.shot = { ...mid, bearing: ((across + (side > 0 ? Math.PI : 0)) * 180) / Math.PI, zoom: 23.7, pitch: 72 };
    auntie.talk(true);
    cine.begin();
    await cine.say('AUNTIE AKOS', 'Ei! Sit down, my child. What happened?');
    await cine.say('YOU', 'A boy took my bag. My money, my phone… everything.');
    await cine.say('AUNTIE AKOS', 'Sorry, ooo. Eat small. Who do you know in Accra?');
    await cine.say('YOU', 'My uncle. Uncle Kwame.');
    await cine.say('AUNTIE AKOS', 'Give me his number. I will call him on my phone.');
    cine.call('Uncle Kwame');
    await cine.wait(1.4);
    await cine.say('UNCLE KWAME', 'Stay there. I’m coming.');
    cine.call(null);
    await cine.say('AUNTIE AKOS', 'Don’t worry. Accra will not swallow you. Eat!');
    auntie.talk(false);
    story.shot = null;
    cine.end();
    ayekoo('Mission 1 complete', 'You found Auntie Akos. Uncle Kwame is on his way.');
    me.vibe += 5;
    await new Promise((r) => setTimeout(r, 3500));
    cine.begin();
    await cine.title(`Chapter 1 · From ${home} to Accra`, 'Coming soon: Uncle Kwame, the compound and your first hustle.', 3.5);
    await cine.black(false, 0.8);
    cine.end();
    stopDoing();
  }
  story.frozen = false;
  story.busy = false;
  storyGoal('');
  toast('Explore Circle while you wait', 'Your first goals are top left');
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
// Real 3D buildings near the player (the map's own blocks are switched off at street level).
// Trees, lights, kiosks, umbrellas, polytanks and people, placed along the same streets.
let life: StreetLife | null = null;
let trafficModel: Traffic | null = null;
const pendingBatches: { pts: [number, number][]; lanes: 1 | 2; half: number; bridge: boolean }[][] = [];
const buildings = new StreetBuildings(
  (lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT],
  { light: 220, standard: 320, ultra: 450 }[tier],
  (roads, roofs) => {
    life?.add(roads, roofs);
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
  light: { radiusM: 140, people: 60, props: 250, scenes: 20 },
  standard: { radiusM: 200, people: 170, props: 600, scenes: 44 },
  ultra: { radiusM: 280, people: 300, props: 1200, scenes: 70 },
}[tier], smoothCrowd: PRESET.smoothCrowd });
scene.add(life.group);
// The sound of Accra (starts on the first tap), with a button to switch it off.
const streetSound = new StreetSound();
const soundButton = document.getElementById('btn-sound')!;
soundButton.addEventListener('click', () => {
  streetSound.setMuted(!streetSound.muted);
  soundButton.classList.toggle('off', streetSound.muted);
});

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
  const [player] = await Promise.all([loadPlayer(choice.body), skipStory ? null : loadThief(), skipStory ? null : auntie.load()]);
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
    const traffic = createStreetNetwork({ light: 6, standard: 4, ultra: 3 }[tier]);
    trafficModel = traffic;
    for (const b of pendingBatches.splice(0)) traffic.addRoads(b);
    // Busy roads (raised from the first budget of 15 / 40 / 100: they are drawn in batches, so they cost little).
    const limit = { light: 60, standard: 110, ultra: 180 }[tier];
    streetTraffic = new StreetTraffic(traffic, (lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT], limit, { light: 90, standard: 130, ultra: 170 }[tier]);
    scene.add(streetTraffic.group);
    streetTraffic.deckHeight = (x, z) => flyovers.heightAt(x, z);
    streetTraffic.signals = signals;
    if (life) life.vehicleAt = vehicleAt;
    streetTraffic.onHoot = (x, z) => honk(Math.hypot(x - state.x, z - state.z), true);
    if (debug) Object.assign(window, { __street: { state, sky, look, life, story, thief, signals, lightFor, flyovers, pinch, traffic: streetTraffic, toLocal: (lng: number, lat: number) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT] } });
  }

  document.getElementById('loading')!.remove();
  startedAt = performance.now();
  if (skipStory) {
    setMoney(0);
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
    const baseLimit = { light: 60, standard: 110, ultra: 180 }[tier];
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
