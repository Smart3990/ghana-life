// Before playing: confirm 18+ and accept the house rules (master plan: "Every player reads
// and accepts the rules before entering, and again when they change"). Full accounts with
// a server-side age check come later in T8.

const KEY = 'gl.rules';
const RULES_VERSION = 1; // raise this whenever the rules change, so everyone is asked again

function accepted(): boolean {
  try {
    return Number(localStorage.getItem(KEY)) >= RULES_VERSION;
  } catch {
    return false;
  }
}

// Resolves once the player has accepted. Never resolves for someone under 18.
export function houseRules(): Promise<void> {
  if (accepted()) return Promise.resolve();
  const screen = document.getElementById('rules')!;
  const form = document.getElementById('rules-form') as HTMLFormElement;
  const adult = document.getElementById('rules-adult') as HTMLInputElement;
  const agree = document.getElementById('rules-agree') as HTMLInputElement;
  const enter = document.getElementById('rules-enter') as HTMLButtonElement;
  const under = document.getElementById('rules-under') as HTMLButtonElement;
  const blocked = document.getElementById('rules-blocked')!;
  screen.hidden = false;

  const update = () => (enter.disabled = !(adult.checked && agree.checked));
  adult.addEventListener('change', update);
  agree.addEventListener('change', update);
  update();

  under.addEventListener('click', () => {
    form.hidden = true;
    blocked.hidden = false;
  });

  return new Promise((resolve) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!(adult.checked && agree.checked)) return;
      try {
        localStorage.setItem(KEY, String(RULES_VERSION));
      } catch {
        // Storage blocked: they will be asked again next visit.
      }
      screen.classList.add('leaving');
      setTimeout(() => screen.remove(), 500);
      resolve();
    });
  });
}
