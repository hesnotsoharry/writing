---
id: 0002
title: Window frame (recorded for next wave)
status: ACTIVE
decided-in: wave-4
promoted-during: wave-4
date: 2026-06-03
---

## Context

The design ships a full custom title bar with its own window controls; the shell wave must implement the frame wiring.

## Pick

Custom frame — Tauri `decorations: false`, controls via `@tauri-apps/api`.

## Rationale

Matches the design exactly; the seamless title bar is core to the "Quiet Study" look.

## Consequences

Next wave owns window drag/min/max/close wiring.

## Enforcement

advisory-only (recorded here; implemented and enforced in the shell wave).
