// Every vehicle on Accra's roads (step 4 of the Epic City plan; owner, 28 Oct 2026: "all types of cars
// from the pack displayed in the catalogue should all be on the streets"). Each kind of traffic (car,
// taxi, trotro, ...) comes in the Low Poly Epic City pack's models, mixed by how often you see them.
// `paint`: the model's colours that are its paintwork (repainted per vehicle); left out, the vehicle
// keeps the pack's own colours (police blue and white, fire-engine red, the yellow school bus...).
// Lengths and widths are the models' own (metres), used by the drivers to keep their distance.
import type { Kind } from './traffic';

export type VehicleType = {
  key: string;
  kind: Kind;
  file?: string; // the pack model (public/models/epic/vehicles); none: our own model (tricycles)
  paint?: string[];
  white?: string[];
  len: number;
  width: number;
  weight: number; // how often, among its kind
  speed?: number; // times its kind's usual speed
};

export const VEHICLE_TYPES: VehicleType[] = [
  // Cars
  { key: 'car', kind: 'car', file: 'car-passenger', paint: ['dbdbda'], len: 4.72, width: 2.1, weight: 52 },
  { key: 'hatch', kind: 'car', file: 'car-passenger', paint: ['dbdbda'], len: 4.72, width: 2.1, weight: 18 },
  { key: 'police', kind: 'car', file: 'car-police', len: 5.44, width: 2.19, weight: 6 },
  { key: 'veteran', kind: 'car', file: 'car-veteran', len: 4.4, width: 1.72, weight: 4, speed: 0.8 },
  { key: 'race', kind: 'car', file: 'car-passenger-race', len: 4.81, width: 2.1, weight: 4 },
  { key: 'jeep', kind: 'car', file: 'jeep-open', len: 4.09, width: 1.83, weight: 5 },
  { key: 'formula', kind: 'car', file: 'car-formula', len: 4.86, width: 1.8, weight: 0.7, speed: 1.2 },
  { key: 'golfcart', kind: 'car', file: 'golf-cart', len: 2.39, width: 1.23, weight: 0.5, speed: 0.5 },
  { key: 'taxi', kind: 'taxi', file: 'car-taxi', paint: ['fdcf24'], len: 5.35, width: 2.19, weight: 1 },
  { key: 'suv', kind: 'suv', file: 'car-passenger', paint: ['dbdbda'], len: 4.72, width: 2.1, weight: 75 },
  { key: 'suvjeep', kind: 'suv', file: 'jeep-open', len: 4.09, width: 1.83, weight: 25 },
  // Pickups and vans
  { key: 'pickup', kind: 'pickup', file: 'car-baywatch', paint: ['fdcf24'], len: 5.27, width: 1.96, weight: 68 },
  { key: 'tow', kind: 'pickup', file: 'car-tow-truck', len: 5.43, width: 1.96, weight: 14 },
  { key: 'firepickup', kind: 'pickup', file: 'car-firefighter-pickup', len: 6.24, width: 2.43, weight: 7 },
  { key: 'ambulance', kind: 'pickup', file: 'car-ambulance-pickup', len: 6.24, width: 2.43, weight: 8 },
  { key: 'trotro', kind: 'trotro', file: 'car-hippie-van', paint: ['35ccdd'], white: ['b7f0f2'], len: 4.38, width: 1.83, weight: 66 },
  { key: 'sprinter', kind: 'trotro', file: 'car-hippie-van', paint: ['35ccdd'], white: ['b7f0f2'], len: 4.38, width: 1.83, weight: 34 },
  // Buses
  { key: 'bus', kind: 'bus', file: 'bus-passenger', paint: ['dbdbda'], len: 11.28, width: 2.85, weight: 74 },
  { key: 'schoolbus', kind: 'bus', file: 'bus-school', len: 9.77, width: 3.03, weight: 26 },
  // Lorries and machines
  { key: 'truck', kind: 'truck', file: 'truck', paint: ['e44935'], len: 6.3, width: 2.26, weight: 32 },
  { key: 'dump', kind: 'truck', file: 'car-truck-dump', len: 8.94, width: 2.57, weight: 17 },
  { key: 'tanker', kind: 'truck', file: 'car-truck-tanker', len: 10.9, width: 2.57, weight: 13 },
  { key: 'cement', kind: 'truck', file: 'car-truck-cement', len: 8.93, width: 2.59, weight: 13 },
  { key: 'firetruck', kind: 'truck', file: 'firetruck', len: 8.54, width: 3.02, weight: 5 },
  { key: 'armored', kind: 'truck', file: 'armored-truck', len: 5.85, width: 2.29, weight: 6 },
  { key: 'roller', kind: 'truck', file: 'road-roller', len: 4.86, width: 3, weight: 2.5, speed: 0.4 },
  { key: 'bulldozer', kind: 'truck', file: 'bulldozer', len: 4.88, width: 2.9, weight: 2.5, speed: 0.45 },
  { key: 'excavator', kind: 'truck', file: 'excavator', len: 7.48, width: 3.1, weight: 1.5, speed: 0.4 },
  { key: 'crane', kind: 'truck', file: 'crane-crawler', len: 8.27, width: 3.1, weight: 1, speed: 0.35 },
  { key: 'forklift', kind: 'truck', file: 'forklift', len: 3.6, width: 1.14, weight: 1.5, speed: 0.4 },
  // Two and three wheels
  { key: 'okada', kind: 'okada', file: 'motorbike-old', paint: ['ca3038'], len: 2.17, width: 0.83, weight: 1 },
  { key: 'tricycle', kind: 'tricycle', len: 3, width: 1.4, weight: 50 }, // our own pragya
  { key: 'motorking', kind: 'tricycle', len: 3, width: 1.4, weight: 50 }, // our own motor king
];
export const TYPE_BY_KEY = new Map(VEHICLE_TYPES.map((t) => [t.key, t]));

const hash = (n: number) => {
  let x = Math.imul(n ^ 0x2545f491, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca77);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
};
const BY_KIND = new Map<Kind, VehicleType[]>();
for (const t of VEHICLE_TYPES) (BY_KIND.get(t.kind) ?? BY_KIND.set(t.kind, []).get(t.kind)!).push(t);
/** Which model a vehicle of this kind and number is (always the same for the same number). */
export function typeFor(kind: Kind, id: number): VehicleType {
  const list = BY_KIND.get(kind)!;
  const total = list.reduce((s, t) => s + t.weight, 0);
  let r = hash(id) * total;
  for (const t of list) if ((r -= t.weight) < 0) return t;
  return list[0];
}
