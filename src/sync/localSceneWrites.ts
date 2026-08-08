const listeners = new Set<(sceneId: string) => void>();

export function subscribeLocalSceneWrites(
  listener: (sceneId: string) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocalSceneWrite(sceneId: string): void {
  listeners.forEach((listener) => listener(sceneId));
}
