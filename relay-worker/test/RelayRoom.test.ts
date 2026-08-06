import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelayRoom } from "../src/RelayRoom";

interface FakeSocket {
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

class HibernationStateMock {
  readonly sockets: WebSocket[] = [];

  acceptWebSocket(socket: WebSocket): void {
    this.sockets.push(socket);
  }

  getWebSockets(): WebSocket[] {
    return [...this.sockets];
  }
}

const originalResponse = Response;

function fakeSocket(): FakeSocket & WebSocket {
  return {
    close: vi.fn(),
    send: vi.fn(),
  } as FakeSocket & WebSocket;
}

function stateFor(roomState: HibernationStateMock): DurableObjectState {
  return new Proxy({} as DurableObjectState, {
    get: (_target, property) => {
      if (property === "acceptWebSocket") {
        return roomState.acceptWebSocket.bind(roomState);
      }
      if (property === "getWebSockets") {
        return roomState.getWebSockets.bind(roomState);
      }
      return undefined;
    },
  });
}

function makeRoom(roomState = new HibernationStateMock()): RelayRoom {
  return new RelayRoom(stateFor(roomState), {} as Env);
}

beforeEach(() => {
  vi.stubGlobal(
    "WebSocketPair",
    class {
      readonly 0 = fakeSocket();
      readonly 1 = fakeSocket();
    },
  );
  vi.stubGlobal(
    "Response",
    class extends originalResponse {
      constructor(body?: BodyInit | null, init?: ResponseInit) {
        super(body, init?.status === 101 ? { ...init, status: 200 } : init);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RelayRoom", () => {
  it("tracks joins and leaves through the hibernation state", async () => {
    const state = new HibernationStateMock();
    const room = makeRoom(state);

    await room.fetch(
      new Request("https://relay.test/room/id", {
        headers: { Upgrade: "websocket" },
      }),
    );
    expect(state.getWebSockets()).toHaveLength(1);

    const departed = state.sockets.pop();
    expect(departed).toBeDefined();
    room.webSocketClose(departed!, 1000, "done", true);
    expect(state.getWebSockets()).toHaveLength(0);
  });

  it("broadcasts verbatim to every socket except the sender", () => {
    const state = new HibernationStateMock();
    const sender = fakeSocket();
    const peerOne = fakeSocket();
    const peerTwo = fakeSocket();
    state.sockets.push(sender, peerOne, peerTwo);

    makeRoom(state).webSocketMessage(sender, "opaque ciphertext");

    expect(sender.send).not.toHaveBeenCalled();
    expect(peerOne.send).toHaveBeenCalledWith("opaque ciphertext");
    expect(peerTwo.send).toHaveBeenCalledWith("opaque ciphertext");
  });

  it("closes an oversized text frame with 1009", () => {
    const sender = fakeSocket();
    makeRoom().webSocketMessage(sender, "a".repeat(1024 * 1024 + 1));
    expect(sender.close).toHaveBeenCalledWith(1009, "Frame exceeds 1 MiB");
  });

  it("accepts then closes the ninth socket with 1013", async () => {
    const state = new HibernationStateMock();
    state.sockets.push(...Array.from({ length: 8 }, fakeSocket));

    await makeRoom(state).fetch(
      new Request("https://relay.test/room/id", {
        headers: { Upgrade: "websocket" },
      }),
    );

    expect(state.getWebSockets()).toHaveLength(9);
    const ninth = state.sockets[8] as FakeSocket & WebSocket;
    expect(ninth.close).toHaveBeenCalledWith(1013, "Room capacity reached");
  });

  it("drops binary frames", () => {
    const state = new HibernationStateMock();
    const sender = fakeSocket();
    const peer = fakeSocket();
    state.sockets.push(sender, peer);

    makeRoom(state).webSocketMessage(sender, new ArrayBuffer(4));

    expect(sender.close).not.toHaveBeenCalled();
    expect(peer.send).not.toHaveBeenCalled();
  });
});
