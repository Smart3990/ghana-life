import './style.css';

// Device facts that help pick the official test phone and a quality tier later.
type NavigatorExtras = Navigator & {
  deviceMemory?: number;
  connection?: { effectiveType?: string; saveData?: boolean };
};

const nav = navigator as NavigatorExtras;

const facts: [string, string][] = [
  ['Screen', `${screen.width} × ${screen.height}`],
  ['Pixel density', String(window.devicePixelRatio)],
  ['Memory', nav.deviceMemory ? `about ${nav.deviceMemory} GB` : 'not reported'],
  ['CPU cores', nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : 'not reported'],
  ['Connection', nav.connection?.effectiveType ?? 'not reported'],
  ['Data saver', nav.connection?.saveData ? 'on' : 'off'],
  ['Browser', navigator.userAgent],
];

const list = document.getElementById('device')!;
for (const [label, value] of facts) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  list.append(dt, dd);
}
