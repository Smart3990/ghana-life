// Quality tiers (master plan, "Quality tiers and performance"): Light, Standard and Ultra,
// picked from device clues, then watched while playing. If the frame rate stays low the game
// steps down one tier at a time. It never steps up by itself.
import type { Tier } from './style';

export const TIERS: Tier[] = ['light', 'standard', 'ultra'];

// Below these frame rates for two checks in a row, step down a tier.
export const MIN_FPS: Record<Tier, number> = { light: 0, standard: 22, ultra: 35 };

// A device must be slow on two visits before it starts lower next time.
const SLOW_VISITS_TO_REMEMBER = 2;
const slowKey = (tier: Tier) => `gl.slow.${tier}`;

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

function slowVisits(tier: Tier): number {
  try {
    return Number(localStorage.getItem(slowKey(tier))) || 0;
  } catch {
    return 0;
  }
}

// "?tier=light", "?tier=standard" or "?tier=ultra" in the address forces a tier for testing.
export function forcedTier(): Tier | null {
  const forced = new URLSearchParams(window.location.search).get('tier');
  if (forced === 'full') return 'ultra'; // older test links
  return TIERS.includes(forced as Tier) ? (forced as Tier) : null;
}

export function detectTier(): { tier: Tier; reason: string } {
  const forced = forcedTier();
  if (forced) return { tier: forced, reason: 'forced' };

  const nav = navigator as NavigatorExtras;
  if (nav.connection?.saveData) return { tier: 'light', reason: 'data saver' };
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 1) return { tier: 'light', reason: `${nav.deviceMemory} GB memory` };
  if (hasSoftwareGraphics()) return { tier: 'light', reason: 'no graphics chip' };

  // Strong devices get Ultra; everyone else starts at Standard.
  const memoryOk = nav.deviceMemory === undefined || nav.deviceMemory >= 8;
  let tier: Tier = memoryOk && (navigator.hardwareConcurrency ?? 0) >= 8 ? 'ultra' : 'standard';
  let reason = 'auto';

  // Remembered slowness caps the starting tier.
  if (tier === 'ultra' && slowVisits('ultra') >= SLOW_VISITS_TO_REMEMBER) [tier, reason] = ['standard', 'slow before'];
  if (tier === 'standard' && slowVisits('standard') >= SLOW_VISITS_TO_REMEMBER) [tier, reason] = ['light', 'slow before'];
  return { tier, reason };
}

// Counts a visit where this tier was too slow.
export function recordSlow(tier: Tier) {
  try {
    localStorage.setItem(slowKey(tier), String(slowVisits(tier) + 1));
  } catch {
    // Storage blocked: decide again next visit.
  }
}

export const tierBelow = (tier: Tier): Tier | null => TIERS[TIERS.indexOf(tier) - 1] ?? null;

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
