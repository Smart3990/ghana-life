// Street test (Ghanaverse design brief, section 22.1, prototype A).
// Can the existing map carry a close, third-person view: a 3D person you steer with a joystick,
// keyboard or controller, who can get on an okada and ride through Accra, while staying smooth
// on a cheap phone? The map, buildings and traffic are the game's own; this page adds the
// follow camera, the 3D player and okada (through a three.js layer inside the map) and the controls.
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { createMap } from '../map/createMap';
import { detectTier, measureFps } from '../map/tier';
import { startTraffic } from '../game/traffic';
import { createPerson, type Move, type Person } from '../game/person';

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
map.setMaxZoom(24);
// The camera belongs to the player, so the usual map gestures are switched off.
for (const handler of [map.dragPan, map.scrollZoom, map.boxZoom, map.dragRotate, map.keyboard, map.doubleClickZoom, map.touchZoomRotate, map.touchPitch]) {
  handler.disable();
}

// Local metres (x east, z south, y up) around START, and back to longitude and latitude.
const toLngLat = (x: number, z: number): [number, number] => [START[0] + x / M_LON, START[1] - z / M_LAT];

// ---------- The 3D scene ----------

const scene = new THREE.Scene();
// Late-afternoon Accra light: a warm low sun and a soft sky.
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b4f3a, 1.5));
const sun = new THREE.DirectionalLight(0xffcf9a, 2.4);
sun.position.set(-40, 35, 25);
scene.add(sun);

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
scene.add(okada.root);

// ---------- The player ----------

type Player = Person & { seat: THREE.Vector3; shadow: THREE.Object3D };

// Blended moves: walking and running mix by speed, riding fades in on the okada.
const BLENDED: Move[] = ['idle', 'walk', 'run', 'ride'];

async function loadPlayer(): Promise<Player> {
  const person = await createPerson();
  for (const move of BLENDED) {
    person.actions[move].play();
    person.actions[move].setEffectiveWeight(move === 'idle' ? 1 : 0);
  }
  const shadow = blobShadow(0.55, 0.55);
  person.root.add(shadow);

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
    renderer.toneMappingExposure = 1.05;
  },
  render(_gl, args) {
    const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
    camera3d.projectionMatrix = projection.multiply(placeMatrix);
    renderer.resetState();
    renderer.render(scene, camera3d);
  },
};

// ---------- Controls: joystick, keyboard and game controllers ----------

const input = { x: 0, y: 0, run: false };
const keys = new Set<string>();
let okadaPressed = false;

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyE' && !e.repeat) okadaPressed = true;
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// Touch joystick: drag the knob; its offset from the centre is the direction.
const stick = document.getElementById('stick')!;
const knob = document.getElementById('knob')!;
const touch = { x: 0, y: 0, id: -1 };
const STICK_RADIUS = 46;
const moveKnob = (e: PointerEvent) => {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > STICK_RADIUS) [dx, dy] = [(dx / d) * STICK_RADIUS, (dy / d) * STICK_RADIUS];
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touch.x = dx / STICK_RADIUS;
  touch.y = -dy / STICK_RADIUS;
};
stick.addEventListener('pointerdown', (e) => {
  touch.id = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  moveKnob(e);
});
stick.addEventListener('pointermove', (e) => e.pointerId === touch.id && moveKnob(e));
const releaseStick = (e: PointerEvent) => {
  if (e.pointerId !== touch.id) return;
  touch.id = -1;
  touch.x = touch.y = 0;
  knob.style.transform = '';
};
stick.addEventListener('pointerup', releaseStick);
stick.addEventListener('pointercancel', releaseStick);

const runButton = document.getElementById('btn-run')!;
let runHeld = false;
runButton.addEventListener('pointerdown', () => (runHeld = true));
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) runButton.addEventListener(ev, () => (runHeld = false));
const okadaButton = document.getElementById('btn-okada')!;
okadaButton.addEventListener('click', () => (okadaPressed = true));

// Controllers (Xbox, PlayStation and most pads): left stick moves, A / ✕ runs, X / □ gets on or off.
let padOkadaWasDown = false;
function readInput() {
  let x = 0;
  let y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  let run = keys.has('ShiftLeft') || keys.has('ShiftRight') || runHeld;

  if (Math.hypot(touch.x, touch.y) > Math.hypot(x, y)) [x, y] = [touch.x, touch.y];

  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue;
    const [px, py] = [pad.axes[0] ?? 0, -(pad.axes[1] ?? 0)];
    const dead = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    // Triggers accelerate and brake when they exist (standard mapping: buttons 7 and 6).
    const throttle = (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0);
    const pyAll = Math.abs(throttle) > Math.abs(py) ? throttle : py;
    if (Math.hypot(dead(px), dead(pyAll)) > Math.hypot(x, y)) [x, y] = [dead(px), dead(pyAll)];
    if (pad.buttons[0]?.pressed) run = true;
    const okadaDown = !!pad.buttons[2]?.pressed;
    if (okadaDown && !padOkadaWasDown) okadaPressed = true;
    padOkadaWasDown = okadaDown;
  }
  input.x = Math.max(-1, Math.min(1, x));
  input.y = Math.max(-1, Math.min(1, y));
  input.run = run;
}

// ---------- On-screen bits: clock, place names, help, debug ----------

const clock = document.getElementById('clock')!;
const placeLabel = document.getElementById('place')!;
const debugLine = document.getElementById('debug')!;
const help = document.getElementById('help')!;
setTimeout(() => (help.style.opacity = '0'), 7000);

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
const LEG_OUT_AXIS = new THREE.Vector3(0, 0, 1);
const RIDE_KNEES_OUT = 0.3;

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function step(player: Player, dt: number, t: number) {
  readInput();

  // Getting on or off the okada.
  if (okadaPressed) {
    okadaPressed = false;
    if (state.onOkada) {
      state.onOkada = false;
      state.speed = 0;
      // Step off to the left of the bike.
      state.x = state.okadaX - Math.cos(state.okadaHeading) * 0.9;
      state.z = state.okadaZ - Math.sin(state.okadaHeading) * 0.9;
      state.heading = state.okadaHeading;
    } else if (Math.hypot(state.x - state.okadaX, state.z - state.okadaZ) < MOUNT_DISTANCE_M) {
      state.onOkada = true;
      state.speed = 0;
      state.heading = state.okadaHeading;
    } else {
      showHint('Walk to the okada to get on');
    }
    okadaButton.classList.toggle('on', state.onOkada);
  }

  if (state.onOkada) {
    const target = input.y > 0 ? input.y * OKADA_TOP_SPEED : 0;
    const rate = input.y < 0 ? OKADA_BRAKE : state.speed < target ? OKADA_ACCEL : 2.5; // engine braking
    state.speed += Math.sign(target - state.speed) * Math.min(Math.abs(target - state.speed), rate * dt);
    const grip = Math.min(1, Math.max(0.25, state.speed / 4));
    state.heading += input.x * OKADA_TURN * grip * dt;
    state.lean += (-input.x * 0.38 * Math.min(1, state.speed / 7) - state.lean) * Math.min(1, dt * 6);
  } else {
    const top = input.run ? RUN_SPEED : WALK_SPEED;
    const target = input.y >= 0 ? Math.hypot(input.x, input.y) > 0.2 ? Math.max(input.y, Math.abs(input.x) * 0.4) * top : 0 : input.y * 1.0;
    state.speed += (target - state.speed) * Math.min(1, dt * 8);
    state.heading += input.x * WALK_TURN * dt;
    state.lean = 0;
  }

  state.x += Math.sin(state.heading) * state.speed * dt;
  state.z -= Math.cos(state.heading) * state.speed * dt;
  if (state.onOkada) [state.okadaX, state.okadaZ, state.okadaHeading] = [state.x, state.z, state.heading];

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
    player.root.position.set(state.x, 0, state.z);
    player.root.rotation.set(0, Math.PI - state.heading, 0);
    player.shadow.visible = true;
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
  player.actions.idle.setEffectiveWeight(w.idle * onFoot);
  player.actions.walk.setEffectiveWeight(w.walk * onFoot);
  player.actions.run.setEffectiveWeight(w.run * onFoot);
  player.actions.ride.setEffectiveWeight(rideBlend);
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
  const here = toLngLat(state.x, state.z);
  const height = map.getContainer().clientHeight;
  map.jumpTo({
    center: here,
    bearing: (state.camHeading * 180) / Math.PI,
    zoom: state.zoom,
    pitch: state.pitch,
    padding: { top: height * PLAYER_SCREEN_DROP, bottom: 0, left: 0, right: 0 },
  });
  checkPlace(here);
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

let hintTimer = 0;
function showHint(text: string) {
  help.textContent = text;
  help.style.opacity = '1';
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => (help.style.opacity = '0'), 2500);
}

// Automatic test (?auto): ride the okada in a long gentle curve and measure the frame rate.
async function runAutoTest() {
  okadaPressed = false;
  state.x = state.okadaX;
  state.z = state.okadaZ;
  okadaPressed = true;
  keys.add('KeyW');
  setTimeout(() => keys.add('KeyD'), 4000);
  setTimeout(() => keys.delete('KeyD'), 6000);
  await new Promise((r) => setTimeout(r, 3000));
  const riding = await measureFps(8);
  keys.clear();
  okadaPressed = true;
  await new Promise((r) => setTimeout(r, 1500));
  keys.add('KeyW');
  keys.add('ShiftLeft');
  const walking = await measureFps(5);
  keys.clear();
  const result = { tier, riding: Math.round(riding), walking: Math.round(walking), triangles: renderer.info.render.triangles };
  document.body.dataset.result = JSON.stringify(result);
  console.log('street-test result', result);
}

// The map's road widths stop growing at about zoom 18-20, so at street level the roads would
// shrink to thin lines. Keep each one growing at the same rate as the ground, up to zoom 24.
type ZoomCurve = ['interpolate', unknown, ['zoom'], ...number[]];
function widenForStreetLevel() {
  for (const l of map.getStyle().layers) {
    if (l.type !== 'line') continue;
    for (const prop of ['line-width', 'line-gap-width'] as const) {
      const value = map.getPaintProperty(l.id, prop) as ZoomCurve | undefined;
      if (!Array.isArray(value) || value[0] !== 'interpolate' || (value[2] as unknown[])?.[0] !== 'zoom') continue;
      const stops = value.slice(3) as number[];
      if (stops.some((s) => typeof s !== 'number')) continue;
      const [lastZoom, lastWidth] = stops.slice(-2);
      if (lastZoom < 15 || lastZoom >= 24 || lastWidth <= 1) continue; // fixed hairlines stay thin
      map.setPaintProperty(l.id, prop, [...value, 24, lastWidth * 2 ** (24 - lastZoom)] as unknown as number);
    }
  }
  // Up close, the overview map's bright road colours look like highlighter pen.
  // Street level gets tarmac, kerbs and dusty ground instead.
  for (const l of map.getStyle().layers) {
    const id = l.id;
    if (l.type === 'line' && id.startsWith('roads_') && !/rail|runway|taxiway|pier/.test(id)) {
      const tarmac = /casing/.test(id) ? '#b9b09d' : /highway|major/.test(id) ? '#55534f' : /minor_service|other/.test(id) ? '#8b8477' : '#64625d';
      map.setPaintProperty(id, 'line-color', tarmac);
    }
  }
  const paint = (id: string, prop: 'background-color' | 'fill-color', value: string) => map.getLayer(id) && map.setPaintProperty(id, prop, value);
  paint('background', 'background-color', '#d6cab0');
  paint('earth', 'fill-color', '#d6cab0');
  paint('landuse_pedestrian', 'fill-color', '#cbc2b0');
  paint('landuse_urban_green', 'fill-color', '#9fae77');
  paint('landuse_park', 'fill-color', '#93a86c');
}

async function start() {
  const [player] = await Promise.all([loadPlayer(), new Promise<void>((r) => map.once('load', () => r()))]);
  scene.add(player.root);
  widenForStreetLevel();
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
  startTraffic(map, () => tier, () => Date.now(), 1); // real-size vehicles at street level

  document.getElementById('loading')!.remove();
  let last = performance.now();
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(player, dt, now / 1000);
  };
  requestAnimationFrame(loop);

  if (debug) {
    debugLine.hidden = false;
    for (;;) {
      const fps = await measureFps(2);
      debugLine.textContent = `${tier} (${reason}) · ${Math.round(fps)} fps · ${renderer.info.render.triangles} tris`;
    }
  }
  if (autoTest) runAutoTest();
}

start();
