import './style.css';
import { applyTier, createMap, flyIn } from './map/createMap';
import { detectTier, forcedTier, measureFps, MIN_FPS, recordSlow, tierBelow } from './map/tier';
import { startTour } from './map/tour';
import { enableWalking } from './game/walking';
import { keepSessionSaved, loadSession } from './game/session';
import { Live } from './net/live';
import { playerName } from './net/names';
import { openPlayerMenu, setUpChatBar } from './ui/chat';
import { startTraffic } from './game/traffic';
import { startPlanes } from './game/planes';
import { houseRules } from './ui/rules';
import { offerFullBrowser } from './ui/inapp';

const SPLASH_MS = 3000;

const started = performance.now();
const debug = new URLSearchParams(window.location.search).has('debug');
const detected = detectTier();
let tier = detected.tier;

// Coming back after a refresh (or soon after leaving)? Return to the same spot,
// without replaying the welcome screen, the glide and the tour.
const session = loadSession();
const returning = !!session;
const camera = session && (tier === 'light' ? { ...session.camera, pitch: 0, bearing: 0 } : session.camera);

// The map starts loading right away, hidden behind the welcome screen.
const map = createMap(document.getElementById('map')!, tier, camera ?? undefined);
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

// Welcome screen: 3 seconds, or sooner if the player taps it. Skipped for returning players.
const splashDone = new Promise<void>((resolve) => {
  if (returning) {
    splash.remove();
    resolve();
    return;
  }
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
  offerFullBrowser();
  await splashDone;
  await houseRules(); // first visit only (and again if the rules change)
  await mapLoaded;
  hud.hidden = false;
  showDebug(`${tier} (${detected.reason}) · ${((performance.now() - started) / 1000).toFixed(1)} s`);

  if (returning) {
    showPlace('Accra');
  } else {
    await flyIn(map, tier);
    // Let the square finish loading, then start the tour of Accra (it begins by circling the monument).
    await new Promise<void>((resolve) => map.once('idle', () => resolve()));
    // The tour downloads many map tiles; Light (data saver, weak phones) skips it.
    if (tier !== 'light') startTour(map, () => tier, showPlace);
  }

  let live: Live | null = null;
  const me = enableWalking(map, showToast, (path, speed) => live?.sendWalk(path, speed), session?.avatar);
  live = new Live(map, me, playerName(), {
    onCount: (count) => (online.textContent = count > 1 ? `${count} here` : ''),
    toast: showToast,
    openMenu: (player) => live && openPlayerMenu(player, live, showToast),
  });
  setUpChatBar(() => live, showToast);
  startTraffic(map, () => tier, () => live?.serverNow() ?? Date.now());
  startPlanes(map, () => live?.serverNow() ?? Date.now());
  keepSessionSaved(map, () => me.position);

  // Watch the frame rate while playing. Two slow checks in a row step down one tier
  // (Ultra to Standard to Light). With ?debug the tier and frame rate show live.
  // Wait for the street to load, but not forever: during the tour the camera never stops moving.
  await new Promise<void>((resolve) => {
    map.once('idle', () => resolve());
    setTimeout(resolve, 6000);
  });
  let slowChecks = 0;
  for (;;) {
    const fps = await measureFps(2);
    showDebug(`${tier} (${detected.reason}) · ${Math.round(fps)} fps`);
    if (document.visibilityState === 'hidden') continue;
    slowChecks = fps < MIN_FPS[tier] ? slowChecks + 1 : 0;
    const lower = tierBelow(tier);
    if (slowChecks >= 2 && lower && !forcedTier()) {
      recordSlow(tier);
      tier = lower;
      applyTier(map, tier);
      slowChecks = 0;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

start();

// Keep map and game files on the phone, so later visits are faster and use less data.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Not supported or blocked: the game works without it.
  });
}
