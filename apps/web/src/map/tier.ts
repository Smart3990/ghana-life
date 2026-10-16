import type { Tier } from './style';

const DOWNGRADE_KEY = 'gl.downgraded';

type NavigatorExtras = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

// Graphics chips that are really software drawing, so 3D will crawl.
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

// "?tier=light" or "?tier=full" in the address forces a tier for testing.
export function forcedTier(): Tier | null {
  const forced = new URLSearchParams(window.location.search).get('tier');
  return forced === 'light' || forced === 'full' ? forced : null;
}

// Picks the quality from device clues, unless a tier is forced.
export function detectTier(): Tier {
  const forced = forcedTier();
  if (forced) return forced;

  try {
    if (localStorage.getItem(DOWNGRADE_KEY) === '1') return 'light';
  } catch {
    // Storage blocked: decide from the device alone.
  }

  const nav = navigator as NavigatorExtras;
  if (nav.connection?.saveData) return 'light';
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return 'light';
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return 'light';
  if (hasSoftwareGraphics()) return 'light';
  return 'full';
}

// Remember that this device struggled, so next visit starts in Light. Never upgrades by itself.
export function rememberDowngrade() {
  try {
    localStorage.setItem(DOWNGRADE_KEY, '1');
  } catch {
    // Storage blocked: the downgrade still applies for this visit.
  }
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
