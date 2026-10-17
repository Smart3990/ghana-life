import * as maplibregl from 'maplibre-gl';
import { metresBetween, type LngLat } from './roads';

// A brisk game walk. Long routes pick up to a jog so crossing town does not take minutes.
const WALK_M_PER_S = 4.5;
const JOG_M_PER_S = 9;
const RAMP_S = 0.6; // time to speed up at the start and slow down at the end

// Speed for a route of this length: walk short trips, jog long ones (about 40 s of walking at most).
export const speedFor = (metres: number) => Math.min(JOG_M_PER_S, Math.max(WALK_M_PER_S, metres / 40));

// Distance covered after t seconds: speeds up over RAMP_S, cruises, then slows down to stop
// exactly at the end. Every phone uses this same formula, so everyone sees the same walk.
export function distanceAt(t: number, total: number, speed: number): number {
  const cruise = Math.max(0, total / speed - RAMP_S); // seconds at full speed
  const duration = cruise + 2 * RAMP_S;
  if (t <= 0) return 0;
  if (t >= duration) return total;
  const accel = speed / RAMP_S;
  if (t < RAMP_S) return 0.5 * accel * t * t;
  const afterRamp = 0.5 * speed * RAMP_S;
  if (t < RAMP_S + cruise) return afterRamp + speed * (t - RAMP_S);
  const left = duration - t;
  return Math.min(total, total - 0.5 * accel * left * left);
}

// The figure: legs, arms, body and head as separate parts so they can swing.
// The shirt colour comes from CSS (kente stripes for you, plain colours for others).
const FIGURE = `
<svg class="figure" viewBox="0 0 30 62" width="30" height="62" aria-hidden="true">
  <ellipse class="shadow" cx="15" cy="58" rx="9" ry="3"/>
  <rect class="limb leg back" x="12.5" y="37" width="4.5" height="19" rx="2.2"/>
  <rect class="limb arm back" x="13" y="21" width="4" height="15" rx="2"/>
  <rect class="shorts" x="10" y="33" width="10" height="8" rx="2.5"/>
  <rect class="shirt" x="9" y="19" width="12" height="17" rx="4"/>
  <rect class="limb leg front" x="13" y="37" width="4.5" height="19" rx="2.2"/>
  <circle class="skin" cx="15" cy="12" r="6.3"/>
  <path class="hair" d="M8.7 11.2a6.3 6.3 0 0 1 12.6 0c-1.8-2.1-4-3-6.3-3s-4.5.9-6.3 3z"/>
  <rect class="limb arm front" x="13" y="21" width="4" height="15" rx="2"/>
</svg>`;

// A placeholder person (the real Ghanaian characters come later), walking along a route.
export class Avatar {
  private marker: maplibregl.Marker;
  private element: HTMLElement;
  private pos: LngLat;
  private frame = 0;
  private facingLeft = false;

  constructor(private map: maplibregl.Map, start: LngLat, options: { name?: string; shirt?: number } = {}) {
    this.pos = start;
    this.element = document.createElement('div');
    this.element.className = options.name ? `avatar other shirt-${options.shirt ?? 0}` : 'avatar me';
    this.element.innerHTML = FIGURE;
    if (options.name) {
      const label = document.createElement('span');
      label.className = 'avatar-name';
      label.textContent = options.name;
      this.element.append(label);
    }
    this.marker = new maplibregl.Marker({ element: this.element, anchor: 'bottom' }).setLngLat(start).addTo(map);
  }

  get position(): LngLat {
    return this.pos;
  }

  // Walks the route at the given speed. If the walk began earlier (another player's walk
  // we joined late), pass how long ago it started and the avatar picks up from the right spot.
  walk(path: LngLat[], speed: number, onStep: (p: LngLat) => void = () => {}, startedAgoMs = 0): Promise<void> {
    cancelAnimationFrame(this.frame);
    if (path.length < 2) return Promise.resolve();
    const lengths = path.slice(1).map((p, i) => metresBetween(path[i], p));
    const total = lengths.reduce((a, b) => a + b, 0);
    // Faster pace, quicker steps.
    this.element.style.setProperty('--stride', `${(0.5 * WALK_M_PER_S) / speed}s`);
    this.element.classList.add('walking');

    return new Promise((resolve) => {
      const started = performance.now() - Math.max(0, startedAgoMs);
      const step = (now: number) => {
        let travelled = distanceAt((now - started) / 1000, total, speed);
        if (travelled >= total) {
          this.place(path[path.length - 1]);
          onStep(this.pos);
          this.element.classList.remove('walking');
          resolve();
          return;
        }
        // Find which street segment we are on, and how far along it.
        let i = 0;
        while (i < lengths.length - 1 && travelled > lengths[i]) travelled -= lengths[i++];
        const t = lengths[i] ? travelled / lengths[i] : 0;
        const [a, b] = [path[i], path[i + 1]];
        this.place([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        this.face(a, b);
        onStep(this.pos);
        this.frame = requestAnimationFrame(step);
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  remove() {
    cancelAnimationFrame(this.frame);
    this.marker.remove();
  }

  private place(p: LngLat) {
    this.pos = p;
    this.marker.setLngLat(p);
  }

  // Turn to face left or right on screen, but only on a clear change of direction,
  // so the figure does not flicker at every small bend in the street.
  private face(a: LngLat, b: LngLat) {
    const dx = this.map.project(b).x - this.map.project(a).x;
    if (Math.abs(dx) < 4) return;
    const left = dx < 0;
    if (left !== this.facingLeft) {
      this.facingLeft = left;
      this.element.classList.toggle('facing-left', left);
    }
  }
}
