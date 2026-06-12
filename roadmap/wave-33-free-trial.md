---
status: PLANNED
created: 2026-06-11
---

# Wave 33: free-trial

## Plan

### Status

PLANNED · target v0.5.0 · drafted 2026-06-11 · shape ratified by Cole 2026-06-11 (local-only 14-day trial, full app, no backend changes)

### Goal

A fresh install with no license key opens straight into the full app under a 14-day trial instead of hitting the activation wall. The license gate becomes three-state (activated / trial / needed), the trial clock lives in the same SQLite `app_meta` table as the activation record (new key, no migration), a small "X days left" pill in the StatusBar links to the activation screen, and an expired trial lands on the existing `ActivationGate` with trial-ended copy. Setting the system clock backwards does not extend the trial (monotonic `lastSeenAt` clamp). Activated users see zero change.

### Scope

**In scope:**

- `src/features/license/trial.ts` (NEW) — pure trial-status logic: `computeTrialStatus(record, now)` → `{ state: 'active' | 'expired', daysLeft }`, 14-day constant, clock-rollback clamp.
- `src/features/license/trial.store.ts` (NEW) — read/write `TrialRecord` `{ trialStartedAt: string, lastSeenAt: string }` under `app_meta` key `"trial"`, mirroring `license.store.ts` (low-level db-handle functions + `getDb()`-bound wrappers, JSON round-trip, `INSERT OR REPLACE`).
- `src/features/license/license.gate.ts` — `useLicenseGate` grows the third state: no license → load-or-start trial → `gateStatus: 'trial'` (with `daysLeft`) or `'needed'` (expired); update `lastSeenAt` on boot.
- `src/App.tsx:316–319` — render the app during `'trial'`; pass trial-expired flag to `ActivationGate` when `'needed'` arose from expiry.
- `src/features/license/ActivationGate.tsx` — optional trial-mode props: `trialExpired` (copy variant) and `onDismiss` ("Continue trial" back link, shown only while trial is active).
- `src/shell/StatusBar.tsx` (`sb-right` section) — trial pill ("X days left"), pattern-matched to the existing backup-status element; click opens the activation screen; hidden when activated.
- Tests beside the existing license tests in `src/test/` (same mock seams: `stubDb()` for stores, `vi.mock` feature-boundary mocks for the gate/components).

**Out of scope:**

- Server-issued trials / Lemon Squeezy changes / marketing backend — deliberately rejected; deferral path: revisit only if trial-reset abuse is ever observed in the wild.
- Post-activation license re-validation (refund revocation) — pre-existing gap noted in wave-30 exploration; deferral path: future wave if refund abuse appears.
- Feature-limiting during trial — rejected by design (full app, time-boxed).
- Anti-tamper beyond the clock clamp (e.g. hidden duplicate trial markers outside the DB) — the manuscripts-live-in-the-same-DB deterrent is judged sufficient; deferral path: same as server trials.
- Marketing-site copy changes ("14-day free trial" on writersnook.app) — separate, Cole-owned content pass after the feature ships.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Trial store + status logic (`trial.ts`, `trial.store.ts`) | haiku-implementer | pyramid · cross-boundary (persistent storage) · Pure logic + KV store mirroring `license.store.ts`. Contract: `TrialRecord {trialStartedAt, lastSeenAt}` ISO strings under key `"trial"`; `computeTrialStatus` clamps effective-now to `max(now, lastSeenAt)`, `daysLeft = ceil((start+14d − effNow)/86400000)`, expired when ≤ 0. Orchestrator authors the acceptance test first (pre-impl oracle). | Internal — no observation point (wired in Phase 2). |
| 2 | Three-state gate + App wiring | sonnet-implementer | trophy · internal-only · `useLicenseGate`: license record wins outright; else load trial → start one if absent (write `trialStartedAt = lastSeenAt = now`) → `'trial'` + daysLeft, or `'needed'` + `trialExpired`. Update `lastSeenAt = max(now, lastSeenAt)` every boot. App.tsx renders app on `'trial'`. DEV bypass behavior unchanged. | Fresh dev launch with empty DB opens the binder/editor (no activation wall); CDP-backdating `trialStartedAt` 15 days and relaunching shows the ActivationGate instead. |
| 3 | Trial pill + trial-mode ActivationGate copy | sonnet-implementer | trophy · internal-only · StatusBar pill in `sb-right` ("X days left", click → activation screen), hidden when activated. ActivationGate: `trialExpired` copy variant ("Your 14-day trial has ended…") and `onDismiss` "Continue trial" link (trial-active entry only — full-screen takeover stays, no modal rework). Activation success during trial clears pill + gate via existing `onActivated` path. | Pill reading "14 days left" visible in StatusBar on a fresh-trial launch; clicking it opens the activation screen with a "Continue trial" link that returns to the editor; backdated-expired launch shows trial-ended copy with no dismiss link. |

Walking-skeleton rule: not triggered — no new architectural surface (existing SQLite KV table, existing gate hook, existing shell components).

Wave verification strategy (Site 4, declared once): runtime trial states are observed via the dev-build CDP port (tauri-devtools MCP, port 9222) by seeding/backdating the `app_meta` trial row, since calendar time can't be fast-forwarded. Phases 2 and 3 run with `smoke: true`; Phase 1 is logic-only (vitest is the oracle there).

### Acceptance criteria

- [ ] Fresh launch, no license record, no trial record → trial record written once; app opens to the full editor; no activation wall.
- [ ] `daysLeft` semantics: brand-new trial shows 14; `daysLeft = ceil((trialStartedAt + 14d − effectiveNow)/86400000)`; trial is expired when ≤ 0.
- [ ] Trial pill renders in StatusBar `sb-right` during an active trial, shows the live day count, and is absent when a license record exists.
- [ ] Clicking the pill opens the activation screen; "Continue trial" returns to the app without altering trial state.
- [ ] Expired trial (backdated `trialStartedAt`) → full-screen ActivationGate with trial-ended copy and no dismiss link; app content unreachable.
- [ ] Clock rollback: with `lastSeenAt` ahead of system time, effective-now clamps to `lastSeenAt` — a backdated system clock does not increase `daysLeft` or un-expire a trial; `lastSeenAt` never moves backwards.
- [ ] Activating during an active trial → gate flips to cleared via existing `onActivated`, pill disappears; license-record presence takes precedence over any trial state on subsequent boots (trial-record deletion optional, precedence mandatory).
- [ ] Activated users (existing installs with an `ActivationRecord`): no trial record is ever created; boot path unchanged.
- [ ] Lint, typecheck, and full vitest suite green at wave end.

### Files the next agent should read first

1. `src/features/license/license.gate.ts` — the gate hook being extended; DEV bypass at :37–42, status flip at :61.
2. `src/features/license/license.store.ts` — the store pattern to mirror exactly (low-level + wrapper split, JSON round-trip, `app_meta` KV).
3. `src/App.tsx` (~:316–319) — gate wiring; the three-state render decision lands here.
4. `src/features/license/ActivationGate.tsx` — full-screen gate getting the copy variant + dismiss link.
5. `src/shell/StatusBar.tsx` (~:69–72, :115–125) — `sb-right` section and the backup-status element the pill pattern-matches.
6. `src/test/ActivationGate.test.tsx` + `src/test/licenseStore.acceptance.test.ts` — the established mock seams (`vi.mock` feature boundary; `stubDb()`).

### Note to the implementer

This wave converts the activation wall into a trial funnel — the spirit is "let writers live in the app for two weeks." Resist: adding feature limits, adding migrations (`app_meta` is KV — a new key needs none, and prior-migration tests break when migrations are appended), reworking ActivationGate into a modal (full-screen with a back link is the design), and touching anything under `marketing/`. License-record presence always wins — the trial path must be unreachable for activated users. First step: verify the `## Locked decisions` section has decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

**Known gap:** existing *unactivated* installs (someone who installed but never bought) will start a fresh 14-day trial on next update — accepted; that cohort is effectively empty today (only known installs are activated).

## Locked decisions

### Decision 1: Local-only trial (no server issuance)

**Context:** Trial trust model — local clock vs server-issued trial keys.
**Pick:** Local-only: trial record in the app's own SQLite DB.
**Rationale:** Trial clock shares the DB with the user's manuscripts — wiping it to reset the trial deletes their writing, an unusually strong natural deterrent. Server trials add issuance/validation endpoints + offline handling against a threat that doesn't exist for this product. Cole ratified 2026-06-11.
**Consequences:** A determined user with a SQLite editor can reset the trial; accepted.
**Enforcement:** none (convention)
durable: candidate

### Decision 2: Trial state as a new `app_meta` key, no migration

**Context:** Where the trial record persists.  **Pick:** `app_meta` key `"trial"`, JSON value `{trialStartedAt, lastSeenAt}`, mirroring the `"license"` key pattern.  **Rationale:** KV table — no schema change; appending migrations breaks prior migration tests (project memory, 2026-06).  **Enforcement:** advisory-only

### Decision 3: Clock-rollback clamp via monotonic `lastSeenAt`

**Context:** Cheap hardening against extending the trial by setting the clock back.  **Pick:** Persist `lastSeenAt = max(now, lastSeenAt)` each boot; trial math uses `effectiveNow = max(now, lastSeenAt)`.  **Rationale:** Few lines, no new storage surface, defeats the only trivial bypass.  **Enforcement:** Phase 1 acceptance test (clock-rollback case)

### Decision 4: Pill in StatusBar; ActivationGate stays full-screen

**Context:** Where the trial surfaces in the UI.  **Pick:** Day-count pill in StatusBar `sb-right` (pattern: backup-status element); pill click opens the existing full-screen ActivationGate with a "Continue trial" back link — no modal variant.  **Rationale:** sb-right already hosts persistent status; full-screen reuse avoids layout surgery on a component designed as an exclusive takeover.  **Enforcement:** advisory-only

> Before any decision is written here it must pass the decision-review cell (`~/.claude/rules/best-practice-spectrum.md`, M-42 P2): `sonnet-architect` produces it, a `sonnet-adversarial-reviewer` with `Posture: attack-decision` clears it, the orchestrator adjudicates — THEN it is appended. The `adversarial_review_enforce.mjs` hook denies the edit otherwise; trivial decisions skip via the `review-tier-{session_id}.json` sidecar. (Decisions above were Cole-ratified in-session or trivial in-pattern picks — no architect dispatch occurred.)

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 0 (oracle) | 2026-06-11 (orchestrator + haiku-test-author) | 2026-06-11 | e870b22 | Internal — oracle confirmed failing for the right reason (13/14 "not implemented") |
| 1 | 2026-06-11 · run-phase `wf_6279ff85-963` | 2026-06-11 · gates green · reviewer PASS (4/4 angles) | 3877c22 | Internal — no observation point (oracle: 14/14 pass) |
| 2 (oracle) | 2026-06-11 (orchestrator + haiku-test-author) | 2026-06-11 | a743a3c | Internal — oracle confirmed failing for the right reason (10/12 pre-impl) |
| 2 | 2026-06-11 · run-phase `wf_8f07c851-71b` | 2026-06-11 · oracle 12/12 · reviewer FLAG adjudicated (setup.ts shim accepted) | 683130b | Deferred to Phase 3 smoke (gates were red on pre-existing test debt at smoke time; fixed in ffc1132) |
| 2b (inline fix) | 2026-06-11 (sonnet-implementer) | 2026-06-11 | ffc1132 | Internal — stale ActivationGate tests aligned to shipped UUID validation (15/15) |
| 3 (oracle) | 2026-06-11 (orchestrator + haiku-test-author) | 2026-06-11 | 60912f9 | Internal — oracle failing for the right reason (5/10 pre-impl) |
| 3 | 2026-06-11 · run-phase `wf_e1fa24b1-f1c` | 2026-06-11 · oracle 10/10 · reviewer FLAG_UNCERTAIN adjudicated (cosmetic) | 49ec20a | HIT — Cole-authorized DB-swap smoke via CDP (2026-06-11): fresh DB → app opens on trial, pill "14 days left" in StatusBar; pill click → full-screen gate with "Continue trial" → returns to app; backdated trial → "Your 14-day free trial has ended." with no dismiss; restored real DB (hash-verified) → no pill, no gate, app_meta keys = ["license"] only. Full suite 1251/1251. |

## Follow-up candidates

<!-- DEFAULT: empty. Tier-3 triple gate (VALUE with present-harm: pointer AND STRUCTURAL AND CLEARABILITY) required to stage anything here. -->

## Result

### Mechanical review

**Inputs resolved:**
- Plan: roadmap/wave-33-free-trial.md
- Diff range: c146c84..9b4b036 (9 commits)
- Graph: healthy (traces via wave-end reviewer's graph queries + grep)
- Run timestamp: 2026-06-11T23:35:00-06:00

#### Check 1: Forward-trace
- Change sites traced: 11 (computeTrialStatus, TRIAL_DURATION_DAYS, read/writeTrialRecord, load/saveTrial, resolveGate, useLicenseGate daysLeft/trialExpired fields, renderTrialPill, GateHead/GateDismiss, StatusBarProps/AppContentProps new fields)
- Paths reaching production consumer: 11 (chain: trial.ts → trial.store → resolveGate → useLicenseGate → App → AppContent/StatusBar + ActivationGate render; graph-verified single production call chain, no forks)
- Paths flagged as dead: 0. No silent drops — daysLeft and trialExpired both consumed at App (StatusBar pill / ActivationGate copy).

#### Check 2: Plan universal-quantifier cross-reference
- Universals found in plan: 6 ("Activated users see zero change", "no trial record is ever created" (activated), "license-record presence takes precedence ... on subsequent boots", "lastSeenAt never moves backwards", "license-key form stays present in every variant", "trial path unreachable for activated users")
- Universals where diff covers all instances: 6 (trialGate case 2 + clamp tests + oracle case 10 + runtime smoke: restored real DB → app_meta keys ["license"] only, no pill)
- Universals flagged as narrowed: 0

#### Check 3: Export audit
- New exports added: 10 (trial.ts ×5, trial.store.ts ×4, LicenseGateResult)
- Exports with production consumers: 10 (license.gate.ts imports computeTrialStatus/TRIAL_DURATION_DAYS/loadTrial/saveTrial; trial.store imports TrialRecord; write/readTrialRecord consumed by same-file wrappers on the production path — exact license.store.ts pattern, exported for db-handle testability)
- Exports flagged as dead: 0

#### Check 4: Schema-removal migration safety
Check 4 skipped: no schema property removals in this wave's diff (additive app_meta KV key only).

#### Check 5: Boundary-phase orchestrator-owned acceptance test verification
- Trigger: fired (Phase 1 declared cross-boundary, persistent storage)
- Cross-boundary phases declared: 1; valid: 1
- Acceptance file `src/test/trial.acceptance.test.ts`: created e870b22 (orchestrator, own commit, pre-impl) → phase-1 impl 3877c22 never touched it. Post-phase modifications 11565fe (orchestrator lint-fix) and 9b4b036 (orchestrator-added NaN-guard case from wave-end review) are orchestrator-authored and additive — the failing-first contract for the implementing phase was never broken.
- Run evidence: Status table — pre-impl 13/14 failing for the right reason; post-impl 14/14; post-NaN-guard 15/15; full suite 1251/1251.

#### Check 6: Test theater detection via mutation score
Check 6 skipped: no stryker.config found in project root (and no mutation:test script). Non-fatal flag (new test files without mutation testing) — justified: all three wave oracles were validated failing-first (red pre-impl for the stated reason, green post-impl), which is direct evidence they assert behavior, not tautology.

#### Verdict

**FLAG — all flags addressed.** Checks 1–3 ran clean (zero dead paths, zero narrowed universals, zero dead exports). Check 5's two post-phase acceptance-file modifications are orchestrator-authored and justified above; Check 6's no-Stryker flag is justified by failing-first oracle validation. Proceeds to wrap.

### Delivered

14-day local-first free trial before license activation, shipped as v0.5.0. Fresh installs boot into the full app on a 14-day trial (`app_meta` "trial" record, no migration); the gate is three-state (cleared / trial / needed) with license-record precedence; a StatusBar pill ("N days left") opens the activation screen with a "Continue trial" dismiss; expired trials hit the full-screen gate with trial-ended copy; clock rollback is clamped via monotonic `lastSeenAt`; hand-edited garbage dates read as no-record (NaN guard from wave-end review). All states verified at runtime via Cole-authorized DB-swap CDP smoke; activated users verified unchanged against the restored real DB. Wave-end adversarial review FLAG fixed (9b4b036); mechanical review FLAG-addressed. Promoted: `roadmap/decisions/local-only-trial-no-server-issuance.md`. Known repo gap (not a qualified follow-up): no `.claude/smoke-config.json`, so run-phase auto-smoke reports CANNOT-LAUNCH — this wave smoked manually via tauri-devtools CDP.

### Telemetry summary

Wave session IDs: 8f43485c-0ac0-43f6-b8ee-b80d42d4430f
Window: 2026-06-11 (single session)

| Surface | Events in wave | Notes |
|---|---|---|
| hook | ~1,060 (pre/post_tool_use 852; graph_vs_grep 59; meta_boundary 54; others) | no HABITUATED/DEAD-LETTER flags surfaced in-wave |
| agent | 75 dispatches (workflow-subagent 20, haiku-explorer 14, haiku-test-author 9, sonnet-adversarial-reviewer 8, sonnet-implementer 8, gate-runner 6, smoke-runner 2, explorers 2) + 3 phase_review_outcome records (PASS/FLAG/FLAG) | no ADJUST verdicts |
| command | run-phase ×3 | — |
| rule | 9 distinct rules loaded ×1 | thin data |
| skill | wave-plan-lite ×1, review ×1 | thin data |
| adr | 0 | thin data |

**Flagged items:** none

Auto-filled via: `mcp__telemetry__query({ session_id: '8f43485c-…', aggregate: 'count_by_name', since: '24h' })`
