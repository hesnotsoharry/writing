import * as Y from "yjs";

import type { MobileQuickNote } from "../../db/mobileQuickNoteStore";
import { encodeDoc } from "../../shared/serialize";

export type SwipeState = "idle" | "dragging" | "committing" | "archived";
export type SwipeEvent = "start" | "cancel" | "open" | "success" | "failure";

export function reduceSwipe(state: SwipeState, event: SwipeEvent): SwipeState {
  const transitions: Partial<Record<`${SwipeState}:${SwipeEvent}`, SwipeState>> = {
    "idle:start": "dragging", "dragging:cancel": "idle", "dragging:open": "committing",
    "committing:success": "archived", "committing:failure": "idle",
  };
  return transitions[`${state}:${event}`] ?? state;
}

export function formatNoteWhen(createdAt: number, now = Date.now()): string {
  const minutes = Math.floor((now - createdAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(createdAt).toLocaleDateString(undefined, { weekday: "long" });
  return new Date(createdAt).toLocaleDateString();
}

export function provenance(note: MobileQuickNote, now = Date.now()): string {
  const when = formatNoteWhen(note.created_at, now);
  return note.source ? `${when} · ${note.source}` : when;
}

export const promotionKey = (noteId: string): string => `quick-note:${noteId}`;

export function noteBodyToSceneDoc(body: string): string {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("content");
  for (const line of body.split("\n")) {
    const paragraph = new Y.XmlElement("paragraph");
    const textNode = new Y.XmlText();
    textNode.insert(0, line);
    paragraph.insert(0, [textNode]);
    fragment.push([paragraph]);
  }
  return encodeDoc(doc);
}

export interface PromotionDeps {
  findSceneByKey(key: string): Promise<string | null>;
  createScene(input: { projectId: string; title: string; idempotencyKey: string }): Promise<string>;
  sceneDocExists(sceneId: string): Promise<boolean>;
  saveSceneDoc(sceneId: string, stateBase64: string, plaintext: string): Promise<void>;
  publishScene(sceneId: string): Promise<void>;
  markFiled(noteId: string): Promise<void>;
  syncAfterSave(sceneId: string): Promise<void>;
}

export async function promoteNote(
  deps: PromotionDeps,
  note: Pick<MobileQuickNote, "id" | "body" | "project_id">,
  stateBase64: string,
): Promise<string> {
  const key = promotionKey(note.id);
  const existing = await deps.findSceneByKey(key);
  if (existing) {
    if (!await deps.sceneDocExists(existing)) {
      await deps.saveSceneDoc(existing, stateBase64, note.body);
    }
    await deps.publishScene(existing);
    await deps.markFiled(note.id);
    await deps.syncAfterSave(existing);
    return existing;
  }
  const sceneId = await deps.createScene({ projectId: note.project_id, title: "Untitled", idempotencyKey: key });
  await deps.saveSceneDoc(sceneId, stateBase64, note.body);
  await deps.publishScene(sceneId);
  await deps.markFiled(note.id);
  await deps.syncAfterSave(sceneId);
  return sceneId;
}
