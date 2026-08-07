// RelayProvider's only platform dependency is the global `WebSocket`, which
// RN provides natively (S4 blueprint "Crypto and transport" section) — no RN
// fork needed, unlike engineDefaults.ts/keyStorage.ts/schema.ts.
export { RelayProvider } from "@writersnook/sync/provider";
export type { ConnectionState, WebSocketFactory } from "@writersnook/sync/provider";
