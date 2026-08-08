// Pure Yjs helpers (js-base64 + yjs only, no Tauri-bearing imports) — safe to
// import at runtime, unlike schema.ts-backed store classes.
export { applyEncoded, encodeDoc, extractPlainText } from "@writersnook/yjs/serialize";
