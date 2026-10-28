// Day and night by the real time in Accra (step 3 of the Epic City plan).
// Accra keeps GMT all year, so the game's clock is the real UTC time. The sun's place in the sky is
// worked out for Accra on today's date (sunrise about 6:00 and sunset about 18:00, moving a little
// through the year), and the light, sky and night lights follow it.
import * as THREE from 'three';

const LAT = 5.56;
const LON = -0.2;
const rad = Math.PI / 180;

/** Where the sun is over Accra at this moment: height above the horizon and compass bearing (degrees). */
export function sunOverAccra(ms: number): { elevation: number; azimuth: number } {
  // A standard short form of the sun's position (accurate to well under a degree).
  const d = ms / 86400000 - 10957.5; // days since 1 Jan 2000, 12:00 UTC
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const h = ((gmst + LON / 15) * 15) * rad - ra;
  const lat = LAT * rad;
  const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(-Math.sin(h), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(h));
  return { elevation: el / rad, azimuth: ((az / rad) + 360) % 360 };
}

type Look = {
  el: number; // sun height (degrees) this look is for
  sun: string; sunI: number; // the sun's (or moon's) light
  sky: string; ground: string; skyI: number; // light from the sky
  env: number; // share of the image-based sky light
  mapSky: string; horizon: string; fog: string; // the map's sky
  dim: number; // how much the map's flat ground is darkened
  shade: number; // shadow strength
};
// From deep night to high noon. In between, everything is blended.
// (Owner, 28 Oct 2026: "people and cars should never lose their colours at any time of day, just a
// little shade so we can tell the difference." So the night light is a soft, nearly white moonlight
// at about three quarters of the day's; the dark sky, lit windows and street lights say it is night.)
const LOOKS: Look[] = [
  { el: -14, sun: '#e4eaff', sunI: 1.35, sky: '#d6ddf2', ground: '#5d5c66', skyI: 0.95, env: 0.7, mapSky: '#060c1c', horizon: '#131f3c', fog: '#0f182c', dim: 0.32, shade: 0.14 },
  { el: -6, sun: '#ece2f2', sunI: 1.3, sky: '#dfd4e4', ground: '#5e5052', skyI: 0.94, env: 0.74, mapSky: '#23305a', horizon: '#c0684a', fog: '#3a3550', dim: 0.2, shade: 0.15 },
  { el: -1, sun: '#ffb488', sunI: 1.4, sky: '#f2cbb8', ground: '#5c463a', skyI: 0.92, env: 0.78, mapSky: '#5d5a8a', horizon: '#f59a5a', fog: '#d8a080', dim: 0.1, shade: 0.2 },
  { el: 4, sun: '#ffa868', sunI: 1.8, sky: '#ffd8b0', ground: '#5a4232', skyI: 0.92, env: 0.85, mapSky: '#e8935a', horizon: '#ffd09a', fog: '#f0c49a', dim: 0.05, shade: 0.26 },
  { el: 16, sun: '#ffcb94', sunI: 2.3, sky: '#fff1dc', ground: '#6b4f3a', skyI: 1, env: 1, mapSky: '#f2b36b', horizon: '#f7d9b0', fog: '#f1d7b6', dim: 0, shade: 0.3 },
  { el: 40, sun: '#fff2df', sunI: 2.7, sky: '#f4f6ff', ground: '#7a6450', skyI: 1.08, env: 1.1, mapSky: '#8ec1e6', horizon: '#e4edf2', fog: '#e8eef0', dim: 0, shade: 0.32 },
];

export type DayLook = {
  hour: number; // 0-24, Accra time
  elevation: number;
  dir: THREE.Vector3; // towards the light (sun by day, moon at night), x east, y up, z south
  sun: THREE.Color; sunI: number;
  sky: THREE.Color; ground: THREE.Color; skyI: number;
  env: number;
  mapSky: string; horizon: string; fog: string;
  dim: number;
  shade: number;
  /** 0 by day, 1 at night: street lights, windows, headlights. */
  night: number;
};

const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const hex = (c: THREE.Color) => '#' + c.getHexString();

/**
 * The game's time. Normally the real time in Accra; `?hour=19.5` starts the clock at another hour
 * (for testing) and `?timescale=60` makes it run faster.
 */
export class GameTime {
  private offset = 0;
  constructor(private scale = 1, startHour?: number) {
    if (startHour !== undefined) {
      const now = new Date();
      const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      this.offset = today + startHour * 3600000 - now.getTime();
    }
    this.started = Date.now();
  }
  private started: number;
  /** Milliseconds since 1970 in game time. */
  now() {
    const real = Date.now();
    return this.started + this.offset + (real - this.started) * this.scale;
  }
  /** Set the hour (0-24) of today, keeping the speed. */
  setHour(h: number) {
    const now = this.now();
    const d = new Date(now);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    this.offset += today + h * 3600000 - now;
  }
}

/** The look of the city at a moment of game time. */
export function dayLook(ms: number): DayLook {
  const { elevation, azimuth } = sunOverAccra(ms);
  let i = 0;
  while (i < LOOKS.length - 2 && elevation > LOOKS[i + 1].el) i++;
  const a = LOOKS[i], b = LOOKS[i + 1];
  const t = THREE.MathUtils.clamp((elevation - a.el) / (b.el - a.el), 0, 1);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  // By day the light comes from the sun; once it has set, from a moon high in the east-south-east.
  const up = elevation > -1;
  const el = up ? Math.max(elevation, 3) : 55;
  const az = up ? azimuth : 115;
  const dir = new THREE.Vector3(Math.sin(az * rad) * Math.cos(el * rad), Math.sin(el * rad), -Math.cos(az * rad) * Math.cos(el * rad));
  const d = new Date(ms);
  return {
    hour: d.getUTCHours() + d.getUTCMinutes() / 60,
    elevation,
    dir,
    sun: mix(a.sun, b.sun, t), sunI: lerp(a.sunI, b.sunI),
    sky: mix(a.sky, b.sky, t), ground: mix(a.ground, b.ground, t), skyI: lerp(a.skyI, b.skyI),
    env: lerp(a.env, b.env),
    mapSky: hex(mix(a.mapSky, b.mapSky, t)), horizon: hex(mix(a.horizon, b.horizon, t)), fog: hex(mix(a.fog, b.fog, t)),
    dim: lerp(a.dim, b.dim),
    shade: lerp(a.shade, b.shade),
    // Lights come on as the sun goes down (from 3 degrees above the horizon) and are full at dusk.
    night: THREE.MathUtils.smoothstep(-elevation, -3, 4),
  };
}

/**
 * Words that fit the time of day: "Good afternoon" becomes "Good morning" or "Good evening", and
 * talk of the hot sun becomes talk of the warm night after dark.
 */
export function forTheHour(text: string, hour: number) {
  const greet = hour < 12 ? 'Good morning' : hour < 16.5 ? 'Good afternoon' : 'Good evening';
  let t = text.replace(/Good (morning|afternoon|evening)/g, greet);
  if (hour >= 18.3 || hour < 6) t = t.replace('Ei, the sun is hot oo!', 'Ei, the night is warm oo!').replace('the sun is hot today', 'the night is warm').replace('this afternoon', 'tonight');
  return t;
}

/**
 * How full Accra's roads are at this hour (0-1 of the vehicles that can be on them): packed in the
 * morning rush (6:30-9:30) and the evening rush (16:30-20:00, the worst), busy in the day, thinner
 * late at night. It changes smoothly, so traffic fills up and empties out gradually.
 */
export function roadFill(hour: number) {
  const keys: [number, number][] = [[0, 0.5], [4.5, 0.45], [6, 0.75], [7.5, 1], [9.5, 0.9], [11, 0.75], [14, 0.75], [16.5, 0.92], [18, 1], [20, 0.95], [21.5, 0.75], [23, 0.55], [24, 0.5]];
  for (let i = 1; i < keys.length; i++) {
    if (hour <= keys[i][0]) {
      const [h0, f0] = keys[i - 1], [h1, f1] = keys[i];
      const t = (hour - h0) / (h1 - h0);
      return f0 + (f1 - f0) * (t * t * (3 - 2 * t));
    }
  }
  return 0.5;
}
