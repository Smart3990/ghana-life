// The round minimap in the bottom-left corner. It is drawn on a small 2D canvas from the street data
// the big map has already loaded (no second map, no extra downloads), turns with the player so
// "up" is always the way you face, and marks the player, north and places of interest.
import type { Map as MapLibreMap, GeoJSONFeature } from 'maplibre-gl';

type Local = (lng: number, lat: number) => [number, number]; // longitude/latitude → metres east, south
export type Blip = { x: number; z: number; color: string; size?: number };

const RANGE_M = 170; // metres from the centre to the rim
const REFRESH_DISTANCE_M = 120; // re-read the streets after moving this far
const KEEP_RADIUS_M = 420;

const ROAD_WIDTH: Record<string, number> = { highway: 12, major_road: 9, minor_road: 6, other: 4, path: 2.2 };

type Shapes = { roads: Map<string, Path2D>; water: Path2D; green: Path2D; buildings: Path2D | null };

export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private size = 0;
  private scale = 1;
  private shapes: Shapes | null = null;
  private centre = { x: Infinity, z: Infinity };
  private lastDraw = { x: NaN, z: NaN, h: NaN, t: 0 };
  private refreshQueued = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private map: MapLibreMap,
    private toLocal: Local,
    private opts: { buildings: boolean; pixelRatio: number },
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // New street tiles arrive as the player moves: read them again, at most every 1.5 s.
    map.on('sourcedata', (e) => {
      if (e.sourceId !== 'accra' || !e.isSourceLoaded || this.refreshQueued) return;
      this.refreshQueued = true;
      setTimeout(() => {
        this.refreshQueued = false;
        this.read(this.centre.x, this.centre.z);
      }, 1500);
    });
  }

  private resize() {
    const css = this.canvas.clientWidth || 140;
    this.size = Math.round(css * this.opts.pixelRatio);
    this.canvas.width = this.canvas.height = this.size;
    this.scale = this.size / 2 / RANGE_M;
    this.lastDraw.t = 0; // force a redraw
  }

  // Turns the loaded street data near (x, z) into ready-to-draw shapes, in metres.
  private read(x: number, z: number) {
    if (!Number.isFinite(x)) return;
    const near = ([px, pz]: [number, number]) => Math.abs(px - x) < KEEP_RADIUS_M && Math.abs(pz - z) < KEEP_RADIUS_M;
    const lines = (f: GeoJSONFeature, into: Path2D) => {
      const g = f.geometry;
      const parts: number[][][] = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const line of parts) {
        const pts = line.map(([lng, lat]): [number, number] => this.toLocal(lng, lat));
        if (!pts.some(near)) continue;
        pts.forEach(([px, pz]: [number, number], i: number) => (i ? into.lineTo(px, pz) : into.moveTo(px, pz)));
      }
    };
    const polygons = (f: GeoJSONFeature, into: Path2D) => {
      const g = f.geometry;
      const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) {
        for (const ring of poly) {
          const pts = ring.map(([lng, lat]): [number, number] => this.toLocal(lng, lat));
          if (!pts.some(near)) continue;
          pts.forEach(([px, pz]: [number, number], i: number) => (i ? into.lineTo(px, pz) : into.moveTo(px, pz)));
          into.closePath();
        }
      }
    };
    const query = (layer: string) => this.map.querySourceFeatures('accra', { sourceLayer: layer });
    const roads = new Map<string, Path2D>();
    for (const f of query('roads')) {
      const kind = String(f.properties.kind ?? 'other');
      if (kind === 'rail' || kind === 'ferry') continue;
      const key = ROAD_WIDTH[kind] ? kind : 'other';
      if (!roads.has(key)) roads.set(key, new Path2D());
      lines(f, roads.get(key)!);
    }
    const water = new Path2D();
    for (const f of query('water')) if (f.geometry.type.endsWith('Polygon')) polygons(f, water);
    const green = new Path2D();
    for (const f of query('landuse')) {
      if (/park|grass|pitch|wood|forest|garden/.test(String(f.properties.kind))) polygons(f, green);
    }
    let buildings: Path2D | null = null;
    if (this.opts.buildings) {
      buildings = new Path2D();
      for (const f of query('buildings')) polygons(f, buildings);
    }
    this.shapes = { roads, water, green, buildings };
    this.centre = { x, z };
    this.lastDraw.t = 0;
  }

  // Call every frame; it redraws only when something changed, and at most about 15 times a second.
  update(x: number, z: number, heading: number, blips: Blip[] = []) {
    if (Math.hypot(x - this.centre.x, z - this.centre.z) > REFRESH_DISTANCE_M || !this.shapes) this.read(x, z);
    const now = performance.now();
    const moved = Math.abs(x - this.lastDraw.x) + Math.abs(z - this.lastDraw.z) > 0.4 || Math.abs(heading - this.lastDraw.h) > 0.01;
    if (this.lastDraw.t && (!moved || now - this.lastDraw.t < 66)) return;
    this.lastDraw = { x, z, h: heading, t: now };
    this.draw(x, z, heading, blips);
  }

  private draw(x: number, z: number, heading: number, blips: Blip[]) {
    const { ctx, size, scale } = this;
    const r = size / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#26302a';
    ctx.fillRect(0, 0, size, size);

    // The world, turned so the player's facing direction points up.
    ctx.translate(r, r);
    ctx.rotate(-heading);
    ctx.scale(scale, scale);
    ctx.translate(-x, -z);
    const s = this.shapes;
    if (s) {
      ctx.fillStyle = '#3b5a3a';
      ctx.fill(s.green);
      ctx.fillStyle = '#2f6f93';
      ctx.fill(s.water);
      if (s.buildings) {
        ctx.fillStyle = '#39443d';
        ctx.fill(s.buildings);
      }
      ctx.lineCap = ctx.lineJoin = 'round';
      for (const [kind, path] of s.roads) {
        ctx.strokeStyle = kind === 'major_road' || kind === 'highway' ? '#c9c2b2' : '#8f948c';
        ctx.lineWidth = ROAD_WIDTH[kind] ?? 4;
        ctx.stroke(path);
      }
    }
    for (const b of blips) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.z, (b.size ?? 5) / scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // The player: a gold arrow in the middle, pointing up.
    const a = size * 0.06;
    ctx.save();
    ctx.translate(r, r);
    ctx.fillStyle = '#e3a92b';
    ctx.strokeStyle = '#121a14';
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.moveTo(0, -a * 1.25);
    ctx.lineTo(a, a);
    ctx.lineTo(0, a * 0.45);
    ctx.lineTo(-a, a);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // North, on the rim.
    const nx = r + Math.sin(-heading) * (r - size * 0.09);
    const ny = r - Math.cos(-heading) * (r - size * 0.09);
    ctx.fillStyle = '#121a14';
    ctx.beginPath();
    ctx.arc(nx, ny, size * 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2efe6';
    ctx.font = `800 ${Math.round(size * 0.08)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny + size * 0.004);
  }
}
