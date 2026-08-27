import { DurableObject } from "cloudflare:workers";

const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_SOCKETS = 8;

export class RelayRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", {
        status: 426,
        headers: { Upgrade: "websocket" },
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
      // Plain accept() (NOT ctx.acceptWebSocket) so the rejected socket never
      // joins the hibernation set — workerd requires an accepted socket before
      // close() is legal, and this one must never receive broadcasts.
      server.accept();
      server.close(1013, "Room capacity reached");
      return new Response(null, { status: 101, webSocket: client });
    }

    this.ctx.acceptWebSocket(server);
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

  webSocketClose(): void {
    // The hibernation runtime removes closed sockets from getWebSockets().
  }

  webSocketError(): void {
    // The hibernation runtime owns socket cleanup; payloads and errors stay unlogged.
  }
}
