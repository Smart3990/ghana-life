// Test 1b (master plan): can this phone draw 10, 20 and 30 animated low-poly 3D characters
// over the map? The result decides whether Standard and Ultra show real 3D characters for the
// nearest few players, or whether 3D stays in close-up scenes only.
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { createMap } from '../map/createMap';

const ORIGIN: [number, number] = [-0.1927, 5.5476]; // Black Star Square
const SIZE = 3; // drawn larger than life so they read at street-level zoom, like the vehicles
const COUNTS = [10, 20, 30];
const WARM_UP_MS = 1500;
const MEASURE_MS = 5000;

const map = createMap(document.getElementById('map')!, 'standard', { center: ORIGIN, zoom: 18.3, pitch: 65, bearing: -8 });

// One low-poly person: head, body, arms and legs as separate moving parts.
// Rounded parts are built with enough segments to land near the plan's per-body budget.
function makePerson(shirt: number): { group: THREE.Group; limbs: THREE.Object3D[] } {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0x6b4429 });
  const cloth = new THREE.MeshLambertMaterial({ color: shirt });
  const trousers = new THREE.MeshLambertMaterial({ color: 0x2d2a26 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 8, 24), cloth);
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), skin);
  head.position.y = 1.65;
  group.add(body, head);
  const limb = (x: number, y: number, length: number, material: THREE.Material) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, length, 6, 16), material);
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  };
  const limbs = [
    limb(-0.1, 0.85, 0.75, trousers), // left leg
    limb(0.1, 0.85, 0.75, trousers), // right leg
    limb(-0.3, 1.4, 0.55, skin), // left arm
    limb(0.3, 1.4, 0.55, skin), // right arm
  ];
  group.scale.setScalar(SIZE);
  return { group, limbs };
}

type Walker = { person: ReturnType<typeof makePerson>; radius: number; speed: number; phase: number };

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(30, 80, 40);
scene.add(sun);
const walkers: Walker[] = [];
const SHIRTS = [0xe8b10d, 0x0e7a3e, 0xc8102e, 0x2f6fd0, 0x7b3fa0, 0xf08a24];

function setCount(n: number) {
  while (walkers.length < n) {
    const i = walkers.length;
    const person = makePerson(SHIRTS[i % SHIRTS.length]);
    scene.add(person.group);
    walkers.push({ person, radius: 15 + (i % 6) * 12, speed: 1.2 + (i % 4) * 0.25, phase: i * 0.7 });
  }
  walkers.forEach((w, i) => (w.person.group.visible = i < n));
}

// Draws the three.js scene inside the map, positioned in metres around Black Star Square.
const origin = maplibregl.MercatorCoordinate.fromLngLat(ORIGIN, 0);
const metre = origin.meterInMercatorCoordinateUnits();
let renderer: THREE.WebGLRenderer;
const camera = new THREE.Camera();
const start = performance.now();

const layer: maplibregl.CustomLayerInterface = {
  id: 'characters',
  type: 'custom',
  renderingMode: '3d',
  onAdd(m, gl) {
    renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
    renderer.autoClear = false;
  },
  render(_gl, args) {
    const t = (performance.now() - start) / 1000;
    for (const w of walkers) {
      if (!w.person.group.visible) continue;
      const a = w.phase + (t * w.speed) / w.radius;
      w.person.group.position.set(Math.cos(a) * w.radius, 0, Math.sin(a) * w.radius);
      w.person.group.rotation.y = -a; // face the way they walk
      const swing = Math.sin(t * 7 + w.phase) * 0.6;
      const [leftLeg, rightLeg, leftArm, rightArm] = w.person.limbs;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.8;
      rightArm.rotation.x = swing * 0.8;
    }
    const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
    const place = new THREE.Matrix4()
      .makeTranslation(origin.x, origin.y, origin.z)
      .scale(new THREE.Vector3(metre, -metre, metre))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    camera.projectionMatrix = projection.multiply(place);
    renderer.resetState();
    renderer.render(scene, camera);
    map.triggerRepaint();
  },
};

function measureFps(ms: number): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const begin = performance.now();
    const tick = (now: number) => {
      frames++;
      if (now - begin < ms) requestAnimationFrame(tick);
      else resolve((frames * 1000) / (now - begin));
    };
    requestAnimationFrame(tick);
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runAll() {
  const button = document.getElementById('run-all') as HTMLButtonElement;
  button.disabled = true;
  const results: Record<number, number> = {};
  for (const n of COUNTS) {
    setCount(n);
    document.getElementById(`fps-${n}`)!.textContent = 'measuring…';
    await wait(WARM_UP_MS);
    results[n] = await measureFps(MEASURE_MS);
    const triangles = renderer.info.render.triangles;
    document.getElementById(`fps-${n}`)!.textContent = `${Math.round(results[n])} fps (${Math.round(triangles / n)} triangles each)`;
  }
  const verdict = document.getElementById('verdict')!;
  verdict.textContent = results[10] >= 28
    ? 'Result: real 3D characters are possible for the nearest few players on Standard and Ultra.'
    : 'Result: keep 3D characters for close-up scenes only on this phone.';
  verdict.style.color = results[10] >= 28 ? '#0e7a3e' : '#c8102e';
  (document.body.dataset as Record<string, string>).result = JSON.stringify(results);
  button.disabled = false;
  button.textContent = 'Run again';
}

const nav = navigator as Navigator & { deviceMemory?: number };
document.getElementById('device')!.textContent =
  `This device: ${nav.deviceMemory ? `about ${nav.deviceMemory} GB memory, ` : ''}${navigator.hardwareConcurrency ?? '?'} CPU cores, screen ${screen.width}×${screen.height}.`;

map.on('load', () => {
  map.addLayer(layer);
  setCount(COUNTS[0]);
  document.getElementById('run-all')!.addEventListener('click', runAll);
  if (new URLSearchParams(location.search).has('auto')) runAll();
});
