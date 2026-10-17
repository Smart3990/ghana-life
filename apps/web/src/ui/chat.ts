// T5 screens: the chat bar, and the menu for another player (mute, block, report).
import type { Live, PlayerMenu } from '../net/live';

const REPORT_REASONS = ['Rude or abusive', 'Asking for money or a scam', 'Sexual messages', 'Hate or threats', 'Something else'];

export function setUpChatBar(getLive: () => Live | null, toast: (text: string) => void) {
  const openButton = document.getElementById('chat-open') as HTMLButtonElement;
  const form = document.getElementById('chat-form') as HTMLFormElement;
  const input = document.getElementById('chat-input') as HTMLInputElement;
  openButton.hidden = false;

  const close = () => {
    form.hidden = true;
    openButton.hidden = false;
    input.blur();
  };
  openButton.addEventListener('click', () => {
    openButton.hidden = true;
    form.hidden = false;
    input.focus();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return close();
    if (!getLive()?.sendChat(text)) {
      toast('Not connected right now. Try again in a moment.');
      return;
    }
    input.value = '';
    close();
  });
  input.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  document.getElementById('chat-cancel')!.addEventListener('click', close);
}

export function openPlayerMenu(player: PlayerMenu, live: Live, toast: (text: string) => void) {
  const sheet = document.getElementById('player-menu')!;
  const title = document.getElementById('player-menu-name')!;
  const actions = document.getElementById('player-menu-actions')!;
  title.textContent = player.name;

  const button = (label: string, onClick: () => void, extraClass = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `menu-button ${extraClass}`.trim();
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  const close = () => (sheet.hidden = true);

  const showMain = () => {
    actions.replaceChildren(
      button('Mute their chat', () => {
        live.mute(player.id);
        toast(`You will not see ${player.name}'s messages this visit.`);
        close();
      }),
      button('Block', () => {
        live.block(player);
        toast(`${player.name} is blocked on this device.`);
        close();
      }),
      button('Report', showReasons, 'danger'),
      button('Cancel', close, 'quiet'),
    );
  };
  const showReasons = () => {
    actions.replaceChildren(
      ...REPORT_REASONS.map((reason) => button(reason, () => {
        live.report(player, reason);
        close();
      })),
      button('Back', showMain, 'quiet'),
    );
  };

  showMain();
  sheet.hidden = false;
}
