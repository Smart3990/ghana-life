import * as maplibregl from 'maplibre-gl';
import { metresBetween, type LngLat } from './roads';

// Game speed: a few times faster than real walking, so crossing town takes seconds, not minutes.
export const WALK_SPEED_M_PER_S = 14;

// A placeholder person (the real Ghanaian characters come later), walking along a route.
// The player's own avatar wears kente colours; other players get a different shirt and a name label.
export class Avatar {
  private marker: maplibregl.Marker;
  private element: HTMLElement;
  private pos: LngLat;
  private frame = 0;

  constructor(private map: maplibregl.Map, start: LngLat, options: { name?: string; shirt?: number } = {}) {
    this.pos = start;
    this.element = document.createElement('div');
    this.element.className = options.name ? `avatar other shirt-${options.shirt ?? 0}` : 'avatar me';
    this.element.innerHTML = '<span class="avatar-shadow"></span><span class="avatar-body"></span><span class="avatar-head"></span>';
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

  // Walks the route. If the walk began earlier (another player's walk we joined late),
  // pass how long ago it started and the avatar picks up from the right spot.
  walk(path: LngLat[], onStep: (p: LngLat) => void = () => {}, speed = WALK_SPEED_M_PER_S, startedAgoMs = 0): Promise<void> {
    cancelAnimationFrame(this.frame);
    if (path.length < 2) return Promise.resolve();
    const lengths = path.slice(1).map((p, i) => metresBetween(path[i], p));
    const total = lengths.reduce((a, b) => a + b, 0);
    this.element.classList.add('walking');

    return new Promise((resolve) => {
      const started = performance.now() - Math.max(0, startedAgoMs);
      const step = (now: number) => {
        let travelled = ((now - started) / 1000) * speed;
        if (travelled >= total) {
          this.place(path[path.length - 1]);
          onStep(this.pos);
          this.element.classList.remove('walking');
          resolve();
          return;
        }
        // Find which street segment we are on, and how far along it.
        let i = 0;
        while (travelled > lengths[i]) travelled -= lengths[i++];
        const t = lengths[i] ? travelled / lengths[i] : 0;
        const [a, b] = [path[i], path[i + 1]];
        this.element.classList.toggle('facing-left', this.screenX(b) < this.screenX(a));
        this.place([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
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

  private screenX(p: LngLat) {
    return this.map.project(p).x;
  }
}
