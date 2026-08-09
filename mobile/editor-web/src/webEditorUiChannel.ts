import {
  classifyUiSequence, EDITOR_UI_VERSION, type EditorAutoLinkTapState, type EditorSelectionState,
  type EditorUiAck, type NativeEditorUiMessage, serializeEditorUiMessage,
} from "../../src/features/editor/editorUiProtocol";

export class WebEditorUiChannel {
  private sceneId: string | null = null;
  private handler: ((message: NativeEditorUiMessage) => void) | null = null;
  private pendingNative: Exclude<NativeEditorUiMessage, EditorUiAck>[] = [];
  private nextNativeSeq = 1;
  private nextWebSeq = 1;
  private inFlightWeb: { seq: number; ackType: "selection" | "autolink" } | null = null;
  private pendingSelection: EditorSelectionState | null = null;
  private pendingAutoLink: EditorAutoLinkTapState | null = null;

  constructor(private readonly sessionId: string, private readonly postRaw: (raw: string) => void) {}

  setScene(sceneId: string): void { this.sceneId = sceneId; }

  bind(handler: (message: NativeEditorUiMessage) => void): () => void {
    this.handler = handler;
    const pending = this.pendingNative;
    this.pendingNative = [];
    for (const message of pending) handler(message);
    return () => { if (this.handler === handler) this.handler = null; };
  }

  report(selection: EditorSelectionState): void {
    this.pendingSelection = selection;
    this.sendPendingWebEvent();
  }

  reportAutoLinkTap(tap: EditorAutoLinkTapState): void {
    this.pendingAutoLink = tap;
    this.sendPendingWebEvent();
  }

  receive(message: NativeEditorUiMessage): void {
    if (message.type === "editor-ui-ack") {
      this.receiveWebAck(message);
      return;
    }
    if (!this.sceneId) return;
    const verdict = classifyUiSequence(message, {
      sessionId: this.sessionId, sceneId: this.sceneId, seq: this.nextNativeSeq,
    });
    if (verdict === "replay") this.postAck(message);
    if (verdict !== "accept") return;
    this.nextNativeSeq += 1;
    if (this.handler) this.handler(message);
    else this.pendingNative.push(message);
    this.postAck(message);
  }

  destroy(): void {
    this.handler = null;
    this.pendingNative = [];
    this.pendingSelection = null;
    this.inFlightWeb = null;
    this.pendingAutoLink = null;
  }

  private postAck(message: Exclude<NativeEditorUiMessage, EditorUiAck>): void {
    this.postRaw(serializeEditorUiMessage({
      v: EDITOR_UI_VERSION, type: "editor-ui-ack", sessionId: this.sessionId,
      sceneId: message.sceneId, seq: message.seq,
      ackType: message.type === "editor-theme" ? "theme"
        : message.type === "editor-focus" ? "focus" : "command",
    }));
  }

  private sendPendingWebEvent(): void {
    if (this.inFlightWeb || !this.sceneId) return;
    const event = this.pendingAutoLink ?? this.pendingSelection;
    if (!event) return;
    const isAutoLink = this.pendingAutoLink !== null;
    if (isAutoLink) this.pendingAutoLink = null;
    else this.pendingSelection = null;
    const seq = this.nextWebSeq;
    this.nextWebSeq += 1;
    this.inFlightWeb = { seq, ackType: isAutoLink ? "autolink" : "selection" };
    const envelope = { v: EDITOR_UI_VERSION, sessionId: this.sessionId,
      sceneId: this.sceneId, seq } as const;
    this.postRaw(serializeEditorUiMessage(isAutoLink
      ? { ...envelope, type: "auto-link-tap", ...event as EditorAutoLinkTapState }
      : { ...envelope, type: "selection-state", ...event as EditorSelectionState }));
  }

  private receiveWebAck(message: EditorUiAck): void {
    if (!this.inFlightWeb || message.sessionId !== this.sessionId) return;
    if (message.sceneId !== this.sceneId || message.seq !== this.inFlightWeb.seq) return;
    if (message.ackType !== this.inFlightWeb.ackType) return;
    this.inFlightWeb = null;
    this.sendPendingWebEvent();
  }
}
