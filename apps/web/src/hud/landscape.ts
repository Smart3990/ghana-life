// The game is played with the phone sideways. On phones and tablets, "Tap to play" goes full screen
// and locks the screen sideways where the browser allows it (Android). Where it cannot (iPhone),
// a "turn your phone" card covers the game while it is held upright, and the game can be added to the
// Home Screen to open full screen (manifest.webmanifest).
//
// The tap itself is caught by a small script in the page (street-test.html), so it works from the
// very first moment (before the game has finished downloading) and on iPhones. Afterwards, if the
// phone leaves full screen or is turned, the next tap asks for full screen again.

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

type GateWindow = Window & { __gateTap?: boolean; __onGate?: () => void; __goFull?: () => void };

const canGoFull = () => {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: unknown };
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
};
const isFull = () => !!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);

/** After the start: turned sideways again, or out of full screen? The next tap goes back to full screen. */
function keepFullScreen() {
  if (!canGoFull()) return; // (iPhones: not possible for a web page)
  let want = false;
  const check = () => {
    want = !isFull() && matchMedia('(orientation: landscape)').matches;
  };
  for (const ev of ['orientationchange', 'resize', 'fullscreenchange', 'webkitfullscreenchange']) window.addEventListener(ev, () => setTimeout(check, 250));
  document.addEventListener('fullscreenchange', check);
  // A tap (a user gesture is needed to go full screen).
  document.addEventListener(
    'pointerup',
    () => {
      if (!want) return;
      want = false;
      (window as GateWindow).__goFull?.();
    },
    { passive: true, capture: true },
  );
}

export function landscapeGate(gate: HTMLElement, skip = false): Promise<void> {
  const touch = isTouchDevice();
  document.documentElement.classList.toggle('touch', touch);
  const w = window as GateWindow;
  if (!touch || skip) {
    gate.remove();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const go = () => {
      gate.remove();
      keepFullScreen();
      resolve();
    };
    // Tapped already (while the game was downloading), or when it is tapped.
    if (w.__gateTap) go();
    else w.__onGate = go;
    // (No page script: the old way, the tap here.)
    if (!w.__goFull) {
      gate.addEventListener(
        'click',
        async () => {
          try {
            await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
            await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> } | undefined)?.lock?.('landscape');
          } catch {
            // Not allowed here: the turn-your-phone card handles it.
          }
          go();
        },
        { once: true },
      );
    }
  });
}
