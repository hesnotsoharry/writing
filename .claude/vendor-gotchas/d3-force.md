---
vendor: "d3-force"
sdkVersion: "4.x"
firstWritten: 2026-06-05
lastVerified: 2026-06-05
relatedPaths:
  - src/storybible/RelationshipMap.tsx
notes: "D3 force simulation for graph layout in relationship map view; static pre-computed layout (no live animation)."
---

# d3-force gotchas

## 2026-06-05 — d3-force: forceSimulation is a stateful engine; call .stop() before ticking if you want deterministic results

Source: wave-27, commit fe27e3b

**Gotcha:** `forceSimulation()` starts in a running state. If you call `.tick()` without `.stop()` first, the simulation's tick count persists across calls, making layout non-deterministic (the forces continue from where they left off). For a pre-computed static layout (render once, no animation), call `.stop()` immediately after creation, then tick a fixed number of times (e.g., 300) to settle the layout.

**Workaround:** In `buildLayout()`, create the simulation, call `.stop()` immediately, then loop `.tick()` N times (typically 200–300 iterations). The `stop()` call ensures the simulation does not continue evolving after your loop exits. Clamp node positions to the viewport bounds after ticking to prevent nodes from escaping.

**Why:** d3-force was designed for live animated layouts (continuous `.on("tick")` updates). When used for static pre-computation, the default running state can produce layout flickering or jitter if the component re-renders during simulation. Calling `.stop()` freezes the simulation state so you can extract final positions deterministically.

Related: collision detection via `forceCollide()` requires radius hints; ensure `nodeRadius()` is consistent between the force's radius function and the rendering code (mismatches cause overlaps that visual inspection might not catch in unit tests).

