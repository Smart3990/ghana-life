// Street test (Ghanaverse design brief, section 22.1, prototype A).
// Can the existing map carry a close, third-person view: a 3D person you steer with a joystick,
// keyboard or controller, who can get on an okada and ride through Accra, while staying smooth
// on a cheap phone? The map, buildings and traffic are the game's own; this page adds the
// follow camera, the 3D player and okada (through a three.js layer inside the map) and the controls.
import { Railway } from '../game/railway';
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createMap } from '../map/createMap';
import { detectTier, measureFps } from '../map/tier';
import type { Traffic } from '../game/traffic';
import { createStreetNetwork } from '../game/streetNetwork';
import { AD_ASPECT, AD_ROWS, StreetTraffic } from '../game/vehicles3d';
import { StreetBuildings } from '../game/streetBuildings';
import { foodGeometry, foodMaterial } from '../game/foodKit';
import { applyStreetStyle } from '../map/streetStyle';
import { StreetLife } from '../game/streetLife';
import type { Nearby } from '../game/streetScenes';
import { Signals, lightFor, stopLineAt } from '../game/signals';
import { Flyovers } from '../game/flyovers';
import { EpicRoads } from '../game/epicRoads';
import { TrafficSim } from '../game/trafficSim';
import { GameTime, dayLook, forTheHour, roadFill, type DayLook } from '../game/dayNight';
import { epicGeometry, epicMaterial, setEpicNight } from '../game/epicKit';
import { BigScreen } from '../game/bigScreen';
import { RoadSigns } from '../game/roadSigns';
import { planStation } from '../game/trotroStation';
import { Places } from '../game/places';
import { AD_CLOCK } from '../game/adScreens';
import { mateCall } from '../game/streetCalls';
import { TALKS, asNode, type TalkNode } from '../game/talks';
import { box, merge, paint } from '../game/vehicles3d';
import { SkyTraffic } from '../game/sky3d';
import { StreetSound } from '../game/streetSound';
import { createPerson, type Move, type Person } from '../game/person';
import { Minimap } from '../hud/minimap';
import { FullMap } from '../hud/fullMap';
import { AdCard, type AdContact } from '../hud/adCard';
import { forPlayer } from '../game/address';
import { COMPOUND, compoundHouse, compoundSolid, inYourRoom, PARKING, VILLA } from '../game/compound';
import { housePick, modelSize, STREET_HOUSES, villaMesh } from '../game/packBuildings';
import { AD_COUNT, adThumb } from '../game/adPosters';
import type { PlaceAt } from '../game/places';
import { Phone, type MissionRow, type Destination } from '../hud/phone';
import { TouchControls } from '../hud/touchControls';
import { landscapeGate } from '../hud/landscape';
import { Cinema, startScreen, type StartChoice } from '../hud/cinema';
import { FilmMusic } from '../game/music';
import { billboardPlace, vehiclePlace } from '../game/adPrices';

// ---------- Where and how big ----------

const START: [number, number] = [-0.2166, 5.5694]; // Kwame Nkrumah Circle
// The 3D world is drawn on the map's own grid (Mercator, on MapLibre's round earth of radius
// 6,371,008.8 m), so metres here must be the map's metres, the same both ways. (The usual 110,574 m
// per degree north and 111,320 m east put our 3D streets about 8 m off the map at Nima.)
const MAP_M_PER_DEG = (2 * Math.PI * 6371008.8) / 360;
const M_LAT = MAP_M_PER_DEG;
const M_LON = MAP_M_PER_DEG * Math.cos((START[1] * Math.PI) / 180);
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
const WALK_TURN_RATE = 9; // how fast you turn to face the way you push (radians per second)
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
  { name: 'Nima', at: [-0.1982, 5.5813] },
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
// Light phones colour fewer pixels (1.25 for each screen pixel, not 1.5): on a cheap graphics chip
// that is most of the work of a frame, and the street still looks sharp.
if (tier === 'light') map.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
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
// Accra's light at the real time of day (dayNight.ts): the sun moves across the sky, and after
// sunset a dim moon. The sky itself lights everything (image-based light, made in code from a sky
// model, remade as the sun moves), plus the sun that casts shadows.
const gameTime = new GameTime(Number(params.get('timescale')) || 1, params.has('hour') ? Number(params.get('hour')) : undefined);
let day: DayLook = dayLook(gameTime.now());
const SUN_DIR = day.dir.clone();
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
    refreshSkyLight();
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

// The sky light, made again when the sun has moved a few degrees (only on phones that use it).
let skyLightFor = -999;
function refreshSkyLight() {
  if (!renderer || !PRESET.skyLight) return;
  skyLightFor = day.elevation;
  const skyScene = new THREE.Scene();
  const skyDome = new Sky();
  skyDome.scale.setScalar(1000);
  const u = skyDome.material.uniforms;
  u.turbidity.value = 7;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.006;
  u.mieDirectionalG.value = 0.82;
  // At night the sky model is lit by a sun just under the horizon: a deep blue glow.
  u.sunPosition.value.set(day.dir.x, day.elevation > -1 ? Math.max(0.05, day.dir.y) : -0.08, day.dir.z);
  skyScene.add(skyDome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const old = scene.environment;
  scene.environment = pmrem.fromScene(skyScene, 0.02).texture;
  old?.dispose();
  pmrem.dispose();
  skyDome.geometry.dispose();
  skyDome.material.dispose();
  renderer.resetState();
}

// ---------- Day and night ----------
// At night, a soft warm light around the player (as from the shops and lamps all round), so the
// people near you can still be seen. Always there (dark by day), so switching costs nothing.
const nightFill = new THREE.PointLight(0xffe2c0, 0, 18, 1.2);
scene.add(nightFill);
const HEMI_BASE = PRESET.skyLight ? 0.9 : 1.4;
let lookAt = -1;
let mapLookAt = -1;
let nightShown = -1;
/** Light, sky and night lights for the time now (worked out once a second; cheap). */
function applyDayLook(force = false) {
  const now = performance.now();
  if (!force && now - lookAt < 1000) return;
  lookAt = now;
  day = dayLook(gameTime.now());
  SUN_DIR.copy(day.dir);
  sun.color.copy(day.sun);
  sun.intensity = day.sunI;
  hemi.color.copy(day.sky);
  hemi.groundColor.copy(day.ground);
  hemi.intensity = HEMI_BASE * day.skyI;
  scene.environmentIntensity = 0.16 * day.env; // the sky model is very bright: a little goes a long way
  (shadowCatcher.material as THREE.ShadowMaterial).opacity = day.shade;
  if (PRESET.skyLight && Math.abs(day.elevation - skyLightFor) > 4) refreshSkyLight();
  // Night lights: the pack's night glow, lit windows, street lights, headlights, lit billboards.
  const n = Math.round(day.night * 20) / 20;
  if ((n > 0.5) !== nightShown > 0.5 || nightShown < 0) setEpicNight(n > 0.5); // (changes the pack's shader: only when it flips)
  nightShown = n;
  setNightLights(n); // every second: cheap, and it reaches things that appeared since
  nightFill.intensity = 38 * n;

  // The map's sky and its flat ground, every few seconds (changing the map's style costs a little).
  if (force || now - mapLookAt > 4000) {
    mapLookAt = now;
    if (map.isStyleLoaded()) {
      map.setSky({ 'sky-color': day.mapSky, 'horizon-color': day.horizon, 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6, 'fog-color': day.fog, 'fog-ground-blend': 0.9 });
      if (map.getLayer('night-dim')) map.setPaintProperty('night-dim', 'fill-opacity', day.dim);
      if (map.getLayer('night-roads')) map.setPaintProperty('night-roads', 'line-opacity', 0.55 * day.night);
      if (map.getLayer('night-lamps')) map.setPaintProperty('night-lamps', 'line-opacity', 0.9 * day.night);
      // The map's blocks (seen from the sky): lit up in every colour at night, painted walls by day.
      const lit = day.night > 0.5;
      if (lit !== mapBlocksLit) {
        mapBlocksLit = lit;
        for (const id of ['buildings', 'ride-buildings']) {
          if (!map.getLayer(id)) continue;
          if (!dayBlockColour.has(id)) dayBlockColour.set(id, map.getPaintProperty(id, 'fill-extrusion-color') as maplibregl.DataDrivenPropertyValueSpecification<string>);
          map.setPaintProperty(id, 'fill-extrusion-color', lit ? NIGHT_BLOCKS : dayBlockColour.get(id));
        }
        for (const id of ['roofs', 'ride-roofs']) {
          if (!map.getLayer(id)) continue;
          if (!dayBlockColour.has(id)) dayBlockColour.set(id, map.getPaintProperty(id, 'fill-extrusion-color') as maplibregl.DataDrivenPropertyValueSpecification<string>);
          map.setPaintProperty(id, 'fill-extrusion-color', lit ? NIGHT_BLOCKS : dayBlockColour.get(id)); // (from the sky you see the roofs)
        }
      }
    }
  }
}
// The map's blocks at night: Circle's own look, dark walls with a few lit (owner, 29 Oct 2026: "too
// colourful… very slightly" neon): most dark, some with warm lit windows, a few softly pink, violet or
// teal. Picked from each building's number so they never change.
const NIGHT_BLOCKS: maplibregl.ExpressionSpecification = [
  'match', ['%', ['to-number', ['id'], 0], 20],
  0, '#5c3a2c', 1, '#56402e', 2, '#4e3a2c', 3, '#5a2f4c', 4, '#3c3058', 5, '#2b4652',
  '#1e1c2b',
];
let mapBlocksLit = false;
const dayBlockColour = new Map<string, maplibregl.DataDrivenPropertyValueSpecification<string>>();
/** Switch the night lights of everything in the street (0 = day, 1 = full night). */
function setNightLights(n: number) {
  buildings.setNight(n);
  life?.setNight(n);
  streetTraffic?.setNight(n);
  flyovers.setNight(n);
}

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
  if (compoundAt(x, z, 0.05)) return 3; // the compound's walls and rooms
  if (underCarport(x, z)) return 2.6;
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
const BOXED: [number, number, number] = [0, 36, 0.42];
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
let flyoverVersion = 0;
let deckNear = false; // is a flyover close (only then are decks checked: it saves work)
function keepPlayerInView(dt: number, baseBearing: number, basePitch: number) {
  camAvoid.check -= dt;
  if (camAt.y > 0 && camAvoid.check <= 0) {
    camAvoid.check = 0.12;
    deckNear = flyovers.heightAt(state.x, state.z) > 0 || flyovers.heightAt(camAt.x, camAt.z) > 0;
    // How far the camera is with no swing, from where it is now.
    const reach = 10.7 * 2 ** (23.1 - state.zoom - pinch.zoom); // the camera distance with no zoom-in (as frameShot)
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
      // The best clear view (the list is best first). Keep the current one while it is clear and no
      // worse, so the camera does not flick between two.
      const bestAt = VIEW_TRIES.findIndex((t) => clear(t[0], t[1], t[2]));
      const w = camAvoid.want;
      const curAt = w ? VIEW_TRIES.indexOf(w) : -1;
      const curOk = !!w && clear(w[0], w[1], w[2]) && curAt >= 0 && (bestAt < 0 || curAt <= bestAt);
      if (!curOk) camAvoid.want = bestAt >= 0 ? VIEW_TRIES[bestAt] : BOXED; // boxed in: high and close
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
// (On either half of a phone screen: the left half is also the walking stick's.)
const tapStarts = new Map<number, { x: number; y: number; t: number }>();
for (const zone of [lookZone, document.getElementById('stick-zone')!]) {
  zone.addEventListener('pointerdown', (e) => tapStarts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }));
  zone.addEventListener('pointerup', (e) => {
    const t = tapStarts.get(e.pointerId);
    tapStarts.delete(e.pointerId);
    if (t && performance.now() - t.t < 350 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 14) tapVehicle(e.clientX, e.clientY);
  });
}
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
/** One vehicle's horn in a jam: its own pitch, short or long (several sound together, like Accra). */
let hornsPlayed = 0; // (for tests)
function hornOf(distance: number, pitch: number, long: boolean) {
  hornsPlayed++;
  try {
    const audio = streetSound.context;
    const out = streetSound.output;
    if (!audio || !out) return;
    const t = audio.currentTime;
    const loud = 0.1 / (1 + distance / 10);
    for (const [start, len] of long ? [[0, 0.7]] : [[0, 0.2], [0.28, 0.2]]) {
      const osc = audio.createOscillator();
      const osc2 = audio.createOscillator(); // a second note: real horns are two tones
      const gain = audio.createGain();
      osc.type = osc2.type = 'square';
      osc.frequency.setValueAtTime(pitch, t + start);
      osc2.frequency.setValueAtTime(pitch * 1.26, t + start);
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(loud, t + start + 0.015);
      gain.gain.setValueAtTime(loud, t + start + len - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + len);
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(out);
      for (const o of [osc, osc2]) {
        o.start(t + start);
        o.stop(t + start + len + 0.02);
      }
    }
  } catch {
    // (no sound here)
  }
}
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
  const now = new Date(gameTime.now()); // Ghana time is UTC
  clock.textContent = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
};
updateClock();
setInterval(updateClock, 2_000);

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
    const push = Math.min(1, Math.hypot(input.x, input.y));
    let target = 0;
    if (story.autoRun) target = input.y * top; // (the story steers)
    else if (push > 0.2) {
      // Walking (owner, 28 Oct 2026: "the walking has to really improve"): push the stick the way you
      // want to go, as seen on the screen; you turn smoothly to face it and walk that way, slowing for
      // a sharp turn the way a person steps round, then on at full pace.
      const want = state.camHeading + look.yaw + Math.atan2(input.x, input.y);
      const diff = angleDiff(want, state.heading);
      state.heading += Math.max(-WALK_TURN_RATE * dt, Math.min(WALK_TURN_RATE * dt, diff));
      const facing = Math.abs(diff);
      target = push * top * (facing > 1.7 ? 0.25 : facing > 0.9 ? 0.65 : 1);
    }
    // Gently up to speed, a little quicker to slow down.
    state.speed += (target - state.speed) * Math.min(1, dt * (target > state.speed ? 5 : 8));
    state.lean = 0;
    if (me.doing === 'sit' || me.doing === 'dance') state.speed = 0;
    if (me.doing === 'sit' && me.seat) [state.x, state.z, state.heading] = [me.seat.x, me.seat.z, me.seat.face];
  }

  // Move, but not into buildings: slide along the wall when walking into one at an angle.
  const stepX = Math.sin(state.heading) * state.speed * dt;
  const stepZ = -Math.cos(state.heading) * state.speed * dt;
  const room = state.onOkada ? 0.7 : 0.3;
  // Already inside something (a kiosk put down where you stand): you can always walk out.
  const stuck = solidAt(state.x, state.z, room);
  // On foot, never stopped dead by a car, a kiosk or a wall: you step round it (the nearest way
  // past, a little to one side and then the other).
  const round = !state.onOkada && !stuck && solidAt(state.x + stepX, state.z + stepZ, room)
    ? [0.45, -0.45, 0.9, -0.9, 1.3, -1.3].find((off) => !solidAt(state.x + Math.sin(state.heading + off) * state.speed * dt, state.z - Math.cos(state.heading + off) * state.speed * dt, room))
    : undefined;
  if (stuck || !solidAt(state.x + stepX, state.z + stepZ, room)) {
    state.x += stepX;
    state.z += stepZ;
  } else if (round !== undefined) {
    state.x += Math.sin(state.heading + round) * state.speed * dt * Math.cos(round);
    state.z -= Math.cos(state.heading + round) * state.speed * dt * Math.cos(round);
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
    player.root.position.set(state.x, state.y - (state.y > 0.2 ? 0 : groundDip(state.x, state.z)), state.z);
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
  handsOnHead.w += ((story.handsOnHead ? 1 : 0) - handsOnHead.w) * Math.min(1, dt * 6);
  if (handsOnHead.w > 0.01) poseHandsOnHead(player, handsOnHead.w);
  // Eating: a bite every couple of seconds (up, a moment at the mouth, down).
  const bite = story.eating ? (performance.now() / 1000) % 2.4 : 99;
  const biteW = bite < 0.6 ? bite / 0.6 : bite < 1.1 ? 1 : bite < 1.7 ? 1 - (bite - 1.1) / 0.6 : 0;
  if (biteW > 0.01) poseHandToMouth(player, biteW * 0.95);
  placeBag(player);

  // Camera: follows behind the player, turning a little after them, closer on foot.
  // The camera: behind the okada as you ride; on foot it eases round behind you as you walk (and stays
  // where it is while you stand, so the stick's directions stay put).
  const camRate = state.onOkada ? 2.6 : story.autoRun || story.frozen ? 3.2 : Math.abs(state.speed) > 0.4 ? 1.1 : 0;
  state.camHeading += angleDiff(state.heading, state.camHeading) * Math.min(1, dt * camRate);
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
  // In your room at the compound, the walls would fill the picture: the camera looks down into the
  // room instead (its roof lifted away), blending over smoothly as you go in and out.
  const roomShot = compoundRoomShot();
  roomCam.w += ((roomShot && !story.shot && !story.fly ? 1 : 0) - roomCam.w) * Math.min(1, dt * 3);
  if (roomShot) roomCam.last = roomShot;
  if (roomCam.w > 0.01 && roomCam.last && !story.shot) {
    const r = roomCam.last;
    const w = roomCam.w * roomCam.w * (3 - 2 * roomCam.w);
    const [lng, lat] = toLngLat(r.x, r.z);
    cam.center = [here[0] + (lng - here[0]) * w, here[1] + (lat - here[1]) * w];
    cam.bearing += angleDiff((r.bearing * Math.PI) / 180, (cam.bearing * Math.PI) / 180) * (180 / Math.PI) * w;
    cam.zoom += (r.zoom + fit - cam.zoom) * w;
    cam.pitch += (r.pitch - cam.pitch) * w;
    cam.padding.top *= 1 - w * 0.6;
  }
  story.beforeCam?.();
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
    // (Held at the very top until the high view has been drawn behind the black.)
    const k = story.fly.hold ? 0 : Math.min(1, (performance.now() / 1000 - story.fly.t) / story.fly.length);
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
  applyDayLook();
  followSun(state.x, state.z);
  nightFill.position.set(state.x, 4.5, state.z);
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
    trotros: mateSpots(),
    talk: chatting || performance.now() / 1000 < cine.lastTalk + 2.5,
    siren: ambulance.car ? { x: ambulance.car.x, z: ambulance.car.z } : null,
    quiet: !!compoundRoomShot() || (compound.placed && Math.hypot(state.x - compound.x, state.z - compound.z) < COMPOUND.w / 2),
  });
  if (life?.scenes && !life.scenes.onSpeak) {
    life.scenes.onSpeak = (x, z, height, said, body, seed) => {
      // Calling out to the player: "Sister, come!" to a woman, "Bra, come!" to a man.
      const text = seed === 4242 || (x === state.x && z === state.z) ? said : toMe(said);
      showBubble(x, z, height, text);
    };
  }
  if (life) signals.junctions = life.junctions;
  signals.roadsVersion = epicRoads.tilesBuilt * 1000 + flyovers.version;
  if (trafficSim) trafficSim.blockVersion = flyovers.version * 100000 + buildings.loadedCells;
  signals.update(state.x, state.z, Date.now() / 1000);
  flyovers.update();
  flyovers.updateLamps(state.x, state.z);
  epicRoads.update(state.x, state.z, tier === 'light' ? 3 : 5);
  if (flyovers.version !== flyoverVersion) {
    flyoverVersion = flyovers.version;
    streetTraffic?.recheckRoutes();
  }
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
  if (streetTraffic) streetTraffic.walkers = life?.crossers ?? [];
  streetTraffic?.update(here[0], here[1], Date.now() / 1000, TRAFFIC_LANE_M, story.hidePlayer ? undefined : state);
  updateStats(dt);
  updateButtons();
  AD_CLOCK.value = (Date.now() / 1000) % 86400; // small numbers: the GPU counts in low precision
  updateThief(dt);
  updateDriver(dt);
  updateUncle(dt);
  updateAmbulance(performance.now() / 1000);
  if (compound.placed && compound.group) {
    const dx = state.x - compound.x;
    const dz = state.z - compound.z;
    const c = Math.cos(compound.face);
    const sn = Math.sin(compound.face);
    const roof = compound.group.getObjectByName('roof');
    const u = -(dx * c + dz * sn);
    const v = dx * sn - dz * c;
    // The roof lifts away as you step up to your door, and comes back when you walk off.
    const atDoor = Math.abs(u + 0.6) < 1.6 && v > -COMPOUND.d / 2 && v < -COMPOUND.d / 2 + 0.13 + 3.4 + 1.6;
    if (roof) roof.visible = !story.roomView && !inYourRoom(u, v) && !atDoor;
  }
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
  return buildings.blocked(x, z, room) || !!life?.solid(x, z, room) || !!vehicleAt(x, z, room) || places.solid(x, z, room) || compoundAt(x, z, room) || flyovers.lowRampAt(x, z);
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


// ---------- Talking with people (words on screen; no voices) ----------
// Anyone you meet can talk with you: tap GREET (or CHAT with a seller). They speak first, often
// with a question; you pick an answer on the screen (or press 1, 2, 3) and they reply, out loud and
// in a bubble. Walking away ends it.
const talkEl = document.getElementById('talk')!;
let chatting = false;
let talkEnd: (() => void) | null = null;
let homeTown = 'Ada';
let dayName = 'Kwame';
const fill = (t: string) => t.replace(/\{home\}/g, homeTown).replace(/\{name\}/g, dayName);
type Who = { x: number; z: number; height: number; kind: string; seller: boolean; body: 'male' | 'female' | 'child'; seed: number; words?: string[] };
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

// Asking for help (owner, 28 Oct 2026): anyone can be asked. Some help, telling you which way to go
// and roughly how far; some are not from here and send you to ask someone else.
const NOT_FROM_HERE = [
  'Sorry oo, I am not from here. Ask another person.',
  'Ei, I don\'t know this place well myself. Ask that woman over there, she sells here.',
  'Sorry, my dear, I am new here too. Ask the kiosk people, they know everywhere.',
  'Hmm, I can\'t say. Ask somebody else, they will show you.',
];
const HELP_PLACES = ['BUS STOP', 'CHOP BAR', 'MOBILE MONEY', 'PHARMACY', 'MARKET', 'POLICE STATION', 'SUPERMARKET'];
function helpAnswer(who: Who): string {
  const r = ((who.seed * 2654435761) >>> 0) / 4294967296;
  if (r > 0.62) return NOT_FROM_HERE[Math.floor(r * 97) % NOT_FROM_HERE.length];
  // Where to: where the story is sending you; otherwise somewhere useful nearby.
  let goal: { x: number; z: number; name: string } | null = null;
  if (story.target) goal = { x: story.target.x, z: story.target.z, name: story.target.who === 'Auntie Dede' ? 'the kelewele auntie' : story.target.who ?? 'there' };
  else if (story.auntie) goal = { x: story.auntie.x, z: story.auntie.z, name: 'the kelewele auntie' };
  else {
    const spots = places.list().filter((p) => HELP_PLACES.includes(p.kind));
    if (station) spots.push({ x: station.x, z: station.z, kind: 'LORRY STATION' });
    spots.sort((a, b) => Math.hypot(a.x - state.x, a.z - state.z) - Math.hypot(b.x - state.x, b.z - state.z));
    const p = spots[0];
    if (p) goal = { x: p.x, z: p.z, name: `the ${p.kind.toLowerCase()}` };
  }
  if (!goal) return 'Welcome to Accra! Just ask around, people will help you.';
  const d = Math.hypot(goal.x - state.x, goal.z - state.z);
  const rel = angleDiff(Math.atan2(goal.x - state.x, -(goal.z - state.z)), state.heading);
  const way = Math.abs(rel) < 0.5 ? 'straight ahead of you' : Math.abs(rel) > 2.5 ? 'behind you' : rel > 0 ? 'on your right' : 'on your left';
  const far = d < 25 ? 'just there, very close' : d < 140 ? `about ${Math.round(d / 10) * 10} metres` : `a bit far, about ${Math.round(d / 50) * 50} metres. Take an okada if you are tired`;
  const tip = goal.name === 'the kelewele auntie' ? ' Cross at the zebra, the cars stop when the light is red.' : '';
  return `You want ${goal.name}? Go that way, ${way}: ${far}.${tip}`;
}

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
    const line = forTheHour(mine ? fill(text) : toMe(fill(text)), day.hour);
    if (mine) life?.scenes?.onSpeak?.(state.x, state.z, 1.95, line);
    else showBubble(who.x, who.z, who.height, line, 3 + line.length * 0.05);
    const wait = new Promise((r) => setTimeout(r, Math.max(1600, 700 + line.length * 55)));
    await wait;
  };
  // You say hello first.
  await speak(who.kind === 'muslimMan' || who.kind === 'muslimWoman' ? 'Salaam alaikum.' : [forTheHour('Good afternoon!', day.hour), 'Hello!', 'Chale, how far?'][Math.floor(Math.random() * 3)], true);
  const HELP = 'Please, I am new in Accra. Can you help me?';
  let asked = false;
  while (node && !away()) {
    await speak(node.them, false);
    // Every conversation offers asking for help (once).
    const offered: TalkNode = { ...node, choices: [...(node.choices ?? []), ...(asked ? [] : [{ you: HELP }])] };
    if (!offered.choices!.length || away()) break;
    const choice = await new Promise<number>((resolve) => {
      talkEnd = () => resolve(-1);
      showChoices(offered, resolve);
    });
    talkEl.classList.add('hidden');
    if (choice < 0 || away()) break;
    const c: { you: string; next?: TalkNode | string } = offered.choices![choice];
    await speak(c.you, true);
    if (c.you === HELP) {
      asked = true;
      node = { them: helpAnswer(who), choices: [{ you: 'Thank you very much!', next: 'You are welcome. Go well!' }] };
      continue;
    }
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
type Action = { id: ActionId; target?: Nearby; walker?: { i: number; x: number; z: number; kind: string; height: number; body: 'male' | 'female' | 'child' }; rider?: { id: number; x: number; z: number; kind: string } };
/** A rider or driver you can talk to: within reach, the vehicle stopped or crawling, its driver to be seen. */
function riderNear() {
  if (!streetTraffic) return null;
  let best: { id: number; x: number; z: number; kind: string; d: number } | null = null;
  for (const p of streetTraffic.placed) {
    if (p.bridge || (p.v.speed ?? 0) > 1.6) continue;
    const kind = p.v.kind;
    if (!['okada', 'tricycle', 'taxi', 'trotro', 'car', 'suv', 'pickup'].includes(kind)) continue;
    const [x, z] = [(p.lon - START[0]) * M_LON, (START[1] - p.lat) * M_LAT];
    const d = Math.hypot(x - state.x, z - state.z);
    if (d < 3.3 && (!best || d < best.d)) best = { id: p.v.id, x, z, kind, d };
  }
  return best;
}
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
  // Riders and drivers too (owner, 28 Oct 2026: "talk to anyone she gets close to, even riders"):
  // an okada rider, a tricycle or open-jeep driver, a taxi driver or trotro mate, stopped or crawling
  // in the traffic right beside you.
  const rider = me.doing === 'none' && !chatting && !walker ? riderNear() : null;
  if (rider) return { id: 'greet', target: { kind: 'person', x: rider.x, z: rider.z, face: 0, d: 0, who: -1 }, rider };
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
      } else if (a.rider) {
        // The vehicle waits while you talk (then drives on).
        const id = a.rider.id;
        streetTraffic?.hold.add(id);
        const kind = a.rider.kind === 'okada' || a.rider.kind === 'tricycle' ? 'rider' : a.rider.kind === 'trotro' ? 'mate' : 'driver';
        who = { x: a.rider.x, z: a.rider.z, height: a.rider.kind === 'okada' ? 2.0 : 2.3, kind, seller: false, body: 'male', seed: id * 17 };
        const release = () => streetTraffic?.hold.delete(id);
        setTimeout(release, 45000); // (never held for long)
        void (async () => {
          await new Promise((r) => setTimeout(r, 300));
          while (chatting) await new Promise((r) => setTimeout(r, 300));
          release();
        })();
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
// Who you are (title cards over the music), the trotro leaving for Accra (the film), then the camera comes
// down over Accra to Circle. A boy snatches your bag; you chase him and lose him; the kelewele
// auntie calls your uncle. Then the city is yours to explore. ?nostory skips it (for tests).

const cine = new Cinema();
// The opening film starts downloading as the page opens (owner, 28 Oct 2026: no long dark screen at
// the start): the lighter copy (360p, about 0.8 MB) on a slow or data-saving connection.
const slowNet = (() => {
  try {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return !!c && (!!c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType ?? ''));
  } catch {
    return false;
  }
})();
const FILM = slowNet ? '/film/opening-360.mp4' : '/film/opening-480.mp4';
if (!params.has('nostory') && !params.has('auto')) cine.loadVideo(FILM, '/film/opening-poster.jpg');
/** The opening film, started in the START tap (it plays while the city and the people load behind it). */
let earlyFilm: Promise<boolean> | null = null;
/** The name you get from the day you arrive (brief 5.3). */
function dayNameFor(body: 'male' | 'female') {
  return (body === 'female' ? ['Akosua', 'Adwoa', 'Abenaa', 'Akua', 'Yaa', 'Afua', 'Ama'] : ['Kwasi', 'Kwadwo', 'Kwabena', 'Kwaku', 'Yaw', 'Kofi', 'Kwame'])[new Date().getDay()];
}
const DEGREES = ['Computer Science', 'Business Administration', 'Accounting', 'Marketing', 'Civil Engineering', 'Communication Studies'];
/**
 * The opening (owner, 29 Oct 2026: no Grandma, nobody gives you money): with the music playing, title
 * cards say who you are (your name, a fresh graduate from the hometown you picked, off to hustle in
 * Accra and stay with Uncle Kwame), then the film: the trotro on the road to Accra (public/film/opening-*:
 * the owner's 2.2 s clip sent on 29 Oct 2026, as it is, without its own sound).
 * On a slow network: "Loading…" on the black until the film can play.
 */
async function playFilm(home: string, body: 'male' | 'female') {
  cine.begin();
  cine.coverNow();
  streetSound.setQuiet(true); // (the music only)
  const degree = DEGREES[[...home].reduce((n, c) => n + c.charCodeAt(0), new Date().getDay()) % DEGREES.length];
  // (About 2.5 seconds each: owner, 29 Oct 2026, "it shouldn't keep that long".)
  await cine.title(`You are ${dayNameFor(body)}`, `A university graduate in ${degree}, from ${home}.`, 2.2);
  await cine.title(home, 'You studied hard, but there is still no work at home.', 2.2);
  await cine.title('Accra', 'So you are going to Accra, to stay with your uncle and hustle.', 2.4);
  if (cine.skipped) return false;
  const t0 = performance.now();
  while (!cine.videoReady() && !cine.skipped && performance.now() - t0 < 25000) {
    if (performance.now() - t0 > 1200) cine.loadingNote(true);
    await new Promise((r) => setTimeout(r, 100));
  }
  cine.loadingNote(false);
  if (!cine.videoReady() || cine.skipped) return false;
  return cine.video(
    [[0.4, '', 'The trotro to Accra.', 1.7]],
    true,
  );
}
/** Take away the dark loading screen that hides the city (once). */
function liftCurtain() {
  document.getElementById('loading')?.remove();
}
const story = {
  busy: false, // the story is running (the first goals wait)
  frozen: false, // a film scene is playing: no control
  fly: null as { t: number; length: number; hold?: boolean } | null,
  goal: '',
  auntie: null as { x: number; z: number; reached: () => void } | null,
  shot: null as { x: number; z: number; bearing: number; zoom: number; pitch: number } | null,
  onFrame: null as (() => void) | null,
  /** Run every frame just before the camera is placed (a film shot that follows a moving car smoothly). */
  beforeCam: null as (() => void) | null,
  /** Who or where the story is sending you (shown on the big map and the minimap). */
  target: null as null | { x: number; z: number; who?: string; role?: string; icon: string; label: string; mission: string },
  /** A move the scene gives the player (talking in the chair, eating...). */
  pose: null as null | (typeof POSES)[number],
  /** Both hands on the head ("Ei! My bag!"). */
  handsOnHead: false,
  /** Eating from the hand, bite after bite. */
  eating: false,
  /** The player is out of sight (in Uncle Kwame's car). */
  hidePlayer: false,
  /** The film is looking into your room: its roof is lifted away. */
  roomView: false,
  /** The story is running the player towards this point (the chase). */
  autoRun: null as { x: number; z: number; stop?: boolean; walk?: boolean } | null,
};

// ---------- Hands on the head (there is no clip for it: the arms are aimed by hand) ----------
const handsOnHead = { w: 0 };
const hv = { s: new THREE.Vector3(), e: new THREE.Vector3(), h: new THREE.Vector3(), t: new THREE.Vector3(), head: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(), side: new THREE.Vector3() };
const hq = { a: new THREE.Quaternion(), b: new THREE.Quaternion(), p: new THREE.Quaternion(), w: new THREE.Quaternion(), keep: new THREE.Quaternion() };
/** Turn a bone so that its child (the next joint) points at a target point, blended by w. */
function aimBone(bone: THREE.Bone, child: THREE.Object3D, target: THREE.Vector3, w: number) {
  bone.getWorldPosition(hv.s);
  child.getWorldPosition(hv.e);
  const from = hv.e.sub(hv.s).normalize();
  const to = hv.t.copy(target).sub(hv.s).normalize();
  hq.a.setFromUnitVectors(from, to); // the world turn needed
  bone.getWorldQuaternion(hq.w);
  (bone.parent ?? bone).getWorldQuaternion(hq.p);
  hq.keep.copy(bone.quaternion);
  hq.b.copy(hq.p).invert().multiply(hq.a).multiply(hq.w); // the new local turn
  bone.quaternion.copy(hq.keep).slerp(hq.b, w);
  bone.updateMatrixWorld(true);
}
function poseHandsOnHead(p: Person, w: number) {
  const B = p.bones;
  const head = B.Head ?? B.head;
  if (!head) return;
  p.root.updateMatrixWorld(true);
  head.getWorldPosition(hv.head);
  hv.fwd.set(Math.sin(state.heading), 0, -Math.cos(state.heading));
  for (const side of ['l', 'r'] as const) {
    const upper = B[`upperarm_${side}`];
    const lower = B[`lowerarm_${side}`];
    const hand = B[`hand_${side}`];
    if (!upper || !lower || !hand) continue;
    upper.getWorldPosition(hv.s);
    hv.side.copy(hv.s).sub(hv.head).setY(0).normalize();
    // Elbow out to the side and up; hand on top of the head.
    const elbow = new THREE.Vector3().copy(hv.s).addScaledVector(hv.side, 0.2).addScaledVector(hv.up, 0.2).addScaledVector(hv.fwd, 0.06);
    aimBone(upper, lower, elbow, w);
    const top = new THREE.Vector3().copy(hv.head).addScaledVector(hv.up, 0.14).addScaledVector(hv.side, 0.06).addScaledVector(hv.fwd, 0.03);
    aimBone(lower, hand, top, w);
  }
}

/** The right hand up to the mouth (eating from the wrap), blended by w. */
function poseHandToMouth(p: Person, w: number) {
  const B = p.bones;
  const head = B.Head ?? B.head;
  const upper = B.upperarm_r;
  const lower = B.lowerarm_r;
  const hand = B.hand_r;
  if (!head || !upper || !lower || !hand) return;
  p.root.updateMatrixWorld(true);
  head.getWorldPosition(hv.head);
  hv.fwd.set(Math.sin(state.heading), 0, -Math.cos(state.heading));
  upper.getWorldPosition(hv.s);
  hv.side.copy(hv.s).sub(hv.head).setY(0).normalize();
  // Elbow down and a little forward and out; the hand at the mouth.
  const elbow = new THREE.Vector3().copy(hv.s).addScaledVector(hv.fwd, 0.16).addScaledVector(hv.up, -0.2).addScaledVector(hv.side, 0.1);
  aimBone(upper, lower, elbow, w);
  const mouth = new THREE.Vector3().copy(hv.head).addScaledVector(hv.fwd, 0.13).addScaledVector(hv.up, -0.06).addScaledVector(hv.side, 0.02);
  aimBone(lower, hand, mouth, w);
}

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
// The kelewele: a paper of fried plantain cubes and groundnuts (foodKit.ts), in place of the plain box.
void foodGeometry('kelewele-wrap').then((g) => {
  props.food.geometry = g;
  props.food.material = foodMaterial();
});
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
    // An older man (the brief: your uncle in Nima, a compound tenant who always has advice): hair going
    // grey, a long pale kaftan, a little heavier than the young newcomer.
    const p = await createPerson({ shirt: '#cdbf9f', trousers: '#cdbf9f', shoes: '#3a2a1c', hair: '#8f8a83', skin: '#6e625b' }, 'male', 'full');
    p.model.scale.multiplyScalar(1.04);
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
// Uncle Kwame's wife, Auntie Esi, and their two children, Kofi and Akos (6c; owner, 28 Oct 2026:
// "the uncles, his wife and children"): at home in the yard when you arrive.
const family = {
  people: [] as { p: Person; x: number; z: number; heading: number }[],
  loading: null as Promise<void> | null,
  load() {
    this.loading ??= (async () => {
      const list = await Promise.all([
        createPerson({ shirt: '#1f5fa8', trousers: '#e3a92b', shoes: '#3a2a20', hair: '#141110', skin: '#6e625b' }, 'female', 'full'), // Auntie Esi, in a wax-print blue and gold
        createPerson({ shirt: '#c8442e', trousers: '#2a3446', shoes: '#f2efe6', hair: '#141110', skin: '#6e625b' }, 'male', 'full'), // Kofi
        createPerson({ shirt: '#d84a8c', trousers: '#f2efe6', shoes: '#f2efe6', hair: '#141110', skin: '#6e625b' }, 'female', 'full'), // Akos
      ]);
      list[1].model.scale.multiplyScalar(0.62);
      list[2].model.scale.multiplyScalar(0.58);
      for (const p of list) {
        act(p, 'idle', 0);
        p.model.traverse((o) => (o.castShadow = PRESET.shadows));
        this.people.push({ p, x: 0, z: 0, heading: 0 });
      }
    })();
    return this.loading;
  },
  show(spots: { x: number; z: number; heading: number }[]) {
    this.people.forEach((f, i) => {
      if (!spots[i]) return;
      [f.x, f.z, f.heading] = [spots[i].x, spots[i].z, spots[i].heading];
      scene.add(f.p.root);
    });
  },
  update(dt: number) {
    for (const f of this.people) {
      if (!f.p.root.parent) continue;
      f.p.root.position.set(f.x, 0, f.z);
      f.p.root.rotation.set(0, Math.PI - f.heading, 0);
      f.p.mixer.update(dt);
    }
  },
};
function updateUncle(dt: number) {
  family.update(dt);
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

// An ambulance now and then (about every minute and a half while you walk the streets): white,
// a red stripe, red and blue lights flashing on the roof and its siren on, driving along
// a real road near you; the traffic behind it waits, and in a jam it waits too, siren going.
const ambulance = {
  car: null as NonNullable<typeof streetTraffic>['story'][number] | null,
  v: null as null | (NonNullable<typeof streetTraffic>['placed'][number]['v']),
  s: 0,
  until: 0,
  last: 0,
  next: 25,
  group: null as THREE.Group | null,
  lights: [] as THREE.MeshBasicMaterial[],
};
function ambulanceId() {
  // A number with no advert space on it (the vehicles' adverts are picked by number).
  for (let id = 900100; ; id++) if (((id * 2246822519) >>> 0) / 4294967296 >= 0.8) return id;
}
/** Is there a vehicle (of the traffic) just in front of a story vehicle at (x, z) facing `heading`? */
function storyBlocked(x: number, z: number, heading: number, half: number) {
  if (!streetTraffic) return false;
  const fx = Math.sin(heading), fz = -Math.cos(heading);
  for (const b of streetTraffic.boxes) {
    if (streetTraffic.story.some((q) => q.x === b.x && q.z === b.z)) continue; // (story vehicles themselves)
    const dx = b.x - x, dz = b.z - z;
    const along = dx * fx + dz * fz;
    if (along <= 0 || along > half + b.half + 2) continue;
    if (Math.abs(dx * -fz + dz * fx) < 1.05 + b.halfW) return true;
  }
  return false;
}
/** Clear the traffic off a story vehicle's path (at a camera cut). */
function clearStoryPath(pts: { x: number; z: number }[], width = 3.4) {
  trafficSim?.clearAlong(pts.map((p) => [p.x, p.z] as [number, number]), width);
}
/** Drive a story vehicle along `at(d)` from d0, speeding up to `speed`, waiting behind traffic; done when far from you or after `seconds`. */
function driveAway(car: { x: number; z: number; heading: number }, at: (d: number) => { x: number; z: number; heading: number }, d0: number, speed: number, seconds: number, done: () => void, accel = 2.4) {
  let d = d0, v = 0, t = 0, last = gameClock;
  const step = () => {
    const dt = Math.min(0.1, gameClock - last);
    last = gameClock;
    t += dt;
    const ahead = at(d + 1);
    const next = at(d + Math.max(0.4, v * dt * 2));
    if (storyBlocked(ahead.x, ahead.z, ahead.heading, 2.6) || trafficSim?.overlapsBox(next.x, next.z, next.heading, 2.9, 1.2)) v = 0;
    else v = Math.min(speed, v + accel * dt);
    d += v * dt;
    const q = at(d);
    [car.x, car.z, car.heading] = [q.x, q.z, q.heading];
    if (Math.hypot(q.x - state.x, q.z - state.z) > 75 || t > seconds) done();
    else requestAnimationFrame(step);
  };
  step();
}

function ambulanceLook() {
  const g = new THREE.Group();
  const red = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
  const blue = new THREE.MeshBasicMaterial({ color: '#2a6bff' });
  const stripe = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.6 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.34), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.5 }));
  // On the pack's ambulance (its own red stripes): a flashing light bar on the front of the box roof.
  void stripe;
  bar.position.set(0, 2.72, 0.55);
  g.add(bar);
  for (const [x, m] of [[-0.42, red], [0.42, blue]] as const) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.3), m);
    l.position.set(x, 2.84, 0.55);
    g.add(l);
  }
  ambulance.lights = [red, blue];
  return g;
}
/**
 * The ambulance as one of the traffic's drivers (owner, 28 Oct 2026: nothing passes through another
 * vehicle): it comes along a lane 35 to 80 m away, a little faster than the rest, lights flashing,
 * behind whatever is ahead in a jam; after about 20 seconds its lights go off and it drives on.
 */
const simAmbulance = { id: null as number | null };
function updateSimAmbulance(t: number) {
  const a = ambulance;
  const sim = trafficSim!;
  if (simAmbulance.id !== null) {
    const w = sim.where(simAmbulance.id);
    if (!w || t > a.until) {
      if (a.group) scene.remove(a.group);
      simAmbulance.id = null;
      a.next = t + 70 + Math.random() * 40;
      return;
    }
    const y = w.bridge ? flyovers.heightAt(w.x, w.z) : -groundDip(w.x, w.z);
    a.group!.position.set(w.x, y, w.z);
    a.group!.rotation.y = Math.PI - w.heading;
    const on = Math.floor(t * 4) % 2 === 0;
    a.lights[0].color.set(on ? '#ff2a2a' : '#4a0a0a');
    a.lights[1].color.set(on ? '#0a1640' : '#2a6bff');
    return;
  }
  if (t < a.next || story.frozen || story.autoRun || chatting) return;
  a.next = t + 10; // (try again soon if no lane fits)
  const id = sim.addSpecial('pickup', state.x, state.z, 35, 80);
  if (id === null) return;
  simAmbulance.id = id;
  a.until = t + 20;
  a.group ??= ambulanceLook();
  scene.add(a.group);
}
function updateAmbulance(t: number) {
  if (trafficSim) return updateSimAmbulance(t);
  if (!streetTraffic) return;
  const a = ambulance;
  if (a.car && a.v) {
    // Along its lane at up to 15 m/s, but never into the vehicle ahead: in a jam it waits, siren on.
    const step = Math.min(0.1, Math.max(0, t - a.last)) * 15;
    a.last = t;
    const ahead = streetTraffic.routeAt(a.v, a.s + 5.5);
    const blocked = streetTraffic.boxes.some((b) => Math.hypot(b.x - ahead.x, b.z - ahead.z) < b.half + 1.2 && !(b.x === a.car!.x && b.z === a.car!.z));
    if (!blocked) a.s += step;
    const p = streetTraffic.routeAt(a.v, a.s);
    [a.car.x, a.car.z, a.car.heading] = [p.x, p.z, p.heading];
    a.group!.position.set(a.car.x, 0, a.car.z);
    a.group!.rotation.y = Math.PI - p.heading;
    const on = Math.floor(t * 4) % 2 === 0;
    a.lights[0].color.set(on ? '#ff2a2a' : '#4a0a0a');
    a.lights[1].color.set(on ? '#0a1640' : '#2a6bff');
    if (t > a.until || p.bridge) {
      streetTraffic.story = streetTraffic.story.filter((q) => q !== a.car);
      scene.remove(a.group!);
      a.car = null;
      a.v = null;
      a.next = t + 70 + Math.random() * 40;
    }
    return;
  }
  if (t < a.next || story.frozen || story.autoRun || chatting) return;
  a.next = t + 10; // (try again soon if no road fits)
  // A vehicle 35 to 80 m away driving towards you: the ambulance comes along its road from there.
  let pick: (typeof streetTraffic.placed)[number] | null = null;
  for (const q of streetTraffic.storyRoutes()) {
    if (q.bridge) continue;
    const [x, z] = [(q.lon - START[0]) * M_LON, (START[1] - q.lat) * M_LAT];
    const d = Math.hypot(x - state.x, z - state.z);
    const towards = ((state.x - x) * Math.sin(q.heading) + (state.z - z) * -Math.cos(q.heading)) / (d || 1);
    if (d > 35 && d < 80 && towards > 0.6) {
      pick = q;
      break;
    }
  }
  if (!pick) return;
  // Behind that vehicle, in a free gap in its lane (never on top of another vehicle).
  const tr = streetTraffic;
  const back = [-14, -22, -30, -38].find((k) => {
    const q = tr.routeAt(pick.v, pick.s + k);
    return !q.bridge && !tr.boxes.some((b) => Math.hypot(b.x - q.x, b.z - q.z) < b.half + 3.4);
  });
  if (back === undefined) return;
  a.v = pick.v;
  a.s = pick.s + back;
  a.until = t + 20;
  a.last = t;
  a.car = { key: 'ambulance', kind: 'trotro', id: ambulanceId(), x: 0, z: 0, heading: 0, colour: '#f6f6f2', shown: true, moving: true };
  streetTraffic.story.push(a.car);
  a.group ??= ambulanceLook();
  scene.add(a.group);
}

// The compound house: placed on open ground near where the ride ends, its gate facing the road.
const compound = { group: null as THREE.Group | null, x: 0, z: 0, face: 0, placed: false, street: null as UncleStreet | null };
/** Uncle Kwame's quiet street (6c): its middle line from the main road to his gate, the main road there. */
type UncleStreet = { toGate: { x: number; z: number }[]; main: { x: number; z: number; dx: number; dz: number; half: number }; houses: number };
/**
 * Follows a street's middle line from (x, z) along T, up to maxLen metres: its points, and where it
 * meets a main road (if it does).
 */
function traceStreet(x: number, z: number, T: { x: number; z: number }, maxLen: number) {
  const pts = [{ x, z }];
  if (!life) return { pts, main: null };
  let p = { x, z };
  let t = { ...T };
  for (let d = 3; d <= maxLen; d += 3) {
    const g = { x: p.x + t.x * 3, z: p.z + t.z * 3 };
    const main = life.roadPointNear(g.x, g.z, 4, 4.5);
    if (main && d > 6) {
      pts.push({ x: main.x, z: main.z });
      return { pts, main };
    }
    const q = life.roadPointNear(g.x, g.z, 5, 2);
    if (!q) break;
    let dir = { x: q.dx, z: q.dz };
    if (dir.x * t.x + dir.z * t.z < 0) dir = { x: -dir.x, z: -dir.z };
    // (At a crossing, keep straight on rather than turning into the other street.)
    if (dir.x * t.x + dir.z * t.z > 0.75) t = dir;
    p = { x: q.x, z: q.z };
    pts.push(p);
  }
  return { pts, main: null };
}
/** The gate's street: which way it runs at the gate point, and the way to the nearest main road along it. */
function gateStreet(gx: number, gz: number, maxLen = 100) {
  const q = life?.roadPointNear(gx, gz, 8, 2);
  if (!q) return null;
  let best: { pts: { x: number; z: number }[]; main: NonNullable<ReturnType<NonNullable<typeof life>['roadPointNear']>>; len: number } | null = null;
  for (const sg of [1, -1]) {
    const tr = traceStreet(q.x, q.z, { x: q.dx * sg, z: q.dz * sg }, maxLen);
    if (!tr.main) continue;
    let len = 0;
    for (let i = 1; i < tr.pts.length; i++) len += Math.hypot(tr.pts[i].x - tr.pts[i - 1].x, tr.pts[i].z - tr.pts[i - 1].z);
    if (!best || len < best.len) best = { pts: tr.pts, main: tr.main, len };
  }
  return best;
}
/** Under the carport's tin roof (the camera cannot see through it). */
function underCarport(x: number, z: number) {
  if (!compound.placed) return false;
  const dx = x - compound.x;
  const dz = z - compound.z;
  const c = Math.cos(compound.face);
  const sn = Math.sin(compound.face);
  const u = -(dx * c + dz * sn);
  const v = dx * sn - dz * c;
  return Math.abs(u - PARKING.u) < 2.1 && Math.abs(v - PARKING.v) < 3.3;
}
function compoundAt(x: number, z: number, room: number) {
  if (!compound.placed) return false;
  const dx = x - compound.x;
  const dz = z - compound.z;
  const R = Math.hypot(COMPOUND.w, COMPOUND.d) / 2 + 1;
  if (Math.abs(dx) > R || Math.abs(dz) > R) return false;
  const c = Math.cos(compound.face);
  const sn = Math.sin(compound.face);
  return compoundSolid(-(dx * c + dz * sn), dx * sn - dz * c, room);
}
/** The camera for your room when you are inside it (looking down into it), or null. */
const roomCam = { w: 0, last: null as null | { x: number; z: number; bearing: number; zoom: number; pitch: number } };
function compoundRoomShot() {
  if (!compound.placed) return null;
  const dx = state.x - compound.x;
  const dz = state.z - compound.z;
  const c = Math.cos(compound.face);
  const sn = Math.sin(compound.face);
  if (!inYourRoom(-(dx * c + dz * sn), dx * sn - dz * c)) return null;
  const D = COMPOUND.d / 2;
  const u = -0.2;
  const v = -D + 1.9;
  return frameShot(compound.x - u * c + v * sn, compound.z - u * sn - v * c, ((compound.face + Math.PI) * 180) / Math.PI - 15, 3.8, 24);
}
function placeCompound(nearX: number, nearZ: number) {
  if (!life) return null;
  if (!compound.group) {
    compound.group = compoundHouse();
    // Uncle's family house, the white modern one, on its side of the yard (it arrives in a moment).
    const g = compound.group;
    void villaMesh(VILLA).then((m) => g.add(m));
  }
  const W = COMPOUND.w / 2 + 0.5;
  const D = COMPOUND.d / 2 + 0.5;
  let best: { x: number; z: number; face: number; bad: number } | null = null;
  for (let r = 14; r <= 160 && !(best && best.bad === 0); r += 6)
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
          else if (buildings.blocked(px, pz, 0.2)) bad += 0.12; // (the map's buildings there are cleared away: open ground only a little better)
        }
      // The gate must open onto the road, with nothing between the gate and the road.
      let toRoadOk = false;
      for (let k = 1; k <= 9; k += 1) {
        const gx = cx + F[0] * (D + k);
        const gz = cz + F[1] * (D + k);
        if (life.roadAt(gx, gz, 0.5)) {
          toRoadOk = true;
          break;
        }
        if (buildings.blocked(gx, gz, 0.2) && k > 3) bad += 15;
      }
      if (!toRoadOk) bad += 40;
      // A quiet side street, not on a busy main road with its sellers.
      if (life.roadDirNear(cx, cz, D + 14, 4.5) !== null) bad += 25;
      // ... that joins a main road 25 to 100 m away (owner, 28 Oct 2026: Uncle comes along the main
      // road and curves into his street).
      if (bad < 30 && (!best || bad < best.bad)) {
        let k = 1;
        while (k < 12 && !life.roadAt(cx + F[0] * (D + k), cz + F[1] * (D + k), 0)) k += 0.5;
        const st = gateStreet(cx + F[0] * (D + k + 1), cz + F[1] * (D + k + 1));
        if (!st || st.len < 25) bad += 30;
        else if (st.len > 55) bad += Math.min(20, (st.len - 55) / 5); // (a short street: he is home in a few seconds)
      } else bad += 30;
      if (!best || bad < best.bad) best = { x: cx, z: cz, face, bad };
    }
  if (!best || best.bad >= 100) return null;
  [compound.x, compound.z, compound.face, compound.placed] = [best.x, best.z, best.face, true];
  // The compound takes its own plot: the map's buildings standing on it are cleared away.
  // (with a little forecourt in front of the gate, out to the road)
  buildings.clearPlot(best.x + Math.sin(best.face) * 1.8, best.z - Math.cos(best.face) * 1.8, best.face, COMPOUND.w / 2 + 0.4, COMPOUND.d / 2 + 2.4);
  places.clearArea(best.x + Math.sin(best.face) * 3, best.z - Math.cos(best.face) * 3, Math.hypot(COMPOUND.w, COMPOUND.d) / 2 + 6);
  compound.group.position.set(best.x, 0, best.z);
  compound.group.rotation.y = Math.PI - best.face;
  scene.add(compound.group);
  life.clearArea(best.x, best.z, Math.hypot(COMPOUND.w, COMPOUND.d) / 2 + 12); // no sellers crowding the house: open ground round it
  const F = { x: Math.sin(best.face), z: -Math.cos(best.face) };
  compound.street = buildUncleStreet(best.x, best.z, F);
  return { x: best.x, z: best.z, face: best.face, gate: { x: best.x + F.x * (COMPOUND.d / 2 + 1.6), z: best.z + F.z * (COMPOUND.d / 2 + 1.6) }, F };
}

/**
 * Uncle Kwame's street (6c): from the main road to his gate and on a little past it, the map's
 * buildings are cleared and the street is lined on both sides with houses from the pack, every one
 * facing the street with its own house number (players can own them later). Returns the street.
 */
function buildUncleStreet(hx: number, hz: number, F: { x: number; z: number }): UncleStreet | null {
  if (!life) return null;
  const D = COMPOUND.d / 2;
  let k = 1;
  while (k < 12 && !life.roadAt(hx + F.x * (D + k), hz + F.z * (D + k), 0)) k += 0.5;
  const st = gateStreet(hx + F.x * (D + k + 1), hz + F.z * (D + k + 1));
  if (!st) return null;
  const toMain = st.pts; // from the gate to the main road
  // On past the gate for about 50 m the other way.
  const g0 = toMain[0], g1 = toMain[Math.min(1, toMain.length - 1)];
  const back = { x: g0.x - g1.x, z: g0.z - g1.z };
  const bl = Math.hypot(back.x, back.z) || 1;
  const beyond = traceStreet(g0.x, g0.z, { x: back.x / bl, z: back.z / bl }, 50).pts;
  const line = [...beyond.slice(1).reverse(), ...toMain]; // from the far end to the main road
  // Clear the map's buildings along it (the compound has its own plot).
  const a = line[0], b = line[line.length - 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len > 10) buildings.clearPlot((a.x + b.x) / 2, (a.z + b.z) / 2, Math.atan2(b.x - a.x, -(b.z - a.z)), 24, len / 2 + 4, 1);
  // Houses on both sides, about every 15 m, from the far end to 14 m short of the main road.
  let made = 0;
  let s0 = 0;
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
  const total = cum[cum.length - 1];
  const at = (d: number) => {
    let i = 1;
    while (i < line.length - 1 && cum[i] < d) i++;
    const p = line[i - 1], q = line[i];
    const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
    const L = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t, tx: (q.x - p.x) / L, tz: (q.z - p.z) / L };
  };
  for (const side of [1, -1]) {
    s0 = side > 0 ? 6 : 13;
    for (let d = s0; d < total - 14; d += 15) {
      const p = at(d);
      const n = { x: -p.tz * side, z: p.tx * side }; // out to this side
      const half = life.roadPointNear(p.x, p.z, 6, 2)?.half ?? 4;
      const model = STREET_HOUSES[(made * 7 + (side > 0 ? 3 : 0)) % STREET_HOUSES.length];
      const size = modelSize(model);
      const scale = Math.min(1, 13.5 / size.w);
      const out = half + 2.2 + (size.d * scale) / 2;
      const cx = p.x + n.x * out, cz = p.z + n.z * out;
      // Not on the compound, not on another road, not on a flyover ramp.
      const hw = (size.w * scale) / 2, hd = (size.d * scale) / 2;
      if (Math.hypot(cx - hx, cz - hz) < Math.hypot(COMPOUND.w, COMPOUND.d) / 2 + Math.max(hw, hd) + 1) continue;
      let ok = true;
      for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const px = cx + p.tx * hw * u * 0.95 + n.x * hd * v * 0.95, pz = cz + p.tz * hw * u * 0.95 + n.z * hd * v * 0.95;
        if (life.roadAt(px, pz, 0.3) || flyovers.lowRampAt(px, pz)) ok = false;
      }
      if (!ok) continue;
      const front = { x: -n.x, z: -n.z }; // facing the street
      const h = housePick(model, cx, cz, Math.atan2(front.x, front.z), scale, 7_100_000 + made);
      buildings.addHouse(h);
      life.clearArea(cx, cz, Math.max(hw, hd) + 1.5);
      places.clearArea(cx, cz, Math.max(hw, hd) + 1.5);
      made++;
    }
  }
  return { toGate: [...toMain].reverse(), main: st.main, houses: made };
}

// The story's kelewele auntie (Auntie Dede): her own stall across the road from the nearest zebra.
const auntie = {
  group: new THREE.Group(),
  person: null as Person | null,
  x: 0,
  z: 0,
  async load() {
    // A woman in an orange top and a green wrap skirt.
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
// Her stall, from the Epic City pack (owner, 29 Oct 2026: "use the big pack… more real"): its striped
// market stand over a table of kelewele (the pan heaped with it, groundnuts, khebab on sticks, fried
// yam: foodKit.ts), her coal pot with the big pan beside it, and two plastic chairs for customers in
// front. Built facing +z (she stands at -z behind the table, the customer's chair is at +z).
function stallModel() {
  const g = new THREE.Group();
  void epicGeometry('props/marketplace-stand-simple.glb').then((geo) => {
    const stand = new THREE.Mesh(geo, epicMaterial());
    stand.position.z = 0.1;
    stand.castShadow = true;
    g.add(stand);
  });
  void foodGeometry('stall-kelewele').then((geo) => {
    const table = new THREE.Mesh(geo, foodMaterial());
    table.position.z = 0.1;
    table.castShadow = true;
    g.add(table);
  });
  // The coal pot beside the stand, the big pan of kelewele on it.
  const pot = new THREE.Mesh(paint(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 10).translate(1.95, 0.16, -0.05), '#2b2b2b'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  pot.castShadow = true;
  g.add(pot);
  void foodGeometry('kelewele-pan').then((geo) => {
    const pan = new THREE.Mesh(geo, foodMaterial());
    pan.position.set(1.95, 0.32, -0.05);
    pan.scale.setScalar(0.8);
    g.add(pan);
  });
  const chairs = new THREE.Mesh(
    merge([
      paint(box(0.46, 0.05, 0.44, 0.2, 0.44, 1.05), '#1f5fa8'), // blue chair (the customer's)
      paint(box(0.46, 0.45, 0.05, 0.2, 0.68, 1.27), '#1f5fa8'),
      paint(box(0.46, 0.05, 0.44, -0.95, 0.44, 1.25), '#c8442e'), // red chair
      paint(box(0.46, 0.45, 0.05, -0.95, 0.68, 1.47), '#c8442e'),
    ]),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
  );
  chairs.castShadow = true;
  g.add(chairs);
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
      for (const out of [4.4, 5.2, 3.8, 6]) {
        const face = zebra.angle + (far > 0 ? -Math.PI / 2 : Math.PI / 2); // her table faces the road
        tries.push({ x: zebra.x + ox + rx * (zebra.half + out) * far, z: zebra.z + oz + rz * (zebra.half + out) * far, face });
      }
    }
  }
  const pave = life?.pavementNear(state.x + 15, state.z, 2);
  if (pave) tries.push({ x: pave.x, z: pave.z, face: state.heading + Math.PI });
  // First a free spot; if kiosks fill them all, she takes the first spot clear of roads and
  // buildings and the kiosks there move aside.
  // Never on the road: the stall well back from the kerb, and the customer's chair (on the road side
  // of the table) on the pavement too.
  const chairAt = (t: { x: number; z: number; face: number }) => ({ x: t.x + Math.sin(t.face) * 1.05, z: t.z - Math.cos(t.face) * 1.05 });
  const offRoad = (t: { x: number; z: number; face: number }) => !life?.roadAt(t.x, t.z, 2.2) && !life?.roadAt(chairAt(t).x, chairAt(t).z, 0.8);
  const free = (t: { x: number; z: number; face: number }) => !solidAt(t.x, t.z, 1.2) && offRoad(t);
  const open = (t: { x: number; z: number; face: number }) => !buildings.blocked(t.x, t.z, 1.2) && !flyovers.lowRampAt(t.x, t.z) && offRoad(t);
  const pick = tries.find(free) ?? tries.find(open);
  if (pick) life?.clearArea(pick.x, pick.z, 2.8); // (kiosks never crowd her stall)
  for (const t of pick ? [pick] : []) {
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
  // Your first steps are on open pavement: no kiosk is ever put where you stand (they arrive with
  // the streets, a little after you do).
  life.clearArea(spot.x, spot.z, 3.5);
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
  bag.group.visible = !!who && (bag.holder !== 'thief' || thief.on) && !state.onOkada && !(bag.holder === 'player' && story.hidePlayer);
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
function runThief(from = state.heading): { grabbed: Promise<void>; gone: Promise<void> } {
  const boy = thief.person;
  if (!boy) return { grabbed: Promise.resolve(), gone: Promise.resolve() };
  // He runs up (along the pavement, heading `from`) to your right hand with the bag, snatches it and
  // runs on.
  thief.on = true;
  thief.phase = 'pass';
  thief.time = gameClock; // when the chase began (game time)
  thief.heading = from;
  thief.x = state.x - Math.sin(from) * 7 + Math.cos(state.heading) * 0.6;
  thief.z = state.z + Math.cos(from) * 7 + Math.sin(state.heading) * 0.6;
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
// The queue behind, after a while (the light is green and nobody can move).
const COMPLAINTS = [
  'Light don turn green ooo!',
  'Ei! We go sleep here?',
  'This one, he no hear horn?',
  'Somebody help am comot for road!',
  'Chale, green light! Move!',
  'Ah, Accra! Every day!',
  'My brother, we dey late!',
  'Ebei! Who dey stand for road like that?',
];
// A passer-by who comes off the pavement to move you.
const HELPER_LINES = ['Come, come, my brother. Come this side.', 'Chale, come out of the road before car jam you!', 'Massa, I beg, the pavement dey here.'];
const queue = { hoot: new Map<number, number>(), said: 0, front: -1, since: 0, last: 0 };
const driver = {
  person: null as Person | null,
  loading: false,
  phase: 'none' as 'none' | 'out' | 'push' | 'back',
  /** 'driver': the front vehicle's driver gets out; 'passer': someone comes from the pavement. */
  who: 'driver' as 'driver' | 'passer',
  homeX: 0,
  homeZ: 0,
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
/**
 * A vehicle waits because you stand in its way (owner, 28 Oct 2026): on a green light, the whole queue
 * behind you hoots, each at its own moment and pitch; after a while the drivers further back complain;
 * then someone always comes and pushes you off the road: a passer-by from the pavement, or the driver
 * of the front vehicle. At a red light they were stopping anyway: nobody fusses.
 */
function onVehicleBlocked(v: { id: number; x: number; z: number; heading: number; kind: string; halfW: number; half: number; waited: number }) {
  if (story.busy) return;
  // Waiting at a red light anyway: no fuss.
  if (signals.shouldStop(v.x, v.z, v.heading, v.half, Date.now() / 1000)) return;
  const now = performance.now() / 1000;
  const n = nagged.get(v.id) ?? { shout: 0, hoot: 0 };
  const mouthX = v.x + Math.sin(v.heading) * v.half * 0.6;
  const mouthZ = v.z - Math.cos(v.heading) * v.half * 0.6;
  if (queue.front !== v.id || now - queue.last > 3) [queue.front, queue.since] = [v.id, now];
  queue.last = now;
  // How long it has waited for you, in real seconds (the same on a slow phone).
  const waited = Math.max(0, now - queue.since);
  // 1. The front one shouts (the mate on a trotro, otherwise the driver), then again every few seconds.
  if (waited > 0.9 && now - n.shout > 5) {
    n.shout = now;
    const line = toMe(v.kind === 'trotro' && v.id % 2 ? pick(MATE_SHOUTS, v.id + now) : pick(SHOUTS, v.id * 7 + now));
    showBubble(mouthX, mouthZ, 2.3, line);
  }
  // 2. Horns: the front one, and the whole queue behind it (each its own moment and note).
  if (waited > 1.6 && now - n.hoot > 2.2) {
    n.hoot = now;
    hornOf(Math.hypot(v.x - state.x, v.z - state.z), 330 + (v.id % 7) * 22, waited > 6 && v.id % 2 === 0);
  }
  const fx = Math.sin(v.heading), fz = -Math.cos(v.heading);
  const behind = (trafficSim?.near(v.x, v.z, 55, 40) ?? []).filter((q) => {
    if (q.v.id === v.id || q.bridge || (q.v.speed ?? 0) > 0.6) return false;
    const [qx, qz] = [(q.lon - START[0]) * M_LON, (START[1] - q.lat) * M_LAT];
    const along = (qx - v.x) * fx + (qz - v.z) * fz;
    return along < -1 && Math.abs((qx - v.x) * -fz + (qz - v.z) * fx) < 8 && Math.cos(q.heading - v.heading) > 0.8;
  });
  if (waited > 2.2) {
    for (const q of behind.slice(0, 8)) {
      const last = queue.hoot.get(q.v.id) ?? 0;
      const every = 2.4 + ((q.v.id * 7919) % 10) / 4; // each driver his own rhythm
      if (now - last < every) continue;
      queue.hoot.set(q.v.id, now);
      const [qx, qz] = [(q.lon - START[0]) * M_LON, (START[1] - q.lat) * M_LAT];
      const d = Math.hypot(qx - state.x, qz - state.z);
      setTimeout(() => hornOf(d, 300 + (q.v.id % 9) * 20, (q.v.id + Math.floor(now)) % 3 === 0), ((q.v.id * 131) % 900));
    }
    if (queue.hoot.size > 300) queue.hoot.clear();
  }
  // 3. After a while, the queue complains (a line every few seconds, from different vehicles).
  if (waited > 5 && now - queue.said > 3.2 && behind.length) {
    queue.said = now;
    const q = behind[Math.floor(now) % Math.min(behind.length, 5)];
    const [qx, qz] = [(q.lon - START[0]) * M_LON, (START[1] - q.lat) * M_LAT];
    const line = toMe(pick(COMPLAINTS, q.v.id + now));
    showBubble(qx, qz, 2.1, line);
  }
  nagged.set(v.id, n);
  if (nagged.size > 200) nagged.clear();
  // 4. Someone always comes to move you (after about 8 seconds): a passer-by from the nearest
  //    pavement if there is one close, otherwise the front vehicle's driver gets down.
  if (waited > 8 && driver.phase === 'none' && driver.person && !state.onOkada) {
    const pave = life?.pavementNear(state.x, state.z, 0.5);
    driver.car = { id: v.id, x: v.x, z: v.z, heading: v.heading, halfW: v.halfW, half: v.half };
    if (pave && Math.hypot(pave.x - state.x, pave.z - state.z) < 14) {
      driver.who = 'passer';
      // From a few steps along the pavement, so you see them come.
      const ax = pave.x - state.x, az = pave.z - state.z, al = Math.hypot(ax, az) || 1;
      driver.homeX = pave.x + (-az / al) * 3 + (ax / al) * 1;
      driver.homeZ = pave.z + (ax / al) * 3 + (az / al) * 1;
      if (solidAt(driver.homeX, driver.homeZ, 0.3)) [driver.homeX, driver.homeZ] = [pave.x, pave.z];
      [driver.x, driver.z] = [driver.homeX, driver.homeZ];
    } else {
      if (v.kind === 'okada') return;
      driver.who = 'driver';
      const side = Math.sign((state.x - v.x) * Math.cos(v.heading) + (state.z - v.z) * Math.sin(v.heading)) || 1;
      // He gets out on the side you are standing, so he walks straight to you.
      driver.x = v.x + Math.cos(v.heading) * (v.halfW + 0.45) * side;
      driver.z = v.z + Math.sin(v.heading) * (v.halfW + 0.45) * side;
      streetTraffic?.hold.add(v.id);
    }
    driver.phase = 'out';
    driver.time = 0; // seconds in this phase (game time, so slow phones work the same)
    scene.add(driver.person.root);
    const line = toMe(driver.who === 'passer' ? pick(HELPER_LINES, v.id) : pick(PUSH_LINES, v.id));
    showBubble(driver.x, driver.z, 1.9, line);
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
  if (driver.phase === 'back' && driver.who === 'passer') [tx, tz] = [driver.homeX, driver.homeZ];
  else if (driver.phase === 'back') {
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
    if (driver.who === 'driver') streetTraffic?.hold.delete(car.id);
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

// The chase. The boy grabs the bag; you stand there, hands on your head: "Hey! My bag! Thief!".
// Then you run after him, shouting. He darts across the road; a taxi coming along the road brakes
// hard right across your path; you dodge round it, and he is gone down the far pavement.
const CHASE_SHOUTS = ['Thief! Thief!', 'Stop him! Stop that boy!', 'Somebody hold him!', 'My bag! Thief!'];
async function runChase(gone: Promise<void>) {
  // 1. The shock.
  story.frozen = true;
  state.speed = 0;
  cine.begin(); // a new scene: Skip from the film does not cut this short
  story.handsOnHead = true;
  life?.scenes?.onSpeak?.(state.x, state.z, 1.9, 'Hey! My bag! Thief!', playerBody, 4242);
  void cine.say('', 'A boy grabs your bag: your money, your phone, everything!', 2.6);
  await pause(1.9);
  story.handsOnHead = false;
  await pause(0.3);
  cine.end();
  // 2. The chase: the story runs you after him.
  story.frozen = false;
  document.body.classList.add('auto');
  const toRoad = life?.roadDirNear(state.x, state.z, 45) ?? life?.roadDirNear(state.x, state.z, 60, 2) ?? state.heading;
  const F0 = { x: Math.sin(toRoad), z: -Math.cos(toRoad) };
  const T0 = { x: -F0.z, z: F0.x };
  let near = { x: state.x, z: state.z };
  for (let k = 0; k < 60 && !life?.roadAt(near.x, near.z, 0); k++) near = { x: near.x + F0.x * 0.5, z: near.z + F0.z * 0.5 };
  let far = { ...near };
  for (let k = 0; k < 60 && life?.roadAt(far.x, far.z, 0); k++) far = { x: far.x + F0.x * 0.5, z: far.z + F0.z * 0.5 };
  const across = { x: far.x + F0.x * 2, z: far.z + F0.z * 2 };
  const runSide = Math.random() < 0.5 ? 1 : -1;
  thief.path = [across, { x: across.x + T0.x * 30 * runSide, z: across.z + T0.z * 30 * runSide }];
  let shoutAt = gameClock;
  let shout = 0;
  story.onFrame = () => {
    if (thief.on && story.autoRun && !story.autoRun.stop && !blocker.on) [story.autoRun.x, story.autoRun.z] = [thief.x, thief.z];
    if (story.autoRun && !story.autoRun.stop && gameClock - shoutAt > 2.4) {
      shoutAt = gameClock;
      const line = CHASE_SHOUTS[shout++ % CHASE_SHOUTS.length];
      life?.scenes?.onSpeak?.(state.x, state.z, 1.9, line, playerBody, 4242);
    }
  };
  story.autoRun = { x: thief.x, z: thief.z };
  storyGoal('Catch the thief!');
  await pause(1.6);
  // 3. When the road is just ahead of you, the taxi comes along it.
  const roadAhead = () => {
    const H = { x: Math.sin(state.heading), z: -Math.cos(state.heading) };
    return !!life?.roadAt(state.x + H.x * 2.6, state.z + H.z * 2.6, 0);
  };
  await waitUntil(roadAhead, 8);
  const H = { x: Math.sin(state.heading), z: -Math.cos(state.heading) };
  // You pull up at the kerb, and the taxi screeches in right across your path, in your face.
  let k = 0;
  while (k < 8 && !life?.roadAt(state.x + H.x * k, state.z + H.z * k, 0)) k += 0.5;
  const kerb = { x: state.x + H.x * Math.max(0, k - 0.5), z: state.z + H.z * Math.max(0, k - 0.5) };
  const stopAt = { x: kerb.x + H.x * 1.9, z: kerb.z + H.z * 1.9 }; // its side a step in front of you
  blocker.on = true;
  story.autoRun = { x: kerb.x, z: kerb.z };
  const halt = story.onFrame;
  story.onFrame = () => {
    halt?.();
    // A hard stop at the kerb (never past it).
    if (blocker.on && (state.x - kerb.x) * H.x + (state.z - kerb.z) * H.z > -0.3) {
      state.speed = 0;
      [state.x, state.z] = [kerb.x - H.x * 0.3, kerb.z - H.z * 0.3];
      if (story.autoRun) story.autoRun.stop = true;
    }
  };
  // Along the road there (never out of a wall): the way with the most road behind it.
  const nr = life?.roadDirNear(stopAt.x - H.x * 3, stopAt.z - H.z * 3, 12, 2);
  const N = nr === null || nr === undefined ? H : { x: Math.sin(nr), z: -Math.cos(nr) };
  const T = { x: -N.z, z: N.x };
  const onRoad = (sd: number) => {
    let n = 0;
    for (let j = 3; j <= 27; j += 3) if (life?.roadAt(stopAt.x - T.x * sd * j, stopAt.z - T.z * sd * j, 0.3)) n++;
    return n;
  };
  const from = onRoad(1) >= onRoad(-1) ? 1 : -1;
  let reach = 20;
  while (reach > 8 && !life?.roadAt(stopAt.x - T.x * from * reach, stopAt.z - T.z * from * reach, 0.3)) reach -= 2;
  const car = { key: 'taxi' as const, kind: 'taxi' as const, id: 900001, x: stopAt.x - T.x * from * reach, z: stopAt.z - T.z * from * reach, heading: Math.atan2(T.x * from, -T.z * from), colour: '#f2efe6', shown: true, moving: true };
  streetTraffic?.story.push(car);
  // Its way across is clear when the scene cuts to it (no car under it).
  clearStoryPath([{ x: car.x, z: car.z }, stopAt, { x: stopAt.x + T.x * from * 12, z: stopAt.z + T.z * from * 12 }]);
  // The camera: from the side, you and the taxi's side filling the picture.
  cine.begin();
  story.shot = frameShot(kerb.x + H.x * 0.8, kerb.z + H.z * 0.8, ((Math.atan2(T.x, -T.z) + Math.PI / 2 + 0.5) * 180) / Math.PI, 6, 74);
  honk(8, true);
  const t0 = gameClock;
  await new Promise<void>((done) => {
    const drive = () => {
      const q = Math.min(1, (gameClock - t0) / 1.1);
      const e = 1 - (1 - q) * (1 - q); // brakes hard at the end
      const nx = stopAt.x - T.x * from * reach * (1 - e);
      const nz = stopAt.z - T.z * from * reach * (1 - e);
      // Never into a vehicle of the traffic (it brakes short instead).
      if (!trafficSim?.overlapsBox(nx, nz, car.heading, 2.9, 1.25)) [car.x, car.z] = [nx, nz];
      if (q < 1) requestAnimationFrame(drive);
      else done();
    };
    drive();
  });
  car.moving = false;
  if (story.autoRun) story.autoRun.stop = true;
  state.speed = 0;
  story.handsOnHead = true;
  showBubble(car.x, car.z, 2.2, toMe('Ei! Massa, watch the road!'));
  thief.escape = true;
  await pause(1.2);
  story.handsOnHead = false;
  // You look one way, then the other, for a way round.
  const road = Math.atan2(T.x, -T.z);
  state.heading = road + 0.9;
  await pause(0.5);
  state.heading = road + Math.PI - 0.9;
  await pause(0.5);
  life?.scenes?.onSpeak?.(state.x, state.z, 1.9, 'Move! Move! My bag!', playerBody, 4242);
  story.onFrame = halt; // (still not after the thief: round the taxi first)
  music.stop(6); // the music goes with him
  cine.end();
  story.shot = null;
  // 4. You dodge round the back of the taxi and across, but he is already gone.
  const back = { x: car.x - T.x * from * 3.9, z: car.z - T.z * from * 3.9 };
  story.autoRun = { x: back.x - H.x * 1.3, z: back.z - H.z * 1.3 };
  await waitUntil(() => Math.hypot(story.autoRun!.x - state.x, story.autoRun!.z - state.z) < 1, 3);
  story.autoRun = { x: back.x + H.x * 4, z: back.z + H.z * 4 };
  await waitUntil(() => Math.hypot(story.autoRun!.x - state.x, story.autoRun!.z - state.z) < 1, 3);
  story.autoRun = null;
  story.onFrame = null;
  state.speed = 0;
  document.body.classList.remove('auto');
  // The taxi drives on.
  car.moving = true;
  // It drives on, behind whatever is ahead of it (never through it), and is let go once out of sight.
  driveAway(car, (d) => ({ x: stopAt.x + T.x * d * from, z: stopAt.z + T.z * d * from, heading: car.heading }), 0, 8, 30, () => {
    if (streetTraffic) streetTraffic.story = streetTraffic.story.filter((q) => q !== car);
  });
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

// ---------- The way to Nima (the ride's route and signboards) ----------
// The real road route from Circle to Nima (public/data/route-nima.json, found on our own map tiles
// by scripts/route/nima-route.mjs), and what you pass on the way: roads, areas and public landmarks
// (no businesses or brands).
type RideSign = { at: number; kind: 'road' | 'area' | 'landmark' | 'welcome'; name: string; sub?: string; icon?: string };
const RIDE_SIGNS: RideSign[] = [
  { at: 100, kind: 'road', name: 'Kwame Nkrumah Interchange' },
  { at: 222, kind: 'landmark', name: 'Circle Lorry Station', icon: '🚌' },
  { at: 270, kind: 'landmark', name: 'Ghana National Fire Service', icon: '🚒' },
  { at: 380, kind: 'road', name: 'Ring Road Central', sub: '↑ Nima · Kanda' },
  { at: 700, kind: 'area', name: 'Kokomlemle' },
  { at: 920, kind: 'area', name: 'Asylum Down' },
  { at: 1500, kind: 'road', name: 'Ring Road Central', sub: '← Nima · Kanda   Osu →' },
  { at: 1900, kind: 'road', name: 'Al-Waleed Bin Talal Highway' },
  { at: 1990, kind: 'landmark', name: 'Nima Police Station', icon: '👮' },
  { at: 2267, kind: 'landmark', name: 'Nima Cluster of Schools', icon: '🏫' },
  { at: 2420, kind: 'road', name: 'Nima Roundabout' },
  { at: 2434, kind: 'landmark', name: 'Nima Government Clinic', icon: '🏥' },
  { at: 2770, kind: 'landmark', name: 'Nima Market', icon: '🧺' },
  { at: 2900, kind: 'landmark', name: 'Nima Post Office', icon: '📮' },
  { at: 2940, kind: 'welcome', name: 'Welcome to Nima', sub: 'Ayawaso East · Accra' },
];
type Way = { length: number; at: (d: number) => { x: number; z: number; heading: number } };
const nimaRoute: Promise<Way | null> = fetch('/data/route-nima.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((j: { path: [number, number][] } | null) => {
    if (!j?.path?.length) return null;
    const pts = j.path.map(([lng, lat]) => ({ x: (lng - START[0]) * M_LON, z: (START[1] - lat) * M_LAT }));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    return {
      length: cum[cum.length - 1],
      at: (d: number) => {
        let i = 1;
        while (i < pts.length - 1 && cum[i] < d) i++;
        const a = pts[i - 1];
        const b = pts[i];
        const k = Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, heading: Math.atan2(b.x - a.x, -(b.z - a.z)) };
      },
    };
  })
  .catch(() => null);
// A small gold tag over Uncle Kwame's car during the ride (seen from above it is only a few pixels).
const carTag = (() => {
  const el = document.createElement('div');
  el.id = 'car-tag';
  el.innerHTML = '<b>🚗 Uncle Kwame</b><small>and you</small>';
  el.hidden = true;
  document.body.append(el);
  return el;
})();
const tagAt = new THREE.Vector4();
function placeCarTag(x: number, z: number) {
  tagAt.set(x, 2, z, 1).applyMatrix4(camera3d.projectionMatrix);
  if (tagAt.w <= 0) return;
  carTag.hidden = false;
  carTag.style.transform = `translate(${((tagAt.x / tagAt.w + 1) / 2) * innerWidth}px, ${((1 - tagAt.y / tagAt.w) / 2) * innerHeight}px) translate(-50%, -100%)`;
}
const rideSigns = (() => {
  const el = document.createElement('div');
  el.id = 'ride-signs';
  document.body.append(el);
  return el;
})();
/** A signboard sliding in during the ride (green road and area signs, brown landmark signs). */
function rideSign(sg: RideSign) {
  const card = document.createElement('div');
  card.className = `rs rs-${sg.kind}`;
  card.innerHTML = sg.kind === 'landmark' ? `<i>${sg.icon ?? '📍'}</i><b>${sg.name}</b>` : `<b>${sg.name}</b>${sg.sub ? `<small>${sg.sub}</small>` : ''}`;
  rideSigns.append(card);
  while (rideSigns.children.length > 3) rideSigns.firstElementChild?.remove();
  setTimeout(() => card.classList.add('out'), 2300);
  setTimeout(() => card.remove(), 2900);
}

/**
 * The trotro from home pulls in at the kerb beside where you will stand, the mate calls the stop,
 * you step down and walk to the pavement, the trotro drives off, and you turn to face the road.
 * Returns the direction along the pavement (the thief comes that way), or null.
 */
// The trotro's sliding door (the van has none of its own that opens): as it slides back, the dark
// doorway opens from its front edge backwards, on the van's right side a little ahead of the middle
// (only the opening is drawn, so it suits every van's paint and advert). Built in the van's own frame:
// +z is its front, -x its right side (as the vehicles are turned).
const busDoor = (() => {
  const doorway = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.95).translate(0, 0, -0.475), new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.9 }));
  doorway.visible = false;
  scene.add(doorway);
  /** Where the van is and how open its door is (0 shut, 1 open). */
  const set = (x: number, z: number, heading: number, open: number) => {
    doorway.visible = open > 0.01;
    doorway.position.set(x, 0, z);
    doorway.rotation.y = Math.PI - heading;
    // (Moved out to the van's side and forward to the door's front edge, in the van's frame.)
    doorway.translateX(-0.95); // (our trotro: its sliding door, behind the front door on the right)
    doorway.translateY(1.12);
    doorway.translateZ(1.05);
    doorway.scale.z = Math.max(0.01, open);
  };
  return { set, hide: () => (doorway.visible = false) };
})();

/** The first shot at Circle: from further along the kerb, looking back at the traffic (the trotro
 *  comes in there). The camera's way down from the sky ends exactly here. */
function arrivalShot() {
  const toRoad = life?.roadDirNear(state.x, state.z, 30, 2) ?? null;
  const lane = roadLineNear(state.x, state.z);
  if (!lane || toRoad === null) return null;
  const T = { x: Math.sin(lane(0).heading), z: -Math.cos(lane(0).heading) };
  const along = (lane(0).heading * 180) / Math.PI + 180; // looking back along the road
  const lean = angleDiff(toRoad, lane(0).heading + Math.PI) > 0 ? -28 : 28; // the camera a little out over the road
  return frameShot(state.x - T.x * 3, state.z - T.z * 3, along + lean, 11, 70);
}

/** The trotro that brings you to Circle, waiting (held) about 45 m back along its lane, its way to the
 *  kerb clear. Made behind the black, before the camera comes down from the sky. */
let trotroIn: ReturnType<typeof prepareTrotro> | null = null;
function prepareTrotro(spot: { x: number; z: number }, lane: NonNullable<ReturnType<typeof roadLineNear>>) {
  // The trotro from the opening film (owner, 30 Oct 2026: "use the color of the original video"): white,
  // the green Sika Mobile Money advert along its side, its route sign from your hometown to Accra.
  const look = { advert: 'SIKA MOBILE MONEY', route: `${homeTown.toUpperCase()} - ACCRA` };
  const bus = { key: 'trotro' as const, kind: 'trotro' as const, id: 900003, x: 0, z: 0, heading: 0, colour: '#f1ece0', shown: true, moving: true, ...look };
  const STOP = -3; // its door (front right) comes level with you
  // The trotro is a real driver in the traffic (owner, 28 Oct 2026: it must never pass through a car):
  // it comes along its lane from about 45 m back, stops for the lights and waits behind the traffic
  // like everyone, and stops level with you. Its lane in front of it is cleared behind the black, and
  // it waits (held) out of sight while the camera comes down, so nothing on its way in to the kerb
  // ever vanishes in view; the traffic on the other lanes keeps passing (owner, 29 Oct 2026).
  clearStoryPath([-55, -30, -10, STOP, STOP + 12].map((d) => lane(d)));
  const stopAt = lane(STOP);
  const simBus = trafficSim?.addStory({ kind: 'trotro', type: 'trotro', colour: '#f1ece0', x: stopAt.x, z: stopAt.z, heading: stopAt.heading, back: 45 }) ?? null;
  if (simBus !== null) streetTraffic?.looks.set(simBus, look); // (dressed the same when the traffic draws it)
  if (simBus !== null) {
    trafficSim!.stopAt(simBus, stopAt.x, stopAt.z);
    // It pulls over right beside the pavement (owner, 29 Oct 2026: "not in the middle of the street"):
    // how far the road's edge is to the right of its lane, less half its width and a hand's breadth.
    // (Measured from the traffic lane it really drives in.)
    const at = trafficSim!.lanePose(stopAt.x, stopAt.z, stopAt.heading) ?? stopAt;
    const rx = Math.cos(at.heading), rz = Math.sin(at.heading);
    if ((spot.x - at.x) * rx + (spot.z - at.z) * rz > 0) {
      let edge = 0;
      while (edge < 12 && life?.roadAt(at.x + rx * (edge + 0.25), at.z + rz * (edge + 0.25), 0)) edge += 0.25;
      trafficSim!.pullOver(simBus, Math.max(0, Math.min(8, edge - 1.35)));
    }
  }
  if (simBus !== null) trafficSim!.hold.add(simBus);
  return { bus, simBus, STOP, stopAt };
}

async function arriveByBus(): Promise<number | null> {
  const spot = { x: state.x, z: state.z };
  const toRoad = life?.roadDirNear(spot.x, spot.z, 30, 2) ?? null;
  const lane = roadLineNear(spot.x, spot.z);
  /** Skipped (the film's Skip): you are simply standing at Circle, facing the road. */
  const skipTo = () => {
    // (The trotro waiting for you goes on its way with the traffic.)
    if (trotroIn?.simBus != null) {
      trafficSim?.hold.delete(trotroIn.simBus);
      trafficSim?.release(trotroIn.simBus);
    }
    trotroIn = null;
    story.hidePlayer = false;
    story.autoRun = null;
    state.speed = 0;
    [state.x, state.z] = [spot.x, spot.z];
    if (toRoad !== null) state.heading = state.camHeading = toRoad;
    return lane ? lane(0).heading + Math.PI : null;
  };
  if (cine.skipped) return skipTo();
  if (!lane || toRoad === null || !streetTraffic) {
    story.hidePlayer = false;
    await cine.say('', 'Circle. Noise, crowds, hawkers everywhere. You made it to Accra.');
    return null;
  }
  // The stop is a clear bit of pavement (the kiosks there stand back), so the camera sees it all.
  life?.clearArea(spot.x, spot.z, 13);
  // (Normally made behind the black before the camera comes down: see prepareTrotro.)
  const { bus, simBus, STOP } = trotroIn ?? prepareTrotro(spot, lane);
  trotroIn = null;
  if (simBus !== null) trafficSim?.hold.delete(simBus); // off it goes
  const put = (d: number) => {
    const p = lane(d);
    [bus.x, bus.z, bus.heading] = [p.x, p.z, p.heading];
  };
  const follow = () => {
    const w = simBus !== null ? trafficSim?.where(simBus) : null;
    if (w) [bus.x, bus.z, bus.heading] = [w.x, w.z, w.heading];
    return !!w;
  };
  if (simBus === null || !follow()) {
    // (No lane of the traffic here: the trotro is drawn by the story, on the road line.)
    put(STOP - 45);
    streetTraffic.story.unshift(bus);
  }
  story.hidePlayer = true;
  // Seen from further along the kerb, looking back at the traffic: the trotro comes in and stops.
  const T = { x: Math.sin(lane(0).heading), z: -Math.cos(lane(0).heading) };
  const along = (lane(0).heading * 180) / Math.PI + 180; // looking back along the road
  const toRoadDeg = (toRoad * 180) / Math.PI;
  const lean = angleDiff(toRoad, lane(0).heading + Math.PI) > 0 ? -28 : 28; // the camera a little out over the road
  const view = { x: spot.x - T.x * 3, z: spot.z - T.z * 3 };
  story.shot = frameShot(view.x, view.z, along + lean, 11, 70);
  void toRoadDeg;
  void cine.say('', 'Circle. Noise, crowds, hawkers everywhere. You made it to Accra.', 3.4);
  const t0 = gameClock;
  if (simBus !== null && follow()) {
    // Until it has come to rest at the stop (or, at worst, in the queue nearby).
    while (gameClock - t0 < 25) {
      if (cine.skipped) {
        trafficSim!.release(simBus);
        return skipTo();
      }
      follow();
      const st = trafficSim!.storyState(simBus);
      if (!st || (st.stopped && (st.atStop || gameClock - t0 > 12))) break;
      await pause(0.02);
    }
    follow();
  } else {
    while (gameClock - t0 < 4) {
      const k = Math.min(1, (gameClock - t0) / 4);
      put(STOP - 45 * (1 - k) * (1 - k)); // slows to a stop
      await pause(0.02);
    }
  }
  bus.moving = false;
  honk(2, true);
  await cine.say('BUS MATE', 'Circle! Circle! Last stop! Everybody down, down!', 2.4);
  // The door slides open, then you step out through the doorway onto the pavement, seen from the
  // pavement beside the door (owner, 29 Oct 2026: the door opens first; nobody walks through the van).
  const right = { x: Math.cos(bus.heading), z: Math.sin(bus.heading) };
  const fwd = { x: Math.sin(bus.heading), z: -Math.cos(bus.heading) };
  const at = (ahead: number, out: number) => ({ x: bus.x + fwd.x * ahead + right.x * out, z: bus.z + fwd.z * ahead + right.z * out });
  const door = at(0.55, 0.45); // just inside the doorway
  const kerb = at(0.55, 2.1);
  story.shot = frameShot(at(0.55, 0.9).x, at(0.55, 0.9).z, (toRoad * 180) / Math.PI + 35 * Math.sign(lean || 1), 5.5, 72);
  const slide = async (from: number, to: number, seconds: number) => {
    const t0 = gameClock;
    while (gameClock - t0 < seconds) {
      busDoor.set(bus.x, bus.z, bus.heading, from + (to - from) * smooth((gameClock - t0) / seconds));
      await pause(0.02);
    }
    busDoor.set(bus.x, bus.z, bus.heading, to);
  };
  busDoor.set(bus.x, bus.z, bus.heading, 0);
  await pause(0.4);
  await slide(0, 1, 0.8);
  [state.x, state.z, state.heading] = [door.x, door.z, toRoad + Math.PI];
  story.hidePlayer = false;
  story.autoRun = { x: kerb.x, z: kerb.z, walk: true };
  await waitUntil(() => !story.autoRun || Math.hypot(kerb.x - state.x, kerb.z - state.z) < 0.4, 2.5);
  await slide(1, 0, 0.6); // the mate shuts it behind you
  await pause(0.2);
  story.shot = frameShot(spot.x, spot.z, along + lean * 1.6, 7, 72);
  story.autoRun = { x: spot.x, z: spot.z, walk: true };
  await waitUntil(() => !story.autoRun || Math.hypot(spot.x - state.x, spot.z - state.z) < 0.5, 4);
  story.autoRun = null;
  state.speed = 0;
  [state.x, state.z] = [spot.x, spot.z];
  // The trotro pulls away and is gone.
  busDoor.hide();
  bus.moving = true;
  // It pulls away down its lane, behind whatever is ahead (never through it), and is let go out of sight.
  if (simBus !== null && trafficSim?.where(simBus)) trafficSim.release(simBus);
  else
    driveAway(bus, lane, STOP, 12, 40, () => {
      streetTraffic!.story = streetTraffic!.story.filter((q) => q !== bus);
    });
  state.heading = state.camHeading = lane(0).heading; // watching it go
  await pause(1.9);
  // Then you stand there taking it in, amazed by Accra's noise and crowds: you look one way down the
  // road, then the other (about 3 seconds). Seen from behind you, a little high, with the road and the
  // pavement either side in the picture, so the snatch that comes next is seen clearly. (The kiosks
  // behind you stand back: the stop is kept clear.)
  story.shot = frameShot(spot.x, spot.z, (toRoad * 180) / Math.PI + 12 * Math.sign(lean || 1), 7.5, 68);
  showBubble(state.x, state.z, 1.95, toMe('Ei! So this is Accra!'), 2.4);
  const turn = async (to: number, seconds: number) => {
    const from = state.heading;
    const t0 = gameClock;
    while (gameClock - t0 < seconds) {
      const k = smooth((gameClock - t0) / seconds);
      state.heading = from + angleDiff(to, from) * k;
      await pause(0.02);
    }
    state.heading = to;
  };
  await turn(toRoad - 0.9, 0.7);
  await pause(0.5);
  await turn(toRoad + 0.9, 0.9);
  await pause(0.5);
  await turn(toRoad, 0.5);
  await pause(0.3);
  state.camHeading = toRoad;
  return lane(0).heading + Math.PI; // the thief comes along the pavement, against the traffic
}

async function playOpening(start: StartChoice) {
  const home = start.hometown;
  homeTown = home;
  bag.holder = 'player'; // you arrive holding your travel bag
  story.busy = story.frozen = true;
  story.hidePlayer = true; // (you are on the trotro until it stops at Circle and you step down)
  goalChip.classList.add('hidden');
  setMoney(50, 'Your savings for the journey');
  // 1. Who you are (title cards over the music), then the film: the trotro on the road to Accra.
  //    Then a title card on black: hours later, Accra.
  music.preload();
  // (The opening began in the START tap; it may still be playing while the city loaded.)
  const played = await (earlyFilm ?? playFilm(home, start.body));
  if (!played && !cine.skipped) await cine.title(home, 'The trotro to Accra.', 2.6);
  await cine.title('Accra', 'Hours later. Kwame Nkrumah Circle.', 2.2);
  // 2. The camera comes down over the city to Circle (the first moment the city is seen). Behind the
  //    black, the camera goes up to the high view first and the map draws it (its tiles loaded), so
  //    the first thing seen is the city from the sky: never a glimpse of the street (owner, 29 Oct 2026).
  if (!cine.skipped) {
    // Where you will stand, and the first shot there (the stop kept clear, so nothing pops away later).
    await waitUntil(() => startPlaced, 15);
    if (life?.roadAt(state.x, state.z, 0.4)) placeOnPavement();
    life?.clearArea(state.x, state.z, 13);
    story.shot = arrivalShot();
    const lane = roadLineNear(state.x, state.z);
    if (lane && streetTraffic) trotroIn = prepareTrotro({ x: state.x, z: state.z }, lane);
    story.fly = { t: performance.now() / 1000, length: 9, hold: true };
    await cine.wait(0.5); // (the street's next frames move the camera up)
    await new Promise<void>((done) => {
      const t = setTimeout(done, 5000);
      map.once('idle', () => (clearTimeout(t), done()));
      map.triggerRepaint();
    });
    await cine.wait(0.3);
    liftCurtain();
    story.fly.t = performance.now() / 1000;
    story.fly.hold = false;
    await cine.black(false, 1.2);
    placeCard('Accra');
    await cine.wait(4.5);
    placeCard('Kwame Nkrumah Circle');
    while (story.fly && !cine.skipped) await cine.wait(0.1);
  }
  liftCurtain();
  story.fly = null;
  for (const id of ['buildings', 'roofs']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  await cine.black(false, 0.3);
  // Down at Circle: the street's sounds, and the music (in as the journey ends, out as the thief gets away).
  streetSound.setQuiet(false);
  music.play(3);
  // 3. The trotro pulls in at the kerb, you step down, it drives off, you turn to cross: the bag.
  await waitUntil(() => startPlaced, 15);
  if (life?.roadAt(state.x, state.z, 0.4)) placeOnPavement();
  playerMoved = true; // from here the story decides where you are
  const along = await arriveByBus();
  const { grabbed, gone: chase } = runThief(along ?? state.heading);
  await Promise.race([grabbed, new Promise((r) => setTimeout(r, 6000))]);
  bag.holder = 'thief';
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
    if (tier !== 'light') map.setPixelRatio(Math.min(devicePixelRatio, 1.5, sharp * 1.25)); // a little sharper for the scene (not on Light: smoothness first)
    const you = playerPerson;
    const dede = auntie.person;
    // Camera shots: side-on two-shot, and closer on each of you.
    const across = stall.chair.face + Math.PI / 2;
    const mid = { x: (stall.chair.x + stall.x) / 2, z: (stall.chair.z + stall.z) / 2 };
    const clear = (side: number) => !solidAt(mid.x + Math.sin(across) * 4 * side, mid.z - Math.cos(across) * 4 * side, 0.5);
    const side = clear(1) ? 1 : -1;
    const sideBearing = ((across + (side > 0 ? Math.PI : 0)) * 180) / Math.PI;
    const twoShot = () => (story.shot = frameShot(mid.x, mid.z, sideBearing, 4.6, 75));
    // Close shots from the open front of the stall, a little to the clear side (never from behind the
    // stand's back wall or from behind your head): her face over the table, your face in your chair.
    const front = { x: -Math.sin(stall.chair.face), z: Math.cos(stall.chair.face) }; // from her towards the road
    const A = { x: Math.sin(across) * side, z: -Math.cos(across) * side };
    const from = (tx: number, tz: number, out: number, aside: number, pitch: number) => {
      const dx = -(front.x * out + A.x * aside);
      const dz = -(front.z * out + A.z * aside);
      return frameShot(tx, tz, (Math.atan2(dx, -dz) * 180) / Math.PI, Math.hypot(dx, dz), pitch);
    };
    const onHer = () => (story.shot = from(stall.x, stall.z, 2.8, 0.9, 82)); // (low, under the roof's edge)
    const onYou = () => (story.shot = from(stall.chair.x, stall.chair.z, -1.25, 0.65, 82)); // (over her shoulder: you face her)
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
    await cine.say('AUNTIE DEDE', 'By the lorry station, the kelewele stall. Okay, okay. Bye bye.');
    cine.call(null);
    dropProp(props.phone);
    if (dede) act(dede, 'idle');
    twoShot();
    auntie.talk(true);
    await cine.say('AUNTIE DEDE', 'He is coming. Don’t worry, Accra will not swallow you. Here, eat!');
    auntie.talk(false);
    // She gives you a wrap of hot kelewele; you stay in your chair and eat, bite after bite.
    const standX = stall.chair.x + Math.sin(stall.chair.face) * 0.7;
    const standZ = stall.chair.z - Math.cos(stall.chair.face) * 0.7;
    if (you && dede) {
      act(dede, 'pickUp');
      await pause(0.9);
      holdProp(props.food, dede);
      act(dede, 'interact');
      story.pose = 'sitTalk'; // reaching out for it from the chair
      passProp(props.food, dede, you, 1);
      await pause(1.2);
      act(dede, 'idle');
      story.pose = null; // just sitting
      story.eating = true;
    }
    // Close on you over her shoulder, sitting and eating from your hand, bite after bite.
    story.shot = from(stall.chair.x, stall.chair.z, -1.15, 0.6, 82);
    await cine.say('', 'Hot, sweet and peppery. For the first time today, you smile.', 3.4);
    await pause(2.4);
    ayekoo('Mission 1 complete', 'You found Auntie Dede. Uncle Kwame is on his way.');
    storyStep.auntie = true;
    me.vibe += 5;
    twoShot();
    await pause(3);

    // 6. Uncle Kwame arrives in his car. He pulls off the road and parks beside the stall (the
    //    traffic flows on past), walks round the front of the car to her, thanks her and pays her;
    //    then you both walk to the car (he to his door on the road side, you to yours) and get in.
    const lane = roadLineNear(stall.x, stall.z); // the first lane, the stall's kerb on its right
    await cine.black(true, 0.6);
    await cine.title('Forty minutes later…', '', 1.6);
    dropProp(props.food);
    story.pose = null;
    story.eating = false;
    // You have finished and stood up by the stall.
    me.doing = 'none';
    me.seat = null;
    [state.x, state.z, state.heading] = [standX, standZ, stall.chair.face];
    const park = lane ? parkingNear(lane, stall) : null;
    if (park && trafficSim) {
      // Parked clear of every traffic lane (owner, 28 Oct 2026: nothing passes through it): further
      // in to the kerb until a vehicle passing in the nearest lane misses it.
      const R = { x: Math.cos(park.heading), z: Math.sin(park.heading) };
      for (let k = 0; k < 12 && trafficSim.laneClearance(park.x, park.z) < 2.5; k++) {
        park.x += R.x * 0.25;
        park.z += R.z * 0.25;
        park.off += 0.25;
      }
    }
    // The streets of the ride home start loading now (they are ready when you set off).
    void nimaRoute.then((way) => {
      if (!way) return;
      for (let d = 400; d < way.length; d += 300) {
        const q = way.at(d);
        buildings.loadAround(toLngLat(q.x, q.z), 160);
      }
    });
    let uCar: NonNullable<typeof streetTraffic>['story'][number] | null = null;
    if (lane && park && streetTraffic) {
      uCar = { key: 'car', kind: 'car', id: 900002, x: 0, z: 0, heading: 0, colour: '#b3261e', shown: true, moving: true }; // Uncle Kwame's red saloon
      streetTraffic.story.unshift(uCar);
      if (park.off > 0) life?.clearArea(park.x, park.z, 4.6); // kiosks there make room (the whole car length)
      const put = (q: { x: number; z: number; heading: number }) => ([uCar!.x, uCar!.z, uCar!.heading] = [q.x, q.z, q.heading]);
      put(pullIn(lane, park, -40));
      // While the screen is black: his way in (and out again later) is clear of traffic.
      clearStoryPath([-48, -30, -15, -5, 0].map((d) => pullIn(lane, park, d)));
      story.shot = frameShot((park.x + stall.chair.x) / 2, (park.z + stall.chair.z) / 2, sideBearing, 12, 70);
      // He drives in the traffic like everyone (owner, 28 Oct 2026: the lights, the queues, never
      // through a car) to about 10 m before his parking place; then eases off the road into it.
      const entry = pullIn(lane, park, -10);
      const simCar = trafficSim?.addStory({ kind: 'car', type: 'car', colour: '#b3261e', x: entry.x, z: entry.z, heading: entry.heading, back: 16 }) ?? null;
      const follow = () => {
        const w = simCar !== null ? trafficSim?.where(simCar) : null;
        if (w) put(w);
        return !!w;
      };
      await cine.black(false, 0.6);
      const t0 = gameClock;
      if (simCar !== null && follow()) {
        uCar.shown = false; // (the traffic draws it while it drives)
        trafficSim!.stopAt(simCar, entry.x, entry.z);
        // (Owner, 28 Oct 2026: under 10 s for him to arrive: at most 7 s in the traffic, then he pulls in.)
        while (gameClock - t0 < 7) {
          follow();
          const st = trafficSim!.storyState(simCar);
          if (!st || (st.stopped && (st.atStop || gameClock - t0 > 5))) break;
          await pause(0.02);
        }
        follow();
        trafficSim!.remove_(simCar);
        uCar.shown = true;
        // Off the road into the parking place, on a smooth curve, slowing to a stop (waiting if anyone is in the way).
        const curve = easeCurve({ x: uCar.x, z: uCar.z, heading: uCar.heading }, pullIn(lane, park, 0));
        let d = 0;
        let v = 4;
        let last = gameClock;
        while (d < curve.length) {
          const dt = Math.min(0.1, gameClock - last);
          last = gameClock;
          const ahead = curve.at(Math.min(curve.length, d + 3.2));
          if (trafficSim?.vehicleNear(ahead.x, ahead.z, 1.1)) v = 0;
          else v = Math.max(0.8, Math.min(4, v + 2 * dt, ((curve.length - d) / 3) * 4));
          d += v * dt;
          put(curve.at(Math.min(d, curve.length)));
          await pause(0.02);
        }
      } else {
        while (gameClock - t0 < 5) {
          const k = Math.min(1, (gameClock - t0) / 5);
          const e = 1 - (1 - k) * (1 - k); // slows to a stop
          put(pullIn(lane, park, -40 * (1 - e)));
          await pause(0.02);
        }
      }
      uCar.moving = false;
      honk(5, true);
    } else await cine.black(false, 0.6);
    // The driver's door is on the left (Ghana drives on the right): the road side. Yours is on the kerb side.
    const carRight = uCar ? { x: Math.cos(uCar.heading), z: Math.sin(uCar.heading) } : { x: 1, z: 0 };
    const carFwd = uCar ? { x: Math.sin(uCar.heading), z: -Math.cos(uCar.heading) } : { x: 0, z: -1 };
    const door = uCar ? { x: uCar.x - carRight.x * 1.25, z: uCar.z - carRight.z * 1.25 } : { x: stall.chair.x + 3, z: stall.chair.z };
    const myDoor = uCar ? { x: uCar.x + carRight.x * 1.25, z: uCar.z + carRight.z * 1.25 } : { x: stall.chair.x + 3.5, z: stall.chair.z };
    // Round the front of the car (never through it).
    const nose = uCar ? { x: uCar.x + carFwd.x * 3.2, z: uCar.z + carFwd.z * 3.2 } : door;
    const toStall = Math.hypot(nose.x - stall.x, nose.z - stall.z) < Math.hypot(uCar ? uCar.x - carFwd.x * 3.2 - stall.x : 0, uCar ? uCar.z - carFwd.z * 3.2 - stall.z : 0) ? 1 : -1;
    const round = uCar ? { x: uCar.x + carFwd.x * 3.2 * toStall, z: uCar.z + carFwd.z * 3.2 * toStall } : door;
    uncle.show(door.x, door.z, uCar ? uCar.heading : 0);
    const meetX = (stall.x + standX) / 2 + Math.cos(stall.chair.face) * 1.1;
    const meetZ = (stall.z + standZ) / 2 + Math.sin(stall.chair.face) * 1.1;
    story.shot = frameShot((meetX + door.x) / 2, (meetZ + door.z) / 2, sideBearing, 10, 72);
    if (uCar) await uncle.walkTo(round.x, round.z);
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
    if (uCar) story.shot = frameShot(uCar.x, uCar.z, sideBearing, 9, 72);
    story.autoRun = { x: myDoor.x, z: myDoor.z, walk: true };
    void (async () => {
      if (uCar) await uncle.walkTo(round.x, round.z);
      await uncle.walkTo(door.x, door.z);
    })();
    await waitUntil(() => !story.autoRun || Math.hypot(story.autoRun.x - state.x, story.autoRun.z - state.z) < 0.6, 10);
    await waitUntil(() => !uncle.target, 6);
    story.autoRun = null;
    if (uCar) uncle.face(uCar.x, uCar.z);
    await pause(0.4);
    uncle.hide();
    await pause(0.5);
    story.hidePlayer = true;
    honk(4, true);
    await pause(0.6);

    // 7. The ride to Nima, filmed from outside: the car pulls back onto the road and away down the
    //    street at Circle, then (a quick dip to black) the whole real way from above (Ring Road
    //    Central, past Kokomlemle and Asylum Down, up the Al-Waleed Bin Talal Highway to the Nima
    //    Roundabout) with a signboard for every road, area and landmark, about 15 seconds in all.
    if (lane && park && uCar) {
      const t0 = gameClock;
      uCar.moving = true;
      void cine.say('', 'Uncle Kwame drives you home to Nima.', 2.6);
      let d = 0;
      let last = gameClock;
      // Out into the traffic lane on a smooth curve, only when the way is clear: nothing in front, and
      // nothing coming up the lane behind (he waits for a gap, like every Accra driver).
      const here = { x: uCar.x, z: uCar.z, heading: uCar.heading };
      const into = trafficSim?.lanePose(here.x, here.z, here.heading, 13) ?? null;
      const curve = into ? easeCurve(here, into) : null;
      const gap = () => {
        if (!trafficSim || !into) return true;
        const behind = trafficSim.lanePose(into.x, into.z, into.heading, -16);
        return !trafficSim.vehicleNear(into.x, into.z, 3) && !(behind && trafficSim.vehicleNear(behind.x, behind.z, 7));
      };
      let going = false;
      while (gameClock - t0 < 2.4) {
        const t = gameClock - t0;
        const dt = gameClock - last;
        last = gameClock;
        let q: { x: number; z: number; heading: number };
        if (curve) {
          if (!going) going = gap();
          if (going) {
            const ahead = curve.at(Math.min(curve.length, d + 3.4));
            if (!trafficSim!.vehicleNear(ahead.x, ahead.z, 1.1)) d = Math.min(curve.length, d + Math.min(7, 1.5 + d) * dt);
          }
          q = curve.at(d);
        } else {
          // Out into the road, waiting for a gap if a car is passing in front.
          const want = t < 2.5 ? 1.4 * t * t : 8.75 + (t - 2.5) * 7;
          const ahead = pullOut(lane, park, d + 1);
          if (!storyBlocked(ahead.x, ahead.z, ahead.heading, 2.4)) d = Math.min(want, d + 8 * dt);
          q = pullOut(lane, park, d);
        }
        [uCar.x, uCar.z, uCar.heading] = [q.x, q.z, q.heading];
        [state.x, state.z, state.heading] = [q.x, q.z, q.heading];
        // A low shot from the kerb that turns to follow the car away.
        const look = (q.heading * 180) / Math.PI + 70 - t * 14;
        story.shot = frameShot(q.x, q.z, look, 9 + t * 1.2, 74 - t);
        await pause(0.02);
      }
    }
    const way = await nimaRoute;
    if (way && uCar) await rideFilm(way, uCar);

    const home = await homeAtNima(uCar, start.hometown);
    story.hidePlayer = false;
    story.roomView = false;
    story.shot = null;
    cine.end();
    map.setPixelRatio(sharp);
    stopDoing();
    if (home) {
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
 * The ride to Nima, at a real driving speed (about 15 m/s, 54 km/h), filmed low from behind and
 * beside Uncle Kwame's car so the street and its buildings fill the picture: first through Circle
 * onto Ring Road Central (about 14 s, past the lorry station and the fire service), a fade ("Twenty
 * minutes later", with the signs of the places in between), then into Nima (about 11 s: the
 * roundabout, the clinic, the market, the post office) and home. Signs show each road, area and
 * landmark as it passes; nobody talks over it. The city is the map's own 3D blocks (our street pieces
 * are only round you), in 3D on every phone for these seconds.
 */
async function rideFilm(way: Way, uCar: NonNullable<typeof streetTraffic>['story'][number]) {
  await cine.black(true, 0.35);
  // The real street all along the way, as round you on foot: its buildings, kiosks, people and
  // traffic are built round the car as it goes (the map squares were loaded before the ride).
  story.hidePlayer = true;
  for (let d = 400; d < way.length; d += 300) {
    const q = way.at(d);
    buildings.loadAround(toLngLat(q.x, q.z), 160); // (already loading since Uncle was called)
  }
  await waitUntil(() => !(buildings.loading || epicRoads.loading), 8);
  const added: string[] = [];
  const SPEED = 15;
  // (The first 400 m of the way go up over the Kwame Nkrumah Interchange flyover: the ride starts just
  // past it, down on Ring Road Central, where the car is on the street.)
  // (Owner, 29 Oct 2026: the drive home a real film of the road: four shots, each where the streets are
  // built all round first, with their traffic lights, poles and traffic; 30 Oct: "like 10 seconds" each.)
  const parts: [number, number][] = [
    [620, 10], // from (metres along the way), for (seconds): Ring Road Central, Kokomlemle (past the flyover's foot)
    [1430, 10], // Ring Road Central at its big junction
    [2330, 10], // Nima Roundabout and the clinic
    [Math.max(2650, way.length - 20 - SPEED * 9), 9], // Nima Market, almost home
  ].filter(([from]) => from < way.length - 40) as [number, number][];
  let next = 0;
  while (next < RIDE_SIGNS.length && RIDE_SIGNS[next].at < parts[0][0] - 30) next++; // (Circle's own signs: seen there already)
  uCar.moving = true;
  for (let i = 0; i < parts.length; i++) {
    const [from, LEN] = parts[i];
    let bearing = way.at(from + 20).heading;
    let gone = 0; // metres driven in this part
    let tPrev = 0;
    // Uncle's car is a real driver in the traffic for the ride (owner, 28 Oct 2026: it follows the
    // road, stops at the lights and waits in the queues, never through a car), steered along the real
    // way home at every junction. (Without a traffic lane there, it drives the way by itself.)
    const start = way.at(from);
    // Behind the black: the streets there are built all round first (roads, buildings, kiosks, people,
    // traffic lights and poles), and the traffic fills them, so the shot opens on a real street.
    {
      [state.x, state.z] = [start.x, start.z];
      trafficSim?.fillNow();
      // (On the real clock: behind the black the street runs slowly, and the wait must stay short.)
      const t0 = performance.now();
      while (performance.now() - t0 < 2500 && (performance.now() - t0 < 1000 || buildings.loading || epicRoads.loading)) await new Promise((r) => setTimeout(r, 100));
    }
    const guide: [number, number][] = [];
    for (let k = from; k < Math.min(way.length, from + SPEED * LEN + 400); k += 10) {
      const q = way.at(k);
      guide.push([q.x, q.z]);
    }
    // Its road ahead clear for this shot (still behind the black): it drives on, never through anyone.
    clearStoryPath(guide.slice(0, 14).map(([x, z]) => ({ x, z })), 2.6);
    let simRide = trafficSim?.addStory({ kind: 'car', type: 'car', colour: '#b3261e', x: start.x + Math.cos(start.heading) * 1.8, z: start.z + Math.sin(start.heading) * 1.8, heading: start.heading, back: 0, guide, hurry: true }) ?? null;
    if (simRide !== null) uCar.shown = false;
    let dAt = from;
    const followSim = () => {
      const w = simRide !== null ? trafficSim?.where(simRide) : null;
      if (!w) return null;
      [uCar.x, uCar.z, uCar.heading] = [w.x, w.z, w.heading];
      [state.x, state.z] = [w.x, w.z];
      // How far along the way it has come (for the road and area signs).
      let best = dAt, bestD = Infinity;
      for (let k = dAt - 4; k <= dAt + 40; k += 1) {
        const q = way.at(k);
        const dd = Math.hypot(q.x - w.x, q.z - w.z);
        if (dd < bestD) [best, bestD] = [k, dd];
      }
      dAt = Math.max(dAt, best);
      return dAt;
    };
    const drive = (t: number) => {
      const fromSim = followSim();
      if (fromSim !== null) return fromSim;
      // Gently away at the start of the ride, gently to a stop at the end; an even pace between.
      const pace = Math.min(i === 0 ? Math.min(1, 0.2 + t / 2.5) : 1, i === parts.length - 1 ? Math.max(0.15, Math.min(1, (LEN - t) / 2.5)) : 1);
      // Never into the vehicle ahead: in traffic it slows and waits, like everyone else.
      const look = way.at(from + gone + 6.5);
      const lr = { x: Math.cos(look.heading), z: Math.sin(look.heading) };
      const aheadX = look.x + lr.x * 1.8;
      const aheadZ = look.z + lr.z * 1.8;
      const jam = (streetTraffic?.boxes ?? []).some((b) => !(b.x === uCar.x && b.z === uCar.z) && Math.hypot(b.x - aheadX, b.z - aheadZ) < b.halfW + 1.2);
      gone += (jam ? 0 : SPEED * pace) * Math.max(0, t - tPrev);
      tPrev = t;
      const d = from + gone;
      const p = way.at(d);
      const right = { x: Math.cos(p.heading), z: Math.sin(p.heading) };
      [uCar.x, uCar.z, uCar.heading] = [p.x + right.x * 1.8, p.z + right.z * 1.8, p.heading]; // the right-hand lane
      [state.x, state.z] = [uCar.x, uCar.z]; // (the city is built round you, in the car)
      return d;
    };
    const shoot = (t: number, turn: number) => {
      // Low and close behind the car (over the road, never out over the buildings), swaying a little,
      // turning with the road gently; every other shot from a little more to its side, so the street,
      // its lights and poles go by.
      bearing += angleDiff(uCar.heading, bearing) * turn;
      const b = bearing + 0.16 * Math.sin(t * 0.35 + i * 2) + (i % 2 ? 0.55 : 0);
      story.shot = frameShot(uCar.x, uCar.z, (b * 180) / Math.PI, i % 2 ? 10 : 12, i % 2 ? 74 : 71);
      placeCarTag(uCar.x, uCar.z);
    };
    drive(0);
    bearing = uCar.heading;
    shoot(0, 1);
    await pause(0.15);
    void cine.black(false, 0.7);
    const t0 = gameClock;
    let last = t0;
    let still = 0;
    let d = from;
    // The car and the camera move together, every frame, just before the camera is placed (owner,
    // 30 Oct 2026: the car was shaking; the camera had been moved only every 50 ms).
    story.beforeCam = () => {
      const t = gameClock - t0;
      d = drive(t);
      shoot(t, Math.min(1, (gameClock - last) * 1.4));
      last = gameClock;
    };
    let lastCheck = gameClock;
    while (gameClock - t0 < LEN) {
      const t = gameClock - t0;
      // Never a shot of the car standing for long: stops are a second at most (he goes after 1 s); held
      // up for 2 s anyway, the film cuts to the next shot.
      const st = simRide !== null ? trafficSim?.storyState(simRide) : null;
      still = st && st.v < 0.3 ? still + (gameClock - lastCheck) : 0;
      lastCheck = gameClock;
      // Standing from the very start (his lane of the traffic leads nowhere from there): he drives the
      // way himself instead, from where he is.
      if (simRide !== null && still > 1.2 && dAt - from < 3) {
        trafficSim?.remove_(simRide);
        simRide = null;
        uCar.shown = true;
        gone = dAt - from;
        tPrev = t;
        still = 0;
      }
      if (still > 2 && t > 2.5) break;
      while (next < RIDE_SIGNS.length && d >= RIDE_SIGNS[next].at) rideSign(RIDE_SIGNS[next++]);
      await pause(0.02);
    }
    story.beforeCam = null;
    if (simRide !== null) {
      // (Its pose is kept for the next part, or for the way in at home.)
      trafficSim?.remove_(simRide);
      uCar.shown = true;
    }
    if (i + 1 < parts.length) {
      // Twenty minutes later: the places passed on the way show while the screen is dark.
      carTag.hidden = true;
      await cine.black(true, 0.5);
      const skip = parts[i + 1][0];
      const between: RideSign[] = [];
      while (next < RIDE_SIGNS.length && RIDE_SIGNS[next].at < skip) between.push(RIDE_SIGNS[next++]);
      for (const g of between) rideSign(g);
    }
  }
  while (next < RIDE_SIGNS.length) rideSign(RIDE_SIGNS[next++]);
  carTag.hidden = true;
  for (const id of added) map.removeLayer(id);
}
/**
 * 8. Home at Nima: the screen fades, the streets there load, Uncle's car comes along the road and
 * turns in through the gate to the carport; you both get out and you follow him to your room.
 * Returns false if the house could not be placed. (?scene=nima starts here, for tests.)
 */
async function homeAtNima(uCar: NonNullable<typeof streetTraffic>['story'][number] | null, hometown: string) {
  await cine.black(true, 0.7);
  for (const id of ['buildings', 'roofs']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  buildings.group.visible = true;
  const nima = { x: (-0.1982 - START[0]) * M_LON, z: (START[1] - 5.5813) * M_LAT };
  [state.x, state.z] = [nima.x, nima.z];
  if (uCar) [uCar.x, uCar.z, uCar.shown] = [nima.x, nima.z, false];
  // Every street within 250 m must be known before the house is placed, or it could land on a
  // road from a map square that has not loaded yet.
  buildings.loadAround(toLngLat(nima.x, nima.z), 250);
  await waitUntil(() => !!life?.roadDirNear(nima.x, nima.z, 80, 2), 25);
  await waitUntil(() => !(buildings.loading || epicRoads.loading), 25);
  await pause(0.5);
  const home = placeCompound(nima.x, nima.z);
  storyStep.home = true; // Nima opens on the map
  if (home) {
    // Places in the compound's own frame: u across, v towards the gate (the rooms are at -v).
    const c = Math.cos(home.face);
    const sn = Math.sin(home.face);
    const at = (u: number, v: number) => ({ x: home.x - u * c + v * sn, z: home.z - u * sn - v * c });
    const D = COMPOUND.d / 2;
    const inward = home.face + Math.PI; // facing into the yard, towards the rooms
    [state.x, state.z] = [home.x, home.z];
    story.hidePlayer = true;
    const drive = uCar ? driveIn(home, at) : null;
    if (uCar && drive) {
      uCar.shown = true;
      uCar.moving = true;
      [uCar.x, uCar.z, uCar.heading] = [drive.at(0).x, drive.at(0).z, drive.at(0).heading];
      // (At this cut: the traffic on his way along the road is let go.)
      clearStoryPath(Array.from({ length: Math.ceil(drive.length / 8) + 1 }, (_, k) => drive.at(Math.min(k * 8, drive.length))), 3);
    }
    const gateIn = at(0, D - 2);
    story.shot = frameShot(gateIn.x, gateIn.z, (inward * 180) / Math.PI + 32, 17, 62);
    await pause(0.3);
    await cine.black(false, 0.9);
    placeCard('Nima');
    if (uCar && drive) {
      // Along the road at an easy pace and in through the gate, slowing to a stop under the carport:
      // stopping for anything ahead and for a red light (owner, 28 Oct 2026: never through a car).
      const t0 = gameClock;
      let d = 0;
      let v = 6;
      let last = gameClock;
      while (d < drive.length - 0.05 && gameClock - t0 < 10) {
        const dt = Math.min(0.1, gameClock - last);
        last = gameClock;
        const here = drive.at(d);
        const ahead = drive.at(Math.min(drive.length, d + 3.6));
        const blocked = (trafficSim?.vehicleNear(ahead.x, ahead.z, 1.2) ?? false) || signals.shouldStop(here.x, here.z, here.heading, 2.4, Date.now() / 1000);
        const left = drive.length - d;
        const want = blocked ? 0 : Math.max(0.7, Math.min(9, Math.sqrt(2 * 1.6 * left)));
        v = want < v ? Math.max(want, v - 5 * dt) : Math.min(want, v + 2 * dt);
        d = Math.min(drive.length, d + v * dt);
        const q = drive.at(d);
        [uCar.x, uCar.z, uCar.heading] = [q.x, q.z, q.heading];
        // Following the car in from just behind it, a little to the side, until the gate.
        if (left > 14) story.shot = frameShot(q.x, q.z, (q.heading * 180) / Math.PI + 24, 15, 64);
        else story.shot = frameShot(gateIn.x, gateIn.z, (inward * 180) / Math.PI + 32, 17, 62);
        await pause(0.02);
      }
      const end = drive.at(drive.length);
      [uCar.x, uCar.z, uCar.heading] = [end.x, end.z, end.heading];
      uCar.moving = false;
    }
    // You both get out: Uncle on the driver's side (left), you on the other.
    const right = { x: Math.cos(inward), z: Math.sin(inward) };
    const carAt = at(PARKING.u, PARKING.v);
    // From the side, low enough to see under the carport's roof.
    story.shot = frameShot(carAt.x, carAt.z, (inward * 180) / Math.PI - 90, 7.5, 76);
    uncle.show(carAt.x - right.x * 1.3, carAt.z - right.z * 1.3, inward);
    [state.x, state.z, state.heading, state.camHeading] = [carAt.x + right.x * 1.3, carAt.z + right.z * 1.3, inward, inward];
    story.hidePlayer = false;
    await pause(0.6);
    if (uncle.person) act(uncle.person, 'talk');
    await cine.say('UNCLE KWAME', 'Welcome home. This is our house. Esi! Kofi! Akos! Come, he is here!');
    if (uncle.person) act(uncle.person, 'idle');
    // His wife and children come out of the house to greet you.
    await family.loading;
    const meAt = { x: state.x, z: state.z };
    const toYou = (x: number, z: number) => Math.atan2(meAt.x - x, -(meAt.z - z));
    const spots = [at((VILLA.u0 + VILLA.u1) / 2 + 2.6, VILLA.v1 + 2.4), at((VILLA.u0 + VILLA.u1) / 2 + 4.2, VILLA.v1 + 3.6), at((VILLA.u0 + VILLA.u1) / 2 + 1.6, VILLA.v1 + 3.9)].map((q) => ({ ...q, heading: toYou(q.x, q.z) }));
    family.show(spots);
    story.shot = frameShot((spots[0].x + meAt.x) / 2, (spots[0].z + meAt.z) / 2, (inward * 180) / Math.PI + 200, 9, 72);
    const [esi, kofi, akos] = family.people.map((f) => f.p);
    if (esi) act(esi, 'talk');
    await cine.say('AUNTIE ESI', playerBody === 'female' ? 'Akwaaba! You are welcome, my dear. Kofi, Akos, come and greet your cousin!' : 'Akwaaba! You are welcome, my son. Kofi, Akos, come and greet your cousin!');
    if (esi) act(esi, 'idle');
    if (kofi) act(kofi, 'yes');
    if (akos) act(akos, 'dance');
    await cine.say('KOFI AND AKOS', 'Welcome! Welcome!', 2.2);
    story.pose = 'yes';
    await cine.say('YOU', 'Thank you, Auntie. Medaase.', 2.2);
    story.pose = null;
    if (kofi) act(kofi, 'idle');
    if (akos) act(akos, 'idle');
    story.shot = frameShot(carAt.x, carAt.z, (inward * 180) / Math.PI - 90, 7.5, 76);
    if (uncle.person) act(uncle.person, 'talk');
    await cine.say('UNCLE KWAME', 'Come, let me show you your room. It is at the back.');
    if (uncle.person) act(uncle.person, 'idle');
    // Now you walk: Uncle goes ahead to your door (the middle room at the back) and waits for you;
    // as you come up he steps in, and you follow him inside.
    const doorOut = at(-0.6, -D + 0.13 + 3.4 + 1.3);
    const uIn = at(0.4, -D + 1.2);
    const meIn = at(-0.8, -D + 1.9);
    const youAt = () => {
      const dx = state.x - home.x;
      const dz = state.z - home.z;
      return { u: -(dx * c + dz * sn), v: dx * sn - dz * c };
    };
    story.shot = null;
    cine.end();
    story.frozen = false;
    storyGoal('Follow Uncle Kwame to your room');
    story.target = { x: doorOut.x, z: doorOut.z, who: 'Uncle Kwame', role: 'Your room is at the back', icon: '🏠', label: 'Follow Uncle Kwame to your room', mission: 'CHAPTER 1' };
    void (async () => {
      await uncle.walkTo(at(1.6, PARKING.v - 4).x, at(1.6, PARKING.v - 4).z); // out from under the carport
      await uncle.walkTo(at(0.3, -D + 0.13 + 3.4 + 1.4).x, at(0.3, -D + 0.13 + 3.4 + 1.4).z);
      uncle.face(state.x, state.z);
      await waitUntil(() => Math.hypot(state.x - doorOut.x, state.z - doorOut.z) < 3.2, 900);
      await uncle.walkTo(at(-0.6, -D + 0.13 + 3.4 - 0.5).x, at(-0.6, -D + 0.13 + 3.4 - 0.5).z);
      await uncle.walkTo(uIn.x, uIn.z);
      uncle.face(state.x, state.z);
    })();
    await waitUntil(() => {
      const y = youAt();
      return inYourRoom(y.u, y.v);
    }, 900);
    story.target = null;
    storyGoal('');
    story.frozen = true;
    state.speed = 0;
    cine.begin();
    // A few steps on, right into the room beside him.
    story.autoRun = { x: meIn.x, z: meIn.z, walk: true };
    await waitUntil(() => !story.autoRun || Math.hypot(meIn.x - state.x, meIn.z - state.z) < 0.4, 4);
    story.autoRun = null;
    state.speed = 0;
    await waitUntil(() => !uncle.target, 4);
    if (Math.hypot(meIn.x - state.x, meIn.z - state.z) > 0.6) [state.x, state.z] = [meIn.x, meIn.z]; // (a slow phone: you are in)
    const toUncle = Math.atan2(uIn.x - state.x, -(uIn.z - state.z));
    state.heading = state.camHeading = toUncle; // facing Uncle
    story.roomView = true;
    // Inside the room: looking down into it from above the front wall, the tin roof lifted away.
    const roomMid = at(-0.2, -D + 1.6);
    uncle.face(state.x, state.z);
    story.shot = frameShot(roomMid.x, roomMid.z, (inward * 180) / Math.PI - 15, 3.8, 24);
    if (uncle.person) act(uncle.person, 'talk');
    await cine.say('UNCLE KWAME', 'This is your room. It is small, but it is yours. The mattress is new.');
    story.pose = 'yes';
    await cine.say('YOU', 'Thank you, Uncle. Medaase.');
    story.pose = null;
    await cine.say('UNCLE KWAME', 'Rest well. Tomorrow, we start.');
    if (uncle.person) act(uncle.person, 'idle');
    await cine.title(`Chapter 1 · From ${hometown} to Accra`, 'Uncle Kwame’s compound house, Nima', 3);
    await cine.black(false, 0.9);
  }
  return !!home;
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
/**
 * The camera at a seat inside a car (eye height about 1.25 m), looking out along `heading`: the map's
 * camera looks at a point on the ground a set distance away, so look at the point that puts the
 * camera in the seat.
 */
function seatShot(x: number, z: number, heading: number) {
  const pitch = 84;
  const R = 1.25 / Math.cos((pitch * Math.PI) / 180);
  const D = R * Math.sin((pitch * Math.PI) / 180);
  return { x: x + Math.sin(heading) * D, z: z - Math.cos(heading) * D, bearing: (heading * 180) / Math.PI, zoom: 23.1 - Math.log2(R / 10.7), pitch };
}
/** A straight drive along the nearest road to a point, in its right-hand lane (when no traffic route passes). */
function roadLineNear(x: number, z: number) {
  if (!life) return null;
  const dir = life.roadDirNear(x, z, 40, 2);
  if (dir === null) return null;
  const F = { x: Math.sin(dir), z: -Math.cos(dir) };
  let p = { x, z };
  for (let k = 0; k < 80 && !life.roadAt(p.x, p.z, 0); k++) p = { x: p.x + F.x * 0.5, z: p.z + F.z * 0.5 };
  p = { x: p.x + F.x * 1.6, z: p.z + F.z * 1.6 }; // into the first lane
  // Along the road with the kerb on the right (Ghana drives on the right).
  const heading = dir + Math.PI / 2; // its right side towards the kerb you are on
  const T = { x: Math.sin(heading), z: -Math.cos(heading) };
  return (d: number) => ({ x: p.x + T.x * d, z: p.z + T.z * d, heading });
}
type Lane = (d: number) => { x: number; z: number; heading: number };
type Park = { x: number; z: number; heading: number; d: number; off: number };
/**
 * A parking place for a car off the road on the kerb side of a lane, near a stall (never on the road,
 * in a wall, a kiosk's spot is fine: they move), or else the edge of the lane itself.
 */
function parkingNear(lane: Lane, stall: { x: number; z: number; chair: { x: number; z: number } }): Park {
  const l0 = lane(0);
  const T = { x: Math.sin(l0.heading), z: -Math.cos(l0.heading) };
  const R = { x: Math.cos(l0.heading), z: Math.sin(l0.heading) };
  const d0 = (stall.x - l0.x) * T.x + (stall.z - l0.z) * T.z;
  const clear = (x: number, z: number) => {
    for (const a of [-2.4, -1.2, 0, 1.2, 2.4])
      for (const b of [-1, 0, 1]) {
        const px = x + T.x * a + R.x * b;
        const pz = z + T.z * a + R.z * b;
        if (life?.roadAt(px, pz, 0.1) || buildings.blocked(px, pz, 0.1) || flyovers.lowRampAt(px, pz) || places.solid(px, pz, 0.1)) return false;
        if (Math.hypot(px - stall.x, pz - stall.z) < 1.6 || Math.hypot(px - stall.chair.x, pz - stall.chair.z) < 1.4) return false;
      }
    return true;
  };
  for (const o of [7.5, -7.5, 10, -10, 12.5, -12.5, 5.5, -5.5, 15, -15])
    for (let off = 2.2; off <= 7; off += 0.25) {
      const p = lane(d0 + o);
      const x = p.x + R.x * off;
      const z = p.z + R.z * off;
      if (clear(x, z)) return { x, z, heading: l0.heading, d: d0 + o, off };
    }
  const p = lane(d0 + 7.5);
  return { x: p.x, z: p.z, heading: l0.heading, d: d0 + 7.5, off: 0 };
}
const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
/** A smooth curve from one pose to another (both ends along their headings), for easing in and out of the kerb. */
function easeCurve(a: { x: number; z: number; heading: number }, b: { x: number; z: number; heading: number }) {
  const L = Math.max(1, Math.hypot(b.x - a.x, b.z - a.z));
  const ta = { x: Math.sin(a.heading) * L, z: -Math.cos(a.heading) * L };
  const tb = { x: Math.sin(b.heading) * L, z: -Math.cos(b.heading) * L };
  const pt = (t: number) => {
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return { x: h00 * a.x + h10 * ta.x + h01 * b.x + h11 * tb.x, z: h00 * a.z + h10 * ta.z + h01 * b.z + h11 * tb.z };
  };
  const N = 24;
  const pts = Array.from({ length: N + 1 }, (_, i) => pt(i / N));
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return {
    length: cum[N],
    at(d: number) {
      let i = 1;
      while (i < N && cum[i] < d) i++;
      const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
      const p = pts[i - 1], q = pts[i];
      return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t, heading: Math.atan2(q.x - p.x, -(q.z - p.z)) };
    },
  };
}
/** Along the lane to the parking place, easing over to it in the last 10 m (s ≤ 0; 0 = parked). */
function pullIn(lane: Lane, park: Park, s: number) {
  const p = lane(park.d + s);
  const k = (s + 10) / 10;
  const side = park.off * smooth(k);
  const slope = k > 0 && k < 1 ? (park.off * 6 * k * (1 - k)) / 10 : 0;
  return { x: p.x + Math.cos(p.heading) * side, z: p.z + Math.sin(p.heading) * side, heading: p.heading + Math.atan(slope) };
}
/** From the parking place back into the lane over 12 m, then on along it (s ≥ 0). */
function pullOut(lane: Lane, park: Park, s: number) {
  const p = lane(park.d + s);
  const k = s / 12;
  const side = park.off * (1 - smooth(k));
  const slope = k > 0 && k < 1 ? (park.off * 6 * k * (1 - k)) / 12 : 0;
  return { x: p.x + Math.cos(p.heading) * side, z: p.z + Math.sin(p.heading) * side, heading: p.heading - Math.atan(slope) };
}
/**
 * The way Uncle's car comes home: along the road in the lane on the compound's side, a right turn
 * in through the middle of the gate, and straight on to the carport (never through a wall).
 */
function driveIn(home: { face: number }, at: (u: number, v: number) => { x: number; z: number }) {
  const D = COMPOUND.d / 2;
  const F = { x: Math.sin(home.face), z: -Math.cos(home.face) }; // out of the gate, towards the road
  const gate = at(0, D);
  let k = 0;
  while (k < 14 && !life?.roadAt(gate.x + F.x * k, gate.z + F.z * k, 0)) k += 0.5;
  const lanePt = { x: gate.x + F.x * (k + 1.8), z: gate.z + F.z * (k + 1.8) };
  // Driving on the right, the compound's side of the road is the car's right: it comes along T.
  let T = { x: Math.cos(home.face), z: Math.sin(home.face) };
  const roadBehind = (t: { x: number; z: number }) => [6, 12, 18, 24].filter((j) => life?.roadAt(lanePt.x - t.x * j, lanePt.z - t.z * j, 0.5)).length;
  if (roadBehind(T) < roadBehind({ x: -T.x, z: -T.z })) T = { x: -T.x, z: -T.z };
  // Where the quiet street meets a main road (owner, 28 Oct 2026: he comes along the main road and
  // curves into the side street, never just standing on the road): back along it up to 90 m.
  let lead: { x: number; z: number }[] = [{ x: lanePt.x - T.x * 34, z: lanePt.z - T.z * 34 }, { x: lanePt.x - T.x * 8, z: lanePt.z - T.z * 8 }];
  const street = compound.street;
  if (street && street.toGate.length > 2) {
    // Along the main road in its right-hand lane, a right turn into Uncle's street, along its
    // right-hand side to the gate (6c).
    const m = street.main;
    const g0 = street.toGate[0], g1 = street.toGate[Math.min(2, street.toGate.length - 1)];
    const T0 = { x: g1.x - g0.x, z: g1.z - g0.z };
    let M = { x: m.dx, z: m.dz };
    if (-M.z * T0.x + M.x * T0.z < 0) M = { x: -M.x, z: -M.z };
    const R = { x: -M.z, z: M.x };
    const lane = { x: m.x + R.x * m.half * 0.4, z: m.z + R.z * m.half * 0.4 };
    lead = [{ x: lane.x - M.x * 16, z: lane.z - M.z * 16 }, { x: lane.x - M.x * 6, z: lane.z - M.z * 6 }, lane];
    for (let i = 2; i < street.toGate.length - 2; i++) {
      const p = street.toGate[i], q = street.toGate[i + 1];
      const L = Math.hypot(q.x - p.x, q.z - p.z) || 1;
      lead.push({ x: p.x + (-(q.z - p.z) / L) * 1.4, z: p.z + ((q.x - p.x) / L) * 1.4 }); // (the right-hand side of the street)
    }
  }
  for (let j = 6; j <= 90 && life && !street; j += 2) {
    const p = { x: lanePt.x - T.x * j, z: lanePt.z - T.z * j };
    if (!life.roadAt(p.x, p.z, 0.5)) break; // (the side street ends)
    if (life.roadDirNear(p.x, p.z, 6, 4.5) === null) continue;
    // On the main road: its direction, across the side street's (a right turn into it, Ghana drives on the right).
    const back = { x: lanePt.x - T.x * Math.max(0, j - 10), z: lanePt.z - T.z * Math.max(0, j - 10) };
    const toMain = life.roadDirNear(back.x, back.z, 20, 4.5);
    if (toMain === null) break;
    let M = { x: Math.cos(toMain), z: Math.sin(toMain) }; // along the main road
    if (-M.z * T.x + M.x * T.z < 0) M = { x: -M.x, z: -M.z };
    const centre = { x: p.x - T.x * 3.5, z: p.z - T.z * 3.5 };
    const lane = { x: centre.x + T.x * 2.2, z: centre.z + T.z * 2.2 }; // the right-hand lane, near the side street
    lead = [
      { x: lane.x - M.x * 26, z: lane.z - M.z * 26 },
      { x: lane.x - M.x * 7, z: lane.z - M.z * 7 },
      lane,
      { x: p.x + T.x * 5, z: p.z + T.z * 5 },
    ];
    if (j > 16) lead.push({ x: lanePt.x - T.x * 8, z: lanePt.z - T.z * 8 });
    break;
  }
  const pts = [
    ...lead,
    lanePt,
    at(0, D + Math.min(3, k)),
    at(0, D + 0.4),
    at(0, D - 1.2),
    at(PARKING.u, PARKING.v),
  ];
  // Round off the corner (twice), keeping the ends and the straight run through the gate.
  let line = pts;
  for (let it = 0; it < 2; it++) {
    const out = [line[0]];
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    out.push(line[line.length - 1]);
    line = out;
  }
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
  const length = cum[cum.length - 1];
  return {
    length,
    at: (d: number) => {
      let i = 1;
      while (i < line.length - 1 && cum[i] < d) i++;
      const a = line[i - 1];
      const b = line[i];
      const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, -(b.z - a.z)) };
    },
  };
}
/** A traffic route that passes close to a point (Uncle Kwame drives along it), and where on it. */
function routeNear(x: number, z: number) {
  if (!streetTraffic) return null;
  const cands = streetTraffic
    .storyRoutes()
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
adCard.lite = tier === 'light';
// The player's own adverts (previews): their contact buttons, and their pictures for the cards.
const ownAds = { board: new Map<number, AdContact>(), vehicle: new Map<number, AdContact>(), boardPictures: new Map<number, string>() };
const KIND_NAME: Record<string, string> = { trotro: 'Trotro', bus: 'City bus', truck: 'Truck', taxi: 'Taxi', car: 'Car', pickup: 'Pickup', suv: 'SUV', tricycle: 'Tricycle', okada: 'Okada' };
const tapPoint = new THREE.Vector4();
/** Which advert a sliding advert face shows at this moment (the same sum as its picture, adScreens.ts). */
const liveAd = (first: number, rows: number, period: number) => (first + Math.floor((AD_CLOCK.value + first * 2.9) / period)) % rows;
function tapVehicle(sx: number, sy: number) {
  if (story.frozen || story.shot || story.autoRun || adCard.isOpen) return; // (any time you are walking, also during the story)
  const w = window.innerWidth;
  const h = window.innerHeight;
  const onScreen = (x: number, y: number, z: number) => {
    tapPoint.set(x, y, z, 1).applyMatrix4(camera3d.projectionMatrix);
    if (tapPoint.w <= 0) return null;
    return [((tapPoint.x / tapPoint.w + 1) / 2) * w, ((1 - tapPoint.y / tapPoint.w) / 2) * h] as const;
  };
  // A vehicle (moving or not) near where you tapped...
  let best: { p: NonNullable<typeof streetTraffic>['placed'][number]; d: number } | null = null;
  for (const p of streetTraffic?.placed ?? []) {
    if (p.bridge) continue;
    const [x, z] = [(p.lon - START[0]) * M_LON, (START[1] - p.lat) * M_LAT];
    if (Math.hypot(x - state.x, z - state.z) > 70) continue;
    const q = onScreen(x, 1.3, z);
    if (!q) continue;
    const d = Math.hypot(q[0] - sx, q[1] - sy);
    if (d < 90 && (!best || d < best.d)) best = { p, d };
  }
  // ... or a billboard's advert (on its legs or on a roof).
  let board: { ad: number; x: number; z: number; d: number } | null = null;
  for (const [list, high, half] of [[life?.boards.all ?? [], 5.0, 2.0], [life?.roofBoards.all ?? [], 5.6, 2.4]] as const) {
    for (const b of list) {
      if (Math.hypot(b.x - state.x, b.z - state.z) > 90) continue;
      const y = ((b as { y?: number }).y ?? 0) + high;
      const c = onScreen(b.x, y, b.z);
      const top = onScreen(b.x, y + half, b.z);
      if (!c || !top) continue;
      const reach = Math.max(40, Math.abs(c[1] - top[1]) * 1.6); // about the poster's size on screen
      const d = Math.hypot(c[0] - sx, c[1] - sy);
      if (d < reach && (!board || d < board.d)) board = { ad: b.colour % AD_COUNT, x: b.x, z: b.z, d };
    }
  }
  if (board && (!best || board.d < best.d)) {
    const { lng, lat } = lngLatOf(board.x, board.z);
    openBoardCard(liveAd(board.ad, AD_COUNT, 7), placeLabel.textContent ?? '', lng, lat, false);
    return;
  }
  if (!best || !streetTraffic) return;
  const info = streetTraffic.vehicleInfo(best.p.v);
  const name = KIND_NAME[best.p.v.kind] ?? 'Vehicle';
  // Every vehicle opens the card (owner, 28 Oct 2026: never "no advert space"): one with no advert of its
  // own starts at a free space in the same set, where your advert can go.
  if (info.ad === null) info.ad = best.p.v.id % AD_ROWS;
  // The card shows every advert that rides the city's vehicles, starting with the one on this one
  // now; the vehicle carries on driving (owner, 28 Oct 2026: it "doesn't affect the cars movement").
  const traffic = streetTraffic;
  const shape = traffic.adShapeOf(info.key);
  adCard.open({
    kind: 'vehicle',
    title: shape === 'roof' ? `${name} · roof screen, both sides` : `${name} · full-side advert, both sides`,
    picture: traffic.vehicleAdPicture(info.ad, shape),
    aspect: AD_ASPECT[shape],
    place: vehiclePlace(best.p.v.kind),
    note: shape === 'roof' ? 'Every taxi carries a bright screen on its roof, seen from both sides all over the city. Each advert shows for a few seconds, then the next.' : 'Adverts ride trotros, buses and lorries on their real routes all day, past everyone on the road. Each one changes every few seconds.',
    own: ownAds.vehicle.get(info.ad) ?? null,
    slides: Array.from({ length: AD_ROWS }, (_, r) => ({ picture: traffic.vehicleAdPicture(r, shape), own: ownAds.vehicle.get(r) ?? null })),
    start: liveAd(info.ad, AD_ROWS, 8),
    preview: () => undefined,
    previewAt: (row, draw, contact) => {
      traffic.previewAd(row, draw);
      ownAds.vehicle.set(row, contact);
    },
  });
}
function openBoardCard(ad: number, place: string, lng: number, lat: number, fromMap = true) {
  if (fromMap) fullMap.close();
  // Its price comes from where it stands: the airport, a busy station or market, a main road or a side street.
  const [bx, bz] = [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT];
  const spots = places.list();
  const near = (kinds: string[], m: number) => spots.some((p) => kinds.includes(p.kind) && Math.hypot(p.x - bx, p.z - bz) < m) || (!!station && kinds.includes('LORRY STATION') && Math.hypot(station.x - bx, station.z - bz) < m);
  const where = billboardPlace(lng, lat, life?.roadDirNear(bx, bz, 16, 4.5) !== null && life?.roadDirNear(bx, bz, 16, 4.5) !== undefined, near);
  adCard.open({
    kind: 'billboard',
    title: `Billboard · ${place || 'Accra'}`,
    picture: ownAds.boardPictures.get(ad) ?? adThumb(ad, 512),
    place: where,
    note: `Shared with ${AD_COUNT - 1} other adverts: each shows for 7 seconds, then slides to the next. Seen from both sides of the road.`,
    own: ownAds.board.get(ad) ?? null,
    preview: () => undefined,
    // Every advert that takes turns on the billboards: swipe through them all.
    slides: Array.from({ length: AD_COUNT }, (_, i) => ({ picture: ownAds.boardPictures.get(i) ?? adThumb(i, 512), own: ownAds.board.get(i) ?? null })),
    start: ad,
    previewAt: (i, draw, contact) => {
      life?.previewAd(i, draw);
      ownAds.board.set(i, contact);
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 288;
      draw(c.getContext('2d')!, 0, 512, 288);
      ownAds.boardPictures.set(i, c.toDataURL('image/webp', 0.85));
    },
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
    open: [
      { ...lngLatOf(0, 0), radius: OPEN_RADIUS_M, name: 'Circle' },
      ...(storyStep.home ? [{ lng: -0.1982, lat: 5.5813, radius: 800, name: 'Nima' }] : []),
    ],
    player: { name: dayName, home: homeTown, energy: me.energy, vibe: me.vibe, money: cashNow, mission: t?.mission ?? '' },
    places: list,
    areas: PLACES.map((a) => ({ name: a.name, lng: a.at[0], lat: a.at[1] })),
    cars: () => (streetTraffic?.placed ?? []).map((p) => ({ id: p.v.id, lng: p.lon, lat: p.lat, kind: p.v.kind, heading: p.heading })),
    here: placeLabel.textContent ?? '',
    boards: (life?.boards.all ?? []).filter((b) => Math.hypot(b.x - state.x, b.z - state.z) < 700).map((b) => ({ ...lngLatOf(b.x, b.z), ad: b.colour % AD_COUNT })),
    adPicture: (n) => adThumb(n, 160),
    openAd: (n, lng, lat) => openBoardCard(n, placeLabel.textContent ?? '', lng, lat),
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
  say: (text) => new Promise((r) => setTimeout(r, Math.max(1600, 700 + text.length * 55))), // (time to read it)
  toMe,
  stopTalking: () => undefined,
  nickname: () => 'Newcomer',
  storyDone: (step) => (step === 'auntie' ? storyStep.auntie : false),
  muted: () => streetSound.muted,
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
const pendingBatches: { pts: [number, number][]; lanes: 1 | 2; half: number; bridge: boolean; oneway?: boolean }[][] = [];
const simBatches: typeof pendingBatches = [];
let trafficSim: TrafficSim | null = null;
const buildings = new StreetBuildings(
  (lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT],
  { light: 220, standard: 320, ultra: 450 }[tier],
  (roads, roofs, pois, rails) => {
    // The railway first, so nothing is placed on the track.
    railway.add(rails);
    life?.addRails(rails);
    life?.add(roads, roofs);
    // The roads themselves, in the Epic City pack's design (tarmac, kerbs, pavements, lines).
    epicRoads.add(roads);
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
        oneway: !!r.oneway,
      }));
    if (trafficModel) trafficModel.addRoads(batch);
    else pendingBatches.push(batch);
    if (trafficSim) trafficSim.addRoads(batch);
    else simBatches.push(batch);
  },
);
// The pack buildings near you (6b): how far, and how many (Light / Standard / Ultra).
[buildings.packRadius, buildings.packLimit] = { light: [42, 24], standard: [90, 80], ultra: [140, 180] }[tier] as [number, number];
scene.add(buildings.group);
life = new StreetLife((x, z, m) => buildings.blocked(x, z, m), { ...{
  // Packed, chaotic Circle (owner, 2026-10-27: "very crowded", kiosks and stalls everywhere).
  // On a struggling phone the walkers thin out automatically (busy %), the shops stay.
  // still: people standing about on top of the walkers (idling and chatting).
  light: { radiusM: 140, people: 170, props: 520, scenes: 42, still: 50 },
  standard: { radiusM: 200, people: 520, props: 1300, scenes: 100, still: 160 },
  ultra: { radiusM: 280, people: 850, props: 2000, scenes: 150, still: 260 },
}[tier], smoothCrowd: PRESET.smoothCrowd, light: tier === 'light' });
scene.add(life.group);
life.groundDip = (x, z) => epicRoads.dipAt(x, z); // walkers step down onto the tarmac
// The sound of Accra (starts on the first tap), with a button to switch it off.
const streetSound = new StreetSound();
/** Where trotro mates call from: trotros passing, the lorry station, bus stops (ids: <0 for places). */
let mateSpotCache: { at: number; list: { x: number; z: number; id: number }[] } = { at: -1, list: [] };
function mateSpots() {
  const now = performance.now();
  const moving = (streetTraffic?.placed ?? []).filter((p) => p.v.kind === 'trotro' && !p.bridge).map((p) => ({ x: (p.lon - START[0]) * M_LON, z: (START[1] - p.lat) * M_LAT, id: p.v.id }));
  if (now - mateSpotCache.at > 2000) {
    const fixed: { x: number; z: number; id: number }[] = [];
    if (station) fixed.push({ x: station.x, z: station.z, id: -1 });
    places.list().forEach((q, i) => q.kind === 'BUS STOP' && Math.hypot(q.x - state.x, q.z - state.z) < 90 && fixed.push({ x: q.x, z: q.z, id: -10 - i }));
    mateSpotCache = { at: now, list: fixed };
  }
  return [...moving, ...mateSpotCache.list];
}
// A voice calls out in one of the owner's recordings: someone in the game does it at the same moment.
// A mate's call comes from the trotro it is playing from; the street's voices from people round you.
streetSound.onCall = (c) => {
  const t = performance.now() / 1000;
  const seconds = Math.max(2.4, c.seconds + 1.2);
  if (c.kind === 'mates' && c.from) {
    // At the lorry station, one of its mates calls (and waves people over); on a trotro, its mate.
    const m = c.from.id === -1 && station ? station.people.find((q) => q.words) : null;
    if (m?.words) showBubble(m.x, m.z, 1.95, `📣 ${m.words[Math.floor(Math.random() * m.words.length)]}`, seconds);
    else showBubble(c.from.x, c.from.z, c.from.id !== undefined && c.from.id < 0 ? 2.1 : 2.7, `📣 ${mateCall((c.from.id ?? 0) * 31 + Math.floor(t))}`, seconds);
  } else if (c.kind === 'street' && !story.frozen) {
    const who = life?.scenes?.talkNear(state.x, state.z, t, Math.max(2, c.seconds + 1));
    if (who) showBubble(who.x, who.z, who.height, CHATTER[Math.floor(Math.random() * CHATTER.length)], seconds);
  }
};
const music = new FilmMusic('/music/arrival.mp3');
const soundButton = document.getElementById('btn-sound')!;
soundButton.addEventListener('click', () => {
  streetSound.setMuted(!streetSound.muted);
  music.setMuted(streetSound.muted);
  soundButton.classList.toggle('off', streetSound.muted);
});

function showBubble(x: number, z: number, height: number, text: string, seconds = 2.6) {
  if (story.fly) return; // (nobody's words over the camera coming down from the sky)
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = forTheHour(text, day.hour);
  document.body.appendChild(el);
  bubbles.push({ el, at: new THREE.Vector3(x, height + 0.25, z), until: performance.now() / 1000 + seconds });
}

// The street's voices: bus mates hanging out of passing trotros shout their routes, the station's
// mates call, and now and then someone nearby calls out.
let nextShout = 0;
function streetVoices(t: number) {
  // What people say shows in speech bubbles (words only). The voices you hear are the owner's Accra
  // recordings.
  if (t < nextShout || chatting || story.frozen) return;
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
    return;
  }
  // Near the station: one of its mates.
  if (station && Math.hypot(station.x - state.x, station.z - state.z) < 45) {
    const mates = station.people.filter((q) => q.words);
    const m = mates[Math.floor(Math.random() * mates.length)];
    if (m?.words) {
      const line = m.words[Math.floor(Math.random() * m.words.length)];
      showBubble(m.x, m.z, 1.95, line);
      return;
    }
  }
  // Otherwise: people chatting as they pass.
  const w = life?.nearestWalker(state.x, state.z, 14);
  if (w) {
    const line = CHATTER[Math.floor(Math.random() * CHATTER.length)];
    showBubble(w.x, w.z, w.height, line);
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
const railway = new Railway();
scene.add(railway.group);
flyovers.maxLamps = { light: 40, standard: 90, ultra: 140 }[tier];
scene.add(flyovers.group);
const epicRoads = new EpicRoads();
epicRoads.showRadius = { light: 260, standard: 380, ultra: 550 }[tier];
scene.add(epicRoads.group);
const groundDip = (x: number, z: number) => epicRoads.dipAt(x, z);

// Traffic lights and zebra crossings at the big junctions (vehicles stop on red).
const signals = new Signals();
scene.add(signals.group);
// No pole on the road: not on any tarmac (junction corners included), not in a ramp, not right at the kerb.
signals.blocked = (x, z) => epicRoads.roadAt(x, z, 0.25) || flyovers.lowRampAt(x, z);

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
      return skipStory ? { body: female ?? 'male', hometown: 'Ada' } : startScreen({ body: female }, (picked) => {
            // Black in the same moment as the tap: no glimpse of Circle (or a helicopter) before the film.
            cine.coverNow();
            (window as Window & { __goFull?: () => void }).__goFull?.(); // (full screen again, if it was left)
            cine.prepareVideo(FILM, '/film/opening-poster.jpg'); // (downloading since the page opened; unlocked here, in the tap)
            music.play(2); // the music from the first card (started in the tap: phones allow sound only then)
            earlyFilm = playFilm(picked.hometown, picked.body); // the opening starts now, while the city and the people load
          });
    })(),
    new Promise<void>((r) => map.once('load', () => r())),
  ]);
  playerBody = choice.body;
  homeTown = choice.hometown;
  // Day name from the day you arrive (brief 5.3).
  dayName = dayNameFor(choice.body);
  const [player] = await Promise.all([loadPlayer(choice.body), skipStory ? null : loadThief(), skipStory ? null : auntie.load(), skipStory ? null : uncle.load(), skipStory ? null : family.load()]);
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
  // Only our own places and signs in the game: the base map's business names are hidden.
  for (const l of map.getStyle().layers) if ((l as { 'source-layer'?: string })['source-layer'] === 'pois') map.setLayoutProperty(l.id, 'visibility', 'none');
  for (const id of ['buildings', 'roofs']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  map.addLayer(layer);
  // At night the map's flat ground (far roads and open ground) is darkened by a sheet over it.
  map.addSource('night-dim', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-0.6, 5.2], [0.3, 5.2], [0.3, 6.0], [-0.6, 6.0], [-0.6, 5.2]]] } } });
  map.addLayer({ id: 'night-dim', type: 'fill', source: 'night-dim', paint: { 'fill-color': '#0b1226', 'fill-opacity': 0 } }, 'street-3d');
  // The whole city lit at night, seen from the sky as the camera comes down (owner, 29 Oct 2026: not
  // only Circle): every road glows sodium orange, with the dots of its street lamps along it.
  const bigRoads: maplibregl.ExpressionSpecification = ['in', ['get', 'kind'], ['literal', ['highway', 'major_road', 'minor_road']]];
  const byKind = (hi: number, major: number, minor: number): maplibregl.ExpressionSpecification => ['match', ['get', 'kind'], 'highway', hi, 'major_road', major, minor];
  map.addLayer({
    id: 'night-roads', type: 'line', source: 'accra', 'source-layer': 'roads', filter: bigRoads, layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get', 'kind'], 'highway', '#ffb54a', 'major_road', '#ffa94d', '#ff9a5c'],
      'line-width': ['interpolate', ['exponential', 2], ['zoom'], 11, ['*', 0.5, byKind(5, 3.5, 1.6)], 17, ['*', 16, byKind(5, 3.5, 1.6)]],
      'line-blur': ['interpolate', ['exponential', 2], ['zoom'], 11, 2, 17, 40],
      'line-opacity': 0,
    },
  }, 'street-3d');
  map.addLayer({
    id: 'night-lamps', type: 'line', source: 'accra', 'source-layer': 'roads', filter: bigRoads, layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#fff0c2', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 16, 3.5], 'line-dasharray': [0.1, 9], 'line-opacity': 0 },
  }, 'street-3d');
  // The map's blocks stand above the night's dark sheet, so their lights show from the sky.
  for (const id of ['buildings', 'roofs', 'ride-buildings', 'ride-roofs']) if (map.getLayer(id)) map.moveLayer(id, 'street-3d');
  // The sky and light for the time now (Accra time), then kept up to date.
  applyDayLook(true);
  map.setLight({ anchor: 'map', color: '#ffe2bd', intensity: 0.45, position: [1.4, 265, 35] });
  // Real 3D vehicles at street level (the overview map's blocks are not used here).
  {
    // Spacing and drawing distance are set so the vehicles near you stay well under the limit:
    // nothing pops in or out close by (it only happens far away, out of sight).
    // (Closer spacing than before: the hour of the day decides how many of the places are filled, roadFill.)
    const traffic = createStreetNetwork({ light: 1.9, standard: 1.5, ultra: 1.2 }[tier]);
    trafficModel = traffic;
    for (const b of pendingBatches.splice(0)) traffic.addRoads(b);
    // Busy roads (raised from the first budget of 15 / 40 / 100: they are drawn in batches, so they cost little).
    const limit = { light: 260, standard: 420, ultra: 560 }[tier]; // (well above what is ever near you: nothing blinks out)
    streetTraffic = new StreetTraffic(traffic, (lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT], limit, { light: 105, standard: 170, ultra: 220 }[tier]);
    scene.add(streetTraffic.group);
    streetTraffic.deckHeight = (x, z) => flyovers.heightAt(x, z);
    streetTraffic.groundDip = groundDip;
    streetTraffic.lowRamp = (x, z) => flyovers.lowRampAt(x, z);
    streetTraffic.signals = signals;
    if (life) life.vehicleAt = vehicleAt;
    streetTraffic.onBlocked = onVehicleBlocked;
    // The drivers: every vehicle drives by the traffic rules (trafficSim.ts), on all the streets loaded.
    const toLngLat = (x: number, z: number): [number, number] => [START[0] + x / M_LON, START[1] - z / M_LAT];
    trafficSim = new TrafficSim((lng, lat) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT], toLngLat, { light: { max: 280, radius: 135, seen: 112 }, standard: { max: 650, radius: 200, seen: 170 }, ultra: { max: 900, radius: 260, seen: 220 } }[tier]);
    for (const b of simBatches.splice(0)) trafficSim.addRoads(b);
    // Strict (owner, 28 Oct 2026): no lane on the ground runs under a low flyover ramp or through a
    // building; such lanes are never used. Checked again as more flyovers and buildings load.
    trafficSim.blocked = (x, z) => flyovers.lowRampAt(x, z) || buildings.deepInside(x, z, 0.8);
    trafficSim.redLight = (x, z, heading) => {
      // A traffic light at the junction this lane runs into: red or amber means stop at its line.
      const fx = Math.sin(heading), fz = -Math.cos(heading);
      for (const j of signals.junctions) {
        const dx = j.x - x, dz = j.z - z;
        if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue;
        const along = dx * fx + dz * fz;
        if (along < 0 || Math.abs(dx * -fz + dz * fx) > j.half + 3) continue;
        const light = lightFor(j, heading, Date.now() / 1000);
        return { stop: light !== 'green', extra: Math.max(0, stopLineAt(j) - along) };
      }
      return null;
    };
    streetTraffic.sim = trafficSim;
    void loadDriver();
    if (debug) Object.assign(window, { __street: { state, sky, look, life, story, thief, signals, lightFor, flyovers, pinch, bigScreen, roadSigns, getStation: () => station, places, fuelWhy, bag, driver, shove, uncle, compound, props, camera3d, adCard, frameShot, placeCompound, buildings, nimaRoute, rideSign, RIDE_SIGNS, map, placeCarTag, fullMap, phone, camAvoid, camAt, viewBlocked, heightAtView, solidAt, traffic: streetTraffic, railway, driveIn, parkingNear, pullIn, pullOut, roadLineNear, compoundAt, music, streetSound, epicRoads, THREE, horns: () => hornsPlayed, people: () => ({ player: playerPerson, thief: thief.person, auntie, uncle }), vehicleAt: (x: number, z: number, r: number) => vehicleAt(x, z, r), placesSolid: (x: number, z: number, r: number) => places.solid(x, z, r), trafficSim: () => trafficSim, toLocal: (lng: number, lat: number) => [(lng - START[0]) * M_LON, (START[1] - lat) * M_LAT] } });
  }

  // The dark loading screen is the curtain over the city. Without the story it goes now; with the story
  // it stays under the start screen, the black and the film until the story itself shows the city (the
  // camera coming down over Circle), so no moment of the city can ever show early, however the film,
  // the black and the loading line up on a phone (owner, 29 Oct 2026: "flashes… permanently").
  if (skipStory || params.get('scene')) liftCurtain();
  startedAt = performance.now();
  if (skipStory) {
    setMoney(0);
    storyStep.auntie = true;
    setTimeout(() => (help.style.opacity = '0'), 7000);
  } else if (params.get('scene') === 'nima' || params.get('scene') === 'ride') {
    // (Tests: straight to the arrival at Uncle Kwame's compound.)
    help.style.opacity = '0';
    void (async () => {
      setMoney(0);
      storyStep.auntie = true;
      story.busy = story.frozen = true;
      await waitUntil(() => !!streetTraffic && !!uncle.person, 30);
      const uCar = { key: 'car' as const, kind: 'car' as const, id: 900002, x: 0, z: 0, heading: 0, colour: '#b3261e', shown: false, moving: false };
      streetTraffic?.story.unshift(uCar);
      cine.begin();
      if (params.get('scene') === 'ride') {
        uCar.shown = true;
        const way = await nimaRoute;
        if (way) await rideFilm(way, uCar);
      }
      const home = await homeAtNima(uCar, choice.hometown);
      story.hidePlayer = false;
      story.roomView = false;
      story.shot = null;
      cine.end();
      stopDoing();
      if (home) missionCard('Chapter 1', 'Fresh in Accra', 'Coming soon: Welcome Chop, your first mission in the compound');
      story.frozen = false;
      story.busy = false;
      storyGoal('');
    })();
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
    // While the film or the black covers the city, the street runs 5 times a second (it keeps loading
    // and the story keeps time, but nothing is drawn that nobody sees): the film plays smoothly.
    // (Not while skipping: then the scene runs on behind the black at about 6 times its speed.)
    const fast = cine.fastForward;
    if (cine.covering && !fast && now - last < 200) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (fast) for (let i = 0; i < 6; i++) step(player, 0.05, now / 1000 + i * 0.05);
    else step(player, dt, now / 1000);
  };
  requestAnimationFrame(loop);

  if (autoTest) runAutoTest();
  // Busy, but never slow: every 2 seconds, if the frame rate is low, show fewer people and vehicles;
  // if there is room to spare, bring them back (master plan: draw less when a phone struggles).
  if (params.has('fps') || debug) debugLine.hidden = false; // (the frame rate on screen only when asked for: ?fps or ?debug)
  if (!params.has('full')) {
    let density = 1;
    const baseLimit = { light: 100, standard: 170, ultra: 260 }[tier];
    for (;;) {
      const fps = await measureFps(2);
      // Measured against this phone's own frame cap (30 on Light, 60 on others): fewer only when it
      // really struggles, and back up again as soon as it copes (before, a Light phone capped at 30
      // could never get back above 48, so after one slow moment its streets stayed empty for good).
      const cap = PRESET.fps;
      if (fps < cap * 0.72 && density > 0.3) density *= 0.8;
      else if (fps > cap * 0.9 && density < 1) density = Math.min(1, density * 1.15);
      // The crowd stays (owner: people must not disappear): a struggling phone thins it only a little,
      // a struggling Light phone a little more (owner, 29 Oct 2026: "no lags").
      life?.setDensity(Math.max(tier === 'light' ? 0.65 : 0.85, density));
      // Vehicles are cheap to draw (a few batches): the roads always stay at least three-quarters full.
      // Rush hours fill the roads; a struggling phone thins them a little (never below three-quarters).
      if (streetTraffic) streetTraffic.density = roadFill(day.hour) * Math.max(0.75, density);
      if (trafficSim) trafficSim.fill = roadFill(day.hour) * Math.max(0.75, density);
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
