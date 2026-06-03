---
vendor: "@fontsource/*"
sdkVersion: "@fontsource v5"
firstWritten: 2026-06-03
lastVerified: 2026-06-03
relatedPaths:
  - src/styles/tokens.css
  - src/main.tsx
notes: "Static vs. variable package distinction; font-family name registration and hardcoded token conflicts"
---

# @fontsource gotchas

## 2026-06-03 — Static vs. variable packages register different font-family names; variable suffix breaks hardcoded tokens.css

Source: wave-4-design-system-foundation, commit 158f78e

**Gotcha:** @fontsource ships dual package tracks for each font family: static (`@fontsource/literata`) and variable (`@fontsource-variable/literata`). The two register DIFFERENT `font-family` names in their `@font-face` rules. Static packages register the bare family name (e.g., `'Literata'`, `'Hanken Grotesk'`). Variable packages register the name with a `Variable` suffix appended (e.g., `'Literata Variable'`, `'Hanken Grotesk Variable'`). If your design's tokens.css hardcodes unqualified family names (e.g., `font-family: 'Literata'`), and you switch to variable packages thinking it's just a bundle-size optimization, the hardcoded names won't resolve at runtime — the fonts load but the CSS token rules don't match the registered family names.

**Workaround:** When adopting @fontsource, choose the package track (static vs. variable) BEFORE finalizing token definitions. If tokens.css is already hardcoded with bare names and must stay verbatim (e.g., a design-system adopt constraint), use static packages and import only the exact weights the design specifies. If you start with variable, update the token definitions to use the `Variable`-suffixed names, or add `@supports (font-variation-settings: normal)` rules to conditionally override with variable names on capable platforms.

**Why:** Variable packages bundle all weight variations in a single file and support runtime weight adjustment via `font-variation-settings`, so they save bytes in a bundled desktop app. Static packages (one weight per import) are heavier per typeface but use canonical unmodified family names. The bundle-size win from variable is real (~35–50 KB per typeface vs. ~100 KB for 4 static weights), but switching packages means renaming fonts in CSS — there is no "upgrade path" that keeps the token names unchanged. This wave chose static to maintain a verbatim byte-identical copy of the design's tokens.css; Wave 2+ may revisit if bundle size becomes a concern.

