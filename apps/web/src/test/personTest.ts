// Person test: the Ghanaverse people up close, in several skin tones and outfits, all from one
// model file. Shows what the character creator will be able to change, and how many triangles it costs.
import * as THREE from 'three';
import { createPerson, SKIN_TONES, type Body, type Detail, type Move, type Outfit } from '../game/person';

const LOOKS: (Partial<Outfit> & { move: Move; body: Body })[] = [
  { body: 'male', skin: SKIN_TONES.deep, shirt: '#2f7d55', trousers: '#2a3446', shoes: '#2b2b2e', move: 'idle' },
  { body: 'female', skin: SKIN_TONES.deep, shirt: '#f2efe6', trousers: '#c8442e', shoes: '#5a3a22', move: 'talk' },
  { body: 'male', skin: SKIN_TONES.veryDeep, shirt: '#e3a92b', trousers: '#3b3b3b', shoes: '#ecebe6', move: 'walk' },
  { body: 'female', skin: SKIN_TONES.medium, shirt: '#1f5fa8', trousers: '#e3a92b', shoes: '#2b2b2e', move: 'dance' },
];

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9c89a');
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b4f3a, 1.5));
const sun = new THREE.DirectionalLight(0xffcf9a, 2.4);
sun.position.set(-3, 4, 5);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshStandardMaterial({ color: '#b9a98c', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
camera.position.set(0, 1.4, 7.8);
camera.lookAt(0, 0.95, 0);

const resize = () => {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', resize);
resize();

// ?detail=lite|crowd|mass shows the lighter versions.
const detail = (new URLSearchParams(location.search).get('detail') ?? 'full') as Detail;
const people = await Promise.all(LOOKS.map(({ move, body, ...outfit }) => createPerson(outfit, body, detail).then((p) => ({ p, move }))));
people.forEach(({ p, move }, i) => {
  p.root.position.x = (i - (people.length - 1) / 2) * 0.95;
  p.root.rotation.y = (i - 1.5) * -0.12;
  p.actions[move].play();
  scene.add(p.root);
});

// ?crowd: the same people drawn by the crowd system (one batch, animated by the graphics card), beside the normal ones.
if (new URLSearchParams(location.search).has('crowd')) {
  const { CrowdBatch } = await import('../game/crowd');
  const time = { value: 0 };
  const male = await CrowdBatch.create('male', 4, time);
  const female = await CrowdBatch.create('female', 4, time);
  LOOKS.forEach(({ body, skin, shirt, trousers, shoes }, i) => {
    const b = body === 'female' ? female : male;
    const slot = b.count++;
    b.setLook(slot, { body, skin: skin!, top: shirt!, bottom: trousers!, shoes: shoes!, hair: '#141110', scale: 1 }, i % 2 ? 'talk' : 'walk', 0);
    b.mesh.setMatrixAt(slot, new THREE.Matrix4().makeTranslation((i - 1.5) * 0.95, 0, -1.6));
  });
  for (const b of [male, female]) {
    b.mesh.count = b.count;
    scene.add(b.mesh);
  }
  setInterval(() => (time.value = performance.now() / 1000), 16);
}

const clock = new THREE.Clock();
const info = document.getElementById('info')!;
let frames = 0;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  for (const { p } of people) p.mixer.update(dt);
  renderer.render(scene, camera);
  if (++frames === 30) {
    info.textContent = `${people.length} people · ${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.programs?.length ?? '?'} shaders`;
    document.body.dataset.ready = '1';
  }
});
