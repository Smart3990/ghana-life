// The game is played with the phone sideways. On phones and tablets, "Tap to play" goes full screen
// and locks the screen sideways where the browser allows it (Android). Where it cannot (iPhone),
// a "turn your phone" card covers the game while it is held upright.

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

export function landscapeGate(gate: HTMLElement, skip = false): Promise<void> {
  const touch = isTouchDevice();
  document.documentElement.classList.toggle('touch', touch);
  if (!touch || skip) {
    gate.remove();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    gate.addEventListener(
      'click',
      async () => {
        try {
          await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
          await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
        } catch {
          // Not allowed here: the turn-your-phone card handles it.
        }
        gate.remove();
        resolve();
      },
      { once: true },
    );
  });
}
