// The big map: tap the minimap (or the Map app on the phone) to see the city around you.
// It flies in from above Accra to where you stand, with the real streets, area names and (on
// Standard and Ultra) 3D buildings. Pins drop in for every real place found: filling stations, bus
// stops, the lorry station, banks, chop bars, pharmacies, clinics, churches, mosques, schools,
// markets, police. The traffic moves live, your goal pulses, and a glowing route runs along the real
// roads to it. A card says where you are and what is nearest. Filter by kind; drag and pinch to look
// around. The second map is made only while it is open, so it costs nothing the rest of the time.
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { buildStyle } from '../map/style';
import type { Tier } from '../map/style';

export type MapPlace = { lng: number; lat: number; kind: string };
export type MapCar = { id: number; lng: number; lat: number; kind: string; heading: number };
type Group = { name: string; icon: string; kinds: string[] };
type View = {
  you: { lng: number; lat: number; heading: number };
  /** Where the story wants you: the person or place, with a picture-sign and a name. */
  goal: { lng: number; lat: number; label: string; who?: string; role?: string; icon?: string } | null;
  /** The parts of the city open now (the rest is greyed out and locked). */
  open: { lng: number; lat: number; radius: number; name: string }[];
  /** The player's card. */
  player: { name: string; home: string; energy: number; vibe: number; money: number; mission: string };
  places: MapPlace[];
  areas: { name: string; lng: number; lat: number }[];
  cars: () => MapCar[];
  here: string;
  /** Billboards: where they stand and which advert they show (its picture, from adThumb). */
  boards: { lng: number; lat: number; ad: number }[];
  adPicture: (ad: number) => string;
  /** Tapping a billboard opens its advert card. */
  openAd: (ad: number) => void;
};

const GROUPS: Group[] = [
  { name: 'Fuel', icon: '⛽', kinds: ['FILLING STATION'] },
  { name: 'Transport', icon: '🚌', kinds: ['BUS STOP', 'BUS TERMINAL', 'LORRY STATION'] },
  { name: 'Food', icon: '🍲', kinds: ['CHOP BAR', 'MARKET', 'SUPERMARKET', 'DRINKING SPOT'] },
  { name: 'Money', icon: '🏦', kinds: ['ADINKRA BANK', 'ATM', 'MOBILE MONEY'] },
  { name: 'Health', icon: '💊', kinds: ['PHARMACY', 'CLINIC'] },
  { name: 'Worship', icon: '⛪', kinds: ['CHURCH', 'MOSQUE'] },
  { name: 'School', icon: '🏫', kinds: ['SCHOOL'] },
  { name: 'Shops', icon: '🛍️', kinds: ['PHONES & ELECTRONICS', 'FASHION HOUSE', 'BARBERING & SALON', 'HARDWARE', 'PRINTING & BOOKS', 'LOTTO KIOSK', 'FITTING SHOP'] },
  { name: 'Safety', icon: '👮', kinds: ['POLICE STATION', 'FIRE STATION', 'POST OFFICE', 'HOTEL'] },
  { name: 'Ads', icon: '📺', kinds: [] },
];
const ICON: Record<string, string> = {
  'FILLING STATION': '⛽', 'BUS STOP': '🚏', 'BUS TERMINAL': '🚌', 'LORRY STATION': '🚐', 'CHOP BAR': '🍲', MARKET: '🧺', SUPERMARKET: '🛒',
  'DRINKING SPOT': '🍻', 'ADINKRA BANK': '🏦', ATM: '🏧', 'MOBILE MONEY': '📲', PHARMACY: '💊', CLINIC: '🏥', CHURCH: '⛪', MOSQUE: '🕌',
  SCHOOL: '🏫', 'PHONES & ELECTRONICS': '📱', 'FASHION HOUSE': '👗', 'BARBERING & SALON': '💈', HARDWARE: '🔨', 'PRINTING & BOOKS': '📚',
  'LOTTO KIOSK': '🎟️', 'FITTING SHOP': '🔧', 'POLICE STATION': '👮', 'FIRE STATION': '🚒', 'POST OFFICE': '📮', HOTEL: '🏨',
};
// Pin colours by group (Royal Kente).
const TINT: Record<string, string> = { Fuel: '#c8442e', Transport: '#2f8f57', Food: '#e3a92b', Money: '#1f5fa8', Health: '#2f8f57', Worship: '#6a4c93', School: '#8e1b1b', Shops: '#121a14', Safety: '#0b2a5a' };
const VEHICLE_ICON: Record<string, string> = { car: 'car', taxi: 'taxi', trotro: 'trotro', bus: 'bus', truck: 'truck', okada: 'okada', tricycle: 'tricycle', pickup: 'pickup', suv: 'suv' };

/** Little top-down pictures of each kind of vehicle, at their real proportions (8 pixels a metre). */
function vehicleIcons() {
  const PX = 8;
  const make = (len: number, wid: number, paint: (g: CanvasRenderingContext2D, L: number, W: number) => void) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(wid * PX) + 4;
    c.height = Math.ceil(len * PX) + 4;
    const g = c.getContext('2d')!;
    g.translate(2, 2);
    paint(g, len * PX, wid * PX);
    return g.getImageData(0, 0, c.width, c.height);
  };
  const body = (g: CanvasRenderingContext2D, L: number, W: number, colour: string, r = 0.3) => {
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath();
    g.roundRect(1, 2, W, L, W * r);
    g.fill();
    g.fillStyle = colour;
    g.beginPath();
    g.roundRect(0, 0, W, L, W * r);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.lineWidth = 1;
    g.stroke();
  };
  const glass = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    g.fillStyle = '#26343e';
    g.beginPath();
    g.roundRect(x, y, w, h, 2);
    g.fill();
  };
  // The front of every picture is at the top (heading 0 = north).
  const saloon = (colour: string, taxi = false) =>
    make(4.4, 1.8, (g, L, W) => {
      body(g, L, W, colour);
      glass(g, 2, L * 0.24, W - 4, L * 0.16); // windscreen
      g.fillStyle = colour === '#f2efe6' ? '#d9d4c8' : 'rgba(0,0,0,.18)';
      g.fillRect(2, L * 0.4, W - 4, L * 0.3); // roof
      glass(g, 2, L * 0.72, W - 4, L * 0.1); // back window
      if (taxi) {
        // Accra taxis: yellow-painted corners, and the roof sign.
        g.fillStyle = '#f2c21a';
        for (const [x, y] of [[0, 0], [W - 5, 0], [0, L - 7], [W - 5, L - 7]]) g.fillRect(x, y, 5, 7);
        g.fillStyle = '#121a14';
        g.fillRect(W / 2 - 4, L * 0.5, 8, 3);
      }
    });
  return {
    car: saloon('#1f4f8a'),
    taxi: saloon('#f2efe6', true),
    suv: make(4.7, 1.95, (g, L, W) => {
      body(g, L, W, '#2a2c33', 0.2);
      glass(g, 2, L * 0.2, W - 4, L * 0.15);
      glass(g, 2, L * 0.82, W - 4, L * 0.08);
    }),
    pickup: make(5, 1.85, (g, L, W) => {
      body(g, L, W, '#8f959b', 0.2);
      glass(g, 2, L * 0.2, W - 4, L * 0.13);
      g.fillStyle = '#5d5a55';
      g.fillRect(2, L * 0.55, W - 4, L * 0.42); // the open back
    }),
    trotro: make(4.9, 1.8, (g, L, W) => {
      body(g, L, W, '#f2efe6', 0.18);
      glass(g, 2, L * 0.08, W - 4, L * 0.1);
      g.fillStyle = '#c8442e';
      g.fillRect(0, L * 0.45, W, 3); // the stripe
      g.fillStyle = '#5d5a55';
      g.fillRect(3, L * 0.6, W - 6, L * 0.22); // luggage on the roof rack
    }),
    bus: make(10.5, 2.5, (g, L, W) => {
      body(g, L, W, '#2f8f57', 0.1);
      glass(g, 2, L * 0.03, W - 4, L * 0.05);
      g.fillStyle = '#f2c21a';
      g.fillRect(0, L * 0.3, W, 3);
      g.fillRect(0, L * 0.6, W, 3);
    }),
    truck: make(7.4, 2.3, (g, L, W) => {
      body(g, L * 0.25, W, '#1f5fa8', 0.15);
      glass(g, 2, L * 0.03, W - 4, L * 0.06);
      g.fillStyle = '#8a5a2b';
      g.fillRect(0, L * 0.28, W, L * 0.72); // the load
      g.strokeStyle = 'rgba(0,0,0,.5)';
      g.strokeRect(0, L * 0.28, W, L * 0.72);
    }),
    tricycle: make(3, 1.3, (g, L, W) => {
      body(g, L, W, '#c8442e', 0.35);
      g.fillStyle = '#e3a92b';
      g.fillRect(2, L * 0.45, W - 4, L * 0.5);
    }),
    okada: make(2, 0.8, (g, L, W) => {
      body(g, L, W, '#121a14', 0.5);
      g.fillStyle = '#c8442e';
      g.beginPath();
      g.arc(W / 2, L * 0.55, W * 0.38, 0, Math.PI * 2); // the rider
      g.fill();
    }),
  };
}
const M_LAT = 110574;
const M_LON = 111320 * Math.cos((5.57 * Math.PI) / 180);
const metres = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => Math.hypot((a.lng - b.lng) * M_LON, (a.lat - b.lat) * M_LAT);
const groupOf = (kind: string) => GROUPS.find((g) => g.kinds.includes(kind));
const far = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const empty = { type: 'FeatureCollection' as const, features: [] };
type Area = { lng: number; lat: number; radius: number; name: string };
const inAny = (opens: Area[], p: { lng: number; lat: number }) => opens.some((o) => metres(p, o) <= o.radius);
/** The edge of an open area: a gently uneven ring, like a district boundary rather than a circle. */
function edgeRing(o: Area) {
  const ring: number[][] = [];
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = o.radius * (1 + 0.035 * Math.sin(a * 3 + 1) + 0.02 * Math.sin(a * 5));
    ring.push([o.lng + (Math.cos(a) * r) / M_LON, o.lat + (Math.sin(a) * r) / M_LAT]);
  }
  return ring;
}

export class FullMap {
  private root: HTMLElement;
  private mapEl: HTMLElement;
  private card: HTMLElement;
  private map: maplibregl.Map | null = null;
  private markers: maplibregl.Marker[] = [];
  private you: maplibregl.Marker | null = null;
  private filter = 'All';
  private timers: number[] = [];
  private routeFor = '';
  isOpen = false;

  constructor(
    private tier: Tier,
    private get: () => View,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'fullmap';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div class="fm-map"></div>
      <div class="fm-top">
        <b>ACCRA</b>
        <div class="fm-chips"></div>
        <button class="fm-close" type="button" aria-label="Close the map">✕</button>
      </div>
      <div class="fm-card"></div>
      <button class="fm-here" type="button">◎ You</button>`;
    document.body.append(this.root);
    this.mapEl = this.root.querySelector('.fm-map')!;
    this.card = this.root.querySelector('.fm-card')!;
    const chips = this.root.querySelector('.fm-chips')!;
    for (const g of [{ name: 'All', icon: '★', kinds: [] }, ...GROUPS]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${g.icon} ${g.name}`;
      b.className = g.name === 'All' ? 'on' : '';
      b.addEventListener('click', () => {
        this.filter = g.name;
        chips.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        this.drawMarkers(true);
      });
      chips.append(b);
    }
    this.root.querySelector('.fm-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fm-here')!.addEventListener('click', () => {
      const { you } = this.get();
      this.map?.flyTo({ center: [you.lng, you.lat], zoom: 16.4, pitch: this.pitch, bearing: 0, duration: 1200 });
    });
    // Touches on the map must not move the player.
    for (const ev of ['pointerdown', 'touchstart', 'wheel']) this.root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  private get pitch() {
    return this.tier === 'light' ? 30 : 52;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    const view = this.get();
    const { you } = view;
    this.map = new maplibregl.Map({
      container: this.mapEl,
      style: buildStyle(this.tier === 'light' ? 'light' : 'standard'),
      center: [you.lng, you.lat],
      zoom: 14.2, // starts high over the open area, then flies down to you
      minZoom: 13.8,
      maxZoom: 18.5,
      // You can look a little past the edge of the open area (to see what is locked), no further.
      maxBounds: [
        Math.min(...view.open.map((o) => o.lng - (o.radius * 1.9) / M_LON)),
        Math.min(...view.open.map((o) => o.lat - (o.radius * 1.9) / M_LAT)),
        Math.max(...view.open.map((o) => o.lng + (o.radius * 1.9) / M_LON)),
        Math.max(...view.open.map((o) => o.lat + (o.radius * 1.9) / M_LAT)),
      ],
      pitch: 0,
      bearing: -25,
      maxPitch: 60,
      pixelRatio: Math.min(devicePixelRatio, this.tier === 'light' ? 1.25 : 1.75),
      attributionControl: { compact: true },
      fadeDuration: 200,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.on('load', () => this.onLoad());
    // Zoomed far out the pins would crowd together: only the goal, you and the area names show.
    this.map.on('zoom', () => this.root.classList.toggle('far', (this.map?.getZoom() ?? 16) < 15.2));
    this.card.innerHTML = this.cardHtml(view);
    this.timers.push(window.setInterval(() => this.tick(), 250));
    this.timers.push(window.setInterval(() => (this.card.innerHTML = this.cardHtml(this.get())), 2000));
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const m of this.markers) m.remove();
    this.markers = [];
    this.you?.remove();
    this.you = null;
    this.map?.remove();
    this.map = null;
    this.routeFor = '';
    this.root.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  private onLoad() {
    const map = this.map!;
    // Live traffic dots and the route: our own layers on top of the city.
    map.addSource('fm-cars', { type: 'geojson', data: empty });
    map.addSource('fm-route', { type: 'geojson', data: empty });
    map.addLayer({
      id: 'fm-route-glow',
      type: 'line',
      source: 'fm-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 7, 18, 18], 'line-opacity': 0.95, 'line-blur': 1.5 },
    });
    map.addLayer({
      id: 'fm-route-line',
      type: 'line',
      source: 'fm-route',
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': '#c8442e', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3.5, 18, 9], 'line-dasharray': [0, 4, 3] },
    });
    // Vehicles drawn as themselves from above (their real shape and colours), turned the way they
    // drive, a little bigger than life when zoomed out so they can be seen.
    for (const [kind, img] of Object.entries(vehicleIcons())) map.addImage(`car-${kind}`, img, { pixelRatio: 2 });
    map.addLayer({
      id: 'fm-cars',
      type: 'symbol',
      source: 'fm-cars',
      layout: {
        'icon-image': ['concat', 'car-', ['get', 'k']],
        'icon-rotate': ['get', 'h'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 14, 0.18, 16, 0.6, 18, 1.4],
      },
    });
    // The locked city: everything outside the open area is greyed out, with a gold dashed edge.
    const rings = this.get().open.map(edgeRing);
    map.addSource('fm-lock', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-1.5, 4.5], [1.5, 4.5], [1.5, 7], [-1.5, 7], [-1.5, 4.5]], ...rings.map((r) => r.slice().reverse())] } },
    });
    map.addSource('fm-edge', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: rings } } });
    map.addLayer({ id: 'fm-lock', type: 'fill', source: 'fm-lock', paint: { 'fill-color': '#4a4f55', 'fill-opacity': 0.66 } }, 'fm-route-glow');
    map.addLayer({ id: 'fm-edge-glow', type: 'line', source: 'fm-edge', paint: { 'line-color': '#e3a92b', 'line-width': 9, 'line-opacity': 0.25, 'line-blur': 4 } }, 'fm-route-glow');
    map.addLayer({ id: 'fm-edge', type: 'line', source: 'fm-edge', paint: { 'line-color': '#e3a92b', 'line-width': 2.5, 'line-dasharray': [3, 2] } }, 'fm-route-glow');
    // Only our own pins: the base map's business names are hidden (no real brands in the game).
    for (const l of map.getStyle().layers) if ((l as { 'source-layer'?: string })['source-layer'] === 'pois') map.setLayoutProperty(l.id, 'visibility', 'none');
    // Soft kente light over the map: a warm water colour and calm land.
    if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', '#5fb6d9');
    const { you } = this.get();
    // The fly-in: from high over Accra down to where you stand.
    map.flyTo({ center: [you.lng, you.lat], zoom: 16.3, pitch: this.pitch, bearing: 0, duration: 2200, curve: 1.3, essential: true });
    this.carLoop();
    map.once('moveend', () => {
      this.drawMarkers(true);
      this.makeRoute();
    });
    this.moveYou();
  }

  private cars = new Map<number, { kind: string; fx: number; fz: number; fh: number; x: number; z: number; h: number; t0: number }>();
  private lastCars = 0;
  /** Glide the vehicles smoothly between the positions the street sends (about 15 times a second on Light). */
  private carLoop() {
    if (!this.map) return;
    requestAnimationFrame(() => this.carLoop());
    const now = performance.now();
    if (now - this.lastCars < (this.tier === 'light' ? 66 : 40)) return;
    this.lastCars = now;
    const features = [];
    for (const [, c] of this.cars) {
      const k = Math.min(1, (now - c.t0) / 250);
      const dh = Math.atan2(Math.sin(c.h - c.fh), Math.cos(c.h - c.fh));
      features.push({
        type: 'Feature' as const,
        properties: { k: VEHICLE_ICON[c.kind] ?? 'car', h: ((c.fh + dh * k) * 180) / Math.PI },
        geometry: { type: 'Point' as const, coordinates: [c.fx + (c.x - c.fx) * k, c.fz + (c.z - c.fz) * k] },
      });
    }
    (this.map.getSource('fm-cars') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }

  private dash = 0;
  private tick() {
    if (!this.map?.isStyleLoaded()) return;
    this.moveYou();
    const view = this.get();
    // New positions for the vehicles; carLoop glides them there.
    const now = performance.now();
    const seen = new Set<number>();
    for (const c of view.cars()) {
      seen.add(c.id);
      const t = this.cars.get(c.id);
      if (t) Object.assign(t, { fx: t.x, fz: t.z, fh: t.h, x: c.lng, z: c.lat, h: c.heading, t0: now });
      else this.cars.set(c.id, { kind: c.kind, fx: c.lng, fz: c.lat, fh: c.heading, x: c.lng, z: c.lat, h: c.heading, t0: now });
    }
    for (const id of [...this.cars.keys()]) if (!seen.has(id)) this.cars.delete(id);
    // The route's dashes march towards the goal.
    const steps: number[][] = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
    this.dash = (this.dash + 1) % steps.length;
    if (this.map.getLayer('fm-route-line')) this.map.setPaintProperty('fm-route-line', 'line-dasharray', steps[this.dash]);
    const key = view.goal ? `${view.goal.lng.toFixed(5)},${view.goal.lat.toFixed(5)}` : '';
    if (key !== this.routeFor && this.markers.length) this.makeRoute();
  }

  private moveYou() {
    if (!this.map) return;
    const { you } = this.get();
    if (!this.you) {
      const el = document.createElement('div');
      el.className = 'fm-you';
      el.innerHTML = '<i></i><b></b>';
      el.style.zIndex = '20'; // always on top of the pins
      this.you = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([you.lng, you.lat]).addTo(this.map);
    }
    this.you.setLngLat([you.lng, you.lat]);
    this.you.setRotation((you.heading * 180) / Math.PI);
  }

  private cardHtml(view: View) {
    const near = (kinds: string[]) => {
      let best: MapPlace | null = null;
      let bestD = Infinity;
      for (const p of view.places) {
        if (!kinds.includes(p.kind)) continue;
        const d = metres(p, view.you);
        if (d < bestD) [best, bestD] = [p, d];
      }
      return best ? bestD : null;
    };
    const rows = [
      ['⛽', 'Filling station', near(['FILLING STATION'])],
      ['🚏', 'Bus stop', near(['BUS STOP', 'BUS TERMINAL', 'LORRY STATION'])],
      ['🍲', 'Chop bar', near(['CHOP BAR'])],
      ['🏧', 'Bank · ATM', near(['ADINKRA BANK', 'ATM', 'MOBILE MONEY'])],
    ].filter((r) => r[2] !== null) as [string, string, number][];
    const pl = view.player;
    const goal = view.goal
      ? `<div class="fm-goalrow"><span>${view.goal.icon ?? '★'}</span><div><small>${pl.mission || 'GOAL'}</small><b>${view.goal.who ? `Meet ${view.goal.who}` : view.goal.label}</b><i>${view.goal.who ? view.goal.label + ' · ' : ''}${far(metres(view.goal, view.you))} away</i></div></div>`
      : '';
    return `<div class="fm-me"><span class="fm-avatar">${pl.name[0]}</span><div><b>${pl.name}</b><small>From ${pl.home} · in ${view.here || 'Accra'}</small></div></div>
      <div class="fm-stats"><span>⚡ ${Math.round(pl.energy)}</span><span>✨ ${pl.vibe}</span><span>₵ ${pl.money.toLocaleString('en-GH')}</span></div>
      ${goal}
      <div class="fm-near">${rows.map(([i, n, d]) => `<span>${i} ${n} <em>${far(d)}</em></span>`).join('')}</div>
      <div class="fm-more">🔒 Open now: ${view.open.map((o) => o.name).join(' and ')}. More of Accra opens up as you play the story.</div>`;
  }

  private drawMarkers(animate: boolean) {
    if (!this.map) return;
    for (const m of this.markers) m.remove();
    this.markers = [];
    const view = this.get();
    const group = GROUPS.find((g) => g.name === this.filter);
    // Nearest first, so the pins drop in rippling out from you.
    const inside = (p: { lng: number; lat: number }) => inAny(view.open, p);
    const list = view.places
      .filter(inside)
      .filter((p) => metres(p, view.you) > 14) // never on top of your own arrow
      .filter((p) => !group || group.kinds.includes(p.kind))
      .filter(() => this.filter !== 'Ads')
      .map((p) => ({ p, d: metres(p, view.you) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 260);
    list.forEach(({ p }, i) => {
      const el = document.createElement('div');
      el.className = 'fm-pin';
      el.style.setProperty('--c', TINT[groupOf(p.kind)?.name ?? ''] ?? '#121a14');
      if (animate) el.style.animationDelay = `${Math.min(1.4, i * 0.012)}s`;
      el.innerHTML = `<span>${ICON[p.kind] ?? '📍'}</span>`;
      el.title = p.kind;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = metres(p, this.get().you);
        new maplibregl.Popup({ closeButton: false, offset: 22, className: 'fm-pop' }).setLngLat([p.lng, p.lat]).setHTML(`<b>${p.kind}</b><span>${far(d)} from you</span>`).addTo(this.map!);
      });
      this.markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(this.map!));
    });
    // The billboards, each with a small picture of its advert, standing on two legs.
    if (this.filter === 'All' || this.filter === 'Ads') {
      const pics = new Map<number, string>();
      // On "All" only a few, spread out (at least 90 m apart), so the map stays clear; all of them under Ads.
      const gap = this.filter === 'Ads' ? 25 : 90;
      const boards: { b: (typeof view.boards)[number] }[] = [];
      for (const b of view.boards.filter(inside).map((b) => ({ b, d: metres(b, view.you) })).sort((a, b) => a.d - b.d)) {
        if (boards.length >= (this.filter === 'Ads' ? 40 : 12)) break;
        if (boards.some((o) => metres(o.b, b.b) < gap)) continue;
        boards.push(b);
      }
      boards.forEach(({ b }, i) => {
        const el = document.createElement('div');
        el.className = 'fm-board';
        if (animate) el.style.animationDelay = `${Math.min(1.6, 0.3 + i * 0.03)}s`;
        if (!pics.has(b.ad)) pics.set(b.ad, view.adPicture(b.ad));
        el.innerHTML = `<img alt="" src="${pics.get(b.ad)}"><i></i>`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          view.openAd(b.ad);
        });
        this.markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([b.lng, b.lat]).addTo(this.map!));
      });
    }
    for (const a of view.areas) {
      const el = document.createElement('div');
      const locked = !inAny(view.open, a);
      el.className = locked ? 'fm-area locked' : 'fm-area';
      el.innerHTML = locked ? `🔒 ${a.name}<small>Opens later in the story</small>` : a.name;
      this.markers.push(new maplibregl.Marker({ element: el }).setLngLat([a.lng, a.lat]).addTo(this.map));
    }
    if (view.goal) {
      const el = document.createElement('div');
      el.className = 'fm-goal';
      el.style.zIndex = '15';
      el.innerHTML = view.goal.who
        ? `<small><b>${view.goal.who}</b>${view.goal.role ? `<i>${view.goal.role}</i>` : ''}</small><span class="who">${view.goal.icon ?? '★'}</span><em></em>`
        : `<small>${view.goal.label}</small><span>${view.goal.icon ?? '★'}</span><em></em>`;
      this.markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([view.goal.lng, view.goal.lat]).addTo(this.map));
    }
    this.moveYou();
  }

  // ---------- The route along the real roads ----------

  private makeRoute() {
    const map = this.map;
    if (!map) return;
    const { you, goal } = this.get();
    this.routeFor = goal ? `${goal.lng.toFixed(5)},${goal.lat.toFixed(5)}` : '';
    const src = map.getSource('fm-route') as GeoJSONSource | undefined;
    if (!src) return;
    if (!goal) return src.setData(empty);
    const path = this.roadPath(you, goal);
    src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } });
    // Show the whole route when the goal is out of view.
    const b = map.getBounds();
    if (!b.contains([goal.lng, goal.lat])) {
      const bounds = new maplibregl.LngLatBounds([you.lng, you.lat], [you.lng, you.lat]);
      for (const c of path) bounds.extend(c as [number, number]);
      map.fitBounds(bounds, { padding: { top: 90, bottom: 60, left: 260, right: 60 }, pitch: this.pitch, duration: 1200, maxZoom: 16.5 });
    }
  }

  /**
   * The shortest way along the roads the map has loaded, or a straight line if none is found.
   * The roads are laid on a grid of 4 m squares, so roads that cross always join up, then A* finds
   * the way and the corners are smoothed out.
   */
  private roadPath(from: { lng: number; lat: number }, to: { lng: number; lat: number }): number[][] {
    const map = this.map!;
    const straight = [[from.lng, from.lat], [to.lng, to.lat]];
    const CELL = 4;
    const ox = from.lng;
    const oz = from.lat;
    const span = Math.max(600, metres(from, to) * 1.6 + 300);
    const toXZ = (c: number[]) => [(c[0] - ox) * M_LON, (oz - c[1]) * M_LAT];
    const road = new Set<number>();
    const K = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
    for (const f of map.querySourceFeatures('accra', { sourceLayer: 'roads' })) {
      const g = f.geometry;
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const [ax, az] = toXZ(line[i - 1]);
          const [bx, bz] = toXZ(line[i]);
          if (Math.min(Math.abs(ax), Math.abs(bx)) > span && Math.min(Math.abs(az), Math.abs(bz)) > span) continue;
          const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
          for (let k = 0; k <= n; k++) road.add(K(Math.round((ax + ((bx - ax) * k) / n) / CELL), Math.round((az + ((bz - az) * k) / n) / CELL)));
        }
      }
    }
    if (!road.size) return straight;
    const nearestCell = (x: number, z: number) => {
      const ci = Math.round(x / CELL);
      const cj = Math.round(z / CELL);
      for (let r = 0; r <= 25; r++)
        for (let i = -r; i <= r; i++)
          for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r && road.has(K(ci + i, cj + j))) return [ci + i, cj + j];
      return null;
    };
    const [tx, tz] = toXZ([to.lng, to.lat]);
    const s0 = nearestCell(0, 0);
    const e0 = nearestCell(tx, tz);
    if (!s0 || !e0) return straight;
    const endK = K(e0[0], e0[1]);
    const h = (i: number, j: number) => Math.hypot(i - e0[0], j - e0[1]);
    const heap: [number, number, number, number][] = []; // f, key, i, j
    const push = (e: [number, number, number, number]) => {
      heap.push(e);
      let i = heap.length - 1;
      while (i > 0) {
        const q = (i - 1) >> 1;
        if (heap[q][0] <= heap[i][0]) break;
        [heap[q], heap[i]] = [heap[i], heap[q]];
        i = q;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const cost = new Map<number, number>([[K(s0[0], s0[1]), 0]]);
    const came = new Map<number, number>();
    push([h(s0[0], s0[1]), K(s0[0], s0[1]), s0[0], s0[1]]);
    let found = false;
    for (let guard = 0; heap.length && guard < 80000; guard++) {
      const [, k, i, j] = pop();
      if (k === endK) {
        found = true;
        break;
      }
      const base = cost.get(k)!;
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const nk = K(i + di, j + dj);
          if (!road.has(nk)) continue;
          const c = base + (di && dj ? 1.414 : 1);
          if (c < (cost.get(nk) ?? Infinity)) {
            cost.set(nk, c);
            came.set(nk, k);
            push([c + h(i + di, j + dj), nk, i + di, j + dj]);
          }
        }
    }
    if (!found) return straight;
    // Back from the goal, then smooth: drop points that lie nearly on the line between their neighbours.
    const cells: number[][] = [];
    for (let k: number | undefined = endK; k !== undefined; k = came.get(k)) cells.push([(Math.floor(k / 8192) - 4096) * CELL, ((k % 8192) - 4096) * CELL]);
    cells.reverse();
    const simple = (pts: number[][], eps: number): number[][] => {
      if (pts.length < 3) return pts;
      const [a, b] = [pts[0], pts[pts.length - 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let worst = 0;
      let at = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / len;
        if (d > worst) [worst, at] = [d, i];
      }
      if (worst < eps) return [a, b];
      return [...simple(pts.slice(0, at + 1), eps).slice(0, -1), ...simple(pts.slice(at), eps)];
    };
    const path = simple([[0, 0], ...cells, [tx, tz]], 3.5);
    return path.map(([x, z]) => [ox + x / M_LON, oz - z / M_LAT]);
  }
}
