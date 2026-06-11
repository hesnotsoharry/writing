// react-window-shim.js — re-exports the UMD global window.React as an ES module
// so @xyflow/react (imported from esm.sh with ?external=react) binds to the
// SAME React instance the app uses. This is the reliable cross-bundler dedup.
const React = window.React;
export default React;
export const {
  Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense,
  cloneElement, createContext, createElement, createRef, forwardRef, isValidElement,
  lazy, memo, startTransition, useCallback, useContext, useDebugValue,
  useDeferredValue, useEffect, useId, useImperativeHandle, useInsertionEffect,
  useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore,
  useTransition, version,
} = React;
