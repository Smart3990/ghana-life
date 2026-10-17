// Risk R5: links opened inside Facebook, Instagram and similar apps run in a cut-down
// built-in browser that can struggle with 3D maps. Offer to open the game in a full browser.

const KEY = 'gl.inappDismissed';

function inAppBrowser(): string | null {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/Snapchat|TikTok|musical_ly|Bytedance|Line\//i.test(ua)) return 'this app';
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return 'this app'; // generic Android in-app web view
  return null;
}

export function offerFullBrowser() {
  const app = inAppBrowser();
  if (!app) return;
  try {
    if (sessionStorage.getItem(KEY)) return;
  } catch {
    // Storage blocked: show the banner anyway.
  }
  const banner = document.getElementById('inapp')!;
  const text = document.getElementById('inapp-text')!;
  const open = document.getElementById('inapp-open') as HTMLAnchorElement;
  const copy = document.getElementById('inapp-copy') as HTMLButtonElement;
  const close = document.getElementById('inapp-close') as HTMLButtonElement;
  const url = window.location.href.split('#')[0];
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isAndroid) {
    // Android "intent" link: asks the phone to open this page in Chrome.
    const { host, pathname, search } = window.location;
    open.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    text.textContent = `You opened Ghana Life inside ${app}. It runs smoother in Chrome.`;
  } else {
    open.hidden = true;
    text.textContent = `You opened Ghana Life inside ${app}. For the smoothest game, tap the ••• or share button and choose "Open in Safari".`;
  }

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = url; // show it so it can be copied by hand
    }
  });
  close.addEventListener('click', () => {
    banner.hidden = true;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // fine
    }
  });
  banner.hidden = false;
}
