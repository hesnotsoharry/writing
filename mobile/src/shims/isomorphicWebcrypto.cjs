/* global module */

const installedCrypto = globalThis.crypto;

if (!installedCrypto?.subtle) {
  throw new Error("Quick Crypto must be installed before Yjs loads");
}

module.exports = {
  ensureSecure() {},
  subtle: installedCrypto.subtle,
  getRandomValues: installedCrypto.getRandomValues.bind(installedCrypto),
};
