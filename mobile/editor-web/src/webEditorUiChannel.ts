import {
  classifyUiSequence, EDITOR_UI_VERSION, type EditorSelectionState,
  type EditorUiAck, type NativeEditorUiMessage, serializeEditorUiMessage,
} from "../../src/features/editor/editorUiProtocol";

export class WebEditorUiChannel {
  private sceneId: string | null = null;
  private handler: ((message: NativeEditorUiMessage) => void) | null = null;
  private nextNativeSeq = 1;
  private nextWebSeq = 1;
  private inFlightSelection: number | null = null;
  private pendingSelection: EditorSelectionState | null = null;

  constructor(private readonly sessionId: string, private readonly postRaw: (raw: string) => void) {}

  setScene(sceneId: string): void { this.sceneId = sceneId; }

  bind(handler: (message: NativeEditorUiMessage) => void): () => void {
    this.handler = handler;
    return () => { if (this.handler === handler) this.handler = null; };
  }

  report(selection: EditorSelectionState): void {
    this.pendingSelection = selection;
    this.sendPendingSelection();
  }

  receive(message: NativeEditorUiMessage): void {
    if (message.type === "editor-ui-ack") {
      this.receiveSelectionAck(message);
      return;
    }
    if (!this.sceneId) return;
    const verdict = classifyUiSequence(message, {
      sessionId: this.sessionId, sceneId: this.sceneId, seq: this.nextNativeSeq,
    });
    if (verdict === "replay") this.postAck(message);
    if (verdict !== "accept") return;
    this.nextNativeSeq += 1;
    this.handler?.(message);
    this.postAck(message);
  }

  destroy(): void {
    this.handler = null;
    this.pendingSelection = null;
    this.inFlightSelection = null;
  }

  private postAck(message: Exclude<NativeEditorUiMessage, EditorUiAck>): void {
    this.postRaw(serializeEditorUiMessage({
      v: EDITOR_UI_VERSION, type: "editor-ui-ack", sessionId: this.sessionId,
      sceneId: message.sceneId, seq: message.seq,
      ackType: message.type === "editor-theme" ? "theme" : "command",
    }));
  }

  private sendPendingSelection(): void {
    if (!this.pendingSelection || this.inFlightSelection !== null || !this.sceneId) return;
    const selection = this.pendingSelection;
    this.pendingSelection = null;
    const seq = this.nextWebSeq;
    this.nextWebSeq += 1;
    this.inFlightSelection = seq;
    this.postRaw(serializeEditorUiMessage({
      v: EDITOR_UI_VERSION, type: "selection-state", sessionId: this.sessionId,
      sceneId: this.sceneId, seq, ...selection,
    }));
  }

  private receiveSelectionAck(message: EditorUiAck): void {
    if (message.ackType !== "selection" || message.sessionId !== this.sessionId) return;
    if (message.sceneId !== this.sceneId || message.seq !== this.inFlightSelection) return;
    this.inFlightSelection = null;
    this.sendPendingSelection();
  }
}
