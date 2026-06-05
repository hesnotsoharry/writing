/**
 * AppFocusLayer — mounts the FocusHud when focus mode is active and exposes
 * the focus settings hook to the parent for threading into the editor.
 *
 * Extracted from App.content.tsx to keep that file within the 300-line limit.
 */

import type { HudGoalInfo } from "./FocusHud";
import { FocusHud } from "./FocusHud";
import type { FocusSettingsHook } from "./useFocusSettings";
import { useFocusSettings } from "./useFocusSettings";

export type { FocusSettingsHook, HudGoalInfo };

interface AppFocusLayerProps {
  focusMode: boolean;
  wordCount: number;
  goal: HudGoalInfo;
  goalOn: boolean;
  settingsHook: FocusSettingsHook;
}

export function AppFocusLayer({ focusMode, wordCount, goal, goalOn, settingsHook }: AppFocusLayerProps) {
  if (!focusMode) return null;
  return <FocusHud wordCount={wordCount} goal={goal} goalOn={goalOn} settingsHook={settingsHook} />;
}

export { useFocusSettings };
