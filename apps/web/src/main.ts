import './style.css';
import { applyLight, createMap, flyIn, startIdleOrbit } from './map/createMap';
import { detectTier, forcedTier, measureFps, recordSlowRun } from './map/tier';

const SPLASH_MS = 3000;
const MIN_FPS = 20; // below this, 3D is too heavy for the device

const started = performance.now();
const debug = new URLSearchParams(window.location.search).has('debug');
const detected = detectTier();
let tier = detected.tier;

// The map starts loading right away, hidden behind the welcome screen.
const map = createMap(document.getElementById('map')!, tier);
const mapLoaded = new Promise<void>((resolve) => map.once('load', () => resolve()));

const splash = document.getElementById('splash')!;
const hud = document.querySelector<HTMLElement>('.hud')!;
const debugLine = document.getElementById('debug')!;
const showDebug = (text: string) => {
  if (!debug) return;
  debugLine.hidden = false;
  debugLine.textContent = text;
};

// Welcome screen: 3 seconds, or sooner if the player taps it.
const splashDone = new Promise<void>((resolve) => {
  const leave = () => {
    splash.classList.add('leaving');
    setTimeout(() => splash.remove(), 700);
    resolve();
  };
  const timer = setTimeout(leave, SPLASH_MS);
  splash.addEventListener('click', () => {
    clearTimeout(timer);
    leave();
  }, { once: true });
});

async function start() {
  await Promise.all([splashDone, mapLoaded]);
  hud.hidden = false;
  showDebug(`${tier} (${detected.reason}) · ${((performance.now() - started) / 1000).toFixed(1)} s`);

  await flyIn(map, tier);
  if (tier === 'light') return;

  // Let the houses finish loading first, so the frame rate is measured on a full street.
  await new Promise<void>((resolve) => map.once('idle', () => resolve()));

  // Watch the frame rate while the camera circles. Only repeated slowness switches to Light.
  const stopOrbit = startIdleOrbit(map);
  const fps = await measureFps(3);
  showDebug(`${tier} (${detected.reason}) · ${Math.round(fps)} fps`);
  if (fps < MIN_FPS && !forcedTier() && recordSlowRun()) {
    stopOrbit();
    tier = 'light';
    applyLight(map);
    showDebug(`light (slow: ${Math.round(fps)} fps)`);
  }
}

start();
