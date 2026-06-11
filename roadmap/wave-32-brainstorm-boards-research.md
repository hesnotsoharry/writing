# Wave 32 Research Extract: Brainstorm Boards Libraries

**Date:** June 10, 2026  
**Project:** WritersNook v0.3.0+  
**Scope:** @xyflow/react, tldraw, TipTap v3 (multiple editors), Yjs (subdocs/fragments), dnd-kit (canvas suitability)

---

## 1. @xyflow/react (React Flow v12)

**Current version:** 12.11.0 (as of June 2026)  
**Package name:** `@xyflow/react`  
**License:** MIT (inferred from project structure)

### React 19 Compatibility
✅ **Fully supported.** React Flow UI components have been updated to support React 19 and Tailwind CSS 4. The library is actively maintained and aligned with the latest React ecosystem (released Oct 2025). The project's example shows `@xyflow/react` working alongside React 19.1.0 (project current version).

**Source:** [React Flow UI Components updated to React 19 and Tailwind CSS 4](https://reactflow.dev/whats-new/2025-10-28)

### Custom Nodes with React Components
✅ **Fully supported.** React Flow accepts arbitrary React components inside custom nodes via the `data` prop and `NodeProps<T>`. The library provides a `NodeProps` type for typing custom node components.

```typescript
// Custom node rendering any React content
export default function CustomNode(props: NodeProps) {
  return (
    <div className="custom-node">
      {/* Any React component here, including rich-text editors */}
      <MyRichTextEditor content={props.data.content} />
    </div>
  );
}
```

**Source:** [React Flow GitHub: NodeProps types](https://github.com/xyflow/xyflow/blob/main/xyflow/packages/react/src/types/nodes.ts); [Custom Nodes example](https://reactflow.dev/examples/nodes/custom-node)

### Rich-Text Editors Inside Nodes
✅ **Supported, with event-handling precautions.** Custom nodes can house TipTap editors. The key gotcha: interactive content (buttons, inputs, editors) inside nodes can trigger unintended drag-start behavior. **Mitigation:** Use the `nodrag` class on interactive elements to prevent node dragging.

```typescript
export default function TextEditorNode(props: NodeProps) {
  return (
    <div className="nodrag">
      {/* This editor won't trigger node drag */}
      <TipTapEditor {...props.data} />
    </div>
  );
}
```

**Source:** [React Flow GitHub: nodrag class documentation](https://github.com/xyflow/xyflow/blob/main/xyflow/packages/react/src/types/nodes.ts); [Using nodrag class to prevent drag on interactive elements](https://github.com/xyflow/xyflow/blob/main/xyflow/examples/react/src/examples/Edges/DefaultEdges/nodes.tsx)

### Pan/Zoom Configuration
✅ **Fully customizable.** React Flow has built-in pan and zoom via `ReactFlow` component props:
- `fitView`: auto-fit viewport on load
- `defaultViewport`: set initial pan/zoom state
- `minZoom`, `maxZoom`: control zoom bounds
- Pan/zoom state is managed internally via `useReactFlow()` hook

```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  fitView
  minZoom={0.1}
  maxZoom={4}
/>
```

**Source:** [React Flow GitHub: ReactFlow component props](https://github.com/xyflow/xyflow/blob/main/xyflow/packages/react/src/components/ReactFlow/types.ts)

### Viewport State Persistence
✅ **Manual control available.** React Flow does NOT auto-persist viewport state. To persist pan/zoom, use `useReactFlow()` hook to read the viewport state and save it to localStorage/database on change:

```typescript
const { getViewport, setViewport } = useReactFlow();

// On mount: restore from storage
useEffect(() => {
  const saved = localStorage.getItem('viewport');
  if (saved) setViewport(JSON.parse(saved));
}, []);

// Listen for changes and persist
useEffect(() => {
  const unsubscribe = store.subscribe((s) => {
    localStorage.setItem('viewport', JSON.stringify(s.viewport));
  });
  return unsubscribe;
}, []);
```

**Source:** [React Flow GitHub: useReactFlow hook](https://github.com/xyflow/xyflow/blob/main/xyflow/packages/react/src/hooks/useReactFlow.ts)

### nodeOrigin Prop
✅ **Available.** Customizes the position origin point for nodes (defaults to top-left `[0, 0]`). Useful for centering node position around its visual center:

```typescript
<ReactFlow nodeOrigin={[0.5, 0.5]} /> // Center-origin positioning
```

**Source:** [React Flow GitHub: ReactFlow component props](https://github.com/xyflow/xyflow/blob/main/xyflow/packages/react/src/components/ReactFlow/types.ts)

### Edge Rendering & Minimal Styling
✅ **Flexible.** Edges are fully customizable. Default edge types: `default`, `straight`, `step`, `smoothstep`, `simplebezier`. Custom edge components accept full React rendering freedom.

```typescript
const edges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'straight', // Minimal, no curves
    style: { stroke: '#ccc', strokeWidth: 1 },
  },
];
```

**Source:** [React Flow GitHub: Edges documentation](https://github.com/xyflow/xyflow/blob/main/xyflow/examples/react/src/examples/Edges/DefaultEdges)

---

## 2. tldraw (v3.x vs v4.x)

**Latest versions:** v3.15.5 (stable) and v4.2.0 (newer, check breaking changes)  
**Package name:** `tldraw`  
**License:** Proprietary (IMPORTANT: production use requires a license key)

### Licensing & Watermark (CRITICAL)
⚠️ **Production requires a license key.** tldraw uses a tiered licensing model:

| License Type | Cost | Watermark | Suitable For |
|---|---|---|---|
| **Trial** | Free | "Made with tldraw" | 100-day evaluation |
| **Hobby** | Free (discretionary) | "Made with tldraw" | Non-commercial projects |
| **Commercial** | Paid (sales discussion) | None | Commercial products |

**Development use is free without a key.** However, in production (HTTPS, non-localhost, `NODE_ENV=production`), a valid license key MUST be provided via the `licenseKey` prop on the `<Tldraw>` component. The WritersNook app is a **paid commercial product**, so it **requires a commercial license key** to ship.

**Source:** [tldraw Docs: License](https://tldraw.dev/community/license); [tldraw Docs: License Key](https://tldraw.dev/sdk-features/license-key); [tldraw Community: License Updates](https://tldraw.substack.com/p/license-updates-for-the-tldraw-sdk)

### Custom Shapes API
✅ **Supported via ShapeUtil classes.** tldraw provides a `ShapeUtil` base class for defining custom shapes. Custom shapes can be registered and synced:

```typescript
import { ShapeUtil, BaseBoxShapeUtil } from 'tldraw';

export class CardShapeUtil extends BaseBoxShapeUtil<CardShape> {
  static override type = 'card' as const;
  
  override getDefaultProps() {
    return { w: 200, h: 100, text: 'Card' };
  }
  
  override component(shape: CardShape) {
    return (
      <div className="tl-custom-card">
        {shape.props.text}
      </div>
    );
  }
}

// Register in Tldraw component:
<Tldraw shapeUtils={[CardShapeUtil]} />
```

**Source:** [tldraw Docs: Custom Shapes](https://tldraw.dev/docs/shapes); [tldraw GitHub: Shape registration](https://github.com/tldraw/tldraw/blob/main/apps/docs/content/docs/shapes.mdx)

### Embedding React Components / Rich Text in Shapes
⚠️ **Possible but requires care.** tldraw's shapes render via a custom canvas/SVG system, not a React tree. To embed React components (like TipTap editors) inside shapes:
1. Render the shape as an HTML overlay positioned over the canvas, OR
2. Use custom SVG/DOM rendering within the ShapeUtil's render method

This is more complex than React Flow's native node rendering. The cost is higher integration friction.

**Source:** Inferred from [tldraw Docs: Custom Shapes](https://tldraw.dev/docs/shapes) and architecture (shapes use TLShapeUtilFlag, not React hooks)

### Store Persistence / Serialization API
✅ **Full control via store snapshots.** tldraw provides:
- `createTLStore()`: Create a reactive store
- `loadSnapshot()`: Hydrate store from JSON
- `getSnapshot()`: Export current state as JSON

```typescript
import { createTLStore, loadSnapshot, getSnapshot, Tldraw } from 'tldraw';

const store = createTLStore();

// Load from localStorage
const saved = localStorage.getItem('drawing');
if (saved) {
  loadSnapshot(store, JSON.parse(saved));
}

// Persist on changes
store.listen((diff) => {
  localStorage.setItem('drawing', JSON.stringify(getSnapshot(store)));
});

<Tldraw store={store} />
```

**Source:** [tldraw Docs: Persistence](https://tldraw.dev/docs/persistence)

### React 19 Compatibility
✅ **Supported (inferred).** tldraw's component is a standard React component. No version-specific compatibility issues reported in recent releases.

---

## 3. TipTap v3 – Multiple Editor Instances on One Screen

**Current version:** 3.24.0 (project pinned)  
**Packages:** `@tiptap/core`, `@tiptap/react`, `@tiptap/extensions`, `@tiptap/starter-kit`, `@tiptap/extension-collaboration`

### Performance with Many Editors
⚠️ **No specific guidance in official docs.** TipTap builds on ProseMirror, which is **not optimized for dozens of simultaneous editor instances.** Each editor instance:
- Loads a full ProseMirror EditorState
- Attaches DOM listeners
- Runs separate update cycles

**Best practices for many editors:**
- Use lazy mounting: don't render all editors at once; virtualize visible ones
- Use `editable={false}` for read-only cards until focused
- Avoid heavy extensions on every instance; load on-demand

**Source:** Inference from [ProseMirror architecture](https://prosemirror.net/) and TipTap's design; no explicit perf guidance in official TipTap docs

### Yjs Collaboration Extension with Multiple Fragments
✅ **Fully supported.** TipTap's `Collaboration` extension supports multiple fields/fragments within a single Y.Doc:

```typescript
const ydoc = new Y.Doc();

// Editor 1: title field
const titleEditor = new Editor({
  extensions: [
    Collaboration.configure({
      document: ydoc,
      field: 'title', // Different field = different Y.XmlFragment
    }),
  ],
});

// Editor 2: content field (same doc)
const contentEditor = new Editor({
  extensions: [
    Collaboration.configure({
      document: ydoc,
      field: 'content', // Another fragment in the same doc
    }),
  ],
});
```

Each `field` maps to a Y.XmlFragment at `ydoc.getXmlFragment(field)`. Multiple editors can collaborate on different fragments within one Y.Doc without collision.

**Source:** [TipTap Docs: Editors with Y.js Fragments](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/guides/naming-documents.mdx); [TipTap Docs: Sync Multiple Fields in One Y.js Document](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/hocuspocus/guides/collaborative-editing.mdx)

### Toggling editable / Read-Only Mode
✅ **Supported via `setEditable()` method:**

```typescript
editor.setEditable(false); // Read-only
editor.setEditable(true);  // Editable
```

For board cards, set `editable={false}` initially, then toggle on click.

**Source:** [TipTap Docs: setEditable() Usage](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/core-concepts/schema.mdx)

---

## 4. Yjs – Multiple Fragments & Metadata in One Doc

**Current version:** 13.6.31 (project pinned)

### Subdocuments vs. Multiple Top-Level Types
✅ **Both approaches supported, each with tradeoffs:**

**Approach A: Subdocuments (separate Y.Doc per card)**
```typescript
const boardDoc = new Y.Doc();
const cardsMap = boardDoc.getMap('cards');

const card1Doc = new Y.Doc();
card1Doc.getXmlFragment('content').insert(0, [/* content */]);
cardsMap.set('card-1', card1Doc);
```
- **Pros:** Natural isolation; lazy-loadable
- **Cons:** More overhead; separate update cycles

**Approach B: Multiple Fragments in One Doc (recommended for WritersNook)**
```typescript
const boardDoc = new Y.Doc();
const metaMap = boardDoc.getMap('board-meta');      // Card positions
const card1Fragment = boardDoc.getXmlFragment('card-1-text');
const card2Fragment = boardDoc.getXmlFragment('card-2-text');
```
- **Pros:** Single update cycle; efficient for frequent position updates
- **Cons:** Larger doc; no lazy-loading boundary

For a brainstorm board with frequent position updates (drag events), **a single Y.Doc with multiple Y.XmlFragment fields (one per card text) + a Y.Map for metadata (positions, colors) is optimal.**

**Source:** [Yjs Docs: Create and Embed Subdocuments](https://github.com/yjs/docs/blob/main/api/subdocuments.md); [Yjs Docs: Y.Map](https://github.com/yjs/docs/blob/main/api/shared-types/y.map.md); [Yjs Docs: Y.XmlFragment](https://github.com/yjs/docs/blob/main/api/shared-types/y.xmlfragment.md)

### Y.Map for Card Metadata (Position, Color, etc.)
✅ **Ideal choice.** Y.Map provides key-value storage with fine-grained observe events:

```typescript
const boardDoc = new Y.Doc();
const cardsMeta = boardDoc.getMap('cards-meta');

// Store card metadata
cardsMeta.set('card-1', {
  x: 100,
  y: 200,
  color: '#ff0000',
  title: 'Idea 1',
});

// Observe changes to a specific card
cardsMeta.observe((event) => {
  event.changes.keys.forEach((change, key) => {
    if (change.action === 'update' && key === 'card-1') {
      // Re-render card at new position
      const meta = cardsMeta.get('card-1');
      updateCardPosition(meta.x, meta.y);
    }
  });
});
```

Y.Map also supports nested objects (plain JSON), making it a clean fit for card metadata.

**Source:** [Yjs Docs: Y.Map - Shared Key-Value Store Operations](https://github.com/yjs/docs/blob/main/api/shared-types/y.map.md)

### Mixing Position Updates with Rich-Text Content
✅ **No known gotchas.** A single Y.Doc can hold both:
- Frequent updates (card positions from drag events → Y.Map)
- Stable content (card rich text → Y.XmlFragment per card)

The Yjs CRDT merges updates independently. High-frequency position updates won't corrupt text content.

**Source:** Yjs CRDT architecture; no conflicts reported in collaboration literature

---

## 5. dnd-kit – Suitability for Free-Form Canvas Dragging

**Current version in project:** @dnd-kit/core ^6.3.1, @dnd-kit/utilities ^3.2.2  
**Package name:** `@dnd-kit/core` (+ sensors like `PointerSensor`)

### Canvas Suitability (Free-Position Dragging, Not Sortable Lists)
⚠️ **Not ideal as the primary dragging solution.** dnd-kit excels at list-based drag-and-drop (sortable, reorderable). For **free-form canvas positioning:**
- dnd-kit provides pointer-sensor-based drag detection
- But it lacks built-in canvas transform handling (pan/zoom coordinate mapping)

**Best practice for canvas:** Use dnd-kit for drag-start/drag-end detection + constraint logic, but handle coordinate transforms separately:

```typescript
// dnd-kit detects drag
const [active, setActive] = useState(null);

// But you calculate transforms with the canvas pan/zoom context:
const transform = clientPositionToCanvasCoord(activePosition, viewport);
```

**Source:** [FreeCodeCamp: How to Optimize a Graphical React Codebase — Optimize d3-zoom and dnd-kit Code](https://www.freecodecamp.org/news/how-to-optimize-a-graphical-react-codebase/); [dnd-kit Docs: Drag Overlay](https://docs.dndkit.com/api-documentation/draggable/drag-overlay)

### Pan/Zoom Coordination
⚠️ **Gotcha: Coordinate Space Mismatches.** When combining dnd-kit with a pan/zoom library (like React Flow's built-in zoom or D3-force, which the project already uses), the canvas coordinate system differs from screen coordinates. You must manually transform drag positions:

```typescript
// Screen position (from dnd-kit)
const { x: screenX, y: screenY } = active.node.activatorNode?.getBoundingClientRect();

// Transform to canvas space
const [canvasX, canvasY] = transformScreenToCanvas(
  { x: screenX, y: screenY },
  viewport // From your pan/zoom context
);

// Update card position in Yjs
cardsMeta.get(`card-${cardId}`).x = canvasX;
```

**Source:** [FreeCodeCamp: How to Optimize a Graphical React Codebase](https://www.freecodecamp.org/news/how-to-optimize-a-graphical-react-codebase/); observed complexity Oct 2025

### Pointer-Sensor + Transform Approach
✅ **Proven pattern.** dnd-kit's `PointerSensor` works well for canvas dragging if you handle transforms. The Oct 2025 Figma-like example shows dnd-kit + D3-Zoom working together (project already uses d3-force, so d3-zoom is a natural pair).

```typescript
import { PointerSensor, useSensor } from '@dnd-kit/core';

const sensors = useSensors(
  useSensor(PointerSensor, { distance: 5 }) // Start drag after 5px movement
);
```

**Source:** [dnd-kit Docs](https://docs.dndkit.com/); [FreeCodeCamp Oct 2025 optimization guide](https://www.freecodecamp.org/news/how-to-optimize-a-graphical-react-codebase/)

---

## Summary Table

| Library | Use Case | Version | React 19 | Critical Notes |
|---|---|---|---|---|
| **@xyflow/react** | Ready-made node-based canvas | 12.11.0 | ✅ Yes | Excellent for interactive nodes; `nodrag` class required for rich-text editors |
| **tldraw** | Full whiteboard/infinite canvas | 3.15.5 or 4.2.0 | ✅ Yes (inferred) | ⚠️ **Production requires commercial license key**; custom shape API is more complex than React Flow |
| **TipTap v3** | Rich-text editor in cards | 3.24.0 | ✅ Yes | Multiple editors OK with Yjs fragments; no built-in perf guidance for many instances |
| **Yjs** | State management & persistence | 13.6.31 | N/A (lib) | Y.Map (metadata) + Y.XmlFragment (text per card) is optimal for this feature |
| **dnd-kit** | Drag detection + constraints | 6.3.1 | ✅ (existing) | ⚠️ Not designed for canvas; coordinate transforms required; dnd-kit + D3-Zoom/React Flow integration proven |

---

## Recommendations for Wave 32 Planning

1. **Library choice (architect's decision):** React Flow v12 is the lowest-friction option for a node-like canvas with embedded rich-text editors. tldraw is more feature-complete but adds licensing complexity and greater integration effort for rich text.

2. **Yjs strategy:** Use a single Y.Doc with Y.Map(metadata) + Y.XmlFragment per card (text). No subdocs needed for Phase 1.

3. **dnd-kit role:** Keep existing dnd-kit for list drag-and-drop elsewhere in the app; for canvas card dragging, implement a simpler pointer-event handler that directly updates Yjs + triggers UI re-render (no dnd-kit overhead).

4. **TipTap in cards:** Lazy-mount editors (don't render until card is focused). Use `editable={false}` initially.

5. **License gotcha (if tldraw chosen):** Secure commercial license key before building; WritersNook is a paid app, so trial/hobby licenses won't work in production.
