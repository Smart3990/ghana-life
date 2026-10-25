// The advert card (design brief 18): tap a billboard on the big map, or a passing trotro, bus or taxi
// in the street, and this card shows its advert, what the space costs a week, and "Put your advert
// here": your business name, words and picture, previewed live on that space in the city (only you
// see the preview). Paying and going live for everyone come with the Ghanaverse server and the
// advertiser page; every advert is checked first (no scams, betting, adult content or politics, no
// real brands without permission, no phone numbers in the words).
import { drawAd, type AdDesign } from '../game/adPosters';

export type AdSpace = {
  kind: 'billboard' | 'vehicle';
  title: string; // "Billboard · Ring Road" or "Trotro · advert on both sides"
  picture: string; // the advert now (data URL)
  price: string; // "₵350 a week"
  note: string; // "Shared with 7 other adverts: one shows every 7 seconds"
  preview: (d: AdDesign, photo: HTMLImageElement | null) => void;
  onClose?: () => void;
};

const COLOURS: [string, string, string][] = [
  ['#0f6b3a', '#1c9b57', '#f2c21a'],
  ['#8e1b1b', '#c8442e', '#ffffff'],
  ['#10265a', '#1f5fa8', '#e3a92b'],
  ['#121a14', '#2a3a2e', '#e3a92b'],
  ['#4a1d6e', '#7a3fb0', '#ffd25a'],
];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// No phone numbers or links in the words (brief 14.5): long runs of digits are taken out.
const clean = (s: string, max: number) => s.replace(/\+?\d[\d\s-]{5,}\d/g, '').replace(/https?:\/\/\S+|www\.\S+/gi, '').slice(0, max).trim();

export class AdCard {
  private root: HTMLElement | null = null;
  private space: AdSpace | null = null;
  private photo: HTMLImageElement | null = null;
  private colour = 0;
  isOpen = false;

  open(space: AdSpace) {
    this.space = space;
    this.photo = null;
    this.build();
    this.isOpen = true;
    this.root!.classList.remove('hidden');
    this.showInfo();
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
    r.className = 'hidden';
    r.innerHTML = '<div class="ac-body"><button type="button" class="ac-x" aria-label="Close">✕</button><div class="ac-in"></div></div>';
    document.body.append(r);
    for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel', 'keydown']) r.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    r.querySelector('.ac-x')!.addEventListener('click', () => this.close());
    this.root = r;
  }

  private get inner() {
    return this.root!.querySelector('.ac-in') as HTMLElement;
  }

  private showInfo() {
    const s = this.space!;
    this.inner.innerHTML = `
      <small class="ac-kind">${s.kind === 'billboard' ? '📺 BILLBOARD' : '🚐 MOVING ADVERT'}</small>
      <h3>${esc(s.title)}</h3>
      <div class="ac-pic ${s.kind}"><img alt="The advert here now" src="${s.picture}"><span>● LIVE</span></div>
      <p class="ac-note">${esc(s.note)}</p>
      <div class="ac-price"><b>${esc(s.price)}</b><span>Small Ghanaian businesses: first week free</span></div>
      <button type="button" class="ac-go">Put your advert here</button>`;
    this.inner.querySelector('.ac-go')!.addEventListener('click', () => this.showForm());
  }

  private showForm() {
    const s = this.space!;
    this.inner.innerHTML = `
      <small class="ac-kind">YOUR ADVERT</small>
      <h3>${esc(s.title)}</h3>
      <canvas class="ac-preview" width="512" height="288"></canvas>
      <label>Business name<input name="brand" maxlength="24" placeholder="Mama Esi Fabrics"></label>
      <label>Big words<input name="head" maxlength="40" placeholder="New wax prints every week"></label>
      <label>Small words<input name="line" maxlength="60" placeholder="Makola Market, row 4"></label>
      <label>Button<input name="cta" maxlength="18" placeholder="Come and see"></label>
      <div class="ac-row"><label class="ac-file">📷 Add a picture<input type="file" accept="image/*" hidden></label><div class="ac-colours">${COLOURS.map((c, i) => `<button type="button" data-c="${i}" style="background:linear-gradient(135deg,${c[0]},${c[1]})" class="${i === this.colour ? 'on' : ''}" aria-label="Colour ${i + 1}"></button>`).join('')}</div></div>
      <button type="button" class="ac-go">Preview it in the city</button>
      <button type="button" class="ac-send" disabled>Send for review and pay</button>
      <p class="ac-note">Only you see the preview. Paying and going live for everyone open soon on the Ghanaverse advertiser page (money is handled only by the server). Every advert is checked first: no scams, betting, adult content or politics, no real brands without permission, no phone numbers.</p>`;
    const get = (n: string) => (this.inner.querySelector(`[name="${n}"]`) as HTMLInputElement).value;
    const design = (): AdDesign => {
      const c = COLOURS[this.colour];
      return {
        brand: clean(get('brand'), 24).toUpperCase() || 'YOUR BUSINESS',
        head: clean(get('head'), 40) || 'Your big words here',
        line: clean(get('line'), 60) || 'Where to find you',
        cta: clean(get('cta'), 18) || 'Come and see',
        bg: [c[0], c[1]],
        accent: c[2],
      };
    };
    const canvas = this.inner.querySelector('.ac-preview') as HTMLCanvasElement;
    const draw = () => drawAd(canvas.getContext('2d')!, design(), 0, 512, 288, this.photo);
    this.inner.querySelectorAll('input:not([type=file])').forEach((i) => i.addEventListener('input', draw));
    this.inner.querySelectorAll<HTMLElement>('[data-c]').forEach((b) =>
      b.addEventListener('click', () => {
        this.colour = Number(b.dataset.c);
        this.inner.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
        draw();
      }),
    );
    (this.inner.querySelector('input[type=file]') as HTMLInputElement).addEventListener('change', (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => {
        this.photo = img;
        draw();
      };
      img.src = URL.createObjectURL(f);
    });
    this.inner.querySelector('.ac-go')!.addEventListener('click', () => {
      s.preview(design(), this.photo);
      const b = this.inner.querySelector('.ac-go') as HTMLButtonElement;
      b.textContent = '✓ Showing in the city now';
      setTimeout(() => (b.textContent = 'Preview it in the city'), 2500);
    });
    draw();
  }
}
