import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const editorRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(editorRoot, "../..");

export default defineConfig({
  root: editorRoot,
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  resolve: {
    alias: { "@writersnook": path.resolve(repositoryRoot, "src") },
    dedupe: [
      "react",
      "react-dom",
      "yjs",
      "@tiptap/core",
      "@tiptap/pm",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-collaboration",
      "@tiptap/extension-highlight",
      "@tiptap/extensions",
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-view",
    ],
  },
  build: {
    outDir: path.resolve(editorRoot, "dist"),
    emptyOutDir: true,
  },
});
