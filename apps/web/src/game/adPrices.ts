// Advert prices by place (design brief 18.2; made much cheaper by the owner on 28 Oct 2026, to make
// sense for Ghanaian businesses: a week costs about what a small seller spends on a few days' chop,
// so a kelewele seller, a phone shop or a church can try it). Everybody pays
// the same (no discounts for now). The busier the place, and the bigger the moving advert, the more
// it costs. Prices are in cedis a week and are only shown here:
// the server decides what is charged (all money is decided on the server).
export type AdPlaceKey = 'street' | 'mainroad' | 'station' | 'airport' | 'taxi' | 'trotro' | 'bus';
export type AdPlace = { key: AdPlaceKey; kind: 'billboard' | 'vehicle'; name: string; note: string; price: number; icon: string };

export const AD_PLACES: AdPlace[] = [
  { key: 'street', kind: 'billboard', icon: '🏘️', name: 'Billboard on a side street', note: 'neighbourhood roads, seen by people walking', price: 25 },
  { key: 'mainroad', kind: 'billboard', icon: '🛣️', name: 'Billboard on a main road', note: 'Ring Road, the highways and the big junctions', price: 40 },
  { key: 'station', kind: 'billboard', icon: '🚌', name: 'Billboard at a busy station', note: 'lorry stations, markets and bus terminals', price: 60 },
  { key: 'airport', kind: 'billboard', icon: '✈️', name: 'Billboard at the airport', note: 'on the roads round Kotoka International Airport', price: 100 },
  { key: 'taxi', kind: 'vehicle', icon: '🚕', name: 'On a taxi roof screen', note: 'the screen on its roof, both sides, all over the city', price: 35 },
  { key: 'trotro', kind: 'vehicle', icon: '🚐', name: 'On a moving trotro', note: 'the whole of both sides, on its real route all day', price: 60 },
  { key: 'bus', kind: 'vehicle', icon: '🚍', name: 'On a moving city bus', note: 'the biggest moving advert: both whole sides, across the city', price: 90 },
];
export const adPlace = (key: AdPlaceKey) => AD_PLACES.find((p) => p.key === key)!;

const AIRPORT: [number, number] = [-0.1709, 5.6052]; // Kotoka International Airport
/**
 * What kind of place a billboard stands in: near the airport, at a busy station or market, on a main
 * road, or on a side street. `near(kinds, metres)` says if one of those places is that close.
 */
export function billboardPlace(lng: number, lat: number, onMainRoad: boolean, near: (kinds: string[], metres: number) => boolean): AdPlaceKey {
  const dx = (lng - AIRPORT[0]) * 110800;
  const dz = (lat - AIRPORT[1]) * 111200;
  if (Math.hypot(dx, dz) < 1400) return 'airport';
  if (near(['LORRY STATION', 'BUS STATION', 'MARKET', 'TAXI RANK'], 140)) return 'station';
  return onMainRoad ? 'mainroad' : 'street';
}
/** A vehicle's advert place. */
export function vehiclePlace(kind: string): AdPlaceKey {
  return kind === 'bus' ? 'bus' : kind === 'trotro' ? 'trotro' : 'taxi';
}
