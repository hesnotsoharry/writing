---
id: 0016
title: The mobile binder drawer is button-only; we do not fight the system back gesture
status: ACTIVE
decided-in: mobile build-out (emulator matrix #8)
promoted-during: mobile build-out
---

# Decision 0016: The mobile binder drawer is button-only under gesture navigation

**Context:** The design canon specifies a left-edge swipe to open the binder drawer from
the editor. Device testing on `Medium_Phone_API_36.1` (Android 15, gesture navigation
enabled — the default on every modern Android device) found the app **never receives the
swipe at all**. Under gesture nav the system owns the left and right screen edges for the
back gesture; the touch is consumed before it reaches the WebView or any React Native
gesture handler. This is not a bug in our gesture wiring — there is nothing to fix in our
code, because no event arrives. The drawer opens correctly from the editor header's
hamburger button, which is device-verified working.

The only way to claim the edge is `setSystemGestureExclusionRects` (Android) — telling the
OS to stop handling back within a rectangle we reserve.

**Pick:** Accept **button-only**. Do not add gesture-exclusion rects. The header hamburger
is the drawer's entry point on Android.

**Rationale:** Three reasons, in order of weight.

1. *Taking the back gesture away is user-hostile.* Back is the most-used control on
   Android and it is muscle memory. A writing app that silently breaks it inside the
   editor — the screen where a writer spends nearly all their time — trades a rarely-
   discovered affordance for a constantly-used one. That is a bad trade even if it works
   perfectly.
2. *Material moved away from edge-swipe drawers for exactly this reason.* Since gesture
   navigation became the platform default, the guidance is a visible navigation affordance
   rather than a hidden edge gesture. We would be reintroducing a pattern the platform
   retired, and fighting the OS to do it.
3. *The exclusion rect is fragile.* It is Android-only, height-capped by the system, and
   the OS reserves the right to ignore or reduce it. We would be maintaining a workaround
   whose behaviour is not ours to guarantee, on the app's most important screen.

**Consequences:**
- Matrix #8 is **resolved as accepted behaviour**, not an open defect. The check is
  reworded from "left-edge swipe opens the drawer" to "the drawer opens from the header
  button and the system back gesture is never impaired".
- The design canon's edge-swipe line is superseded on Android. The design-reference spec
  should be read with this decision alongside it.
- The header hamburger carries the whole burden of drawer discoverability, so it must stay
  visible and must not be hidden behind a submenu. It is legitimately hidden in focus mode,
  where the entire chrome is intentionally gone.
- iOS is not covered by this decision. iOS has its own interactive-pop edge behaviour and
  is untested on device; revisit when the iOS leg is run.

**Enforcement:** Matrix #8 in `roadmap/mobile/EMULATOR-MATRIX.md` records the accepted
behaviour and the evidence. If a future session "fixes" the edge swipe by adding exclusion
rects, that reintroduces the rejected trade and should be challenged against this decision.
