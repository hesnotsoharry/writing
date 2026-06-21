---
id: 0003
title: tokens.css + app.css adopted verbatim
status: ACTIVE
decided-in: wave-4
promoted-during: wave-4
date: 2026-06-03
---

## Context

The app has no design system; the design supplies one via production-ready stylesheets.

## Pick

Copy `tokens.css` + `app.css` byte-identical into `src/styles/`; existing inline styles migrate per-screen in later waves.

## Rationale

Nothing competes with the incoming system (current styling is ad-hoc inline literals), so verbatim adoption is lowest-risk and keeps the design as single source of truth.

## Consequences

Existing screens coexist on inline styles until their port wave; minor global resets from `app.css` are acceptable. Every screen-port wave (6–9) will inherit these tokens as the baseline design surface.

## Enforcement

acceptance criterion (byte-identical check) + Phase 1 gates + adversarial review on verbatim integrity.
