// Ghana Life live server: routes WebSocket connections to the right room.
import { AreaRoom } from './rooms/area';
import { PingRoom } from './rooms/ping';

export { AreaRoom, PingRoom };

interface Env {
  ROOMS: DurableObjectNamespace<PingRoom>;
  AREAS: DurableObjectNamespace<AreaRoom>;
}

// Only our own game pages may open live connections.
const ALLOWED_ORIGINS = [/^https:\/\/ghana-life-web\.ghana-life-web\.workers\.dev$/, /^http:\/\/localhost(:\d+)?$/];

const colo = (request: Request) => String((request as { cf?: { colo?: string } }).cf?.colo ?? 'unknown');

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
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
    return room.fetch(request);
  },
};
