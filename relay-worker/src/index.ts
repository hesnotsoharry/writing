export { RelayRoom } from "./RelayRoom";

const ROOM_PATH = /^\/room\/([A-Za-z0-9_-]{43})$/;

async function fetch(request: Request, env: Env): Promise<Response> {
  const match = ROOM_PATH.exec(new URL(request.url).pathname);
  if (request.method !== "GET" || match === null) {
    return new Response("Not Found", { status: 404 });
  }

  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", {
      status: 426,
      headers: { Upgrade: "websocket" },
    });
  }

  const roomId = match[1];
  const objectId = env.RELAY_ROOM.idFromName(roomId);
  return env.RELAY_ROOM.get(objectId).fetch(request);
}

export default { fetch } satisfies ExportedHandler<Env>;
