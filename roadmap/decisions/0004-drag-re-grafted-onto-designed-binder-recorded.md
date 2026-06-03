---
id: 0004
title: Drag re-grafted onto designed binder (recorded for the Binder wave)
status: ACTIVE
decided-in: wave-4
promoted-during: wave-4
date: 2026-06-03
---

## Context

The existing binder uses `@dnd-kit` (multi-container, custom collision detection); the designed `binder.jsx` has no drag logic.

## Pick

In the Binder port wave, graft the existing `@dnd-kit` logic onto the designed markup — no native-DnD rewrite.

## Rationale

The existing drag is sophisticated and working; rewriting it risks regressions and is an unwise coupling of markup migration + drag re-implementation in a single wave.

## Consequences

The Binder port (wave-6) is the highest-risk screen port; budget time for the graft and test it thoroughly. The @dnd-kit contract (hooks, handlers, data shapes) must stay intact while the rendered elements change.

## Enforcement

advisory-only (recorded here; enforced in the Binder port wave).
