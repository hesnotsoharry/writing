import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const mobileRoot = path.dirname(fileURLToPath(import.meta.url));
const sharedResolve = {
  alias: { "@writersnook": path.resolve(mobileRoot, "../src") },
  dedupe: ["react", "react-dom", "yjs", "@tiptap/core", "@tiptap/pm"],
};

export default defineConfig({
  resolve: sharedResolve,
  test: {
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "native",
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        resolve: sharedResolve,
        test: {
          name: "editor-web",
          environment: "jsdom",
          include: ["editor-web/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
