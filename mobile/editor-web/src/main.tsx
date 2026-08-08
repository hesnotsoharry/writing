import "@writersnook/styles/tokens.css";
import "./editor-web.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createBridgeClient } from "./bridgeClient";
import { EditorWebApp } from "./EditorWebApp";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing editor root");

const bridgeClient = createBridgeClient();

createRoot(rootElement).render(
  <StrictMode>
    <EditorWebApp client={bridgeClient} />
  </StrictMode>,
);
