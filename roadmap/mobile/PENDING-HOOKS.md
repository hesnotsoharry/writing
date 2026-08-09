---
project: writing
scope: wiring each phase asked for but did not own
updated: 2026-08-08
---

# Pending wiring hooks

## AI conversation consent surface — blocked by UI ownership

Both registries default AI conversation sync to off, and the desktop settings
event / mobile setter update the registry immediately. No shipped settings UI
currently writes `syncAiConversations`, however, and the P2e brief explicitly
forbids UI changes. A settings-owner phase must surface the control and call
`setMobileAiConversationsSyncEnabled` on mobile.
