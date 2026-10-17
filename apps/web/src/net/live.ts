// T4 and T5: the live connection. Joins the room for the map area the player is in,
// shows other players, sends our walks and chat, and plays theirs.
import type { Map } from 'maplibre-gl';
import { Avatar } from '../game/avatar';
import { metresBetween, type LngLat } from '../game/roads';

const SERVER = 'wss://ghana-life-server.ghana-life-web.workers.dev/room/';
const AREA_DEG = 0.05; // one room per 0.05° square, about 5.5 km across
const SIMPLIFY_METRES = 1.5;
const MAX_POINTS = 600;
const BLOCKED_KEY = 'gl.blocked';

type PlayerView = { id: string; name: string; pos: LngLat | null; path: LngLat[] | null; startedAt: number; speed: number };
type ServerMessage =
  | { type: 'snapshot'; now: number; you: string; players: PlayerView[] }
  | { type: 'joined'; now: number; player: PlayerView }
  | { type: 'walk'; now: number; id: string; path: LngLat[]; startedAt: number; speed: number }
  | { type: 'left'; id: string }
  | { type: 'chat'; now: number; id: string; text: string }
  | { type: 'chat_refused'; reason: 'word' | 'phone' | 'money' | 'slow' | 'muted'; until: number }
  | { type: 'report_saved' }
  | { type: 'pong'; now: number };

export type PlayerMenu = { id: string; name: string };

// With ?debug, record when key steps happen, for timing tests.
const debugTimes = new URLSearchParams(window.location.search).has('debug');
export const mark = (step: string) => {
  if (debugTimes) document.body.dataset[step] = String(Date.now());
};

const areaOf = ([lon, lat]: LngLat) => `${Math.floor(lon / AREA_DEG)}_${Math.floor(lat / AREA_DEG)}`;

// Drops points that add nothing to the shape of a route, so walk messages stay small.
function simplify(path: LngLat[]): LngLat[] {
  if (path.length <= 2) return path;
  const keep = new Uint8Array(path.length);
  keep[0] = keep[path.length - 1] = 1;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstD = SIMPLIFY_METRES;
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(path[i], path[a], path[b]);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return path.filter((_, i) => keep[i]);
}

function distanceToSegment(p: LngLat, a: LngLat, b: LngLat): number {
  const ab = metresBetween(a, b);
  if (ab === 0) return metresBetween(p, a);
  const t = Math.max(0, Math.min(1,
    ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) /
    ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)));
  return metresBetween(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
}

// A stable shirt colour per player, picked from their id.
const shirtFor = (id: string) => [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 5;

// What to tell the player when the server refuses a chat message.
const REFUSED: Record<string, string> = {
  word: 'That message was blocked. Keep it friendly.',
  phone: 'Never share phone numbers in the game. Stay safe.',
  money: 'Never share mobile money details. Sika has no cash value.',
  slow: 'Slow down a little before sending again.',
  muted: 'You are muted for a few minutes after several blocked messages.',
};

function loadBlocked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(BLOCKED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export class Live {
  private ws: WebSocket | null = null;
  private area = '';
  private myId = '';
  private others = new globalThis.Map<string, { avatar: Avatar; name: string }>();
  private clockOffset = 0; // server time minus our time
  private retryMs = 2000;
  private switching = false;
  private muted = new Set<string>(); // player ids: no chat bubbles, this visit only
  private blocked = loadBlocked(); // player names: hidden completely, remembered on this device

  constructor(
    private map: Map,
    private me: Avatar,
    private name: string,
    private ui: {
      onCount: (playersHere: number) => void;
      toast: (text: string) => void;
      openMenu: (player: PlayerMenu) => void;
    },
  ) {
    this.connect(areaOf(me.position));
    // Every few seconds, check whether the player has walked into another area's room.
    setInterval(() => {
      const area = areaOf(this.me.position);
      if (area !== this.area) this.switchTo(area);
    }, 5000);
  }

  // Tell the room we started walking. The route is simplified to keep the message small.
  sendWalk(path: LngLat[], speed: number) {
    mark('sent');
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const route = simplify(path).slice(0, MAX_POINTS);
    this.ws.send(JSON.stringify({ type: 'move_to', path: route.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]), speed }));
  }

  // Returns false when there is no connection, so the chat box can say so.
  sendChat(text: string): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type: 'chat', text }));
    return true;
  }

  mute(id: string) {
    this.muted.add(id);
  }

  block(player: PlayerMenu) {
    this.blocked.add(player.name);
    try {
      localStorage.setItem(BLOCKED_KEY, JSON.stringify([...this.blocked]));
    } catch {
      // Storage blocked: the block lasts for this visit.
    }
    this.others.get(player.id)?.avatar.setHidden(true);
  }

  report(player: PlayerMenu, reason: string) {
    this.ws?.send(JSON.stringify({ type: 'report', id: player.id, reason }));
  }

  private connect(area: string) {
    this.area = area;
    const ws = new WebSocket(SERVER + area);
    this.ws = ws;
    ws.onopen = () => {
      this.retryMs = 2000;
      ws.send(JSON.stringify({ type: 'hello', name: this.name, pos: this.me.position }));
    };
    ws.onmessage = (e) => {
      try {
        this.handle(JSON.parse(e.data) as ServerMessage);
      } catch {
        // ignore anything malformed
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return; // replaced by a newer connection
      this.clearOthers();
      if (this.switching) return;
      // Lost the connection: try again, waiting longer each time (up to 30 s).
      setTimeout(() => this.ws === ws && this.connect(this.area), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 30_000);
    };
  }

  private switchTo(area: string) {
    this.switching = true;
    const old = this.ws;
    this.ws = null;
    old?.close();
    this.clearOthers();
    this.switching = false;
    this.connect(area);
  }

  private handle(msg: ServerMessage) {
    if ('now' in msg) this.clockOffset = msg.now - Date.now();
    switch (msg.type) {
      case 'snapshot':
        this.myId = msg.you;
        this.clearOthers();
        msg.players.forEach((p) => this.add(p));
        break;
      case 'joined':
        this.add(msg.player);
        break;
      case 'walk': {
        mark('received');
        const other = this.others.get(msg.id);
        if (other) other.avatar.walk(msg.path, msg.speed, undefined, this.serverNow() - msg.startedAt);
        break;
      }
      case 'left':
        this.others.get(msg.id)?.avatar.remove();
        this.others.delete(msg.id);
        break;
      case 'chat': {
        if (msg.id === this.myId) {
          this.me.say(msg.text);
          break;
        }
        const other = this.others.get(msg.id);
        if (other && !this.muted.has(msg.id) && !this.blocked.has(other.name)) other.avatar.say(msg.text);
        break;
      }
      case 'chat_refused':
        this.ui.toast(REFUSED[msg.reason] ?? 'That message was not sent.');
        break;
      case 'report_saved':
        this.ui.toast('Thanks. Your report was sent and will be reviewed.');
        break;
    }
    this.ui.onCount(this.others.size + 1);
  }

  private add(p: PlayerView) {
    this.others.get(p.id)?.avatar.remove();
    const start = p.path?.[0] ?? p.pos;
    if (!start) return;
    const avatar = new Avatar(this.map, start, {
      name: p.name,
      shirt: shirtFor(p.id),
      onNameTap: () => this.ui.openMenu({ id: p.id, name: p.name }),
    });
    avatar.setHidden(this.blocked.has(p.name));
    this.others.set(p.id, { avatar, name: p.name });
    if (p.path) avatar.walk(p.path, p.speed, undefined, this.serverNow() - p.startedAt);
  }

  private clearOthers() {
    this.others.forEach((o) => o.avatar.remove());
    this.others.clear();
    this.ui.onCount(1);
  }

  private serverNow() {
    return Date.now() + this.clockOffset;
  }
}
