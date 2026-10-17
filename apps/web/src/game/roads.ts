// The walkable street network and shortest-route search (A*), all in the browser.

export type RoadFile = { scale: number; nodes: number[]; edges: number[] };

export type LngLat = [number, number];

const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((5.56 * Math.PI) / 180); // Accra's latitude
const CELL = 0.002; // grid cell for finding the nearest street point, about 220 m

export class Roads {
  private lon: Float64Array;
  private lat: Float64Array;
  private start: Int32Array; // neighbours of node i are adj[start[i] .. start[i+1])
  private adj: Int32Array;
  private grid = new Map<string, number[]>();

  // Joins several area files into one network. Streets crossing an area edge appear in both
  // files with identical points, so points are matched by their coordinates.
  static merge(files: RoadFile[]): Roads {
    if (files.length === 1) return new Roads(files[0]);
    const index = new Map<string, number>();
    const nodes: number[] = [];
    const edges: number[] = [];
    for (const f of files) {
      const local = new Int32Array(f.nodes.length / 2);
      for (let i = 0; i < local.length; i++) {
        const x = f.nodes[2 * i];
        const y = f.nodes[2 * i + 1];
        const key = `${x},${y}`;
        let id = index.get(key);
        if (id === undefined) {
          id = nodes.length / 2;
          index.set(key, id);
          nodes.push(x, y);
        }
        local[i] = id;
      }
      for (let k = 0; k < f.edges.length; k += 2) edges.push(local[f.edges[k]], local[f.edges[k + 1]]);
    }
    return new Roads({ scale: files[0].scale, nodes, edges });
  }

  constructor(file: RoadFile) {
    const count = file.nodes.length / 2;
    this.lon = new Float64Array(count);
    this.lat = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      this.lon[i] = file.nodes[2 * i] / file.scale;
      this.lat[i] = file.nodes[2 * i + 1] / file.scale;
      const key = this.cellKey(this.lon[i], this.lat[i]);
      const cell = this.grid.get(key);
      if (cell) cell.push(i);
      else this.grid.set(key, [i]);
    }
    // Pack neighbour lists into flat arrays: fast and light on memory.
    const degree = new Int32Array(count + 1);
    for (let k = 0; k < file.edges.length; k += 2) {
      degree[file.edges[k]]++;
      degree[file.edges[k + 1]]++;
    }
    this.start = new Int32Array(count + 1);
    for (let i = 0; i < count; i++) this.start[i + 1] = this.start[i] + degree[i];
    const fill = this.start.slice(0, count);
    this.adj = new Int32Array(file.edges.length);
    for (let k = 0; k < file.edges.length; k += 2) {
      const a = file.edges[k];
      const b = file.edges[k + 1];
      this.adj[fill[a]++] = b;
      this.adj[fill[b]++] = a;
    }
  }

  position(i: number): LngLat {
    return [this.lon[i], this.lat[i]];
  }

  private cellKey(lon: number, lat: number) {
    return `${Math.floor(lon / CELL)},${Math.floor(lat / CELL)}`;
  }

  private metres(a: number, b: number): number {
    const dx = (this.lon[a] - this.lon[b]) * M_PER_DEG_LON;
    const dy = (this.lat[a] - this.lat[b]) * M_PER_DEG_LAT;
    return Math.hypot(dx, dy);
  }

  // The street point closest to a spot, searching the surrounding grid cells.
  nearest(p: LngLat): number {
    return this.nearestFew(p, 1)[0] ?? -1;
  }

  // The few closest street points, nearest first (used when the closest one is on a cut-off path).
  nearestFew([lon, lat]: LngLat, count: number): number[] {
    const cx = Math.floor(lon / CELL);
    const cy = Math.floor(lat / CELL);
    const found: { i: number; d: number }[] = [];
    // Search one ring beyond the first ring with enough points: a point just across a
    // cell edge can be closer than ones inside the centre cell.
    let lastRing = 3;
    for (let r = 0; r <= lastRing; r++) {
      if (found.length >= count && lastRing === 3) lastRing = Math.min(3, r);
      for (let x = cx - r; x <= cx + r; x++) {
        for (let y = cy - r; y <= cy + r; y++) {
          if (r > 0 && Math.abs(x - cx) < r && Math.abs(y - cy) < r) continue; // inner ring already seen
          for (const i of this.grid.get(`${x},${y}`) ?? []) {
            found.push({ i, d: ((this.lon[i] - lon) * M_PER_DEG_LON) ** 2 + ((this.lat[i] - lat) * M_PER_DEG_LAT) ** 2 });
          }
        }
      }
    }
    return found.sort((a, b) => a.d - b.d).slice(0, count).map((f) => f.i);
  }

  // Shortest route between two spots, trying a few nearby street points at each end
  // in case the closest one belongs to a small cut-off path.
  routeBetween(from: LngLat, to: LngLat): LngLat[] | null {
    const starts = this.nearestFew(from, 3);
    const ends = this.nearestFew(to, 3);
    for (const a of starts) {
      for (const b of ends) {
        const path = this.route(a, b, 400_000);
        if (path) return path;
      }
    }
    return null;
  }

  // Shortest walking route between two street points, as a list of positions (A* search).
  route(from: number, to: number, maxSteps = Infinity): LngLat[] | null {
    const count = this.lon.length;
    const cost = new Float64Array(count).fill(Infinity);
    const came = new Int32Array(count).fill(-1);
    const open = new MinHeap();
    cost[from] = 0;
    open.push(from, this.metres(from, to));
    let steps = 0;
    while (open.size) {
      if (++steps > maxSteps) return null; // give up rather than freeze the phone
      const current = open.pop();
      if (current === to) {
        const path: LngLat[] = [];
        for (let i = to; i !== -1; i = came[i]) path.push(this.position(i));
        return path.reverse();
      }
      for (let k = this.start[current]; k < this.start[current + 1]; k++) {
        const next = this.adj[k];
        const c = cost[current] + this.metres(current, next);
        if (c < cost[next]) {
          cost[next] = c;
          came[next] = current;
          open.push(next, c + this.metres(next, to));
        }
      }
    }
    return null; // not connected
  }
}

// A small binary heap ordered by priority (lowest first).
class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, key: number) {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

export function metresBetween(a: LngLat, b: LngLat): number {
  return Math.hypot((a[0] - b[0]) * M_PER_DEG_LON, (a[1] - b[1]) * M_PER_DEG_LAT);
}
