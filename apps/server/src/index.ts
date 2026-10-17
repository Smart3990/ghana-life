// Ghana Life live server: routes WebSocket connections to the right room,
// and serves the private reports page for moderation.
import { AreaRoom } from './rooms/area';
import { PingRoom } from './rooms/ping';
import { ReportBox, type Report } from './moderation/reports';

export { AreaRoom, PingRoom, ReportBox };

interface Env {
  ROOMS: DurableObjectNamespace<PingRoom>;
  AREAS: DurableObjectNamespace<AreaRoom>;
  REPORTS: DurableObjectNamespace<ReportBox>;
  ADMIN_KEY: string; // secret, set with "wrangler secret put ADMIN_KEY"
}

// Only our own game pages may open live connections.
const ALLOWED_ORIGINS = [/^https:\/\/ghana-life-web\.ghana-life-web\.workers\.dev$/, /^http:\/\/localhost(:\d+)?$/];

const colo = (request: Request) => String((request as { cf?: { colo?: string } }).cf?.colo ?? 'unknown');

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// A plain page listing the latest reports, newest first.
function reportsPage(reports: Report[]): Response {
  const rows = reports.map((r) => `<tr>
    <td>${new Date(r.at).toISOString().replace('T', ' ').slice(0, 16)}</td>
    <td>${escapeHtml(r.reportedName)}<br><small>${escapeHtml(r.reportedId)}</small></td>
    <td>${escapeHtml(r.reason)}</td>
    <td>${escapeHtml(r.reporterName)}</td>
    <td>${r.recentChat.map((m) => escapeHtml(m)).join('<br>') || '<small>no chat</small>'}</td>
    <td>${escapeHtml(r.area)}</td></tr>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reports · Ghana Life</title>
<style>body{font:14px system-ui,sans-serif;margin:16px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}small{color:#777}</style>
<h1>Player reports</h1><p>${reports.length} shown, newest first. Times are UTC (Ghana time).</p>
<div style="overflow-x:auto"><table><tr><th>When</th><th>Reported player</th><th>Reason</th><th>Reported by</th><th>Their recent chat</th><th>Area</th></tr>${rows}</table></div>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/reports') {
      const adminKey = env.ADMIN_KEY?.trim();
      if (!adminKey || url.searchParams.get('key') !== adminKey) return new Response('Not allowed', { status: 403 });
      const box = env.REPORTS.get(env.REPORTS.idFromName('all'));
      return reportsPage(await box.latest(200));
    }

    const ping = path.match(/^\/ping\/(default|afr|selftest)$/);
    const area = path.match(/^\/room\/(-?\d{1,4}_-?\d{1,4})$/);
    if (!ping && !area) return new Response('Ghana Life live server');
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket connection', { status: 426 });
    }

    if (ping) {
      // "default" is placed near whoever connects first; "afr" asks Cloudflare for Africa.
      const id = env.ROOMS.idFromName(`ping-${ping[1]}`);
      const room = ping[1] === 'afr' ? env.ROOMS.get(id, { locationHint: 'afr' }) : env.ROOMS.get(id);
      const forward = new Request(request);
      forward.headers.set('x-edge', colo(request));
      return room.fetch(forward);
    }

    const origin = request.headers.get('Origin') ?? '';
    if (!ALLOWED_ORIGINS.some((re) => re.test(origin))) return new Response('Not allowed', { status: 403 });
    // One room per map area, e.g. "-4_111". Ask Cloudflare to keep area rooms in Africa.
    const room = env.AREAS.get(env.AREAS.idFromName(`area-${area![1]}`), { locationHint: 'afr' });
    const forward = new Request(request);
    forward.headers.set('x-area', area![1]);
    return room.fetch(forward);
  },
};
