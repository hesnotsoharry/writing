// Literata — prose canvas: 400/500/600/700 normal + 400/500 italic
import "@fontsource/literata/400-italic.css";
import "@fontsource/literata/400.css";
import "@fontsource/literata/500-italic.css";
import "@fontsource/literata/500.css";
import "@fontsource/literata/600.css";
import "@fontsource/literata/700.css";
// Newsreader — display serif: 400/500/600 normal + 400 italic
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
// Source Serif 4 — secondary serif: 400/600 normal + 400 italic
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
// Hanken Grotesk — UI sans: 400/500/600/700 normal
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
// IBM Plex Mono — monospace: 400/500 normal
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
// Design-system stylesheets (tokens first — app.css consumes the vars)
import "./styles/tokens.css";
import "./styles/app.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
