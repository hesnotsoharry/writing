import {
  type NavigationAction, useNavigation,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef } from "react";

import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { LiveSceneFlushResult } from "../../shared/engine";
import type { MobileLiveScenePort } from "../../sync/mobileLiveScenePort";
import { canNavigateAfterFlush } from "./sceneEditorState";

type SceneNavigation = NativeStackNavigationProp<RootStackParamList, "Scene">;

interface ExitGuardOptions {
  enabled: boolean;
  port: MobileLiveScenePort;
  onSaving(): void;
  onResult(result: LiveSceneFlushResult): void;
}

interface BeforeRemoveEvent {
  data: { action: NavigationAction };
  preventDefault(): void;
}

const DIRTY_UNAVAILABLE: LiveSceneFlushResult = {
  status: "unavailable", pendingLocal: true,
};

export function useSceneExitGuard(options: ExitGuardOptions) {
  const navigation = useNavigation<SceneNavigation>();
  const { enabled, onResult, onSaving, port } = options;
  const pendingAction = useRef<NavigationAction | null>(null);
  const closing = useRef(false);
  const bypass = useRef(false);

  const attemptExit = useCallback(async () => {
    if (closing.current || !pendingAction.current) return;
    closing.current = true;
    onSaving();
    let result: LiveSceneFlushResult = DIRTY_UNAVAILABLE;
    try { result = await port.close(); } catch { /* Keep dirty routes mounted. */ }
    closing.current = false;
    onResult(result);
    if (!canNavigateAfterFlush(result) || !pendingAction.current) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    bypass.current = true;
    navigation.dispatch(action);
    bypass.current = false;
  }, [navigation, onResult, onSaving, port]);

  useEffect(() => navigation.addListener("beforeRemove", (event: BeforeRemoveEvent) => {
    if (!enabled || bypass.current) return;
    event.preventDefault();
    pendingAction.current = event.data.action;
    void attemptExit();
  }), [attemptExit, enabled, navigation]);

  const stay = useCallback(() => { pendingAction.current = null; }, []);
  return { retry: attemptExit, stay };
}
