// The walkable street network and shortest-route search (A*), all in the browser.

type RoadFile = { bbox: [number, number, number, number]; scale: number; nodes: number[]; edges: number[] };

export type LngLat = [number, number];

const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((5.56 * Math.PI) / 180); // Accra's latitude
const CELL = 0.002; // grid cell for finding the nearest street point, about 220 m

export class Roads {
  readonly bbox: [number, number, number, number];
  private lon: Float64Array;
  private lat: Float64Array;
  private start: Int32Array; // neighbours of node i are adj[start[i] .. start[i+1])
  private adj: Int32Array;
  private grid = new Map<string, number[]>();

  constructor(file: RoadFile) {
    this.bbox = file.bbox;
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

  static async load(url: string): Promise<Roads> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load the street network (${res.status})`);
    return new Roads(await res.json());
  }

  contains([lon, lat]: LngLat): boolean {
    const [w, s, e, n] = this.bbox;
    return lon >= w && lon <= e && lat >= s && lat <= n;
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
  nearest([lon, lat]: LngLat): number {
    const cx = Math.floor(lon / CELL);
    const cy = Math.floor(lat / CELL);
    let best = -1;
    let bestD = Infinity;
    for (let r = 0; r <= 3 && best < 0; r++) {
      for (let x = cx - r; x <= cx + r; x++) {
        for (let y = cy - r; y <= cy + r; y++) {
          for (const i of this.grid.get(`${x},${y}`) ?? []) {
            const d = ((this.lon[i] - lon) * M_PER_DEG_LON) ** 2 + ((this.lat[i] - lat) * M_PER_DEG_LAT) ** 2;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
    }
    return best;
  }

  // Shortest walking route between two street points, as a list of positions (A* search).
  route(from: number, to: number): LngLat[] | null {
    const count = this.lon.length;
    const cost = new Float64Array(count).fill(Infinity);
    const came = new Int32Array(count).fill(-1);
    const open = new MinHeap();
    cost[from] = 0;
    open.push(from, this.metres(from, to));
    while (open.size) {
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
