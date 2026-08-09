import type { ShareIntent } from "expo-share-intent";

export interface ShareCaptureDeps {
  latestProjectId(): Promise<string | null>;
  createQuickNote(projectId: string, body: string, source: string): Promise<string>;
}

export function shareIntentBody(intent: ShareIntent): string | null {
  const text = intent.text?.trim();
  if (text) return text;
  const url = intent.webUrl?.trim();
  return url || null;
}

export async function captureShareIntent(
  deps: ShareCaptureDeps, intent: ShareIntent,
): Promise<string | null> {
  const body = shareIntentBody(intent);
  if (!body) return null;
  const projectId = await deps.latestProjectId();
  if (!projectId) return null;
  return deps.createQuickNote(projectId, body, "Share sheet");
}
