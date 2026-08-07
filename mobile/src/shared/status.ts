// Portable-boundary re-export (see mobile/metro.config.cjs comment + the S4
// blueprint's "small mobile/src/shared/ re-export files" rule): the canonical
// 5-value scene status model lives once in the repo root and mobile imports
// the pure logic unchanged. STATUS_META.dot is a CSS custom-property string
// ("var(--ink-4)") that only means something on the web renderer — mobile UI
// must NOT consume it directly; see mobile/src/theme/palette.ts for the
// RN-native resolved color equivalents.
export { normalizeStatus, STATUS_META, STATUS_ORDER } from "@writersnook/lib/status";
export type { SceneStatus, StatusMeta } from "@writersnook/lib/status";
