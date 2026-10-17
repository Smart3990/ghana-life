import './style.css';
import { applyLight, createMap, flyIn } from './map/createMap';
import { detectTier, forcedTier, measureFps, recordSlowRun } from './map/tier';
import { startTour } from './map/tour';
import { enableWalking } from './game/walking';
import { Live } from './net/live';
import { playerName } from './net/names';

const SPLASH_MS = 3000;
const MIN_FPS = 20; // below this, 3D is too heavy for the device

const started = performance.now();
const debug = new URLSearchParams(window.location.search).has('debug');
const detected = detectTier();
let tier = detected.tier;

// The map starts loading right away, hidden behind the welcome screen.
const map = createMap(document.getElementById('map')!, tier);
const mapLoaded = new Promise<void>((resolve) => map.once('load', () => resolve()));
if (debug) (window as unknown as { gameMap: typeof map }).gameMap = map; // for testing from the browser console

const splash = document.getElementById('splash')!;
const hud = document.querySelector<HTMLElement>('.hud')!;
const place = document.getElementById('place')!;
const online = document.getElementById('online')!;
const debugLine = document.getElementById('debug')!;
const showDebug = (text: string) => {
  if (!debug) return;
  debugLine.hidden = false;
  debugLine.textContent = text;
};

// Fade the place name out and back in when the tour reaches a new area.
const showPlace = (name: string) => {
  place.classList.add('changing');
  setTimeout(() => {
    place.textContent = name;
    place.classList.remove('changing');
  }, 250);
};

// Short messages at the bottom of the screen, gone after a few seconds.
const toastBox = document.getElementById('toast')!;
let toastTimer = 0;
const showToast = (text: string) => {
  toastBox.textContent = text;
  toastBox.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastBox.hidden = true), 3500);
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

  // Let the square finish loading, then start the tour of Accra (it begins by circling the monument).
  await new Promise<void>((resolve) => map.once('idle', () => resolve()));
  startTour(map, () => tier, showPlace);
  let live: Live | null = null;
  const me = enableWalking(map, showToast, (path, speed) => live?.sendWalk(path, speed));
  live = new Live(map, me, playerName(), (count) => {
    online.textContent = count > 1 ? `${count} here` : '';
  });
  if (tier === 'light') return;

  // Watch the frame rate during the first seconds of the tour. Only repeated slowness switches to Light.
  const fps = await measureFps(3);
  showDebug(`${tier} (${detected.reason}) · ${Math.round(fps)} fps`);
  if (fps < MIN_FPS && !forcedTier() && recordSlowRun()) {
    tier = 'light';
    applyLight(map);
    showDebug(`light (slow: ${Math.round(fps)} fps)`);
  }
}

start();
