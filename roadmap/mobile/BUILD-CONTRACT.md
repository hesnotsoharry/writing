---
project: writing
scope: mobile full-app build-out from the design handoff
updated: 2026-08-08
---

# Mobile build contract

Every dispatch working on the mobile app build-out reads this file first. It is
the shared contract: where the design lives, what already exists, which
conventions are non-negotiable, and who owns which files.

## The design

Source: `Mobile app feature design/design_handoff_writersnook_mobile/`

| File | Use it for |
|---|---|
| `README.md` | Scope (what comes to mobile, what stays on desktop), interaction rules, token values, type scale. **Read in full before any UI work.** |
| `SCREENS.md` | Per-screen inventory: purpose, layout, key components. |
| `SOURCE-MAP.md` | Which desktop source file grounds each screen. Read the desktop source before modelling a screen's behaviour. |
| `_frames/<slug>.html` | **The design itself**, split one file per screen per theme (74 files). Each is a self-contained 390x844 frame with exact inline styles and inline SVG. `_frames/_index.json` maps label -> slug. |
| `_frames/_narrative.txt` | The designer's prose commentary between frames. |

`_frames/` is generated from `WritersNook Mobile - The Desk.dc.html`; the HTML
canvas remains the authority if they ever disagree.

**The frames are references, not code.** Do not port HTML/CSS. Read them for
layout, spacing, colour, type, copy, and behaviour, then build natively with
React Native primitives.

The bezel, status bar (`9:41`) and home indicator in every frame are
presentation chrome. Build the content area only; use real safe-area insets
from `react-native-safe-area-context`, never the mocks' hardcoded 52px/30px.

## What exists today

The mobile app is the S4/S5 spine: project list, binder browse, an editable
scene editor hosted in a WebView, QR pairing, and a working sync engine.

- `mobile/src/shared/*` — thin re-export shims over desktop modules. The path
  alias `@writersnook/*` -> `../src/*` is declared in `mobile/tsconfig.json`.
  **Reuse desktop logic through this boundary rather than reimplementing it.**
  Add a new shim file when you need a new desktop module; keep shims to
  re-exports only.
- Mobile runs the **same canonical SQLite migrations** as desktop
  (`mobile/src/shared/migrations.ts` -> `@writersnook/db/migrations`), so every
  desktop table already exists on device. Missing pieces are *stores* and
  *sync coverage*, not schema.
- `mobile/src/db/expoDbClient.ts` implements the desktop `DbClient` seam on
  expo-sqlite. Any desktop `sqlite*Store` that takes a `DbClient` is a
  candidate for direct reuse.
- Sync: `mobile/src/sync/mobileEngine.ts` + `mobile/src/db/syncStores/`.
  Protocol v1.2 — see `docs/superpowers/specs/2026-08-06-sync-protocol-v1.md`
  and the S3/S5 sections of `roadmap/HANDOFF.md`.

Recon reports (read the ones relevant to your phase):
- `roadmap/mobile/RECON-data-sync.md` — screen->data matrix, sync gaps, epoch
  and catch-up APIs, AI routing, license.
- `roadmap/mobile/RECON-portability.md` — desktop module classification, icon
  and font port, new dependencies.

## Theme and tokens

`mobile/src/theme/tokens.ts` is the RN port of `src/styles/tokens.css` — light
and dark, label palette and tints, status dots, shadows, spacing, radii.

- **Never hardcode a colour in a screen.** Read it from the theme.
- Note the name shift documented at the top of `tokens.ts`: the design
  handoff's "line" is the token `parchmentEdge`.
- The legacy `mobile/src/theme/palette.ts` is superseded. Migrate call sites to
  the theme as you touch them; do not add new `PALETTE` references.

## Conventions (enforced by the gates)

- ESLint flat config, strict: 40-line functions, complexity 10, max-depth 3,
  `simple-import-sort`, `no-explicit-any: error`. Never weaken a shared config
  to make a check pass — fix the code.
- Run before reporting done, from `mobile/`:
  `npm run lint` · `npm run typecheck` · `npm run test`
  and from the repo root: `npm run lint` · `npx tsc --noEmit` · the touched
  root tests. A phase is not done until these are green.
- Tests: vitest, `mobile/vitest.config.ts`. jsdom cannot validate real RN
  rendering — test **logic** (state machines, selectors, store queries,
  formatters, reducers), not pixels. Extract logic out of components so it is
  testable, in the shape `sceneEditorState.ts` already uses.
- Minimum hit target 44x44 throughout.
- Both themes ship. Any screen you build must render correctly in light and
  dark from day one — the dark frame is in `_frames/<slug>-dark.html`.
- The editor core (`src/editor/`) is additive-only
  (`decisions/0008-editor-frozen-additive-only-ruling.md`). Mobile's editor
  runs that same core inside a WebView; layer around it, do not change it.

## Non-goals (stated in the design, keep them out)

Desktop-only, and the UI must say so where the design says so: compile/export,
replace-across-scenes (search works, bulk replace does not), label and
entity-type *definition* (applying them works), BYOK API-key entry.
Relationship map and brainstorm boards support link editing on mobile; node/card
layout stays desktop-only.

## Phase ownership

Each phase owns an exclusive set of files. Do not edit files owned by another
phase; if you need a change there, state it in your final message instead.

| Phase | Owns |
|---|---|
| P1 Foundation | `mobile/src/components/**`, `mobile/src/App.tsx` (provider wiring only), `mobile/app.json`, `mobile/package.json`, `mobile/babel.config.*`, `mobile/metro.config.cjs` |
| P1b Extractions | `src/**` (the modules named in RECON-portability.md), `mobile/src/shared/**` |
| P2a Sync infra | `src/sync/*.ts`, `src/sync/lww/**`, `src/db/migrations*.ts` + the new sync store files, `mobile/src/db/syncStores/**`, `mobile/src/sync/**`, the protocol spec |
| P2b Bible doc | `src/sync/bible/**`, `mobile/src/db/mobileBible*.ts` |
| P2c LWW domains | `src/sync/lwwDomains/**` and each domain's desktop bridge |
| P2d Mobile stores | `mobile/src/db/mobile*Store.ts` |
| P3 Shell | `mobile/src/navigation/**`, `mobile/src/features/hub/**`, `mobile/src/features/projects/**` |
| P4 Editor | `mobile/src/features/editor/**`, `mobile/src/features/binder/**`, `mobile/editor-web/**` |
| P5 Story Bible | `mobile/src/features/storybible/**` |
| P6 Structure | `mobile/src/features/corkboard/**`, `mobile/src/features/outliner/**`, `mobile/src/features/search/**` |
| P7 Craft | `mobile/src/features/goals/**`, `mobile/src/features/inbox/**`, `mobile/src/features/archive/**`, `mobile/src/features/snapshots/**` |
| P8 AI | `mobile/src/features/ai/**` |
| P9 System | `mobile/src/features/settings/**`, `mobile/src/features/pairing/**`, `mobile/src/features/focus/**`, `mobile/src/features/license/**`, `mobile/src/features/sync/**` |

Shared additions to `mobile/src/components/**` after P1: propose them in your
final message rather than editing the primitive in place, unless the change is
purely additive and you keep every existing prop working.
