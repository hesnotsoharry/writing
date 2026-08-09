import {
  classifyUiSequence,
  EDITOR_UI_VERSION,
  type EditorCommandName,
  type EditorSelectionMessage,
  type EditorUiAck,
  type EntityLinkPayload,
  type NativeEditorUiMessage,
  parseWebEditorUiMessage,
  serializeEditorUiMessage,
} from "./editorUiProtocol";

interface EditorUiTransport { postMessage(message: string): void }
interface QueuedMessage { message: Exclude<NativeEditorUiMessage, EditorUiAck>; raw: string }

export class NativeEditorUiController {
  private sessionId: string | null = null;
  private nextNativeSeq = 1;
  private nextWebSeq = 1;
  private inFlight: QueuedMessage | null = null;
  private queue: QueuedMessage[] = [];

  constructor(
    private readonly sceneId: string,
    private readonly transport: EditorUiTransport,
    private readonly onSelection: (selection: EditorSelectionMessage) => void,
  ) {}

  start(sessionId: string, colors: Record<string, string>): void {
    this.sessionId = sessionId;
    this.nextNativeSeq = 1;
    this.nextWebSeq = 1;
    this.inFlight = null;
    this.queue = [];
    this.enqueue({ type: "editor-theme", colors });
  }

  command(command: EditorCommandName, entity?: EntityLinkPayload): void {
    this.enqueue({ type: "editor-command", command, ...(entity ? { entity } : {}) });
  }

  receive(raw: string): boolean {
    const message = parseWebEditorUiMessage(raw);
    if (!message || !this.sessionId) return false;
    if (message.type === "editor-ui-ack") this.receiveAck(message);
    else this.receiveSelection(message);
    return true;
  }

  private enqueue(input: { type: "editor-theme"; colors: Record<string, string> }
    | { type: "editor-command"; command: EditorCommandName; entity?: EntityLinkPayload }): void {
    if (!this.sessionId) return;
    const message = {
      v: EDITOR_UI_VERSION, sessionId: this.sessionId, sceneId: this.sceneId,
      seq: this.nextNativeSeq, ...input,
    } as Exclude<NativeEditorUiMessage, EditorUiAck>;
    this.nextNativeSeq += 1;
    this.queue.push({ message, raw: serializeEditorUiMessage(message) });
    this.drain();
  }

  private drain(): void {
    if (this.inFlight || this.queue.length === 0) return;
    this.inFlight = this.queue.shift() ?? null;
    if (this.inFlight) this.transport.postMessage(this.inFlight.raw);
  }

  private receiveAck(ack: EditorUiAck): void {
    if (!this.inFlight || ack.sessionId !== this.sessionId || ack.sceneId !== this.sceneId) return;
    if (ack.seq !== this.inFlight.message.seq) return;
    const type = this.inFlight.message.type === "editor-theme" ? "theme" : "command";
    if (ack.ackType !== type) return;
    this.inFlight = null;
    this.drain();
  }

  private receiveSelection(selection: EditorSelectionMessage): void {
    if (!this.sessionId) return;
    const expected = { sessionId: this.sessionId, sceneId: this.sceneId, seq: this.nextWebSeq };
    const verdict = classifyUiSequence(selection, expected);
    if (verdict === "accept") {
      this.nextWebSeq += 1;
      this.onSelection(selection);
    }
    if (verdict === "accept" || verdict === "replay") this.ackSelection(selection.seq);
  }

  private ackSelection(seq: number): void {
    if (!this.sessionId) return;
    this.transport.postMessage(serializeEditorUiMessage({
      v: EDITOR_UI_VERSION, type: "editor-ui-ack", sessionId: this.sessionId,
      sceneId: this.sceneId, seq, ackType: "selection",
    }));
  }
}
