import { DurableObject } from "cloudflare:workers";

const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_SOCKETS = 8;

export class RelayRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", {
        status: 426,
        headers: { Upgrade: "websocket" },
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    if (this.ctx.getWebSockets().length > MAX_SOCKETS) {
      server.close(1013, "Room capacity reached");
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(sender: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") {
      return;
    }

    if (new TextEncoder().encode(message).byteLength > MAX_FRAME_BYTES) {
      sender.close(1009, "Frame exceeds 1 MiB");
      return;
    }

    for (const socket of this.ctx.getWebSockets()) {
      if (socket === sender) {
        continue;
      }

      try {
        socket.send(message);
      } catch {
        // A closing peer must not prevent delivery to the rest of the room.
      }
    }
  }

  webSocketClose(
    _socket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): void {
    // The hibernation runtime removes closed sockets from getWebSockets().
  }

  webSocketError(_socket: WebSocket, _error: unknown): void {
    // The hibernation runtime owns socket cleanup; payloads and errors stay unlogged.
  }
}
