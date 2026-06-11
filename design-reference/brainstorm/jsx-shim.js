// jsx-shim.js — guarantees @xyflow/react's compiled JSX uses the SAME React
// instance as the rest of the app (the importmap "react"). esm.sh's own
// react/jsx-runtime can bundle a second React copy, which silently breaks
// React Flow's node-measurement effects (nodes stay hidden, no edges, no
// fitView). Routing jsx-runtime + jsx-dev-runtime through this shim removes
// that second copy.
import { createElement, Fragment } from "react";

function jsx(type, props, key) {
  const { children, ...rest } = props || {};
  if (key !== undefined) rest.key = key;
  return createElement(type, rest, children);
}

// jsxs handles multiple children (already an array in `children`)
export { Fragment, jsx, jsx as jsxs, jsx as jsxDEV };
