// react-dom-window-shim.js — re-exports the UMD global window.ReactDOM as an ES
// module so @xyflow/react's `react-dom` imports (createPortal, flushSync) bind
// to the same ReactDOM the app uses.
const ReactDOM = window.ReactDOM;
export default ReactDOM;
export const {
  createPortal, flushSync, render, unmountComponentAtNode,
  unstable_batchedUpdates, createRoot, hydrateRoot, version,
} = ReactDOM;
