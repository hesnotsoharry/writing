const FOCUS_KEEP_AWAKE_TAG = "writersnook-focus";
interface KeepAwakePort {
  activateKeepAwakeAsync(tag?: string): Promise<void>;
  deactivateKeepAwake(tag?: string): Promise<void>;
}

export function setFocusKeepAwake(
  enabled: boolean, port?: KeepAwakePort,
): Promise<void> {
  if (port) return togglePort(enabled, port);
  return import("expo-keep-awake").then((loaded) => togglePort(enabled, loaded));
}

function togglePort(enabled: boolean, port: KeepAwakePort): Promise<void> {
  return enabled ? port.activateKeepAwakeAsync(FOCUS_KEEP_AWAKE_TAG)
    : port.deactivateKeepAwake(FOCUS_KEEP_AWAKE_TAG);
}
