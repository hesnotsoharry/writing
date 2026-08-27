export class DurableObject<Environment> {
  protected readonly ctx: DurableObjectState;
  protected readonly env: Environment;

  constructor(ctx: DurableObjectState, env: Environment) {
    this.ctx = ctx;
    this.env = env;
  }
}

class DefaultWebSocketRequestResponsePair {
  constructor(
    readonly request: string,
    readonly response: string,
  ) {}
}

if (
  typeof (globalThis as { WebSocketRequestResponsePair?: unknown })
    .WebSocketRequestResponsePair === "undefined"
) {
  Object.defineProperty(globalThis, "WebSocketRequestResponsePair", {
    value: DefaultWebSocketRequestResponsePair,
    writable: true,
    configurable: true,
  });
}

