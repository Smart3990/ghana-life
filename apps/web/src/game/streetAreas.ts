// Street networks for all of Greater Accra, split into area files (0.05°, about 5.5 km).
// A walk loads only the areas it crosses, and joins them into one network.
import { metresBetween, Roads, type LngLat, type RoadFile } from './roads';

const BASE = '/data/roads/';
const MARGIN = 0.01; // also load areas within about 1 km, so routes can curve around
export const MAX_WALK_M = 6000; // longer trips are for rides (master plan T11)

type AreaIndex = { size: number; areas: string[] };

export class StreetAreas {
  private index: Promise<{ size: number; areas: Set<string> }>;
  private files = new Map<string, Promise<RoadFile>>();
  private lastKey = '';
  private lastRoads: Roads | null = null;

  constructor() {
    this.index = fetch(BASE + 'areas.json')
      .then((r) => {
        if (!r.ok) throw new Error(`streets index ${r.status}`);
        return r.json() as Promise<AreaIndex>;
      })
      .then((i) => ({ size: i.size, areas: new Set(i.areas) }));
  }

  private async keysAround(points: LngLat[]): Promise<string[]> {
    const { size, areas } = await this.index;
    const lons = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const keys: string[] = [];
    for (let x = Math.floor((Math.min(...lons) - MARGIN) / size); x <= Math.floor((Math.max(...lons) + MARGIN) / size); x++) {
      for (let y = Math.floor((Math.min(...lats) - MARGIN) / size); y <= Math.floor((Math.max(...lats) + MARGIN) / size); y++) {
        if (areas.has(`${x}_${y}`)) keys.push(`${x}_${y}`);
      }
    }
    return keys;
  }

  // True when there are mapped streets in the area of this spot.
  async hasStreets(p: LngLat): Promise<boolean> {
    const { size, areas } = await this.index;
    return areas.has(`${Math.floor(p[0] / size)}_${Math.floor(p[1] / size)}`);
  }

  private load(key: string): Promise<RoadFile> {
    if (!this.files.has(key)) {
      const file = fetch(`${BASE}${key}.json`).then((r) => {
        if (!r.ok) throw new Error(`streets ${key} ${r.status}`);
        return r.json() as Promise<RoadFile>;
      });
      file.catch(() => this.files.delete(key)); // let a later walk try again
      this.files.set(key, file);
    }
    return this.files.get(key)!;
  }

  // A walking route along real streets, or a reason why there is none.
  async route(from: LngLat, to: LngLat): Promise<{ path: LngLat[] } | { problem: 'far' | 'unmapped' | 'none' }> {
    if (metresBetween(from, to) > MAX_WALK_M) return { problem: 'far' };
    if (!(await this.hasStreets(to))) return { problem: 'unmapped' };
    const keys = await this.keysAround([from, to]);
    const key = keys.join('|');
    if (key !== this.lastKey) {
      this.lastRoads = Roads.merge(await Promise.all(keys.map((k) => this.load(k))));
      this.lastKey = key;
    }
    const path = this.lastRoads!.routeBetween(from, to);
    return path ? { path } : { problem: 'none' };
  }

  // Loads the area around a spot ahead of time, so the first tap there is quick.
  async warmUp(p: LngLat) {
    for (const k of await this.keysAround([p])) this.load(k).catch(() => {});
  }
}
