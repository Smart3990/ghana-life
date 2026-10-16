import type { Tier } from './style';

// Renamed from "gl.downgraded" so earlier, too-eager downgrades are forgotten.
const SLOW_RUNS_KEY = 'gl.slowRuns';
const SLOW_RUNS_TO_DOWNGRADE = 2;

type NavigatorExtras = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

// Graphics that are really software drawing, so 3D will crawl.
function hasSoftwareGraphics(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    return true;
  }
}

function slowRuns(): number {
  try {
    return Number(localStorage.getItem(SLOW_RUNS_KEY)) || 0;
  } catch {
    return 0;
  }
}

// "?tier=light" or "?tier=full" in the address forces a tier for testing.
export function forcedTier(): Tier | null {
  const forced = new URLSearchParams(window.location.search).get('tier');
  return forced === 'light' || forced === 'full' ? forced : null;
}

// Full 3D unless there is clear evidence the device cannot cope. The reason is shown with ?debug.
export function detectTier(): { tier: Tier; reason: string } {
  const forced = forcedTier();
  if (forced) return { tier: forced, reason: 'forced' };
  if (slowRuns() >= SLOW_RUNS_TO_DOWNGRADE) return { tier: 'light', reason: 'slow before' };

  const nav = navigator as NavigatorExtras;
  if (nav.connection?.saveData) return { tier: 'light', reason: 'data saver' };
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 1) return { tier: 'light', reason: `${nav.deviceMemory} GB memory` };
  if (hasSoftwareGraphics()) return { tier: 'light', reason: 'no graphics chip' };
  return { tier: 'full', reason: 'auto' };
}

// Counts a slow 3D run. After two, the device starts in Light. Never upgrades by itself.
export function recordSlowRun(): boolean {
  const runs = slowRuns() + 1;
  try {
    localStorage.setItem(SLOW_RUNS_KEY, String(runs));
  } catch {
    // Storage blocked: decide again next visit.
  }
  return runs >= SLOW_RUNS_TO_DOWNGRADE;
}

// Counts frames for a few seconds and reports the average frame rate.
export function measureFps(seconds: number): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = (now: number) => {
      frames++;
      if (now - start < seconds * 1000) requestAnimationFrame(tick);
      else resolve((frames * 1000) / (now - start));
    };
    requestAnimationFrame(tick);
  });
}
