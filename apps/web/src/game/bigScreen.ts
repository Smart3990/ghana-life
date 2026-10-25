// The big screen at Circle (design brief 17): a bright LED screen on a tall frame that rotates four
// things every few seconds: Most Wanted, Ghanaverse News, an advert and "Tonight in Ghanaverse".
// Drawn on a canvas in code; it glows a little so it reads at dusk.
import * as THREE from 'three';
import { box, merge, paint } from './vehicles3d';

const PAGES: { bg: string; title: string; lines: string[]; accent: string }[] = [
  { bg: '#121a14', title: 'GHANAVERSE NEWS', lines: ['Bag thief seen running at Circle', 'Trotro fares steady this week', 'New okada race record in Osu'], accent: '#e3a92b' },
  { bg: '#3a0d0d', title: 'MOST WANTED', lines: ['No one is wanted right now.', 'Keep it that way, chale!'], accent: '#ff5a3c' },
  { bg: '#0f6b3a', title: 'SIKA MOBILE MONEY', lines: ['Send money home in seconds', 'Your ad here: from ₵350 a week'], accent: '#f2c21a' },
  { bg: '#1f2f5c', title: 'TONIGHT IN GHANAVERSE', lines: ['Highlife night at Osu, 8 pm', 'Football at Kaneshie park'], accent: '#e3a92b' },
];

export class BigScreen {
  readonly group = new THREE.Group();
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;
  private page = -1;
  private placed = false;

  constructor() {
    this.canvas.width = 768;
    this.canvas.height = 384;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const frame = merge([
      paint(box(0.5, 9, 0.5, -4.5, 4.5, -0.4), '#4a4844'),
      paint(box(0.5, 9, 0.5, 4.5, 4.5, -0.4), '#4a4844'),
      paint(box(12.6, 6.6, 0.4, 0, 11.3, -0.25), '#1b1c1e'),
    ]);
    const stand = new THREE.Mesh(frame, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    stand.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(12, 6).translate(0, 11.3, -0.03), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    this.group.add(stand, screen);
    this.group.visible = false;
  }

  /** Put it at a spot (once), facing a direction (radians clockwise from north). */
  place(x: number, z: number, facing: number) {
    if (this.placed) return;
    this.placed = true;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = Math.PI - facing;
    this.group.visible = true;
  }
  get isPlaced() {
    return this.placed;
  }

  update(t: number) {
    if (!this.placed) return;
    const page = Math.floor(t / 7) % PAGES.length;
    if (page === this.page) return;
    this.page = page;
    const p = PAGES[page];
    const g = this.canvas.getContext('2d')!;
    g.fillStyle = p.bg;
    g.fillRect(0, 0, 768, 384);
    const kente = ['#e3a92b', '#121a14', '#c8442e', '#121a14', '#2f8f57', '#121a14', '#1f5fa8', '#121a14'];
    for (let x = 0, i = 0; x < 768; x += 24, i++) {
      g.fillStyle = kente[i % kente.length];
      g.fillRect(x, 0, 24, 18);
    }
    g.fillStyle = p.accent;
    g.font = '900 58px system-ui, sans-serif';
    g.fillText(p.title, 36, 100, 700);
    g.fillStyle = '#f2efe6';
    g.font = '700 36px system-ui, sans-serif';
    p.lines.forEach((l, i) => g.fillText(l, 36, 175 + i * 58, 700));
    g.fillStyle = p.accent;
    g.fillRect(0, 352, 768, 32);
    g.fillStyle = p.bg;
    g.font = '800 22px system-ui, sans-serif';
    g.fillText('GHANAVERSE · CIRCLE · ' + ['NEWS', 'MOST WANTED', 'ADVERT', 'TONIGHT'][page], 24, 376);
    this.texture.needsUpdate = true;
  }
}
