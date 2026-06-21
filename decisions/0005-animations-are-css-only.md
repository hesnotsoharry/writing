---
id: 0005
title: Animations are CSS-only
status: ACTIVE
decided-in: wave-4
promoted-during: wave-4
date: 2026-06-03
---

## Context

The design's transitions (page-flip, etc.) need an animation approach; multiple JavaScript animation libraries exist (framer-motion, react-spring, etc.).

## Pick

CSS `@keyframes` in `app.css` + a `matchMedia` reduced-motion gate — no animation library.

## Rationale

The design already implements every animation in pure CSS; adding framer-motion / react-spring would be dead weight. The design's animation scope is limited and CSS is sufficient.

## Consequences

No animation dependency enters the tree across all current and future screen ports. All transitions and animations default to CSS rules in the inherited design stylesheet.

## Enforcement

none (convention) — no animation library is added. Code review and dependency scans catch any breach.
