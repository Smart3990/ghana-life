import './style.css';
import { createMap, pixelRatioFor } from './map/createMap';
import { buildStyle, type Tier } from './map/style';

const TIER_KEY = 'gl.tier';

function savedTier(): Tier {
  try {
    return localStorage.getItem(TIER_KEY) === 'full' ? 'full' : 'light';
  } catch {
    return 'light';
  }
}

let tier = savedTier();
const started = performance.now();
const map = createMap(document.getElementById('map')!, tier);

const status = document.getElementById('status')!;
const tierButton = document.getElementById('tier') as HTMLButtonElement;
const showTier = () => (tierButton.textContent = tier === 'light' ? 'Light mode' : 'Full mode');
showTier();

// "Map ready" = first moment everything on screen has finished drawing.
map.once('idle', () => {
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  status.textContent = `Map ready in ${seconds} s`;
});

tierButton.addEventListener('click', () => {
  tier = tier === 'light' ? 'full' : 'light';
  try {
    localStorage.setItem(TIER_KEY, tier);
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
  map.setPixelRatio(pixelRatioFor(tier));
  map.setStyle(buildStyle(tier));
  showTier();
});
