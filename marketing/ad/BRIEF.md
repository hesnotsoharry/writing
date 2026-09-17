# WritersNook riso ad — brief

A 16-second vertical ad (9:16) in a risograph-print style, built as ONE self-contained
`index.html`: everything is drawn by code, no images or libraries. Technique inspired by the riso
animation shared on r/ClaudeAI (original concept by Kevin Ngo); the story here is our own.

Lives in `marketing/ad/` — deliberately NOT `marketing/public/` (pushing master deploys that).

## The idea

A blinking text cursor on a blank page calls out with ripples, and stories answer — a lighthouse,
a detective in the rain, a dragon, a ship in a storm. They pile up faster than you can hold them;
they spin away and fade to blue. Then the binder catches them: every idea drops into place as a
card, the cards become a manuscript, and a copy is quietly kept safe. It ends on the name,
hand-lettered, with the caret sitting after it as if it had just been typed.

The spine: an ink caret pinned to the exact centre of the frame, and wobbly ripple rings coming
out of it. Every scene, transition and camera move is organised around it.

## Format

- 1080×1920 (logical 540×960 at scale 2), 16.0 s, time-based.
- 120 BPM grid: 0.25 s and 0.5 s are the base units.
- Keep the caret and all legible content inside the middle ~70% vertically (TikTok/Reels UI
  covers the bottom ~20% and the right edge).
- Ends on a readable end card and holds — platforms loop, so no dissolve at the end.

## Timeline

| Time (s) | Act | What happens |
|---|---|---|
| 0.0–2.0 | I. Blank page | Cream paper, caret blinking on the beat. Two ripples at 0.25 and 1.25 run past the frame edge, tick arcs flicking at the rim. |
| 2.0–3.0 | | A disc opens on the caret holding the first idea (lighthouse, caret = the lamp) and the camera dives through it to full bleed. |
| 3.0–6.5 | II. Stories answer | Hard-cut montage on the grid, accelerating 0.5 → 0.25 s. Breathes once at 4.5: paper + one ripple, the next scene irises open from the caret at 5.0. |
| 6.5–8.5 | III. Scattered | Pull back: the scenes become medallions orbiting the caret, orbits counter-rotating. They drain to single blue ink (the only crossfade) and drift outward, fading — ideas getting lost. |
| 8.5–13.0 | IV. The binder | The drift stops and reverses. Medallions fly back and become index cards on a corkboard (terracotta / green / gold tabs, pins), colour returning; the full board holds a beat (10.0–10.5). The cards fold into a manuscript page landing on the 11.0 beat, lines type on eighth notes to 12.0, the caret at the end of the last line. A gold ripple at 12.0 lifts a copy of the page into a small safe circle; gold tick at 12.6, hold to the cut. |
| 13.0–16.0 | V. The nook | Brand close: the Writers Nook mark (quill + lit doorway) printed around the caret, which ends as the light in the door. Gold lamplight, terracotta rings, a printed page frame, rising motes. "Writers Nook" in Literata (site ink #2a251d), the site-style mono label "A QUIET STUDY FOR YOUR NOVEL", and a terracotta "writersnook.app" pill, all inking up as halftone dots by 14.6; hold. |

Act IV was stretched from 3.0 to 4.5 s (and the close trimmed from 3.5 to 3.0 s) after the first cut felt rushed:
the card plinks, collapse whoosh, typing, save chime and cut whoosh were all inside ~0.6 s.

## Sound

Synthesized in-page (OfflineAudioContext, so deterministic and frame-aligned), muxed into the MP4 as AAC.
F major, 120 BPM: Fmaj9 → Dm9 → Bbmaj9 → Gm9 (darkening, filter closes) → Csus → Am7 → Fmaj9. Ripple
pings, montage arpeggio + kick + cut ticks, a falling glide as ideas scatter, card plinks, typing clicks,
save chime, a bell as the wordmark inks up. A mix-level gain arc keeps Act I and III quiet.

## Scene library (Act II, in order)

lighthouse at night, beam sweeping (caret = lamp) · detective under a streetlamp in the rain
(caret = lamp) · dragon on a ridge against a huge moon (caret = eye) · ringed planet with a small
rocket (caret = planet core) · café table, two cups, steam curls (caret = between the cups) ·
castle tower with one lit window (caret = the window) · tall ship in a storm, lightning (caret =
lantern) · snowy cabin in a pine forest, lit window (caret = window).

Each: one bold subject readable as a silhouette in 0.25 s, strong value contrast, 3–4 inks max,
concentric light/sound/water arcs that rhyme with the ripples where it fits.

## Visual system

- Paper: warm cream `#F4EEE2`, static fibre grain + faint mottling. Never flickers.
- Inks (brand-adapted riso set): Ink/indigo `#2E3192` (caret, lettering), Terracotta `#B25A38`
  (brand accent), Green `#4E7C6B` (brand), Gold `#E0A93B`, Blue `#0078BF` (night, sea, and the
  "forgetting" drain). Multiply overprint; no pure black.
- Halftone: each ink its own layer and screen angle, visible dots (~4 logical px pitch),
  gradients as dot-size ramps, solids at 100%.
- Misregistration: per-scene fixed offsets of 0.5–1.5 logical px; the caret always shows a thin
  terracotta fringe.
- Print texture: static speckle, ink-starved voids, hand wobble on every line. Ripples are never
  perfect circles and have tapered ends.

## Motion vocabulary

Ripple (easeOutCubic, ~0.7 s, thinning), disc reveal (easeOutBack), dive (easeInOutCubic
~0.35 s), hard montage cuts, iris, orbit pull-back, ink drain (the only crossfade), card drop
(easeOutBack with stagger), handwriting by stroke progress. Camera: smooth, no jitter.

## Architecture

- `render(t)` is a pure deterministic function of time; seekable to any frame.
- Seeded PRNG (mulberry32); never `Math.random()` in the render path.
- Timeline = data array of cues `{start, dur, kind, scene, params}`.
- Scenes = registry modules `{id, inks, draw(L, localT, rng)}`.
- Riso compositor: Canvas 2D draws each ink's coverage into its own offscreen canvas; a WebGL2
  fragment shader halftones every layer (per-ink angle + registration offset), multiplies over
  the paper and adds print texture. (Deviation from the original's pure-2D compositor: the shader
  is what keeps 1080×1920 at interactive frame rates.)
- Controls: space play/pause, scrubber with act markers, ←/→ one frame (1/30 s), `?t=` open
  paused at a time, `?ui=0` bare canvas, `?s=` render scale.
- Export: deterministic frame-by-frame MP4 for ad upload (not real-time screen capture).
- Optional muted-by-default WebAudio: soft pad + arpeggio at 120 BPM, a ping per ripple.

## Process

1. Engine: paper, compositor, caret, ripple, disc reveal, timeline, controls — stills first.
2. Act II scenes in batches of 4, each screenshotted at 540×960 and looked at.
3. Acts III–V.
4. Inspection pass: frames every 0.25 s around 2.0, 3.0, 4.5, 6.5, 8.5, 11.5.
5. Export MP4, then the free-first rollout (TikTok / Reels / Shorts + a making-of post, then a
   ~$30–50 boost on the best performer, UTM-tagged links, aim for late October).

Quality bar: fewer excellent scenes beat many mediocre ones — cut Act II scenes before touching
transitions or Acts III–V.
