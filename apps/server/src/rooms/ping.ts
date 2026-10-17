// T0a distance test: a tiny live room that echoes messages back, so a phone
// can measure the round-trip time to the server (risk R3 in the master plan).
import { DurableObject } from 'cloudflare:workers';

// Which Cloudflare data centre is running this code (three-letter airport code).
async function whereAmI(): Promise<string> {
  const trace = await (await fetch('https://cloudflare.com/cdn-cgi/trace')).text();
  return /colo=(\w+)/.exec(trace)?.[1] ?? 'unknown';
}

export class PingRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // Hibernation API: the room uses no compute while nobody is sending.
    this.ctx.acceptWebSocket(server);
    server.send(`edge:${request.headers.get('x-edge') ?? 'unknown'}`);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === 'where') {
      ws.send(`room:${await whereAmI()}`);
      return;
    }
    ws.send(message); // echo
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, reason);
  }
}
