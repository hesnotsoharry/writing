import { install } from "react-native-quick-crypto";
import type { ComponentType } from "react";

install();

if (!globalThis.crypto?.subtle) {
  throw new Error("WritersNook mobile requires WebCrypto subtle support");
}

declare function require(moduleId: "expo"): typeof import("expo");
declare function require(moduleId: "./src/App"): { default: ComponentType };

const { registerRootComponent } = require("expo");
const App = require("./src/App").default;
registerRootComponent(App);
