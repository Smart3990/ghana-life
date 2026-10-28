// The advert card and the advertiser steps (design brief 18). Tap a billboard on the big map, or a
// passing trotro, bus or taxi in the street: the card shows its advert and price, and "Put your advert
// here" walks you through it:
//   1. The space: where (prices by place: side street, main road, busy station, airport, or on a
//      moving taxi, trotro or bus, the most), and how many weeks. Everybody pays the same.
//   2. The design: upload your own finished flyer (shown whole on the board), or use the Ghanaverse
//      design with your words and your product photo (shown whole, or filling the board).
//   3. Contact: phone, WhatsApp, website or Instagram, shown on the advert; tapping your advert in the
//      city gives Call, WhatsApp and Website buttons.
//   4. Review and pay: the summary and payment (Mobile Money or card).
// The preview shows on that space in the city straight away, for you. Payments go through the
// Ghanaverse server (money is only ever handled there); every advert is checked before it goes live
// for everyone (no scams, betting, adult content or politics, no brands that are not yours).
import { drawAd, drawFlyer, type AdDesign } from '../game/adPosters';
import { AD_PLACES, adPlace, type AdPlaceKey } from '../game/adPrices';

export type AdContact = { phone: string; whatsapp: string; link: string };
export type AdSpace = {
  kind: 'billboard' | 'vehicle';
  title: string; // "Billboard · Ring Road" or "Trotro · advert on both sides"
  picture: string; // the advert now (data URL)
  /** What kind of place this space is (its price comes from the price list, adPrices.ts). */
  place: AdPlaceKey;
  note: string;
  /** The player's own advert already shown here (from an earlier preview): its contact buttons. */
  own?: AdContact | null;
  /** Draw an advert into the space (preview, for this player only). */
  preview: (draw: (g: CanvasRenderingContext2D, top: number, W: number, H: number) => void, contact: AdContact) => void;
  onClose?: () => void;
  /**
   * All the adverts that take turns on this space (owner, 28 Oct 2026: "swipe to see all the ads"):
   * the card opens on `start` (the one showing now), and you swipe through the rest. With these,
   * "Put your advert here" goes into the advert place you are looking at (`previewAt`).
   */
  slides?: { picture: string; own?: AdContact | null }[];
  /** The advert's shape, width to height (a vehicle wrap's own; billboards 16:9). */
  aspect?: number;
  start?: number;
  previewAt?: (i: number, draw: (g: CanvasRenderingContext2D, top: number, W: number, H: number) => void, contact: AdContact) => void;
};

const COLOURS: [string, string, string][] = [
  ['#0f6b3a', '#1c9b57', '#f2c21a'],
  ['#8e1b1b', '#c8442e', '#ffffff'],
  ['#10265a', '#1f5fa8', '#e3a92b'],
  ['#121a14', '#2a3a2e', '#e3a92b'],
  ['#4a1d6e', '#7a3fb0', '#ffd25a'],
  ['#f2efe6', '#d9d2c2', '#c8442e'],
];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** A safe web link from what was typed ("mamaesi.com" -> "https://mamaesi.com"); only http(s). */
export function webLink(text: string) {
  const t = text.trim();
  if (!t) return '';
  if (/^@[\w.]+$/.test(t)) return `https://instagram.com/${t.slice(1)}`;
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}
/** A Ghana phone number for links: "024 412 3456" -> "233244123456". */
export function phoneDigits(text: string) {
  const d = text.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('233')) return d;
  if (d.startsWith('0')) return `233${d.slice(1)}`;
  return d;
}

type Draft = {
  weeks: number;
  where: AdPlaceKey;
  mode: 'flyer' | 'design';
  flyer: HTMLCanvasElement | null;
  flyerFit: 'auto' | 'contain' | 'cover';
  brand: string;
  head: string;
  line: string;
  cta: string;
  photo: HTMLCanvasElement | null;
  photoFit: 'auto' | 'contain' | 'cover';
  colour: number;
  phone: string;
  whatsapp: string;
  link: string;
  showPhone: boolean;
  pay: 'momo' | 'card';
};

/** Read a picture the person picked, made smaller if it is huge (so phones cope), as a canvas. */
function readPicture(file: File, max = 1600): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export class AdCard {
  private root: HTMLElement | null = null;
  private space: AdSpace | null = null;
  private d: Draft = AdCard.fresh();
  isOpen = false;
  /** On Light phones: a plain see-through dark backdrop instead of the blur (the blur costs speed). */
  lite = false;
  private slide = 0;

  private static fresh(): Draft {
    return { weeks: 1, where: 'street', mode: 'flyer', flyer: null, flyerFit: 'auto', brand: '', head: '', line: '', cta: '', photo: null, photoFit: 'auto', colour: 0, phone: '', whatsapp: '', link: '', showPhone: true, pay: 'momo' };
  }

  open(space: AdSpace) {
    this.space = space;
    this.d.where = space.place;
    this.build();
    this.isOpen = true;
    this.root!.classList.remove('hidden');
    this.step0();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root?.classList.add('hidden');
    this.space?.onClose?.();
    this.space = null;
  }

  private build() {
    if (this.root) return;
    const r = document.createElement('div');
    r.id = 'adcard';
    r.className = 'hidden' + (this.lite ? ' lite' : '');
    r.innerHTML = '<div class="ac-body"><button type="button" class="ac-x" aria-label="Close">✕</button><div class="ac-in"></div></div>';
    document.body.append(r);
    for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel', 'keydown', 'keyup']) r.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    r.querySelector('.ac-x')!.addEventListener('click', () => this.close());
    // A tap on the blurred city around the card closes it.
    r.addEventListener('click', (e) => e.target === r && this.close());
    this.root = r;
  }

  private get inner() {
    return this.root!.querySelector('.ac-in') as HTMLElement;
  }
  /** Billboard or vehicle: the place chosen (it can differ from the space you tapped). */
  private get kind() {
    return adPlace(this.d.where).kind;
  }
  private get aspect() {
    if (this.space?.aspect && this.space.kind === this.kind) return this.space.aspect;
    return this.kind === 'vehicle' ? 2.36 : 16 / 9;
  }
  /** The same price for everybody: the place's price a week, times the weeks. */
  private total() {
    return this.d.weeks * adPlace(this.d.where).price;
  }
  private contact(): AdContact {
    return { phone: this.d.phone.trim(), whatsapp: this.d.whatsapp.trim(), link: webLink(this.d.link) };
  }
  private contactLine() {
    const parts: string[] = [];
    if (this.d.showPhone && this.d.phone.trim()) parts.push(`📞 ${this.d.phone.trim()}`);
    if (this.d.whatsapp.trim() && this.d.whatsapp.trim() !== this.d.phone.trim()) parts.push(`💬 ${this.d.whatsapp.trim()}`);
    const link = webLink(this.d.link);
    if (link) parts.push(`🌐 ${link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}`);
    return parts.join('   ');
  }
  /** Draws the advert as it is now (for the preview canvas and for the city). */
  private drawer() {
    const d = this.d;
    return (g: CanvasRenderingContext2D, top: number, W: number, H: number) => {
      if (d.mode === 'flyer' && d.flyer) return drawFlyer(g, d.flyer, top, W, H, d.flyerFit, d.cta.trim() || undefined);
      const c = COLOURS[d.colour];
      const design: AdDesign = {
        brand: (d.brand.trim() || 'YOUR BUSINESS').toUpperCase().slice(0, 28),
        head: d.head.trim() || 'Your big words here',
        line: d.line.trim() || 'What you sell and where to find you',
        cta: d.cta.trim() || 'Call us today',
        bg: [c[0], c[1]],
        accent: c[2],
        ink: d.colour === 5 ? '#121a14' : undefined,
        photoFit: d.photoFit === 'auto' ? (d.photo && Math.abs(Math.log(d.photo.width / d.photo.height / (W / H))) < 0.25 ? 'cover' : 'contain') : d.photoFit,
        contact: this.contactLine() || undefined,
      };
      drawAd(g, design, top, W, H, d.photo);
    };
  }
  private head(step: number, title: string) {
    const names = ['Space', 'Design', 'Contact', 'Pay'];
    return `<small class="ac-kind">${this.kind === 'billboard' ? '📺 BILLBOARD' : '🚐 MOVING ADVERT'} · STEP ${step} OF 4</small>
      <div class="ac-steps">${names.map((n, i) => `<span class="${i + 1 < step ? 'done' : i + 1 === step ? 'on' : ''}">${i + 1}. ${n}</span>`).join('')}</div>
      <h3>${esc(title)}</h3>`;
  }
  private previewBox() {
    const W = 512;
    return `<canvas class="ac-preview" width="${W}" height="${Math.round(W / this.aspect)}"></canvas>`;
  }
  private redraw() {
    const c = this.inner.querySelector('.ac-preview') as HTMLCanvasElement | null;
    if (c) this.drawer()(c.getContext('2d')!, 0, c.width, c.height);
  }
  private nav(back: (() => void) | null, next: (() => void) | null, nextText = 'Next ›') {
    return { back, next, html: `<div class="ac-nav">${back ? '<button type="button" class="ac-back">‹ Back</button>' : '<span></span>'}${next ? `<button type="button" class="ac-go ac-next">${nextText}</button>` : ''}</div>` };
  }
  private wire(n: ReturnType<AdCard['nav']>) {
    this.inner.querySelector('.ac-back')?.addEventListener('click', () => n.back?.());
    this.inner.querySelector('.ac-next')?.addEventListener('click', () => n.next?.());
  }
  private bindInputs() {
    this.inner.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((i) => {
      const k = i.dataset.k as keyof Draft;
      if (i.type === 'checkbox') i.checked = !!this.d[k];
      else i.value = String(this.d[k] ?? '');
      i.addEventListener(i.type === 'checkbox' ? 'change' : 'input', () => {
        (this.d as Record<string, unknown>)[k] = i.type === 'checkbox' ? i.checked : i.value;
        this.redraw();
        this.inner.querySelectorAll('[data-total]').forEach((t) => (t.textContent = `₵${this.total().toLocaleString('en-GH')}`));
      });
    });
    this.inner.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        const [k, v] = b.dataset.pick!.split('=');
        (this.d as Record<string, unknown>)[k] = /^\d+$/.test(v) ? Number(v) : v;
        this.inner.querySelectorAll(`[data-pick^="${k}="]`).forEach((x) => x.classList.toggle('on', x === b));
        if (k === 'mode') this.step2();
        else {
          this.redraw();
          this.inner.querySelectorAll('[data-total]').forEach((t) => (t.textContent = `₵${this.total().toLocaleString('en-GH')}`));
        }
      }),
    );
    this.inner.querySelectorAll<HTMLInputElement>('input[type=file][data-file]').forEach((f) =>
      f.addEventListener('change', async () => {
        const file = f.files?.[0];
        if (!file) return;
        const pic = await readPicture(file).catch(() => null);
        if (!pic) return;
        if (f.dataset.file === 'flyer') this.d.flyer = pic;
        else this.d.photo = pic;
        const label = f.closest('label');
        if (label) label.classList.add('has');
        this.redraw();
      }),
    );
  }
  private pick(key: keyof Draft, value: string | number, text: string) {
    return `<button type="button" data-pick="${key}=${value}" class="${String(this.d[key]) === String(value) ? 'on' : ''}">${text}</button>`;
  }

  // ---------- Step 0: the space as it is ----------
  private step0() {
    const s = this.space!;
    if (s.slides?.length) return this.gallery();
    const own = s.own;
    this.inner.innerHTML = `
      <small class="ac-kind">${s.kind === 'billboard' ? '📺 BILLBOARD' : '🚐 MOVING ADVERT'}</small>
      <h3>${esc(s.title)}</h3>
      <div class="ac-pic ${s.kind}"><img alt="The advert here now" src="${s.picture}"><span>● LIVE</span></div>
      ${own ? this.contactButtons(own) : ''}
      <p class="ac-note">${esc(s.note)}</p>
      <div class="ac-price"><b>₵${adPlace(s.place).price.toLocaleString('en-GH')} a week</b><span>${esc(adPlace(s.place).name)} · ${esc(adPlace(s.place).note)}</span></div>
      <button type="button" class="ac-go">Put your advert here</button>`;
    this.inner.querySelector('.ac-go')!.addEventListener('click', () => this.step1());
    this.bindContactButtons();
  }
  /** All the adverts on this space, one at a time: swipe (or the arrows) to see the next. */
  private gallery() {
    const s = this.space!;
    const slides = s.slides!;
    const n = slides.length;
    this.slide = Math.max(0, Math.min(n - 1, s.start ?? this.slide));
    this.inner.innerHTML = `
      <small class="ac-kind">${s.kind === 'billboard' ? '📺 BILLBOARD' : '🚐 MOVING ADVERT'} · <span data-count></span></small>
      <h3>${esc(s.title)}</h3>
      <div class="ac-gal">
        <div class="ac-track">${slides.map((sl, i) => `<div class="ac-slide"><div class="ac-pic ${s.kind}"><img alt="Advert ${i + 1} of ${n}" src="${sl.picture}" draggable="false">${i === s.start ? '<span>● LIVE</span>' : ''}</div></div>`).join('')}</div>
        <button type="button" class="ac-arrow prev" aria-label="Previous advert">‹</button>
        <button type="button" class="ac-arrow next" aria-label="Next advert">›</button>
      </div>
      <div class="ac-dots">${slides.map(() => '<i></i>').join('')}</div>
      <div data-contact></div>
      <p class="ac-note">${esc(s.note)}</p>
      <div class="ac-price"><b>₵${adPlace(s.place).price.toLocaleString('en-GH')} a week</b><span>${esc(adPlace(s.place).name)} · ${esc(adPlace(s.place).note)}</span></div>
      <button type="button" class="ac-go">Put your advert here</button>`;
    const track = this.inner.querySelector('.ac-track') as HTMLElement;
    const show = () => {
      (this.inner.querySelector('[data-count]') as HTMLElement).textContent = `${this.slide + 1} OF ${n}`;
      this.inner.querySelectorAll('.ac-dots i').forEach((d, i) => d.classList.toggle('on', i === this.slide));
      const own = slides[this.slide].own;
      (this.inner.querySelector('[data-contact]') as HTMLElement).innerHTML = own ? this.contactButtons(own) : '';
      this.bindContactButtons();
    };
    const go = (i: number, smooth = true) => {
      this.slide = (i + n) % n;
      track.scrollTo({ left: this.slide * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
      show();
    };
    // Swiping: the track snaps to each advert; the counter follows.
    let settle = 0;
    track.addEventListener('scroll', () => {
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== this.slide) {
          this.slide = i;
          show();
        }
      }, 60);
    }, { passive: true });
    this.inner.querySelector('.ac-arrow.prev')!.addEventListener('click', () => go(this.slide - 1));
    this.inner.querySelector('.ac-arrow.next')!.addEventListener('click', () => go(this.slide + 1));
    requestAnimationFrame(() => go(this.slide, false));
    this.inner.querySelector('.ac-go')!.addEventListener('click', () => {
      // Your advert goes into the place you were looking at.
      const at = this.slide;
      s.start = at; // (Back comes back to this one)
      if (s.previewAt) s.preview = (draw, contact) => s.previewAt!(at, draw, contact);
      this.step1();
    });
  }
  private contactButtons(c: AdContact) {
    const btns: string[] = [];
    if (c.phone) btns.push(`<a class="ac-cbtn" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">📞 Call</a>`);
    if (c.whatsapp || c.phone) btns.push(`<a class="ac-cbtn" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(c.whatsapp || c.phone)}">💬 WhatsApp</a>`);
    if (c.link) btns.push(`<a class="ac-cbtn" target="_blank" rel="noopener noreferrer" href="${esc(c.link)}">🌐 Website</a>`);
    return btns.length ? `<div class="ac-contact">${btns.join('')}</div>` : '';
  }
  private bindContactButtons() {
    // Leaving the game for a link: make sure it is what the advertiser gave (never javascript: etc.).
    this.inner.querySelectorAll<HTMLAnchorElement>('.ac-cbtn').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));
  }

  // ---------- Step 1: where and how long ----------
  private step1() {
    const s = this.space!;
    const n = this.nav(() => this.step0(), () => this.step2());
    const here = adPlace(s.place);
    const rows = AD_PLACES.map((p) => `<button type="button" data-where="${p.key}" class="ac-where ${p.key === this.d.where ? 'on' : ''}">
        <i>${p.icon}</i><span><b>${esc(p.name)}${p.key === s.place ? ' · this one' : ''}</b><small>${esc(p.note)}</small></span><em>₵${p.price.toLocaleString('en-GH')}<small>a week</small></em></button>`).join('');
    this.inner.innerHTML = `${this.head(1, 'Where should your advert go?')}
      <div class="ac-label">Busier places cost more; moving vehicles cost the most</div>
      <div class="ac-wheres">${rows}</div>
      <p class="ac-note" data-where-note>${this.d.where === s.place ? `Your advert goes on the ${here.kind === 'billboard' ? 'billboard' : 'vehicle'} you tapped.` : 'We put your advert on a free space of that kind for you.'}</p>
      <div class="ac-label">How long?</div>
      <div class="ac-choice">${this.pick('weeks', 1, '1 week')}${this.pick('weeks', 2, '2 weeks')}${this.pick('weeks', 4, '4 weeks')}${this.pick('weeks', 8, '8 weeks')}</div>
      <div class="ac-price"><b data-total>₵${this.total().toLocaleString('en-GH')}</b><span data-rate>₵${adPlace(this.d.where).price.toLocaleString('en-GH')} a week · the same price for everybody</span></div>
      ${n.html}`;
    this.bindInputs();
    this.wire(n);
    this.inner.querySelectorAll<HTMLElement>('[data-where]').forEach((b) =>
      b.addEventListener('click', () => {
        this.d.where = b.dataset.where as AdPlaceKey;
        this.step1();
      }),
    );
  }

  // ---------- Step 2: the design ----------
  private step2() {
    const s = this.space!;
    const d = this.d;
    const n = this.nav(() => this.step1(), () => this.step3());
    const flyer = `
      <label class="ac-file ${d.flyer ? 'has' : ''}">📄 Upload your flyer or banner (JPG or PNG)<input type="file" accept="image/*" data-file="flyer" hidden></label>
      <div class="ac-label">On the ${this.kind === 'billboard' ? 'board' : 'vehicle'}</div>
      <div class="ac-choice">${this.pick('flyerFit', 'auto', '✨ Automatic')}${this.pick('flyerFit', 'contain', 'Show all of it')}${this.pick('flyerFit', 'cover', 'Fill edge to edge')}</div>
      <p class="ac-note">Never stretched. Automatic fills the ${this.kind === 'billboard' ? 'board' : 'space'} when your flyer is about its shape (${this.kind === 'billboard' ? '1600 × 900, wide 16:9' : '1600 × 400, long 4:1'}), and otherwise shows all of it on a soft blurred copy of itself.</p>
      <label>Button on your flyer (optional)<input data-k="cta" maxlength="22" placeholder="Call now · Order today"></label>`;
    const design = `
      <label>Business name<input data-k="brand" maxlength="28" placeholder="Mama Esi Fabrics"></label>
      <label>Big words<input data-k="head" maxlength="48" placeholder="New wax prints every week"></label>
      <label>Small words<input data-k="line" maxlength="70" placeholder="Makola Market, row 4 · open Monday to Saturday"></label>
      <label>Button<input data-k="cta" maxlength="22" placeholder="Come and see"></label>
      <label class="ac-file ${d.photo ? 'has' : ''}">📷 Add your product or shop photo<input type="file" accept="image/*" data-file="photo" hidden></label>
      <div class="ac-choice">${this.pick('photoFit', 'auto', '✨ Automatic')}${this.pick('photoFit', 'contain', 'Show the whole photo')}${this.pick('photoFit', 'cover', 'Photo fills the board')}</div>
      <div class="ac-label">Colours</div>
      <div class="ac-colours">${COLOURS.map((c, i) => `<button type="button" data-pick="colour=${i}" style="background:linear-gradient(135deg,${c[0]},${c[1]})" class="${i === d.colour ? 'on' : ''}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>`;
    this.inner.innerHTML = `${this.head(2, 'Your advert')}
      <div class="ac-choice ac-mode">${this.pick('mode', 'flyer', '📄 My own flyer')}${this.pick('mode', 'design', '✏️ Ghanaverse design')}</div>
      ${this.previewBox()}
      ${d.mode === 'flyer' ? flyer : design}
      <button type="button" class="ac-try">👀 Preview it in the city</button>
      ${n.html}`;
    this.bindInputs();
    this.wire(n);
    this.inner.querySelector('.ac-try')!.addEventListener('click', () => this.tryIt());
    this.redraw();
  }

  // ---------- Step 3: contact ----------
  private step3() {
    const n = this.nav(() => this.step2(), () => this.step4());
    this.inner.innerHTML = `${this.head(3, 'How customers reach you')}
      ${this.previewBox()}
      <label>Phone number<input data-k="phone" type="tel" maxlength="20" placeholder="024 412 3456"></label>
      <label>WhatsApp (if different)<input data-k="whatsapp" type="tel" maxlength="20" placeholder="020 555 1234"></label>
      <label>Website, Instagram or Facebook<input data-k="link" maxlength="120" placeholder="mamaesifabrics.com or @mamaesi"></label>
      <label class="ac-check"><input type="checkbox" data-k="showPhone"> Show my phone number on the advert</label>
      <p class="ac-note">${this.d.mode === 'flyer' ? 'Your flyer is shown as you made it; these details go on the buttons when players tap your advert.' : 'These details go on the advert, and on the Call, WhatsApp and Website buttons when players tap it.'}</p>
      <button type="button" class="ac-try">👀 Preview it in the city</button>
      ${n.html}`;
    this.bindInputs();
    this.wire(n);
    this.inner.querySelector('.ac-try')!.addEventListener('click', () => this.tryIt());
    this.redraw();
  }

  // ---------- Step 4: review and pay ----------
  private step4() {
    const s = this.space!;
    const d = this.d;
    const c = this.contact();
    const ready = (d.mode === 'flyer' ? !!d.flyer : !!d.brand.trim()) && (!!c.phone || !!c.whatsapp || !!c.link);
    const n = this.nav(() => this.step3(), null);
    this.inner.innerHTML = `${this.head(4, 'Check and pay')}
      ${this.previewBox()}
      <div class="ac-summary">
        <span>Where</span><b>${esc(adPlace(d.where).name)}${d.where === s.place ? ` (${esc(s.title)})` : ''}</b>
        <span>Time</span><b>${d.weeks} week${d.weeks > 1 ? 's' : ''} × ₵${adPlace(d.where).price.toLocaleString('en-GH')}</b>
        <span>Contact</span><b>${esc([c.phone, c.whatsapp, c.link.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ') || '—')}</b>
        <span>Total</span><b class="ac-total" data-total>₵${this.total().toLocaleString('en-GH')}</b>
      </div>
      <div class="ac-label">Pay with</div>
      <div class="ac-choice">${this.pick('pay', 'momo', '📱 Mobile Money')}${this.pick('pay', 'card', '💳 Card')}</div>
      ${ready ? '' : '<p class="ac-warn">Add your flyer (or your business name) and at least one way to reach you first.</p>'}
      <button type="button" class="ac-go ac-pay" ${ready ? '' : 'disabled'}>Pay <span data-total>₵${this.total().toLocaleString('en-GH')}</span> and send for review</button>
      <p class="ac-note">Every advert is checked before it goes live for everyone, usually within a few hours: no scams, betting, adult content or politics, and no brands that are not yours. You get a private link with your daily views and taps.</p>
      ${n.html}`;
    this.bindInputs();
    this.wire(n);
    this.redraw();
    this.inner.querySelector('.ac-pay')?.addEventListener('click', () => this.pay());
  }

  private tryIt() {
    this.space!.preview(this.drawer(), this.contact());
    const b = this.inner.querySelector('.ac-try') as HTMLButtonElement | null;
    if (b) {
      b.textContent = '✓ Showing in the city now (only you see it)';
      setTimeout(() => (b.textContent = '👀 Preview it in the city'), 2600);
    }
  }

  private pay() {
    // Show it in the city for the player, and keep the request on this phone. Taking the money and
    // publishing for everyone happen on the Ghanaverse server (brief 18.3, master plan: money only on
    // the server), which is not switched on yet: say so plainly.
    this.space!.preview(this.drawer(), this.contact());
    const ref = `GV-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    try {
      const list = JSON.parse(localStorage.getItem('gv-ad-requests') ?? '[]') as unknown[];
      list.push({ ref, space: this.space!.title, where: this.d.where, weeks: this.d.weeks, total: this.total(), contact: this.contact(), mode: this.d.mode, made: new Date().toISOString() });
      localStorage.setItem('gv-ad-requests', JSON.stringify(list.slice(-20)));
    } catch {
      // No storage (private window): the preview still works.
    }
    this.inner.innerHTML = `
      <small class="ac-kind">✓ ADVERT SAVED · ${ref}</small>
      <h3>Your advert is ready</h3>
      ${this.previewBox()}
      <p class="ac-note">It is showing on ${this.d.where === this.space!.place ? `this ${this.space!.kind === 'billboard' ? 'billboard' : 'vehicle'}` : `the ${this.space!.kind === 'billboard' ? 'billboard' : 'vehicle'} you tapped`} for you now. <b>Payments are not switched on yet</b>: when the Ghanaverse advertiser page opens, you pay ₵${this.total().toLocaleString('en-GH')} by ${this.d.pay === 'momo' ? 'Mobile Money' : 'card'} with this reference, we check the advert, and it goes live for every player.</p>
      <button type="button" class="ac-go ac-done">Done</button>`;
    this.redraw();
    this.inner.querySelector('.ac-done')!.addEventListener('click', () => this.close());
  }
}
