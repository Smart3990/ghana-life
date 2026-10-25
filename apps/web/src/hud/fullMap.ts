// The big map: tap the minimap (or the Map app on the phone) to see the whole city, the real
// streets and area names, where you are, your goal, and the places around: filling stations, bus
// stops, the lorry station, banks, chop bars, pharmacies, clinics, churches, mosques, schools,
// markets, police. Filter by kind; drag and pinch to look around. A second map is made only while
// it is open, so it costs nothing the rest of the time.
import * as maplibregl from 'maplibre-gl';
import { buildStyle } from '../map/style';

export type MapPlace = { lng: number; lat: number; kind: string };
type Group = { name: string; icon: string; kinds: string[] };

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
];
const ICON: Record<string, string> = {
  'FILLING STATION': '⛽', 'BUS STOP': '🚏', 'BUS TERMINAL': '🚌', 'LORRY STATION': '🚐', 'CHOP BAR': '🍲', MARKET: '🧺', SUPERMARKET: '🛒',
  'DRINKING SPOT': '🍻', 'ADINKRA BANK': '🏦', ATM: '🏧', 'MOBILE MONEY': '📲', PHARMACY: '💊', CLINIC: '🏥', CHURCH: '⛪', MOSQUE: '🕌',
  SCHOOL: '🏫', 'PHONES & ELECTRONICS': '📱', 'FASHION HOUSE': '👗', 'BARBERING & SALON': '💈', HARDWARE: '🔨', 'PRINTING & BOOKS': '📚',
  'LOTTO KIOSK': '🎟️', 'FITTING SHOP': '🔧', 'POLICE STATION': '👮', 'FIRE STATION': '🚒', 'POST OFFICE': '📮', HOTEL: '🏨',
};

export class FullMap {
  private root: HTMLElement;
  private mapEl: HTMLElement;
  private map: maplibregl.Map | null = null;
  private markers: maplibregl.Marker[] = [];
  private you: maplibregl.Marker | null = null;
  private filter = 'All';
  private timer = 0;
  isOpen = false;

  constructor(private get: () => { you: { lng: number; lat: number; heading: number }; goal: { lng: number; lat: number; label: string } | null; places: MapPlace[]; areas: { name: string; lng: number; lat: number }[] }) {
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
      <button class="fm-here" type="button">◎ You</button>
      <div class="fm-note">More of Ghana opens up as you play the story.</div>`;
    document.body.append(this.root);
    this.mapEl = this.root.querySelector('.fm-map')!;
    const chips = this.root.querySelector('.fm-chips')!;
    for (const g of [{ name: 'All', icon: '★', kinds: [] }, ...GROUPS]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${g.icon} ${g.name}`;
      b.className = g.name === 'All' ? 'on' : '';
      b.addEventListener('click', () => {
        this.filter = g.name;
        chips.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        this.drawMarkers();
      });
      chips.append(b);
    }
    this.root.querySelector('.fm-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fm-here')!.addEventListener('click', () => {
      const { you } = this.get();
      this.map?.easeTo({ center: [you.lng, you.lat], zoom: 16, duration: 600 });
    });
    // Touches on the map must not move the player.
    for (const ev of ['pointerdown', 'touchstart', 'wheel']) this.root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    const { you } = this.get();
    this.map = new maplibregl.Map({
      container: this.mapEl,
      style: buildStyle('light'),
      center: [you.lng, you.lat],
      zoom: 15.6,
      minZoom: 11,
      maxZoom: 18.5,
      maxBounds: [-0.8, 5.25, 0.95, 6.3],
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      pixelRatio: Math.min(devicePixelRatio, 1.5),
      attributionControl: { compact: true },
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.on('load', () => {
      // The map's own buildings flat and light, so the markers stand out.
      for (const id of ['buildings', 'roofs']) if (this.map?.getLayer(id)?.type === 'fill-extrusion') this.map.setPaintProperty(id, 'fill-extrusion-height', 0);
    });
    this.drawMarkers();
    this.timer = window.setInterval(() => this.moveYou(), 300);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    clearInterval(this.timer);
    for (const m of this.markers) m.remove();
    this.markers = [];
    this.you?.remove();
    this.you = null;
    this.map?.remove();
    this.map = null;
    this.root.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  private moveYou() {
    if (!this.map) return;
    const { you } = this.get();
    if (!this.you) {
      const el = document.createElement('div');
      el.className = 'fm-you';
      this.you = new maplibregl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat([you.lng, you.lat]).addTo(this.map);
    }
    this.you.setLngLat([you.lng, you.lat]);
    this.you.setRotation((you.heading * 180) / Math.PI);
  }

  private drawMarkers() {
    if (!this.map) return;
    for (const m of this.markers) m.remove();
    this.markers = [];
    const { places, goal, areas } = this.get();
    const group = GROUPS.find((g) => g.name === this.filter);
    for (const p of places) {
      if (group && !group.kinds.includes(p.kind)) continue;
      const el = document.createElement('div');
      el.className = 'fm-pin';
      el.textContent = ICON[p.kind] ?? '📍';
      el.title = p.kind;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        new maplibregl.Popup({ closeButton: false, offset: 14 }).setLngLat([p.lng, p.lat]).setHTML(`<b>${p.kind}</b>`).addTo(this.map!);
      });
      this.markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(this.map));
    }
    for (const a of areas) {
      const el = document.createElement('div');
      el.className = 'fm-area';
      el.textContent = a.name;
      this.markers.push(new maplibregl.Marker({ element: el }).setLngLat([a.lng, a.lat]).addTo(this.map));
    }
    if (goal) {
      const el = document.createElement('div');
      el.className = 'fm-goal';
      el.innerHTML = `<span>★</span><small>${goal.label}</small>`;
      this.markers.push(new maplibregl.Marker({ element: el }).setLngLat([goal.lng, goal.lat]).addTo(this.map));
    }
    this.moveYou();
  }
}
