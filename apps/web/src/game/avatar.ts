import * as maplibregl from 'maplibre-gl';
import { metresBetween, type LngLat } from './roads';

// Game speed: a few times faster than real walking, so crossing town takes seconds, not minutes.
const SPEED_M_PER_S = 14;

// A placeholder person (the real Ghanaian characters come later), walking along a route.
export class Avatar {
  private marker: maplibregl.Marker;
  private element: HTMLElement;
  private pos: LngLat;
  private frame = 0;

  constructor(private map: maplibregl.Map, start: LngLat) {
    this.pos = start;
    this.element = document.createElement('div');
    this.element.className = 'avatar';
    this.element.innerHTML = '<span class="avatar-shadow"></span><span class="avatar-body"></span><span class="avatar-head"></span>';
    this.marker = new maplibregl.Marker({ element: this.element, anchor: 'bottom' }).setLngLat(start).addTo(map);
  }

  get position(): LngLat {
    return this.pos;
  }

  // Walks the route; calls onStep with each new position so the camera can follow.
  walk(path: LngLat[], onStep: (p: LngLat) => void): Promise<void> {
    cancelAnimationFrame(this.frame);
    if (path.length < 2) return Promise.resolve();
    const lengths = path.slice(1).map((p, i) => metresBetween(path[i], p));
    const total = lengths.reduce((a, b) => a + b, 0);
    this.element.classList.add('walking');

    return new Promise((resolve) => {
      const started = performance.now();
      const step = (now: number) => {
        let travelled = ((now - started) / 1000) * SPEED_M_PER_S;
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

  private place(p: LngLat) {
    this.pos = p;
    this.marker.setLngLat(p);
  }

  private screenX(p: LngLat) {
    return this.map.project(p).x;
  }
}
