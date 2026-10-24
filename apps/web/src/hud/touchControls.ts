// Touch controls for phones and tablets: a floating joystick (touch anywhere on the left side and
// drag) and round action buttons on the right. Keyboard and controllers are read elsewhere; this
// only reports what the fingers are doing.

export type Buttons = Record<string, HTMLButtonElement>;

export class TouchControls {
  /** Joystick direction, -1..1 (y is forward). */
  x = 0;
  y = 0;
  private held = new Set<string>();
  private pressed = new Set<string>();
  private stickId = -1;
  private origin = { x: 0, y: 0 };

  constructor(
    zone: HTMLElement,
    private base: HTMLElement,
    private knob: HTMLElement,
    buttons: Buttons,
    private radius = 52,
  ) {
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== -1) return;
      this.stickId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.origin = { x: e.clientX, y: e.clientY };
      base.classList.add('active');
      base.style.left = `${e.clientX}px`;
      base.style.top = `${e.clientY}px`;
      this.move(e);
    });
    zone.addEventListener('pointermove', (e) => e.pointerId === this.stickId && this.move(e));
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = -1;
      this.x = this.y = 0;
      knob.style.transform = '';
      base.classList.remove('active');
      base.style.left = base.style.top = '';
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);

    for (const [name, el] of Object.entries(buttons)) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.held.add(name);
        this.pressed.add(name);
        el.classList.add('down');
        navigator.vibrate?.(8); // a small tick, where the phone supports it
      });
      const up = () => {
        this.held.delete(name);
        el.classList.remove('down');
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  private move(e: PointerEvent) {
    let dx = e.clientX - this.origin.x;
    let dy = e.clientY - this.origin.y;
    const d = Math.hypot(dx, dy);
    // Dragging past the edge pulls the stick along, so the thumb never runs out of room.
    if (d > this.radius) {
      const over = d - this.radius;
      this.origin.x += (dx / d) * over;
      this.origin.y += (dy / d) * over;
      this.base.style.left = `${this.origin.x}px`;
      this.base.style.top = `${this.origin.y}px`;
      dx = (dx / d) * this.radius;
      dy = (dy / d) * this.radius;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.x = dx / this.radius;
    this.y = -dy / this.radius;
  }

  isHeld(name: string) {
    return this.held.has(name);
  }

  /** True once per tap. */
  took(name: string) {
    const was = this.pressed.has(name);
    this.pressed.delete(name);
    return was;
  }
}
