/* ============================================================================
   Relationship map overhaul — design canvas assembly.
   Three full directions, then component-level comparisons (node anatomy,
   edge labels, legend, density framing, empty state) and the night theme.
   Depends: design-canvas.jsx, relmap-explore-core.jsx, relmap-explore-boards.jsx.
   ========================================================================== */

function RMPad({ children, dark, center }) {
  return (
    <div data-theme={dark ? "dark" : undefined}
      style={{ position: "absolute", inset: 0, background: "var(--parchment)", padding: 24,
        ...(center ? { display: "grid", placeItems: "center" } : {}) }}>
      {children}
    </div>
  );
}

function RelmapExplorations() {
  return (
    <DesignCanvas>
      <DCSection id="dirs" title="Three directions — same cast, three voices"
        subtitle="All three keep the mechanics (static layout, pan, degree-based sizing, hover-focus, type filter) and pull type colors from the canon --label-* palette: clay characters · moss locations · gold items · plum factions · sea lore. Hover any node — the maps are live. A = refined Quiet Study (dot-grid drafting paper, type ring + serif initial, name pills, label pills, colored chips as legend). B = cartographer's chart (ruled frame, tinted icon nodes with a double ring, italic serif place-names + edge labels with a paper halo, separate map key). C = boldest read (solid type-colored nodes, paper glyphs, type-blended edges, labels on hover only).">
        <DCArtboard id="dir-a" label="A · Pinned to paper — refined Quiet Study" width={908} height={656}>
          <RMPad><RMDirectionBoard dir="A"></RMDirectionBoard></RMPad>
        </DCArtboard>
        <DCArtboard id="dir-b" label="B · Cartographer's key — ink-chart voice" width={908} height={656}>
          <RMPad><RMDirectionBoard dir="B"></RMDirectionBoard></RMPad>
        </DCArtboard>
        <DCArtboard id="dir-c" label="C · Solid type — boldest legibility" width={908} height={656}>
          <RMPad><RMDirectionBoard dir="C"></RMDirectionBoard></RMPad>
        </DCArtboard>
      </DCSection>

      <DCSection id="anatomy" title="Node anatomy — five types · three states"
        subtitle="Top row: the six-type color/shape system on each body (circle = characters; rounded square = everything else — the legend carries the mapping). Bottom row: rest / hovered (ring thickens, +7% scale, shadow lifts) / dimmed (16% opacity when outside a hovered neighbourhood). Node body options across the rows: A = serif initial, B = type icon, C = mix (initials for characters, icons for the rest).">
        <DCArtboard id="ana-a" label="A · paper body, type ring, serif initial" width={908} height={316}>
          <RMPad><RMAnatomyBoard dir="A"></RMAnatomyBoard></RMPad>
        </DCArtboard>
        <DCArtboard id="ana-b" label="B · tinted body, double ring, type icon" width={908} height={316}>
          <RMPad><RMAnatomyBoard dir="B"></RMAnatomyBoard></RMPad>
        </DCArtboard>
        <DCArtboard id="ana-c" label="C · solid body, paper glyph (initial / icon mix)" width={908} height={316}>
          <RMPad><RMAnatomyBoard dir="C"></RMAnatomyBoard></RMPad>
        </DCArtboard>
      </DCSection>

      <DCSection id="edges" title="Edge labels — three treatments"
        subtitle="Edges step up from the 1.4px hairline to 1.8–2.4px quiet connective strokes; the 9px floating gray text becomes one of: a parchment label pill on the curve · italic serif text with a paper halo (chart voice) · pills that appear only on hover (calmest at rest, best for dense casts).">
        <DCArtboard id="edge-pill" label="Label pill on the curve (A)" width={468} height={254}>
          <RMPad><RMEdgeDemo mode="pill"></RMEdgeDemo></RMPad>
        </DCArtboard>
        <DCArtboard id="edge-halo" label="Serif halo text, no pill (B)" width={468} height={254}>
          <RMPad><RMEdgeDemo mode="halo"></RMEdgeDemo></RMPad>
        </DCArtboard>
        <DCArtboard id="edge-hover" label="Hover-only label (C)" width={468} height={254}>
          <RMPad><RMEdgeDemo mode="hover"></RMEdgeDemo></RMPad>
        </DCArtboard>
      </DCSection>

      <DCSection id="legend" title="Legend + filter chips — two ways"
        subtitle="Option 1: the existing filter chips grow a color/shape swatch and become the legend — one control, no extra furniture. Option 2: chips stay plain and a small 'Map key' card sits inside the canvas, bottom-left (reads well when the map is shared or exported).">
        <DCArtboard id="leg-chips" label="Chips as legend (one control)" width={700} height={150}>
          <RMLegendChipsBoard></RMLegendChipsBoard>
        </DCArtboard>
        <DCArtboard id="leg-key" label="Map key card (in-canvas)" width={528} height={350}>
          <RMPad><RMLegendKeyBoard></RMLegendKeyBoard></RMPad>
        </DCArtboard>
      </DCSection>

      <DCSection id="density" title="Density framing — a 3-node cast vs a 30-node one"
        subtitle="Sparse casts stop swimming: the canvas shrinks to a considered size around the graph instead of stretching to fill the view, and a footer line invites the next link. Dense casts get the full canvas, edge labels move to hover, and degree-sizing + hover-focus carry the reading.">
        <DCArtboard id="den-sparse" label="Sparse · 3 nodes, fitted canvas + invitation" width={648} height={486}>
          <RMPad><RMSparseBoard></RMSparseBoard></RMPad>
        </DCArtboard>
        <DCArtboard id="den-dense" label="Dense · 30 nodes, labels on hover" width={1288} height={876}>
          <RMPad><RMDenseBoard></RMDenseBoard></RMPad>
        </DCArtboard>
      </DCSection>

      <DCSection id="empty" title="Empty state"
        subtitle="An inviting first-run moment on the same drafting paper: a ghost sketch of the map-to-be, one sentence of guidance, and the action that fixes it.">
        <DCArtboard id="empty-1" label="No relationships yet" width={740} height={440}>
          <RMEmptyBoard></RMEmptyBoard>
        </DCArtboard>
      </DCSection>

      <DCSection id="night" title="Night theme — all three directions"
        subtitle="Same tokens, warm-dark values: lifted --label-* hues, dark paper, deeper shadows. Nothing is re-specified — the system follows the theme.">
        <DCArtboard id="night-a" label="A · night" width={908} height={656}>
          <RMPad dark={true}><RMDirectionBoard dir="A"></RMDirectionBoard></RMPad>
        </DCArtboard>
        <DCArtboard id="night-b" label="B · night" width={908} height={656}>
          <RMPad dark={true}><RMDirectionBoard dir="B"></RMDirectionBoard></RMPad>
        </DCArtboard>
        <DCArtboard id="night-c" label="C · night" width={908} height={656}>
          <RMPad dark={true}><RMDirectionBoard dir="C"></RMDirectionBoard></RMPad>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<RelmapExplorations></RelmapExplorations>);
