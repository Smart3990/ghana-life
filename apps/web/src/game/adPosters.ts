// The adverts on the billboards, drawn like real campaign posters: a photo (our own, made with
// ImagineArt: public/ads/*.webp) or a bold graphic, the brand's badge, a big headline, a line under it
// and a button, with a small AD tag and a kente strip. All brands are the game's own (fictional);
// advertisers' own adverts can take these places later. One picture holds them all, one row each, so
// every billboard is drawn in one go.

export type AdDesign = {
  brand: string;
  head: string;
  line: string;
  cta: string;
  bg: [string, string];
  accent: string;
  ink?: string;
  photo?: string;
  /** 'cover' fills the board with the photo; 'contain' shows the whole photo (a product) beside the words. */
  photoFit?: 'cover' | 'contain';
  /** Contact line on the advert: phone, WhatsApp, website. */
  contact?: string;
};

export const BOARD_ADS: AdDesign[] = [
  { brand: 'SIKA MOBILE MONEY', head: 'Send money home in seconds', line: 'Cash in · Cash out · Pay shops', cta: 'Open your wallet', bg: ['#0f6b3a', '#1c9b57'], accent: '#f2c21a', photo: '/ads/wallet.webp' },
  { brand: 'AUNTIE DEDE’S KELEWELE', head: 'Hot. Spicy. Every evening.', line: 'At Circle, by the lorry station', cta: 'Come and chop', bg: ['#c2410c', '#f08a24'], accent: '#fff3c4', ink: '#ffffff', photo: '/ads/kelewele.webp' },
  { brand: 'GHANAVERSE FM 98.5', head: 'The sound of the city', line: 'Highlife · Afrobeats · Gospel · News', cta: 'Listen live 24/7', bg: ['#2a0f45', '#5b2a8a'], accent: '#ffd25a', photo: '/ads/radio.webp' },
  { brand: 'COOL SACHET WATER', head: 'Clean. Cold. Everywhere.', line: 'Pure water for the hot Accra sun', cta: 'Only ₵1', bg: ['#0b4f8a', '#2a86d1'], accent: '#ffffff', photo: '/ads/water.webp' },
  { brand: 'GHANAVERSE NEWS', head: 'The city’s biggest stories', line: 'Tonight at 8 on every big screen', cta: 'Watch tonight', bg: ['#6e1010', '#c8442e'], accent: '#ffffff' },
  { brand: 'ADINKRA BANK', head: 'Save small. Grow big.', line: 'Open an account with ₵10', cta: 'Visit any branch', bg: ['#10265a', '#1f5fa8'], accent: '#e3a92b' },
  { brand: 'TONIGHT IN GHANAVERSE', head: 'Highlife night at Osu', line: 'Live band · free entry · 8 pm', cta: 'See you there', bg: ['#121a14', '#1f4f8a'], accent: '#e3a92b' },
  { brand: 'YOUR AD HERE', head: 'Advertise in Ghanaverse', line: 'Billboards across the city from ₵300 a week', cta: 'Tap this billboard', bg: ['#f2efe6', '#d9d2c2'], accent: '#c8442e', ink: '#121a14' },
];
export const AD_COUNT = BOARD_ADS.length;

const KENTE = ['#e3a92b', '#121a14', '#c8442e', '#121a14', '#2f8f57', '#121a14', '#1f5fa8', '#121a14'];

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Draw one advert into a W x H box at (0, top). */
export function drawAd(g: CanvasRenderingContext2D, d: AdDesign, top: number, W: number, H: number, photo?: HTMLImageElement | HTMLCanvasElement | null) {
  g.save();
  g.translate(0, top);
  g.beginPath();
  g.rect(0, 0, W, H);
  g.clip();
  const ink = d.ink ?? '#ffffff';
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, d.bg[0]);
  bg.addColorStop(1, d.bg[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  let textX = W * 0.06;
  let textW = W * 0.56;
  if (photo && d.photoFit === 'contain') {
    // The whole photo (a product), nothing cut off, on a soft panel on the left; words on the right.
    g.fillStyle = 'rgba(255,255,255,.16)';
    const ph = d.contact ? 0.74 : 0.84; // leave room for the contact strip
    roundRect(g, W * 0.03, H * 0.06, W * 0.46, H * ph, H * 0.04);
    g.fill();
    const s = Math.min((W * 0.42) / photo.width, (H * (ph - 0.08)) / photo.height);
    g.drawImage(photo, W * 0.26 - (photo.width * s) / 2, H * (0.06 + ph / 2) - (photo.height * s) / 2, photo.width * s, photo.height * s);
    textX = W * 0.53;
    textW = W * 0.43;
  } else if (photo) {
    // The photo fills the board; the brand's colour fades in on the right, under the words.
    const s = Math.max(W / photo.width, H / photo.height);
    g.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s);
    const fade = g.createLinearGradient(W * 0.38, 0, W * 0.62, 0);
    fade.addColorStop(0, d.bg[0] + '00');
    fade.addColorStop(1, d.bg[0] + 'e8');
    g.fillStyle = fade;
    g.fillRect(W * 0.38, 0, W * 0.62, H);
    textX = W * 0.54;
    textW = W * 0.42;
  } else {
    // A bold graphic: big soft circles and a slanted band in the accent colour.
    g.globalAlpha = 0.18;
    g.fillStyle = d.accent;
    for (const [x, y, r] of [[0.82, 0.3, 0.42], [0.95, 0.95, 0.3], [0.62, 1.05, 0.2]]) {
      g.beginPath();
      g.arc(W * x, H * y, H * r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = d.accent;
    g.beginPath();
    g.moveTo(W * 0.7, 0);
    g.lineTo(W * 0.78, 0);
    g.lineTo(W * 0.64, H);
    g.lineTo(W * 0.56, H);
    g.fill();
  }
  // The brand's badge.
  const u = H / 100;
  g.font = `800 ${5.2 * u}px system-ui, sans-serif`;
  const bw = g.measureText(d.brand).width + 5 * u;
  g.fillStyle = d.accent;
  roundRect(g, textX, 11 * u, bw, 9 * u, 2 * u);
  g.fill();
  g.fillStyle = d.accent === '#ffffff' || d.accent === '#fff3c4' || d.accent === '#ffd25a' || d.accent === '#f2c21a' || d.accent === '#e3a92b' ? '#121a14' : '#ffffff';
  g.textBaseline = 'middle';
  g.fillText(d.brand, textX + 2.5 * u, 15.7 * u);
  // The words: the headline as big as it can be while everything (headline, small words, button,
  // and the contact strip if there is one) fits on the board without overlapping.
  const bottom = H - (d.contact ? 17 : 7) * u;
  g.font = `600 ${6 * u}px system-ui, sans-serif`;
  let small = wrap(g, d.line, textW).slice(0, 2);
  let size = 15 * u;
  let lines: string[] = [];
  const needs = () => 26 * u + size + (lines.length - 1) * size * 1.05 + small.length * 7.5 * u + 18 * u;
  for (; size > 5.5 * u; size -= u * 0.5) {
    g.font = `900 ${size}px system-ui, sans-serif`;
    lines = wrap(g, d.head, textW);
    if (lines.length <= 3 && lines.every((l) => g.measureText(l).width <= textW) && needs() <= bottom) break;
  }
  if (needs() > bottom) small = small.slice(0, 1);
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  let y = 26 * u + size;
  for (const l of lines) {
    g.fillText(l, textX, y);
    y += size * 1.05;
  }
  g.font = `600 ${6 * u}px system-ui, sans-serif`;
  g.globalAlpha = 0.92;
  for (const l of small) {
    g.fillText(l, textX, y + 2 * u);
    y += 7.5 * u;
  }
  g.globalAlpha = 1;
  // The button.
  g.font = `800 ${6 * u}px system-ui, sans-serif`;
  const cw = g.measureText(d.cta).width + 9 * u;
  const cy = Math.min(bottom - 12 * u, y + 5 * u);
  g.fillStyle = d.accent;
  roundRect(g, textX, cy, cw, 11 * u, 5.5 * u);
  g.fill();
  g.fillStyle = d.accent === '#c8442e' ? '#ffffff' : '#121a14';
  g.textBaseline = 'middle';
  g.fillText(`${d.cta}  ›`, textX + 4.5 * u, cy + 5.7 * u);
  // The contact strip right across the bottom: phone, WhatsApp, website.
  if (d.contact) {
    g.fillStyle = 'rgba(0,0,0,.42)';
    g.fillRect(0, H - 15.5 * u, W, 12 * u);
    let fs = 5.6 * u;
    g.font = `700 ${fs}px system-ui, sans-serif`;
    while (fs > 3.6 * u && g.measureText(d.contact).width > W * 0.92) {
      fs -= 0.3 * u;
      g.font = `700 ${fs}px system-ui, sans-serif`;
    }
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(d.contact, W / 2, H - 9.5 * u, W * 0.94);
    g.textAlign = 'left';
  }
  // The small AD tag, and the kente strip along the bottom.
  g.font = `800 ${4 * u}px system-ui, sans-serif`;
  g.fillStyle = 'rgba(0,0,0,.45)';
  roundRect(g, W - 12 * u, 3 * u, 9 * u, 6 * u, 1.5 * u);
  g.fill();
  g.fillStyle = '#ffffff';
  g.fillText('AD', W - 10.6 * u, 6.2 * u);
  const k = Math.max(6, W / 48);
  for (let x = 0, i = 0; x < W; x += k, i++) {
    g.fillStyle = KENTE[i % KENTE.length];
    g.fillRect(x, H - 3.5 * u, k, 3.5 * u);
  }
  g.restore();
}

/**
 * An advertiser's own finished flyer on the whole board. 'contain' shows all of it (the rest of the
 * board filled with a soft, darkened copy of it); 'cover' fills the board edge to edge.
 */
/**
 * The advertiser's own finished flyer on a board, never stretched. "auto" picks for them: a picture
 * of about the board's shape fills it edge to edge (hardly anything trimmed); any other shape is
 * shown whole, on a soft blurred copy of itself so there are no empty bars. With `cta`, a call to
 * action button sits in the bottom corner.
 */
export function drawFlyer(g: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, top: number, W: number, H: number, fit: 'cover' | 'contain' | 'auto', cta?: string) {
  g.save();
  g.translate(0, top);
  g.beginPath();
  g.rect(0, 0, W, H);
  g.clip();
  const iw = img.width;
  const ih = img.height;
  const cover = Math.max(W / iw, H / ih);
  const mode = fit === 'auto' ? (Math.abs(Math.log(iw / ih / (W / H))) < 0.14 ? 'cover' : 'contain') : fit;
  // Behind: the flyer itself, blown up, blurred and darkened (a soft backdrop).
  g.globalAlpha = 1;
  g.filter = 'blur(10px)';
  g.drawImage(img, (W - iw * cover * 1.2) / 2, (H - ih * cover * 1.2) / 2, iw * cover * 1.2, ih * cover * 1.2);
  g.filter = 'none';
  g.fillStyle = 'rgba(10,12,14,.5)';
  g.fillRect(0, 0, W, H);
  const s = mode === 'cover' ? cover : Math.min(W / iw, H / ih);
  if (mode === 'contain') {
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = H * 0.04;
  }
  g.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  g.shadowBlur = 0;
  const u = H / 100;
  g.font = `800 ${4 * u}px system-ui, sans-serif`;
  g.fillStyle = 'rgba(0,0,0,.45)';
  roundRect(g, W - 12 * u, 3 * u, 9 * u, 6 * u, 1.5 * u);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textBaseline = 'middle';
  g.fillText('AD', W - 10.6 * u, 6.2 * u);
  if (cta) {
    // The call to action: a bright button, bottom right.
    g.font = `900 ${7.5 * u}px system-ui, sans-serif`;
    const text = cta.toUpperCase().slice(0, 26);
    const tw = g.measureText(text).width;
    const bw = tw + 9 * u;
    const bh = 13 * u;
    const bx = W - bw - 4 * u;
    const by = H - bh - 4 * u;
    g.shadowColor = 'rgba(0,0,0,.45)';
    g.shadowBlur = 2 * u;
    g.fillStyle = '#f2c21a';
    roundRect(g, bx, by, bw, bh, bh / 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#121a14';
    g.fillText(text, bx + 4.5 * u, by + bh / 2 + 0.4 * u);
  }
  g.restore();
}

const photos = new Map<string, HTMLImageElement | null>();
function loadPhoto(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    if (photos.has(url)) return resolve(photos.get(url)!);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => (photos.set(url, img), resolve(img));
    img.onerror = () => (photos.set(url, null), resolve(null));
    img.src = url;
  });
}

/**
 * The picture of all the adverts (W wide, one 16:9 row each, the first advert at the bottom as the
 * texture rows count from below). Drawn at once with graphics, then again when the photos arrive.
 */
export function adSheet(W: number, onPhotos?: () => void) {
  const H = Math.round((W * 9) / 16);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H * AD_COUNT;
  const g = c.getContext('2d')!;
  const draw = () => BOARD_ADS.forEach((d, n) => drawAd(g, d, (AD_COUNT - 1 - n) * H, W, H, d.photo ? photos.get(d.photo) : null));
  draw();
  void Promise.all(BOARD_ADS.filter((d) => d.photo).map((d) => loadPhoto(d.photo!))).then(() => {
    draw();
    onPhotos?.();
  });
  return c;
}

/** A small picture of one advert (for the big map). */
export function adThumb(n: number, W = 128) {
  const H = Math.round((W * 9) / 16);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const d = BOARD_ADS[n % AD_COUNT];
  drawAd(c.getContext('2d')!, d, 0, W, H, d.photo ? photos.get(d.photo) : null);
  return c.toDataURL('image/webp', 0.8);
}
