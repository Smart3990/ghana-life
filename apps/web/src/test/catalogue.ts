// Model catalogue (step 1 of the Epic City plan): every model from the Low Poly Epic City pack the
// owner bought, converted for the game. Tap a picture to spin the model in 3D, see it by day or by
// night (the pack's own night glow), and play the people's walk, run and idle animations.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Model = { name: string; group: string; file: string; size: [number, number, number]; min: number[]; tris: number; parts: number; skinned: boolean };
type List = { animations: { name: string; seconds: number }[]; models: Model[] };

const BASE = '/models/epic/';
const GROUP_NAMES: Record<string, string> = {
  vehicles: 'Vehicles', buildings: 'Buildings', people: 'People', props: 'Street things',
  'tiles/roads': 'Roads', 'tiles/bridges': 'Bridges and flyovers', 'tiles/rails': 'Railway', 'tiles/runway': 'Airport runway',
  'tiles/race': 'Race track', 'tiles/tunnels': 'Tunnels', 'tiles/tile-buildings': 'Building plots', tiles: 'Ground tiles',
  nature: 'Nature', 'nature/trees': 'Trees', 'nature/clouds': 'Clouds', 'nature/flowers': 'Flowers', 'nature/grass': 'Grass', 'nature/stones': 'Stones',
  beach: 'Beach', farm: 'Farm', military: 'Military buildings', racing: 'Racing', terrains: 'Hills and mountains',
};
const label = (g: string) => GROUP_NAMES[g] ?? g.replace(/\//g, ' · ');
const top = (g: string) => (g.startsWith('tiles') ? 'tiles' : g.startsWith('nature') ? 'nature' : g);
const TOP_NAMES: Record<string, string> = { tiles: 'Roads and tiles', nature: 'Nature' };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const list = (await (await fetch(BASE + 'list.json')).json()) as List;
const models = list.models.filter((m) => !('error' in m));
const tops = [...new Set(models.map((m) => top(m.group)))].sort((a, b) => (a === 'vehicles' ? -1 : b === 'vehicles' ? 1 : a.localeCompare(b)));
let filter = 'all';
let query = '';

$('count').textContent = `${models.length} models · Low Poly Epic City by Polyperfect · bought by the owner (licence kept privately)`;
const chips = $('chips');
for (const t of ['all', ...tops]) {
  const b = document.createElement('button');
  const n = t === 'all' ? models.length : models.filter((m) => top(m.group) === t).length;
  b.className = 'chip' + (t === filter ? ' on' : '');
  b.textContent = `${t === 'all' ? 'All' : TOP_NAMES[t] ?? label(t)} ${n}`;
  b.onclick = () => { filter = t; chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); b.classList.add('on'); draw(); };
  chips.append(b);
}
$<HTMLInputElement>('search').oninput = (e) => { query = (e.target as HTMLInputElement).value.trim().toLowerCase(); draw(); };

function draw() {
  const main = $('list');
  main.innerHTML = '';
  const shown = models.filter((m) => (filter === 'all' || top(m.group) === filter) && (!query || m.name.includes(query) || m.group.includes(query)));
  const groups = [...new Set(shown.map((m) => m.group))].sort((a, b) => tops.indexOf(top(a)) - tops.indexOf(top(b)) || a.localeCompare(b));
  for (const g of groups) {
    const h = document.createElement('h2');
    const items = shown.filter((m) => m.group === g);
    h.textContent = `${label(g)} (${items.length})`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const m of items) {
      const c = document.createElement('div');
      c.className = 'card';
      c.innerHTML = `<img loading="lazy" alt="" src="${BASE}thumbs/${m.name}.webp"><b>${m.name.replace(/-/g, ' ')}</b><span>${fmtSize(m)}</span>`;
      c.onclick = () => open(m);
      grid.append(c);
    }
    main.append(h, grid);
  }
  if (!shown.length) main.innerHTML = '<p class="note">Nothing matches that search.</p>';
}
const fmtSize = (m: Model) => `${m.size[0]} × ${m.size[2]} m, ${m.size[1]} m tall`;
draw();

// ---------- 3D viewer ----------
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 4000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
const hemi = new THREE.HemisphereLight('#ffffff', '#9a8f80', 1.6);
const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
scene.add(hemi, sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#7d8a76', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const tl = new THREE.TextureLoader();
const tex = (n: string) => { const t = tl.load(BASE + 'tex/' + n); t.colorSpace = THREE.SRGBColorSpace; return t; };
// The pack's two looks: by day the glow sheet is dim; at night the night glow sheet lights the windows,
// lamps and signs (the pack's own night material).
const atlas = tex('albedo.png');
const dayGlow = tex('emission.png');
const nightGlow = tex('emission-night.png');
const material = new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: dayGlow, emissive: new THREE.Color(0.58, 0.58, 0.58), roughness: 0.9, metalness: 0 });
let night = false;
function setNight(on: boolean) {
  night = on;
  material.emissiveMap = on ? nightGlow : dayGlow;
  material.emissive.setRGB(...((on ? [1.24, 0.68, 0.68] : [0.58, 0.58, 0.58]) as [number, number, number]));
  material.emissiveIntensity = on ? 1.6 : 1;
  material.needsUpdate = true;
  scene.background = new THREE.Color(on ? '#0b1020' : '#cfe0ea');
  hemi.intensity = on ? 0.18 : 1.6;
  sun.intensity = on ? 0.12 : 2.4;
  sun.color.set(on ? '#8fa6ff' : '#fff4e0');
  $('day').classList.toggle('on', !on);
  $('night').classList.toggle('on', on);
}
$('day').onclick = () => setNight(false);
$('night').onclick = () => setNight(true);
setNight(false);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
let current: THREE.Object3D | null = null;
let mixer: THREE.AnimationMixer | null = null;
let clips: THREE.AnimationClip[] | null = null;
async function peopleClips() {
  if (!clips) clips = (await loader.loadAsync(BASE + 'people-animations.glb')).animations;
  return clips;
}

async function open(m: Model) {
  $('viewer').classList.add('open');
  $('vtitle').innerHTML = `<b>${m.name.replace(/-/g, ' ')}</b> <small>· ${label(m.group)} · ${fmtSize(m)} · ${m.tris.toLocaleString()} triangles</small>`;
  $('anims').innerHTML = '';
  resize();
  if (current) scene.remove(current);
  mixer = null;
  const g = await loader.loadAsync(BASE + m.file);
  const obj = g.scene;
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material; });
  scene.add(obj);
  current = obj;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const R = Math.max(size.length() / 2, 0.1);
  ground.scale.setScalar(R * 2.2);
  ground.position.set(c.x, box.min.y - 0.01, c.z);
  camera.near = R / 100; camera.far = R * 100; camera.updateProjectionMatrix();
  // Far enough back that the whole model fits on a narrow phone screen as well as a wide one.
  resize();
  const half = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  camera.position.copy(c).add(new THREE.Vector3(1, 0.7, 1.3).normalize().multiplyScalar((R / Math.sin(half)) * 1.05));
  controls.target.copy(c);
  sun.position.set(c.x + R * 3, c.y + R * 6, c.z + R * 4);
  if (m.skinned) {
    const all = await peopleClips();
    mixer = new THREE.AnimationMixer(obj);
    const play = (name: string) => {
      mixer!.stopAllAction();
      const clip = all.find((a) => a.name === name);
      if (clip) mixer!.clipAction(fitClip(clip, obj)).play();
      $('anims').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.clip === name));
    };
    for (const [name, text] of [['idle_standing', 'Stand'], ['walk_cycle', 'Walk'], ['run-cycle', 'Run']]) {
      const b = document.createElement('button');
      b.textContent = text; b.dataset.clip = name;
      b.onclick = () => play(name);
      $('anims').append(b);
    }
    play('walk_cycle');
  }
}
/** The animation file is in metres and the people in centimetres: keep the turns, scale the hip moves. */
const fitted = new WeakMap<THREE.Object3D, Map<string, THREE.AnimationClip>>();
function fitClip(clip: THREE.AnimationClip, person: THREE.Object3D) {
  let cache = fitted.get(person);
  if (!cache) fitted.set(person, (cache = new Map()));
  const hit = cache.get(clip.name);
  if (hit) return hit;
  let hips: THREE.Object3D | undefined;
  person.traverse((o) => { if (!hips && (o as THREE.Bone).isBone && /hips/i.test(o.name)) hips = o; });
  const tracks = clip.tracks.filter((t) => !t.name.endsWith('.scale')).flatMap((t) => {
    if (!t.name.endsWith('.position')) return [t];
    if (!hips || !t.name.startsWith(hips.name + '.')) return [];
    const k = hips.position.y / (t.values[1] || 1);
    const v = t.values.slice();
    for (let i = 0; i < v.length; i++) v[i] *= k;
    return [new THREE.VectorKeyframeTrack(t.name, Array.from(t.times), Array.from(v))];
  });
  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  cache.set(clip.name, out);
  return out;
}
$('close').onclick = () => { $('viewer').classList.remove('open'); };

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (!$('viewer').classList.contains('open')) return;
  const dt = clock.getDelta();
  if (canvas.width !== Math.floor(canvas.clientWidth * renderer.getPixelRatio())) resize();
  mixer?.update(dt);
  controls.update();
  renderer.render(scene, camera);
});
Object.assign(window, { __cat: { scene, open: (n: string) => open(models.find((m) => m.name === n)!), setNight, models, get night() { return night; } } });
