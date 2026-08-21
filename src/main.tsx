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
// React Flow — board canvas (import once here; BoardCanvas.tsx uses it)
import "@xyflow/react/dist/style.css";
// Design-system stylesheets (tokens first — app.css consumes the vars)
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/relationships.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { getTweak, setStoredTweak } from "./features/settings/settings.store";
import { installContextMenuGuard } from "./lib/nativeContextMenu";
import { syncEngine } from "./sync/desktopEngine";
import { hasSyncMasterKey } from "./sync/keyStorage";

if (!import.meta.env.DEV) installContextMenuGuard();

// The sync master key is the real opt-in: it only exists after an explicit
// enable-or-join, and turnOff() deletes it. Gate startup on the key alone.
// Gating on the syncExperimental tweak as well let the two diverge — the key
// lives in the machine-wide OS keyring while the tweak is origin-scoped
// localStorage, and dev (localhost:1420) and the installed build are different
// origins. A device configured under one origin then opened under the other
// showed a fully paired Sync panel that was permanently "Offline", with no
// control anywhere that could start the engine (ReadyKey only offers "Show
// pairing string" and "Turn off sync"). Re-assert the tweak so the two cannot
// drift apart again.
void hasSyncMasterKey()
  .then((hasKey) => {
    if (!hasKey) return;
    setStoredTweak("syncExperimental", "on");
    return syncEngine.start(getTweak("syncRelayUrl", ""));
  })
  .catch((error: unknown) => console.error("[sync] startup failed", error));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
