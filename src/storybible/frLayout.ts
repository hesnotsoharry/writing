/**
 * Fruchterman–Reingold force-directed layout for the Relationship Map.
 * Pure functions — no React, no d3. Ported faithfully from design-reference/relmap.jsx.
 * Bundled param objects keep every function within max-params: 4.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type Vec2 = { x: number; y: number };
type Pos = Vec2[];

export interface ExZone { x: number; y: number; }

/** Layout bounds + exclusion zone, bundled to respect max-params: 4. */
export interface LayoutConfig { W: number; H: number; ex: ExZone; }

/** Minimal node shape consumed by layout helpers. Entity is structurally compatible. */
export interface LayoutNode { id: string; name: string; }

/** Minimal edge shape. EdgeDef is structurally compatible. */
export interface LayoutEdge { a: string; b: string; }

interface LabelCtx {
  p: Record<string, Vec2>;
  radii: Record<string, number>;
  lw: Record<string, number>;
  W: number;
  H: number;
}

// ── Force helpers ──────────────────────────────────────────────────────────────

function frApplyRepulsion(P: Pos, disp: Pos, n: number, k: number): void {
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = Math.hypot(dx, dy) || 0.01;
      const f = k * k / d, ux = dx / d, uy = dy / d;
      disp[i].x += ux * f; disp[i].y += uy * f; disp[j].x -= ux * f; disp[j].y -= uy * f;
    }
  }
}

function frApplyAttraction(P: Pos, disp: Pos, adj: [number, number][], k: number): void {
  adj.forEach(([a, b]) => {
    const dx = P[a].x - P[b].x, dy = P[a].y - P[b].y, d = Math.hypot(dx, dy) || 0.01;
    const f = d * d / k, ux = dx / d, uy = dy / d;
    disp[a].x -= ux * f; disp[a].y -= uy * f; disp[b].x += ux * f; disp[b].y += uy * f;
  });
}

function frApplyDisp(P: Pos, disp: Pos, n: number, temp: number): void {
  for (let i = 0; i < n; i++) {
    const dl = Math.hypot(disp[i].x, disp[i].y) || 0.01, m = Math.min(dl, temp);
    P[i].x += (disp[i].x / dl) * m; P[i].y += (disp[i].y / dl) * m;
  }
}

/** Push overlapping pair apart by (minD-d)/2. Returns true when they were overlapping. */
function frPush(P: Pos, i: number, j: number, minD: number): boolean {
  const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, d = Math.hypot(dx, dy) || 0.01;
  if (d >= minD) return false;
  const push = (minD - d) / 2, ux = dx / d, uy = dy / d;
  P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push;
  return true;
}

function frCollide(P: Pos, R: number[], passes: number, pad: number): void {
  const n = P.length;
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) frPush(P, i, j, R[i] + R[j] + pad);
    }
  }
}

function frClampAndExclude(P: Pos, R: number[], cfg: LayoutConfig): void {
  const { W, H, ex } = cfg;
  for (let i = 0; i < P.length; i++) {
    P[i].x = Math.max(R[i] + 52, Math.min(W - R[i] - 52, P[i].x));
    P[i].y = Math.max(R[i] + 26, Math.min(H - R[i] - 44, P[i].y));
    if (P[i].x < ex.x + R[i] && P[i].y > H - ex.y - R[i]) {
      if ((ex.x + R[i]) - P[i].x < P[i].y - (H - ex.y - R[i])) P[i].x = ex.x + R[i];
      else P[i].y = H - ex.y - R[i];
    }
  }
}

function reCheckExclusion(
  p: Record<string, Vec2>, nodes: LayoutNode[],
  radii: Record<string, number>, cfg: LayoutConfig,
): void {
  const { H, ex } = cfg;
  for (const nd of nodes) {
    const q = p[nd.id], r = radii[nd.id];
    if (q.x < ex.x + r && q.y > H - ex.y - r) {
      if ((ex.x + r) - q.x < q.y - (H - ex.y - r)) q.x = ex.x + r;
      else q.y = H - ex.y - r;
    }
  }
}

function frFinalSeparate(P: Pos, R: number[], cfg: LayoutConfig): void {
  const n = P.length;
  for (let pass = 0; pass < 80; pass++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) { moved += frPush(P, i, j, R[i] + R[j] + 26.5) ? 1 : 0; }
    }
    frClampAndExclude(P, R, cfg);
    if (!moved) break;
  }
}

// ── Label de-clash ─────────────────────────────────────────────────────────────

function declashPair(ctx: LabelCtx, ida: string, idb: string): boolean {
  const { p, radii, lw, W, H } = ctx;
  const A = p[ida], B = p[idb];
  if (!A || !B) return false;
  const dy = Math.abs((A.y + radii[ida]) - (B.y + radii[idb]));
  const need = (lw[ida] + lw[idb]) / 2 + 6, dx = B.x - A.x;
  if (dy >= 26 || Math.abs(dx) >= need) return false;
  const total = need - Math.abs(dx) + 1, sg = dx >= 0 ? 1 : -1;
  const roomA = sg > 0 ? A.x - radii[ida] - 52 : W - radii[ida] - 52 - A.x;
  const roomB = sg > 0 ? W - radii[idb] - 52 - B.x : B.x - radii[idb] - 52;
  let pb = Math.min(total / 2, Math.max(0, roomB));
  const pa = Math.min(total - pb, Math.max(0, roomA));
  pb = Math.min(total - pa, Math.max(0, roomB));
  A.x -= sg * pa; B.x += sg * pb;
  if (pa + pb < total - 1) { const low = A.y >= B.y ? A : B; low.y = Math.min(H - 44, low.y + (26 - dy) + 2); }
  return true;
}

/**
 * Post-layout label de-clash: separates italic name labels sharing a horizontal band.
 * Mutates `p` in place. Must be called after frLayout.
 */
export function declashLabels(
  p: Record<string, Vec2>, nodes: LayoutNode[],
  radii: Record<string, number>, cfg: LayoutConfig,
): void {
  const lw: Record<string, number> = {};
  nodes.forEach(nd => { lw[nd.id] = nd.name.length * 6.8 + 12; });
  const ctx: LabelCtx = { p, radii, lw, W: cfg.W, H: cfg.H };
  for (let pass = 0; pass < 60; pass++) {
    let moved = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        moved += declashPair(ctx, nodes[i].id, nodes[j].id) ? 1 : 0;
      }
    }
    if (!moved) break;
  }
  reCheckExclusion(p, nodes, radii, cfg);
}

// ── Main entry point ───────────────────────────────────────────────────────────

/**
 * Deterministic Fruchterman–Reingold layout with hard collision resolution.
 * Pure — no randomness, no continuous simulation. Runs once; the caller memoizes.
 */
export function frLayout(
  nodes: LayoutNode[], edges: LayoutEdge[],
  radii: Record<string, number>, cfg: LayoutConfig,
): Record<string, Vec2> {
  if (!nodes.length) return {};
  const { W, H } = cfg;
  const n = nodes.length;
  const idx: Record<string, number> = {};
  nodes.forEach((nd, i) => { idx[nd.id] = i; });
  const R = nodes.map(nd => radii[nd.id] ?? 16);
  const P: Pos = nodes.map((_, i) => ({
    x: W / 2 + (Math.min(W, H) / 3) * Math.cos(2 * Math.PI * i / n),
    y: H / 2 + (Math.min(W, H) / 3) * Math.sin(2 * Math.PI * i / n),
  }));
  const adj: [number, number][] = [];
  for (const e of edges) {
    if (e.a in idx && e.b in idx) adj.push([idx[e.a], idx[e.b]]);
  }
  const k = Math.sqrt((W * H) / n) * 0.62;
  let temp = W / 6;
  for (let it = 0; it < 360; it++) {
    const disp: Pos = P.map(() => ({ x: 0, y: 0 }));
    frApplyRepulsion(P, disp, n, k);
    frApplyAttraction(P, disp, adj, k);
    for (let i = 0; i < n; i++) { disp[i].x += (W / 2 - P[i].x) * 0.012; disp[i].y += (H / 2 - P[i].y) * 0.012; }
    frApplyDisp(P, disp, n, temp);
    frCollide(P, R, 2, 18);
    frClampAndExclude(P, R, cfg);
    temp *= 0.978;
  }
  frFinalSeparate(P, R, cfg);
  const pos: Record<string, Vec2> = {};
  nodes.forEach((nd, i) => { pos[nd.id] = P[i]; });
  return pos;
}
