import { afterEach, describe, expect, it, vi } from "vitest";

import { chunkFrames } from "../../sync/frameCodec";
import { RelayProvider } from "../../sync/provider";

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  readonly sent: string[] = [];
  readyState = MockWebSocket.CONNECTING;

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  send(value: string): void { this.sent.push(value); }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

describe("RelayProvider connection discipline", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses outer JSON frames and emits reassembled opaque blobs", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const socket = new MockWebSocket();
    let openedUrl = "";
    const provider = new RelayProvider("https://relay.test/", "room-id", "device-a", (url) => {
      openedUrl = url;
      return socket as unknown as WebSocket;
    });
    const received = vi.fn();
    provider.subscribeFrames(received);
    provider.connect(); socket.open();

    provider.send(new Uint8Array([1, 2, 3]));
    const sent = JSON.parse(socket.sent[0]) as Record<string, unknown>;
    expect(openedUrl).toBe("wss://relay.test/room/room-id");
    expect(sent).toMatchObject({ v: 1, d: "device-a", i: 0, f: 1 });

    const incoming = chunkFrames("device-b", new Uint8Array([4, 5]))[0];
    socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(incoming) }));
    expect(received).toHaveBeenCalledWith(new Uint8Array([4, 5]));
    provider.destroy();
  });

  it("watchdogs a wedged connection after 7 seconds and retries", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket);
    const sockets: MockWebSocket[] = [];
    const provider = new RelayProvider("wss://relay.test", "room/id", "device-a", () => {
      const socket = new MockWebSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    });

    provider.connect();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].readyState).toBe(MockWebSocket.CONNECTING);

    vi.advanceTimersByTime(7_000);
    expect(sockets[0].readyState).toBe(MockWebSocket.CLOSED);
    vi.advanceTimersByTime(500);
    expect(sockets).toHaveLength(2);
    provider.destroy();
  });

  it("backs off exponentially and caps reconnect delay at 10 seconds", () => {
    vi.useFakeTimers();
    let attempts = 0;
    const provider = new RelayProvider("wss://relay.test", "room", "device-a", () => {
      attempts += 1;
      throw new Error("constructor failed");
    });

    provider.connect();
    expect(attempts).toBe(1);
    for (const delay of [500, 1_000, 2_000, 4_000, 8_000, 10_000, 10_000]) {
      vi.advanceTimersByTime(delay - 1);
      const before = attempts;
      vi.advanceTimersByTime(1);
      expect(attempts).toBe(before + 1);
    }
    provider.destroy();
  });
});
